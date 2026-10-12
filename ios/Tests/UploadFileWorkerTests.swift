import Foundation
import CryptoKit

@main
struct UploadFileWorkerTests {
    static func hash(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    static func main() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = root.appendingPathComponent("sample.mov")
        let original = Data(repeating: 0x35, count: UploadFileWorker.chunkSize + 13)
        try original.write(to: url)
        let input = UploadInput(id: "asset-tests01", url: url, mode: "video", stage: "middle", capturedAt: 10)
        let worker = UploadFileWorker(cacheURL: root.appendingPathComponent("cache/checksums.json"))
        let manifests = try await worker.manifests([input]) { value in
            assert(value.bytes <= value.total)
            assert(value.files == 1 && value.file == 1)
        }
        let item = manifests[0]
        assert(item.sha256 == hash(original))
        assert(item.size == Int64(original.count) && item.chunkCount == 2)
        let first = try await worker.chunk(item, index: 0)
        let last = try await worker.chunk(item, index: 1)
        assert(first.count == UploadFileWorker.chunkSize && last.count == 13)
        assert(first + last == original)
        assert(item.json["asset_id"] as? String == input.id)
        assert(item.json["chunk_count"] as? Int == 2)

        // A cached digest can be reused without opening the unchanged original.
        try FileManager.default.setAttributes([.posixPermissions: 0o000], ofItemAtPath: url.path)
        do {
            let reopened = UploadFileWorker(cacheURL: root.appendingPathComponent("cache/checksums.json"))
            let cached = try await reopened.manifests([input]) { _ in }
            assert(cached[0].sha256 == item.sha256)
        } catch {
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
            throw error
        }
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)

        let replacement = Data(repeating: 0x73, count: original.count)
        try replacement.write(to: url)
        try FileManager.default.setAttributes([.modificationDate: Date(timeIntervalSinceNow: 10)], ofItemAtPath: url.path)
        do { _ = try await worker.chunk(item, index: 0); fatalError("Changed original was uploaded") }
        catch UploadFileError.changed { }
        let changed = try await worker.manifests([input]) { _ in }
        assert(changed[0].sha256 == hash(replacement) && changed[0].sha256 != item.sha256)
        do { _ = try await worker.chunk(changed[0], index: 2); fatalError("Invalid chunk index accepted") }
        catch UploadFileError.changed { }

        let cancelled = Task {
            withUnsafeCurrentTask { $0?.cancel() }
            return try await worker.manifests([input]) { _ in }
        }
        do { _ = try await cancelled.value; fatalError("Cancelled scan completed") }
        catch is CancellationError { }
        let preserved = try Data(contentsOf: url)
        assert(preserved == replacement)
        print("PASS: SHA-256, chunk boundaries, resume cache, changed-file rejection, invalidation, cancellation, originals preserved")
    }
}
