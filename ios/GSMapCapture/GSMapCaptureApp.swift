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
            if ProcessInfo.processInfo.arguments.contains("--verify-capture-resolutions") || ProcessInfo.processInfo.arguments.contains("--verify-video-stabilization") || ProcessInfo.processInfo.arguments.contains("--verify-highlight-protection") || ProcessInfo.processInfo.arguments.contains("--verify-highlight-modes") {
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
        }.task {
            if ProcessInfo.processInfo.arguments.contains("--verify-highlight-modes") {
                await verifyHighlightModes()
            } else if ProcessInfo.processInfo.arguments.contains("--verify-video-stabilization") {
                await verifyStabilization()
            } else {
                await verify()
            }
        }
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

    @MainActor private func changeStabilization(_ enabled: Bool) async throws {
        let success: Bool = await withCheckedContinuation { continuation in
            camera.setVideoStabilization(enabled) { continuation.resume(returning: $0) }
        }
        guard success, camera.videoStabilizationEnabled == enabled else { throw failure("防抖开关未应用") }
        try await waitUntil { camera.videoStabilizationActive == enabled }
        guard UserDefaults.standard.bool(forKey: "capture.videoStabilizationEnabled") == enabled else { throw failure("防抖设置未保存") }
    }

    @MainActor private func verifyStabilization() async {
        let originalResolution = camera.resolution
        let originalStabilization = camera.videoStabilizationEnabled
        var samples: [[String: Any]] = []
        var result: [String: Any] = ["version": "0.2.9", "passed": false, "initialEnabled": originalStabilization,
                                     "startedAt": ISO8601DateFormatter().string(from: Date())]
        camera.onVideoSaved = { url, _, _, _, _ in videoURL = url }
        do {
            camera.requestAndConfigure()
            try await waitUntil { camera.isConfigured }
            for selected in [CaptureResolution.fullHD, .ultraHD] {
                try await change(selected)
                guard camera.videoStabilizationAvailable else { throw failure("\(selected.title) 不支持标准防抖") }
                for enabled in [false, true, false] {
                    status = "验证 \(selected.title) 防抖\(enabled ? "开启" : "关闭")"
                    try await changeStabilization(enabled)
                    videoURL = nil
                    camera.toggleVideo()
                    try await waitUntil { camera.isRecording }
                    let rejected: Bool = await withCheckedContinuation { continuation in
                        camera.setVideoStabilization(!enabled) { continuation.resume(returning: !$0) }
                    }
                    guard rejected, camera.videoStabilizationActive == enabled else { throw failure("录制中防抖状态错误") }
                    try await Task.sleep(nanoseconds: 1_000_000_000)
                    camera.stop()
                    try await waitUntil { videoURL != nil && !camera.isBusy }
                    guard let url = videoURL else { throw failure("测试视频未保存") }
                    defer { try? FileManager.default.removeItem(at: url) }
                    let asset = AVURLAsset(url: url)
                    guard let track = try await asset.loadTracks(withMediaType: .video).first else { throw failure("视频轨道缺失") }
                    let size = try await track.load(.naturalSize)
                    let fps = try await track.load(.nominalFrameRate)
                    guard selected.matches(width: Int(size.width), height: Int(size.height)), abs(fps - 30) < 1 else { throw failure("防抖改变了输出档位") }
                    samples.append(["resolution": selected.title, "enabled": enabled, "active": camera.videoStabilizationActive,
                                    "width": Int(size.width), "height": Int(size.height), "fps": fps,
                                    "switchDuringRecordingRejected": rejected])
                }
            }
            result["passed"] = true
        } catch { result["error"] = error.localizedDescription }
        if camera.isRecording { camera.stop(); try? await waitUntil { !camera.isBusy } }
        if let url = videoURL { try? FileManager.default.removeItem(at: url) }
        do {
            try await change(originalResolution)
            try await changeStabilization(originalStabilization)
            result["settingsRestored"] = true
        } catch { result["passed"] = false; result["restoreError"] = error.localizedDescription }
        result["samples"] = samples
        result["finishedAt"] = ISO8601DateFormatter().string(from: Date())
        camera.pauseSession()
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("GSMapCapture")
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
            try data.write(to: directory.appendingPathComponent("stabilization-verification.json"), options: .atomic)
            status = result["passed"] as? Bool == true ? "防抖验证通过" : "防抖验证失败"
        } catch { status = "防抖验证报告写入失败" }
    }

    @MainActor private func verifyHighlightModes() async {
        let originalResolution = camera.resolution
        let originalMode = camera.highlightMode
        var result: [String: Any] = ["version": "0.2.11", "passed": false]
        var samples: [[String: Any]] = []
        camera.onVideoSaved = { url, _, _, _, _ in videoURL = url }
        func select(_ mode: HighlightProtectionMode) async throws {
            let success: Bool = await withCheckedContinuation { continuation in
                camera.setHighlightMode(mode) { continuation.resume(returning: $0) }
            }
            guard success, camera.highlightMode == mode,
                  HighlightProtectionMode.load() == mode else { throw failure(camera.errorMessage ?? "方案未保存") }
        }
        do {
            camera.requestAndConfigure()
            try await waitUntil { camera.isConfigured }
            for resolution in [CaptureResolution.fullHD, .ultraHD] {
                try await change(resolution)
                guard camera.systemHDRAvailable else { throw failure("\(resolution.title) 当前格式不支持系统 HDR") }
                for mode in [HighlightProtectionMode.systemHDR, .autoExposure, .off, .systemHDR] {
                    status = "验证 \(resolution.title) · \(mode.title)"
                    try await select(mode)
                    try await Task.sleep(nanoseconds: 1_200_000_000)
                    let state = await withCheckedContinuation { continuation in
                        camera.highlightVerificationSnapshot { continuation.resume(returning: $0) }
                    }
                    guard state["videoHDREnabled"] as? Bool == (mode == .systemHDR),
                          state["automaticHDRSelection"] as? Bool == false,
                          state["analysisStreamEnabled"] as? Bool == (mode == .autoExposure) else { throw failure("硬件 HDR 和曝光分析未互斥") }
                    if mode == .autoExposure {
                        guard (state["analysisFrames"] as? Int ?? 0) > 0 else { throw failure("未收到曝光分析帧") }
                    } else {
                        guard abs(state["actualExposureBias"] as? Float ?? 99) < 0.05 else { throw failure("曝光补偿未复位") }
                    }
                    videoURL = nil
                    camera.toggleVideo()
                    try await waitUntil { camera.isRecording }
                    let rejected: Bool = await withCheckedContinuation { continuation in
                        camera.setHighlightMode(mode == .off ? .systemHDR : .off) { continuation.resume(returning: !$0) }
                    }
                    guard rejected else { throw failure("录制中允许切换") }
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                    camera.stop()
                    try await waitUntil { videoURL != nil && !camera.isBusy }
                    guard let url = videoURL else { throw failure("视频未保存") }
                    defer { try? FileManager.default.removeItem(at: url) }
                    let asset = AVURLAsset(url: url)
                    guard let track = try await asset.loadTracks(withMediaType: .video).first else { throw failure("没有视频轨道") }
                    let size = try await track.load(.naturalSize)
                    let fps = try await track.load(.nominalFrameRate)
                    guard resolution.matches(width: Int(size.width), height: Int(size.height)), abs(fps - 30) < 1 else { throw failure("视频分辨率或帧率改变") }
                    samples.append(["resolution": resolution.title, "mode": mode.rawValue, "state": state,
                                    "width": Int(size.width), "height": Int(size.height), "fps": fps,
                                    "switchDuringRecordingRejected": rejected])
                }
            }
            result["passed"] = true
        } catch { result["error"] = error.localizedDescription }
        if camera.isRecording { camera.stop(); try? await waitUntil { !camera.isBusy } }
        if let url = videoURL { try? FileManager.default.removeItem(at: url) }
        do {
            try await select(.off)
            try await change(originalResolution)
            try await select(originalMode)
            result["settingsRestored"] = true
        } catch { result["passed"] = false; result["restoreError"] = error.localizedDescription }
        result["samples"] = samples
        result["finishedAt"] = ISO8601DateFormatter().string(from: Date())
        camera.pauseSession()
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("GSMapCapture")
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]).write(to: directory.appendingPathComponent("highlight-modes-verification.json"), options: .atomic)
            status = result["passed"] as? Bool == true ? "防强光方案互斥验证通过" : "验证失败"
        } catch { status = "报告写入失败" }
    }

    @MainActor private func verify() async {
        let original = camera.resolution
        let checkHighlights = ProcessInfo.processInfo.arguments.contains("--verify-highlight-protection")
        let originalHighlights = camera.highlightMode
        var samples: [[String: Any]] = []
        var result: [String: Any] = ["startedAt": ISO8601DateFormatter().string(from: Date()), "version": "0.2.11", "passed": false]
        camera.onPhotoSaved = { photoURL = $0 }
        camera.onVideoSaved = { url, _, _, _, _ in videoURL = url }
        do {
            camera.requestAndConfigure()
            try await waitUntil { camera.isConfigured }
            // Exercise both actual preset transitions and both landscape directions.
            for (index, selected) in [CaptureResolution.fullHD, .ultraHD, .fullHD].enumerated() {
                try await change(selected)
                if checkHighlights {
                    let enabled = index < 2
                    let changed: Bool = await withCheckedContinuation { continuation in
                        camera.setHighlightProtection(enabled) { continuation.resume(returning: $0) }
                    }
                    guard changed, camera.highlightProtectionEnabled == enabled,
                          UserDefaults.standard.bool(forKey: "capture.autoHighlightProtectionEnabled") == enabled else { throw failure("防强光设置未生效或未保存") }
                    try await Task.sleep(nanoseconds: 1_500_000_000)
                    let state = await withCheckedContinuation { continuation in
                        camera.highlightVerificationSnapshot { continuation.resume(returning: $0) }
                    }
                    guard state["continuousAutoExposure"] as? Bool == true,
                          state["analysisStreamEnabled"] as? Bool == enabled else { throw failure("防强光自动曝光/分析连接未应用") }
                    if enabled {
                        guard (state["analysisFrames"] as? Int ?? 0) > 0 else { throw failure("未收到真实亮度分析帧") }
                    } else {
                        guard abs(state["actualExposureBias"] as? Float ?? 99) < 0.05 else { throw failure("关闭后曝光未恢复") }
                    }
                    samples.append(["mode": "highlightProtection", "selected": selected.title, "state": state])
                }
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
                    if checkHighlights {
                        let highlightRejected: Bool = await withCheckedContinuation { continuation in
                            camera.setHighlightProtection(!camera.highlightProtectionEnabled) { continuation.resume(returning: !$0) }
                        }
                        guard highlightRejected else { throw failure("录制中仍可切换防强光") }
                    }
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
        if checkHighlights {
            if camera.isRecording { camera.stop(); try? await waitUntil { !camera.isBusy } }
            if let url = photoURL { try? FileManager.default.removeItem(at: url) }
            if let url = videoURL { try? FileManager.default.removeItem(at: url) }
            do {
                try await change(original)
                let restored: Bool = await withCheckedContinuation { continuation in
                    camera.setHighlightMode(originalHighlights) { continuation.resume(returning: $0) }
                }
                guard restored else { throw failure("防强光设置恢复失败") }
                result["settingsRestored"] = true
            } catch { result["passed"] = false; result["restoreError"] = error.localizedDescription }
        }
        result["samples"] = samples
        result["finishedAt"] = ISO8601DateFormatter().string(from: Date())
        camera.pauseSession()
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("GSMapCapture")
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
            try data.write(to: directory.appendingPathComponent(checkHighlights ? "highlight-verification.json" : "resolution-verification.json"), options: .atomic)
        } catch { status += "；验证报告写入失败" }
    }
}
#endif
