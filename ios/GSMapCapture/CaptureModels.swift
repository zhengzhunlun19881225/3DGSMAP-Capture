import Foundation

/// Interface orientation, not UIDeviceOrientation (whose landscape names differ).
enum CaptureOrientation: CaseIterable {
    case portrait, portraitUpsideDown, landscapeLeft, landscapeRight

    var cameraRotationDegrees: Double {
        switch self {
        case .portrait: 90
        case .portraitUpsideDown: 270
        case .landscapeLeft: 180
        case .landscapeRight: 0
        }
    }
}

enum CaptureMode: String, Codable, CaseIterable, Identifiable {
    case photo, video
    var id: String { rawValue }
    var title: String { self == .photo ? "照片采集" : "视频采集" }
}

enum CaptureResolution: String, Codable, CaseIterable, Identifiable {
    case fullHD, ultraHD
    var id: String { rawValue }
    var title: String { self == .ultraHD ? "4K" : "1080p" }
    var width: Int { self == .ultraHD ? 3840 : 1920 }
    var height: Int { self == .ultraHD ? 2160 : 1080 }
    var dimensionsLabel: String { "\(width) × \(height)" }
    func matches(width: Int, height: Int) -> Bool {
        max(width, height) == self.width && min(width, height) == self.height
    }
}

enum CaptureStage: String, Codable, CaseIterable, Identifiable {
    case upper, middle, lower, detail
    static let captureOrder: [CaptureStage] = [.middle, .upper, .lower, .detail]
    var number: Int { Self.captureOrder.firstIndex(of: self)! + 1 }
    var next: CaptureStage? { number < Self.captureOrder.count ? Self.captureOrder[number] : nil }
    var guideTitle: String {
        switch self {
        case .middle: "环绕房间水平视角拍摄"
        case .upper: "环绕房间仰视拍摄"
        case .lower: "环绕房间俯视拍摄"
        case .detail: "环绕物体补拍细节"
        }
    }
    var id: String { rawValue }
    var title: String {
        switch self { case .upper: "上层"; case .middle: "中层"; case .lower: "下层"; case .detail: "细节" }
    }
    var instruction: String {
        switch self {
        case .upper: "对齐墙面与天花板交界，沿房间缓慢移动"
        case .middle: "保持相邻画面重叠，记录墙面与主要物体"
        case .lower: "对齐墙面与地板交界，补拍低处"
        case .detail: "环绕重要物体，从不同位置补拍细节"
        }
    }
    var linePosition: Double {
        switch self { case .upper: 0.30; case .middle: 0.49; case .lower: 0.72; case .detail: 0.49 }
    }
}

enum CaptureScreen { case positioning, tutorial, ready, review }
enum CaptureCompletionAction { case next, finish, exit }

/// Keep the captured stage fixed until its file and project record are saved.
struct CaptureFlow {
    var stage: CaptureStage = .middle
    var screen: CaptureScreen = .positioning
    private(set) var capturedStage: CaptureStage = .middle
    private(set) var inFlight = false
    private(set) var saving = false
    private(set) var pendingAction: CaptureCompletionAction?

    mutating func beginCapture() -> Bool {
        guard screen == .ready, !inFlight else { return false }
        capturedStage = stage
        inFlight = true
        return true
    }

    mutating func request(_ action: CaptureCompletionAction) -> Bool {
        guard !saving else { return false }
        if inFlight { pendingAction = action; saving = true; return false }
        return true
    }

    mutating func mediaSaved(success: Bool) -> CaptureCompletionAction? {
        let action = success ? pendingAction : nil
        inFlight = false; saving = false; pendingAction = nil
        return action
    }

    mutating func advance() {
        if let next = stage.next { stage = next; screen = .tutorial }
    }
}

struct MediaRecord: Codable, Identifiable {
    let id: UUID
    let mode: CaptureMode
    let relativePath: String
    let createdAt: Date
    let stage: CaptureStage
    let duration: Double?
    let byteCount: Int64?
    var pixelWidth: Int?
    var pixelHeight: Int?
    var codec: String?
    var orientation: Int?
}

struct CaptureSessionRecord: Codable, Identifiable {
    let id: UUID
    let projectId: UUID
    let mode: CaptureMode
    let createdAt: Date
    var endedAt: Date?
    var media: [MediaRecord]
    var skippedStages: [CaptureStage]
    var activeStage: CaptureStage?
    var serverId: String?
    var jobId: String?
}

struct CaptureRoute: Identifiable {
    let id: UUID
    let mode: CaptureMode
}

struct CaptureProject: Codable, Identifiable {
    let id: UUID
    var name: String
    let createdAt: Date
    var updatedAt: Date
    var sessions: [CaptureSessionRecord]
}
