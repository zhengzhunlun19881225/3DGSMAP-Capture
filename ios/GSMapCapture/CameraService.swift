import AVFoundation
import CoreMotion
import Foundation
import SwiftUI
import Combine
import UIKit

extension CaptureOrientation {
    static func cameraRotation(for orientation: UIInterfaceOrientation) -> CGFloat {
        let captureOrientation: CaptureOrientation
        switch orientation {
        case .landscapeLeft: captureOrientation = .landscapeLeft
        case .landscapeRight: captureOrientation = .landscapeRight
        case .portraitUpsideDown: captureOrientation = .portraitUpsideDown
        default: captureOrientation = .portrait
        }
        return CGFloat(captureOrientation.cameraRotationDegrees)
    }
}

final class CameraService: NSObject, ObservableObject {
    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "com.3dgsmap.camera")
    private let photoOutput = AVCapturePhotoOutput()
    private let movieOutput = AVCaptureMovieFileOutput()
    private var currentVideoURL: URL?
    private var currentVideoStarted: Date?
    private var configured = false
    private var pendingPhoto = false
    private var movieRequested = false
    private var stopRequested = false
    private var rotation: CGFloat = 90
    private var device: AVCaptureDevice?
    private var activeResolution = CaptureResolution.fullHD
    private var photoResolution = CaptureResolution.fullHD
    private var videoResolution = CaptureResolution.fullHD
    private static let resolutionKey = "capture.outputResolution"
    private static let stabilizationKey = "capture.videoStabilizationEnabled"
    private var requestedVideoStabilization = UserDefaults.standard.bool(forKey: stabilizationKey)

    @Published private(set) var permissionDenied = false
    @Published private(set) var isConfigured = false
    @Published private(set) var isRecording = false
    @Published private(set) var isBusy = false
    @Published private(set) var recordingStartedAt: Date?
    @Published private(set) var resolution = CaptureResolution(rawValue: UserDefaults.standard.string(forKey: resolutionKey) ?? "") ?? .fullHD
    @Published private(set) var supportedResolutions: [CaptureResolution] = []
    @Published private(set) var isChangingResolution = false
    @Published private(set) var videoStabilizationEnabled = UserDefaults.standard.bool(forKey: stabilizationKey)
    @Published private(set) var videoStabilizationAvailable = false
    @Published private(set) var videoStabilizationActive = false
    @Published var errorMessage: String?
    var onPhotoSaved: ((URL) -> Void)?
    var onVideoSaved: ((URL, TimeInterval, Int, Int, String) -> Void)?

    func requestAndConfigure() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            DispatchQueue.main.async { self.permissionDenied = false }
            configure()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] allowed in
                DispatchQueue.main.async { self?.permissionDenied = !allowed }
                if allowed { self?.configure() }
            }
        default: DispatchQueue.main.async { self.permissionDenied = true }
        }
    }

    private func configure() {
        queue.async { [weak self] in
            guard let self else { return }
            if self.configured { if !self.session.isRunning { self.session.startRunning() }; return }
            self.session.beginConfiguration()
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                  let input = try? AVCaptureDeviceInput(device: device), self.session.canAddInput(input) else {
                self.finishConfiguration(error: "无法打开后置摄像头"); return
            }
            self.session.addInput(input)
            self.device = device
            guard self.session.canAddOutput(self.photoOutput), self.session.canAddOutput(self.movieOutput) else {
                self.finishConfiguration(error: "无法配置照片和视频输出"); return
            }
            self.session.addOutput(self.photoOutput)
            self.session.addOutput(self.movieOutput)
            self.session.commitConfiguration()
            let supported = CaptureResolution.allCases.filter { self.session.canSetSessionPreset(self.preset($0)) }
            let preferred = CaptureResolution(rawValue: UserDefaults.standard.string(forKey: Self.resolutionKey) ?? "") ?? .fullHD
            let selected = supported.contains(preferred) ? preferred : .fullHD
            do { try self.applyResolution(selected) }
            catch { DispatchQueue.main.async { self.errorMessage = error.localizedDescription }; return }
            self.configured = true
            self.setLandscapeConnections()
            self.session.startRunning()
            self.publishVideoStabilizationState()
            DispatchQueue.main.async {
                self.resolution = selected; self.supportedResolutions = supported; self.isConfigured = true
                if selected != preferred { self.errorMessage = "当前相机不支持 4K，已使用 1080p" }
            }
        }
    }

    private func finishConfiguration(error: String) {
        session.commitConfiguration()
        DispatchQueue.main.async { self.errorMessage = error }
    }

    private func preset(_ resolution: CaptureResolution) -> AVCaptureSession.Preset {
        resolution == .ultraHD ? .hd4K3840x2160 : .hd1920x1080
    }

    /// Executed only on the camera queue with no photo or movie in flight.
    private func applyResolution(_ selected: CaptureResolution) throws {
        guard let device, session.canSetSessionPreset(preset(selected)) else {
            throw NSError(domain: "CaptureResolution", code: 2, userInfo: [NSLocalizedDescriptionKey: "当前相机不支持 \(selected.title)"])
        }
        session.beginConfiguration()
        session.sessionPreset = preset(selected)
        session.commitConfiguration()
        let dimensions = device.activeFormat.supportedMaxPhotoDimensions.filter {
            max($0.width, $0.height) >= selected.width && min($0.width, $0.height) >= selected.height
        }.min { Int64($0.width) * Int64($0.height) < Int64($1.width) * Int64($1.height) }
        guard let dimensions else {
            throw NSError(domain: "CaptureResolution", code: 3, userInfo: [NSLocalizedDescriptionKey: "当前相机无法输出 \(selected.title) 照片"])
        }
        try device.lockForConfiguration()
        defer { device.unlockForConfiguration() }
        guard device.activeFormat.videoSupportedFrameRateRanges.contains(where: { $0.minFrameRate <= 30 && $0.maxFrameRate >= 30 }) else {
            throw NSError(domain: "CaptureResolution", code: 4, userInfo: [NSLocalizedDescriptionKey: "当前相机不支持 \(selected.title) / 30 fps"])
        }
        device.activeVideoMinFrameDuration = CMTime(value: 1, timescale: 30)
        device.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: 30)
        device.automaticallyAdjustsVideoHDREnabled = false
        if device.isVideoHDREnabled { device.isVideoHDREnabled = false }
        session.beginConfiguration()
        photoOutput.maxPhotoDimensions = dimensions
        session.commitConfiguration()
        activeResolution = selected
        setLandscapeConnections()
    }

    func setResolution(_ selected: CaptureResolution, completion: ((Bool) -> Void)? = nil) {
        guard isConfigured, !isBusy, !isChangingResolution else { completion?(false); return }
        isChangingResolution = true; isBusy = true; errorMessage = nil
        queue.async {
            guard !self.pendingPhoto, !self.movieRequested else {
                DispatchQueue.main.async { self.isChangingResolution = false; self.isBusy = true; completion?(false) }
                return
            }
            let previous = self.activeResolution
            let wasRunning = self.session.isRunning
            if wasRunning { self.session.stopRunning() }
            do {
                try self.applyResolution(selected)
                UserDefaults.standard.set(selected.rawValue, forKey: Self.resolutionKey)
                if wasRunning { self.session.startRunning() }
                self.publishVideoStabilizationState()
                DispatchQueue.main.async {
                    self.resolution = selected; self.isChangingResolution = false; self.isBusy = false; completion?(true)
                }
            } catch {
                let message = error.localizedDescription
                do { try self.applyResolution(previous) }
                catch { self.configured = false }
                if wasRunning && self.configured { self.session.startRunning() }
                self.publishVideoStabilizationState()
                let available = self.configured
                DispatchQueue.main.async {
                    self.isConfigured = available; self.resolution = previous
                    self.isChangingResolution = false; self.isBusy = false
                    self.errorMessage = "分辨率切换失败：\(message)"; completion?(false)
                }
            }
        }
    }

    private func setLandscapeConnections() {
        for output in [photoOutput as AVCaptureOutput, movieOutput as AVCaptureOutput] {
            guard let connection = output.connection(with: .video) else { continue }
            if connection.isVideoRotationAngleSupported(rotation) { connection.videoRotationAngle = rotation }
            if output === movieOutput {
                let supported = supportsStandardStabilization(connection)
                connection.preferredVideoStabilizationMode = requestedVideoStabilization && supported ? .standard : .off
                publishVideoStabilizationState()
            }
        }
    }

    private func supportsStandardStabilization(_ connection: AVCaptureConnection) -> Bool {
        connection.isVideoStabilizationSupported && device?.activeFormat.isVideoStabilizationModeSupported(.standard) == true
    }

    private func publishVideoStabilizationState() {
        guard let connection = movieOutput.connection(with: .video) else { return }
        let supported = supportsStandardStabilization(connection)
        let active = connection.activeVideoStabilizationMode != .off
        DispatchQueue.main.async {
            self.videoStabilizationAvailable = supported
            self.videoStabilizationActive = active
        }
    }

    /// Changes stabilization only while no capture is in flight. It is opt-in because
    /// digital stabilization can warp pixels that are useful for 3D reconstruction.
    func setVideoStabilization(_ enabled: Bool, completion: ((Bool) -> Void)? = nil) {
        guard isConfigured, !isBusy, !isChangingResolution else { completion?(false); return }
        isBusy = true; errorMessage = nil
        queue.async {
            guard !self.pendingPhoto, !self.movieRequested,
                  let connection = self.movieOutput.connection(with: .video) else {
                let busy = self.pendingPhoto || self.movieRequested
                DispatchQueue.main.async { self.isBusy = busy; completion?(false) }
                return
            }
            guard !enabled || self.supportsStandardStabilization(connection) else {
                DispatchQueue.main.async {
                    self.isBusy = false
                    self.errorMessage = "当前分辨率不支持视频防抖"
                    completion?(false)
                }
                return
            }
            self.requestedVideoStabilization = enabled
            UserDefaults.standard.set(enabled, forKey: Self.stabilizationKey)
            self.setLandscapeConnections()
            DispatchQueue.main.async {
                self.videoStabilizationEnabled = enabled
                self.isBusy = false
                completion?(true)
            }
        }
    }

    func capturePhoto() {
        queue.async { [weak self] in
            guard let self, self.configured, !self.movieRequested, !self.pendingPhoto else { return }
            self.pendingPhoto = true
            self.photoResolution = self.activeResolution
            DispatchQueue.main.async { self.isBusy = true }
            self.setLandscapeConnections()
            let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
            settings.maxPhotoDimensions = self.photoOutput.maxPhotoDimensions
            self.photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }

    func toggleVideo() {
        queue.async { [weak self] in
            guard let self, self.configured, !self.pendingPhoto else { return }
            if self.movieRequested {
                self.stopRequested = true
                if self.movieOutput.isRecording { self.movieOutput.stopRecording() }
                return
            }
            self.movieRequested = true; self.stopRequested = false
            self.videoResolution = self.activeResolution
            let directory = FileManager.default.temporaryDirectory
            let url = directory.appendingPathComponent("capture-\(UUID().uuidString).mov")
            self.currentVideoURL = url
            self.currentVideoStarted = Date()
            self.setLandscapeConnections()
            self.movieOutput.startRecording(to: url, recordingDelegate: self)
            DispatchQueue.main.async { self.isBusy = true }
        }
    }

    func stop() {
        queue.async { [weak self] in
            guard let self else { return }
            self.stopRequested = true
            if self.movieOutput.isRecording { self.movieOutput.stopRecording() }
        }
    }

    func pauseSession() {
        queue.async { [weak self] in
            guard let self else { return }
            self.stopRequested = true
            if self.movieOutput.isRecording { self.movieOutput.stopRecording() }
            if self.session.isRunning { self.session.stopRunning() }
        }
    }

    func setRotation(_ angle: CGFloat) {
        queue.async {
            // Freeze the output orientation for the entire recording.
            guard !self.movieRequested, !self.pendingPhoto else { return }
            self.rotation = angle
            if self.configured { self.setLandscapeConnections() }
        }
    }

    private func savedURL(fileExtension: String) -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("capture-\(UUID().uuidString).\(fileExtension)")
    }

    func previewView() -> CameraPreview { CameraPreview(session: session) }

    deinit { if session.isRunning { session.stopRunning() } }
}

