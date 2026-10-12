#if DEBUG && targetEnvironment(simulator)
import SwiftUI
import AVFoundation
import Photos
import CryptoKit

/// Simulator-only integration fixture. Uses an isolated store and generated videos;
/// never accesses device captures. The test app needs Photos read permission to
/// read back exported bytes; the shipping app only requests add-only permission.
struct VideoExportVerificationView: View {
    @StateObject private var exporter = VideoLocalExporter()
    @State private var urls: [URL] = []
    @State private var store: CaptureStore?
    @State private var directory: URL?
    @State private var baseline: Data?
    @State private var hashes: [String] = []
    @State private var result = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("视频导出集成测试")
                    VideoLocalExportControls(exporter: exporter, urls: urls)
                    Button("验证副本与原件") { Task { await verify() } }
                        .disabled(exporter.busy || urls.isEmpty)
                    Text(result).accessibilityIdentifier("video.export.verification")
                }.padding()
            }
        }.task { await prepare() }
    }

    @MainActor private func prepare() async {
        do {
            if ProcessInfo.processInfo.arguments.contains("--verify-photos-copy") {
                _ = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
            }
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("VideoExport-\(UUID().uuidString)")
            self.directory = directory
            let store = CaptureStore(directory: directory)
            self.store = store
            let project = store.createProject(name: "Isolated export fixture")
            let sessionId = store.startSession(projectId: project.id, mode: .video)
            for width in [1920, 3840] {
                let url = directory.appendingPathComponent("fixture-\(width).mov")
                try await makeVideo(url: url, width: width)
                guard store.addMedia(sessionId: sessionId, url: url, mode: .video, stage: .middle,
                    duration: 0.2, width: width, height: width * 9 / 16, codec: "h264") else {
                    throw failure("Fixture storage failed")
                }
            }
            urls = store.projects[0].sessions[0].media.map { store.fileURL($0) }
            hashes = try urls.map { SHA256.hash(data: try Data(contentsOf: $0)).description }
            baseline = try Data(contentsOf: directory.appendingPathComponent("projects.json"))
            result = "测试视频已准备：1080p 和 4K"
        } catch { result = "验证失败：\(error.localizedDescription)" }
    }

    @MainActor private func verify() async {
        do {
            guard let directory, let baseline else { throw failure("Fixture not ready") }
            guard try Data(contentsOf: directory.appendingPathComponent("projects.json")) == baseline else {
                throw failure("Project index changed")
            }
            for (index, url) in urls.enumerated() {
                guard try SHA256.hash(data: Data(contentsOf: url)).description == hashes[index] else {
                    throw failure("App original changed or was removed")
                }
            }
            if exporter.status.hasPrefix("已保存") {
                let permission = PHPhotoLibrary.authorizationStatus(for: .readWrite)
                guard permission == .authorized || permission == .limited else {
                    throw failure("Photos read permission: \(permission.rawValue)")
                }
                let assets = PHAsset.fetchAssets(with: .video, options: nil)
                for (index, url) in urls.enumerated() {
                    var resource: PHAssetResource?
                    assets.enumerateObjects { asset, _, stop in
                        if let found = PHAssetResource.assetResources(for: asset).first(where: { $0.originalFilename == url.lastPathComponent }) {
                            resource = found; stop.pointee = true
                        }
                    }
                    guard let resource else { throw failure("Photos copy not found") }
                    let copy = directory.appendingPathComponent("photos-copy-\(index).mov")
                    try? FileManager.default.removeItem(at: copy)
                    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                        PHAssetResourceManager.default().writeData(for: resource, toFile: copy, options: nil) { error in
                            if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                        }
                    }
                    guard try SHA256.hash(data: Data(contentsOf: copy)).description == hashes[index] else {
                        throw failure("Export was transcoded or changed")
                    }
                }
            }
            if !exporter.fileDestinations.isEmpty {
                // The UI test saves to the default local Documents directory. Verify
                // EVERY requested file, even if the provider returns one folder URL.
                let destinationDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                    .appendingPathComponent("视频导出", isDirectory: true)
                for (index, source) in urls.enumerated() {
                    let copy = destinationDirectory.appendingPathComponent(source.lastPathComponent)
                    guard try SHA256.hash(data: Data(contentsOf: copy)).description == hashes[index] else {
                        throw failure("Files copy differs from original")
                    }
                }
            }
            result = "验证通过：原件与项目索引保留" + (exporter.status.hasPrefix("已保存") ? "，相册副本逐字节一致" : "")
                + (exporter.fileDestinations.isEmpty ? "" : "，文件副本逐字节一致")
        } catch { result = "验证失败：\(error.localizedDescription)" }
    }

    private func failure(_ message: String) -> NSError {
        NSError(domain: "VideoExportTest", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private func makeVideo(url: URL, width: Int) async throws {
        let height = width * 9 / 16
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width, AVVideoHeightKey: height])
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input,
            sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
                kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height])
        writer.add(input)
        guard writer.startWriting() else { throw writer.error ?? failure("Writer failed") }
        writer.startSession(atSourceTime: .zero)
        for frame in 0..<2 {
            while !input.isReadyForMoreMediaData {
                if writer.status == .failed { throw writer.error ?? failure("Writer failed") }
                try await Task.sleep(for: .milliseconds(10))
            }
            var buffer: CVPixelBuffer?
            guard let pool = adaptor.pixelBufferPool,
                  CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer) == kCVReturnSuccess,
                  let buffer else { throw failure("Pixel buffer failed") }
            CVPixelBufferLockBaseAddress(buffer, [])
            if let address = CVPixelBufferGetBaseAddress(buffer) {
                memset(address, frame == 0 ? 50 : 100, CVPixelBufferGetDataSize(buffer))
            }
            CVPixelBufferUnlockBaseAddress(buffer, [])
            guard adaptor.append(buffer, withPresentationTime: CMTime(value: Int64(frame), timescale: 10)) else {
                throw writer.error ?? failure("Frame failed")
            }
        }
        writer.endSession(atSourceTime: CMTime(value: 2, timescale: 10))
        input.markAsFinished()
        await writer.finishWriting()
        guard writer.status == .completed else { throw writer.error ?? failure("Video incomplete") }
    }
}
#endif
