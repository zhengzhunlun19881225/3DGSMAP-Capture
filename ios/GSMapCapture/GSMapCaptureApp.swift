import SwiftUI
#if DEBUG
import AVFoundation
import ImageIO
#endif

@main
struct GSMapCaptureApp: App {
    @StateObject private var store = CaptureStore()
    @StateObject private var connection = MobileConnection()

    var body: some Scene {
        WindowGroup {
            #if DEBUG && targetEnvironment(simulator)
            if ProcessInfo.processInfo.arguments.contains("--verify-video-export") {
                VideoExportVerificationView()
            } else {
                normalContent
            }
            #else
            normalContent
            #endif
        }
    }

    @ViewBuilder private var normalContent: some View {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--verify-capture-resolutions") {
                CaptureResolutionVerificationView()
            } else {
                projectList
            }
            #else
            projectList
            #endif
    }

    private var projectList: some View {
            ProjectListView()
                .environmentObject(store)
                .environmentObject(connection)
                .preferredColorScheme(.dark)
    }
}

#if DEBUG
/// Explicitly invoked device integration check. Uses production camera methods,
/// keeps tests outside CaptureStore, removes its own temporary captures, and
/// exports only measured file metadata. Never runs on a normal app launch.
private struct CaptureResolutionVerificationView: View {
    @StateObject private var camera = CameraService()
    @State private var status = "正在验证真实相机输出…"
    @State private var photoURL: URL?
    @State private var videoURL: URL?

    var body: some View {
        ZStack {
            CameraPreview(session: camera.session).ignoresSafeArea()
            Text(status).padding(24).background(.black.opacity(0.8), in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(.white)
        }.task { await verify() }
    }

    @MainActor private func waitUntil(_ condition: () -> Bool) async throws {
        let deadline = Date().addingTimeInterval(25)
        while !condition() {
            if let error = camera.errorMessage { throw failure(error) }
            if Date() > deadline { throw failure("等待真实相机输出超时") }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
    }

    private func failure(_ text: String) -> NSError {
        NSError(domain: "ResolutionVerification", code: 1, userInfo: [NSLocalizedDescriptionKey: text])
    }

    @MainActor private func change(_ selected: CaptureResolution) async throws {
        let success: Bool = await withCheckedContinuation { continuation in
            camera.setResolution(selected) { continuation.resume(returning: $0) }
        }
        guard success, camera.resolution == selected else { throw failure(camera.errorMessage ?? "切换未生效") }
    }

    @MainActor private func verify() async {
        let original = camera.resolution
        var samples: [[String: Any]] = []
        var result: [String: Any] = ["startedAt": ISO8601DateFormatter().string(from: Date()), "version": "0.2.6", "passed": false]
        camera.onPhotoSaved = { photoURL = $0 }
        camera.onVideoSaved = { url, _, _, _, _ in videoURL = url }
        do {
            camera.requestAndConfigure()
            try await waitUntil { camera.isConfigured }
            // Exercise both actual preset transitions and both landscape directions.
            for selected in [CaptureResolution.fullHD, .ultraHD, .fullHD] {
                try await change(selected)
                for angle: CGFloat in [0, 180] {
                    status = "验证 \(selected.title)，方向 \(Int(angle))°"
                    camera.setRotation(angle)
                    photoURL = nil
                    camera.capturePhoto()
                    try await waitUntil { photoURL != nil && !camera.isBusy }
                    guard let url = photoURL else { throw failure("照片未保存") }
                    defer { try? FileManager.default.removeItem(at: url) }
                    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
                          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any],
                          let width = properties[kCGImagePropertyPixelWidth as String] as? Int,
                          let height = properties[kCGImagePropertyPixelHeight as String] as? Int,
                          selected.matches(width: width, height: height) else { throw failure("照片实际尺寸错误") }
                    samples.append(["mode": "photo", "selected": selected.title, "rotation": Int(angle), "width": width, "height": height,
                                    "orientation": properties[kCGImagePropertyOrientation as String] ?? 0,
                                    "bytes": (try Data(contentsOf: url)).count])

                    videoURL = nil
                    camera.toggleVideo()
                    try await waitUntil { camera.isRecording }
                    let rejected: Bool = await withCheckedContinuation { continuation in
                        camera.setResolution(selected == .ultraHD ? .fullHD : .ultraHD) { continuation.resume(returning: !$0) }
                    }
                    guard rejected, camera.resolution == selected else { throw failure("录制中仍可改变分辨率") }
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                    camera.stop()
                    try await waitUntil { videoURL != nil && !camera.isBusy }
                    guard let video = videoURL else { throw failure("视频未保存") }
                    defer { try? FileManager.default.removeItem(at: video) }
                    let asset = AVURLAsset(url: video)
                    guard let track = try await asset.loadTracks(withMediaType: .video).first else { throw failure("视频轨道缺失") }
                    let size = try await track.load(.naturalSize)
                    let transform = try await track.load(.preferredTransform)
                    let bounds = CGRect(origin: .zero, size: size).applying(transform)
                    let videoWidth = Int(abs(bounds.width).rounded()), videoHeight = Int(abs(bounds.height).rounded())
                    let fps = try await track.load(.nominalFrameRate)
                    guard selected.matches(width: videoWidth, height: videoHeight), abs(fps - 30) < 1 else { throw failure("视频尺寸或帧率不符") }
                    samples.append(["mode": "video", "selected": selected.title, "rotation": Int(angle), "width": videoWidth, "height": videoHeight,
                                    "encodedWidth": Int(size.width), "encodedHeight": Int(size.height), "fps": fps,
                                    "duration": try await asset.load(.duration).seconds,
                                    "bytes": (try FileManager.default.attributesOfItem(atPath: video.path)[.size] as? NSNumber)?.intValue ?? 0,
                                    "switchDuringRecordingRejected": rejected])
                }
            }
            try await change(original)
            result["passed"] = true
            status = "验证通过：4K / 1080p 照片和视频"
        } catch {
            result["error"] = error.localizedDescription
            status = "验证失败：\(error.localizedDescription)"
        }
        result["samples"] = samples
        result["finishedAt"] = ISO8601DateFormatter().string(from: Date())
        camera.pauseSession()
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("GSMapCapture")
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
            try data.write(to: directory.appendingPathComponent("resolution-verification.json"), options: .atomic)
        } catch { status += "；验证报告写入失败" }
    }
}
#endif