extension CameraService: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard error == nil, let data = photo.fileDataRepresentation() else {
            queue.async { self.pendingPhoto = false }
            DispatchQueue.main.async { self.errorMessage = error?.localizedDescription ?? "照片保存失败"; self.isBusy = false }; return
        }
        queue.async {
            let url = self.savedURL(fileExtension: "jpg")
            do {
                let jpeg = try PhotoResolutionEncoder.encode(data, resolution: self.photoResolution)
                try jpeg.write(to: url, options: .atomic)
                self.pendingPhoto = false
                DispatchQueue.main.async { self.onPhotoSaved?(url); self.isBusy = false }
            } catch {
                self.pendingPhoto = false
                DispatchQueue.main.async { self.errorMessage = "照片写入失败：\(error.localizedDescription)"; self.isBusy = false }
            }
        }
    }
}

extension CameraService: AVCaptureFileOutputRecordingDelegate {
    func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
        DispatchQueue.main.async { self.isRecording = true; self.recordingStartedAt = Date() }
        queue.async { if self.stopRequested { self.movieOutput.stopRecording() } }
    }

    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        DispatchQueue.main.async { self.isRecording = false; self.recordingStartedAt = nil }
        let destination = savedURL(fileExtension: "mov")
        let expectedResolution = videoResolution
        do {
            if let error, ((error as NSError).userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool) != true {
                throw error
            }
            try FileManager.default.moveItem(at: outputFileURL, to: destination)
            Task {
                do {
                    let asset = AVURLAsset(url: destination)
                    let duration = try await asset.load(.duration).seconds
                    let tracks = try await asset.loadTracks(withMediaType: .video)
                    guard let track = tracks.first, duration.isFinite, duration > 0 else { throw NSError(domain: "Capture", code: 1, userInfo: [NSLocalizedDescriptionKey: "视频没有有效画面或时长"]) }
                    let size = try await track.load(.naturalSize)
                    let transform = try await track.load(.preferredTransform)
                    let bounds = CGRect(origin: .zero, size: size).applying(transform)
                    guard expectedResolution.matches(width: Int(abs(bounds.width).rounded()), height: Int(abs(bounds.height).rounded())) else {
                        throw NSError(domain: "CaptureResolution", code: 5, userInfo: [NSLocalizedDescriptionKey: "视频实际尺寸不符合 \(expectedResolution.dimensionsLabel)，请重试"])
                    }
                    let descriptions = try await track.load(.formatDescriptions)
                    let subtype = descriptions.first.map { CMFormatDescriptionGetMediaSubType($0) } ?? 0
                    let codec = String(bytes: [UInt8((subtype >> 24) & 255), UInt8((subtype >> 16) & 255), UInt8((subtype >> 8) & 255), UInt8(subtype & 255)], encoding: .ascii) ?? "unknown"
                    self.queue.async { self.movieRequested = false }
                    DispatchQueue.main.async { self.onVideoSaved?(destination, duration, Int(abs(bounds.width)), Int(abs(bounds.height)), codec); self.isBusy = false }
                } catch {
                    self.queue.async { self.movieRequested = false }
                    DispatchQueue.main.async { self.isBusy = false; self.errorMessage = "视频校验失败：\(error.localizedDescription)" }
                }
            }
        } catch {
            queue.async { self.movieRequested = false }
            DispatchQueue.main.async { self.isBusy = false; self.errorMessage = "视频保存失败：\(error.localizedDescription)" }
        }
        currentVideoURL = nil; currentVideoStarted = nil
    }
}

struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession
    func makeUIView(context: Context) -> PreviewView { let view = PreviewView(); view.previewLayer.session = session; return view }
    func updateUIView(_ uiView: PreviewView, context: Context) {
        uiView.previewLayer.session = session
        uiView.setNeedsLayout()
    }
}

final class PreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    override init(frame: CGRect) { super.init(frame: frame); previewLayer.videoGravity = .resizeAspectFill }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func layoutSubviews() {
        super.layoutSubviews()
        guard let connection = previewLayer.connection else { return }
        let angle = CaptureOrientation.cameraRotation(for: window?.windowScene?.interfaceOrientation ?? .portrait)
        if connection.isVideoRotationAngleSupported(angle) { connection.videoRotationAngle = angle }
    }
}

final class MotionService: ObservableObject {
    private let manager = CMMotionManager()
    @Published private(set) var pitch: Double = 0
    @Published private(set) var roll: Double = 0
    @Published private(set) var guidance = "参考线由用户手动对齐"
    @Published private(set) var isMovingTooFast = false

    func start() {
        guard manager.isDeviceMotionAvailable else { return }
        manager.deviceMotionUpdateInterval = 1.0 / 20.0
        manager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let motion, let self else { return }
            self.pitch = motion.attitude.pitch * 180 / .pi
            self.roll = motion.attitude.roll * 180 / .pi
            let angularSpeed = sqrt(pow(motion.rotationRate.x, 2) + pow(motion.rotationRate.y, 2) + pow(motion.rotationRate.z, 2))
            self.isMovingTooFast = angularSpeed > 0.8
            self.guidance = angularSpeed > 0.8 ? "转动较快，请放慢" : "转动较缓，请保持画面重叠"
        }
    }
    func stop() { manager.stopDeviceMotionUpdates() }
}
