import Foundation
import CryptoKit

struct UploadInput: Sendable {
    let id: String
    let url: URL
    let mode: String
    let stage: String
    let capturedAt: Double
}

struct UploadManifest: Sendable {
    let input: UploadInput
    let size: Int64
    let sha256: String
    var chunkCount: Int { Int((size + Int64(UploadFileWorker.chunkSize) - 1) / Int64(UploadFileWorker.chunkSize)) }
    var json: [String: Any] {
        ["asset_id": input.id, "name": input.url.lastPathComponent, "mode": input.mode,
         "size": size, "chunk_count": chunkCount, "sha256": sha256,
         "stage": input.stage, "captured_at": input.capturedAt]
    }
}

struct UploadProgress: Sendable {
    let phase: String
    let file: Int
    let files: Int
    let bytes: Int64
    let total: Int64
    var fraction: Double { total > 0 ? min(1, Double(bytes) / Double(total)) : 0 }
}

enum UploadFileError: LocalizedError {
    case changed, invalidSize
    var errorDescription: String? {
        switch self {
        case .changed: "素材在校验后发生变化，已停止上传，请重新校验"
        case .invalidSize: "素材为空或超过单文件 8 GiB 上限"
        }
    }
}

// An actor keeps file I/O and hashing off MainActor. Only one chunk is retained.
actor UploadFileWorker {
    static let chunkSize = 4 * 1024 * 1024
    private struct Fingerprint: Codable, Equatable {
        let filename: String
        let size: Int64
        let modified: Date
        let inode: UInt64
    }
    private struct CachedDigest: Codable {
        let fingerprint: Fingerprint
        let sha256: String
    }
    private let cacheURL: URL
    private var prepared: [String: Fingerprint] = [:]

    init(cacheURL: URL) { self.cacheURL = cacheURL }

    private func fingerprint(_ url: URL) throws -> Fingerprint {
        let info = try FileManager.default.attributesOfItem(atPath: url.path)
        guard let size = (info[.size] as? NSNumber)?.int64Value,
              size > 0, size <= 8 * 1024 * 1024 * 1024,
              let modified = info[.modificationDate] as? Date else { throw UploadFileError.invalidSize }
        return Fingerprint(filename: url.lastPathComponent, size: size, modified: modified,
                           inode: (info[.systemFileNumber] as? NSNumber)?.uint64Value ?? 0)
    }

    func manifests(_ inputs: [UploadInput], progress: @Sendable (UploadProgress) async -> Void) async throws -> [UploadManifest] {
        let fingerprints = try inputs.map { try fingerprint($0.url) }
        let total = fingerprints.reduce(Int64(0)) { $0 + $1.size }
        var cache = (try? JSONDecoder().decode([String: CachedDigest].self, from: Data(contentsOf: cacheURL))) ?? [:]
        var result: [UploadManifest] = []
        var completed: Int64 = 0
        for (index, input) in inputs.enumerated() {
            try Task.checkCancellation()
            let before = fingerprints[index]
            await progress(UploadProgress(phase: "校验", file: index + 1, files: inputs.count, bytes: completed, total: total))
            let digest: String
            if let entry = cache[input.id], entry.fingerprint == before {
                digest = entry.sha256
            } else {
                let handle = try FileHandle(forReadingFrom: input.url)
                defer { try? handle.close() }
                var hasher = SHA256()
                var read: Int64 = 0
                var lastUpdate = ContinuousClock.now
                while true {
                    try Task.checkCancellation()
                    let count = try autoreleasepool {
                        let block = try handle.read(upToCount: Self.chunkSize) ?? Data()
                        hasher.update(data: block)
                        return block.count
                    }
                    if count == 0 { break }
                    read += Int64(count)
                    if lastUpdate.duration(to: .now) >= .milliseconds(250) {
                        await progress(UploadProgress(phase: "校验", file: index + 1, files: inputs.count, bytes: completed + read, total: total))
                        lastUpdate = .now
                    }
                }
                guard read == before.size, try fingerprint(input.url) == before else { throw UploadFileError.changed }
                digest = hasher.finalize().map { String(format: "%02x", $0) }.joined()
                cache[input.id] = CachedDigest(fingerprint: before, sha256: digest)
                // Cache is disposable; never alter originals or the project index.
                try? FileManager.default.createDirectory(at: cacheURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                if let encoded = try? JSONEncoder().encode(cache) { try? encoded.write(to: cacheURL, options: .atomic) }
            }
            prepared[input.id] = before
            result.append(UploadManifest(input: input, size: before.size, sha256: digest))
            completed += before.size
            await progress(UploadProgress(phase: "校验", file: index + 1, files: inputs.count, bytes: completed, total: total))
        }
        try Task.checkCancellation()
        return result
    }

    func chunk(_ manifest: UploadManifest, index: Int) throws -> Data {
        try Task.checkCancellation()
        guard index >= 0, index < manifest.chunkCount,
              let previous = prepared[manifest.input.id], try fingerprint(manifest.input.url) == previous else {
            throw UploadFileError.changed
        }
        return try autoreleasepool {
            let handle = try FileHandle(forReadingFrom: manifest.input.url)
            defer { try? handle.close() }
            let offset = Int64(index) * Int64(Self.chunkSize)
            try handle.seek(toOffset: UInt64(offset))
            let data = try handle.read(upToCount: Self.chunkSize) ?? Data()
            guard data.count == Int(min(Int64(Self.chunkSize), manifest.size - offset)) else { throw UploadFileError.changed }
            return data
        }
    }
}
