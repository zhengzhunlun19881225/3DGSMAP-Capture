import Foundation
import Combine
import ImageIO

@MainActor
final class CaptureStore: ObservableObject {
    @Published private(set) var projects: [CaptureProject] = []
    @Published var errorMessage: String?
    private let fileManager = FileManager.default
    private let storageDirectory: URL?
    private var indexUnreadable = false
    var canCapture: Bool { !indexUnreadable }

    private var applicationSupport: URL {
        let directory = storageDirectory ?? fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("GSMapCapture", isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private var indexURL: URL { applicationSupport.appendingPathComponent("projects.json") }

    init(directory: URL? = nil) { storageDirectory = directory; load() }

    func createProject(name: String) -> CaptureProject {
        let now = Date()
        let project = CaptureProject(id: UUID(), name: name.isEmpty ? "未命名项目" : name,
                                     createdAt: now, updatedAt: now, sessions: [])
        projects.insert(project, at: 0)
        save()
        return project
    }

    func startSession(projectId: UUID, mode: CaptureMode) -> UUID {
        guard let index = projects.firstIndex(where: { $0.id == projectId }) else { return UUID() }
        let session = CaptureSessionRecord(id: UUID(), projectId: projectId, mode: mode,
                                           createdAt: Date(), endedAt: nil, media: [], skippedStages: [])
        projects[index].sessions.insert(session, at: 0)
        projects[index].updatedAt = Date()
        save()
        return session.id
    }

    @discardableResult
    func addMedia(sessionId: UUID, url: URL, mode: CaptureMode, stage: CaptureStage, duration: Double?, width: Int? = nil, height: Int? = nil, codec: String? = nil) -> Bool {
        guard let location = sessionLocation(sessionId: sessionId),
              let projectIndex = projects.firstIndex(where: { $0.id == location }),
              let sessionIndex = projects[projectIndex].sessions.firstIndex(where: { $0.id == sessionId }) else { return false }
        let assets = applicationSupport.appendingPathComponent("assets", isDirectory: true)
        try? fileManager.createDirectory(at: assets, withIntermediateDirectories: true)
        let ext = url.pathExtension.isEmpty ? (mode == .photo ? "jpg" : "mov") : url.pathExtension
        let filename = "\(sessionId.uuidString)_\(UUID().uuidString).\(ext)"
        let destination = assets.appendingPathComponent(filename)
        do {
            if fileManager.fileExists(atPath: destination.path) { try fileManager.removeItem(at: destination) }
            try fileManager.moveItem(at: url, to: destination)
            let count = try fileManager.attributesOfItem(atPath: destination.path)[.size] as? NSNumber
            var record = MediaRecord(id: UUID(), mode: mode, relativePath: "assets/\(filename)", createdAt: Date(),
                                     stage: stage, duration: duration, byteCount: count?.int64Value)
            record.pixelWidth = width; record.pixelHeight = height; record.codec = codec
            if mode == .photo, let source = CGImageSourceCreateWithURL(destination as CFURL, nil),
               let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] {
                record.pixelWidth = properties[kCGImagePropertyPixelWidth] as? Int
                record.pixelHeight = properties[kCGImagePropertyPixelHeight] as? Int
                record.orientation = properties[kCGImagePropertyOrientation] as? Int
                record.codec = "jpeg"
            }
            projects[projectIndex].sessions[sessionIndex].media.append(record)
            projects[projectIndex].updatedAt = Date()
            return save()
        } catch {
            errorMessage = "保存采集素材失败：\(error.localizedDescription)"
            return false
        }
    }

    @discardableResult
    func finishSession(sessionId: UUID) -> Bool {
        guard let location = sessionLocation(sessionId: sessionId),
              let projectIndex = projects.firstIndex(where: { $0.id == location }),
              let sessionIndex = projects[projectIndex].sessions.firstIndex(where: { $0.id == sessionId }) else { return false }
        let previousEnd = projects[projectIndex].sessions[sessionIndex].endedAt
        projects[projectIndex].sessions[sessionIndex].endedAt = Date()
        projects[projectIndex].updatedAt = Date()
        if save() { return true }
        projects[projectIndex].sessions[sessionIndex].endedAt = previousEnd
        return false
    }

    @discardableResult
    func skip(stage: CaptureStage, sessionId: UUID) -> Bool {
        guard let location = sessionLocation(sessionId: sessionId),
              let projectIndex = projects.firstIndex(where: { $0.id == location }),
              let sessionIndex = projects[projectIndex].sessions.firstIndex(where: { $0.id == sessionId }) else { return false }
        if !projects[projectIndex].sessions[sessionIndex].skippedStages.contains(stage) {
            projects[projectIndex].sessions[sessionIndex].skippedStages.append(stage)
        }
        return save()
    }

    func checkpoint(stage: CaptureStage, sessionId: UUID) -> Bool {
        guard let projectIndex = projects.firstIndex(where: { $0.id == sessionLocation(sessionId: sessionId) }),
              let sessionIndex = projects[projectIndex].sessions.firstIndex(where: { $0.id == sessionId }) else { return false }
        let previousStage = projects[projectIndex].sessions[sessionIndex].activeStage
        projects[projectIndex].sessions[sessionIndex].activeStage = stage
        if save() { return true }
        projects[projectIndex].sessions[sessionIndex].activeStage = previousStage
        return false
    }

    func sessionLocation(sessionId: UUID) -> UUID? {
        for project in projects where project.sessions.contains(where: { $0.id == sessionId }) { return project.id }
        return nil
    }

    @discardableResult
    func deleteSession(sessionId: UUID) -> Bool {
        guard canCapture else { errorMessage = "项目索引不可读，无法删除记录"; return false }
        guard let projectIndex = projects.firstIndex(where: { $0.sessions.contains(where: { $0.id == sessionId }) }),
              let sessionIndex = projects[projectIndex].sessions.firstIndex(where: { $0.id == sessionId }) else {
            errorMessage = "采集记录不存在，请重新打开项目"; return false
        }
        errorMessage = nil
        let previousProject = projects[projectIndex]
        let removed = projects[projectIndex].sessions.remove(at: sessionIndex)
        projects[projectIndex].updatedAt = Date()
        // Commit the index before touching files. A failed write preserves both.
        guard save() else { projects[projectIndex] = previousProject; return false }

        let retainedPaths = Set(projects.flatMap { $0.sessions }.flatMap { $0.media }.map(\.relativePath))
        let assets = applicationSupport.appendingPathComponent("assets", isDirectory: true).resolvingSymlinksInPath()
        var cleanupFailed = false
        for record in removed.media where !retainedPaths.contains(record.relativePath) {
            let url = fileURL(record).standardizedFileURL.resolvingSymlinksInPath()
            // Only remove files in this app's flat assets directory.
            guard url.deletingLastPathComponent() == assets else { cleanupFailed = true; continue }
            guard fileManager.fileExists(atPath: url.path) else { continue }
            do {
                let values = try url.resourceValues(forKeys: [.isRegularFileKey])
                guard values.isRegularFile == true else { cleanupFailed = true; continue }
                try fileManager.removeItem(at: url)
            } catch { cleanupFailed = true }
        }
        if cleanupFailed { errorMessage = "采集记录已删除，但部分本机素材未能清理" }
        return true
    }

    func mediaCount(project: CaptureProject) -> Int { project.sessions.reduce(0) { $0 + $1.media.count } }

    func fileURL(_ record: MediaRecord) -> URL { applicationSupport.appendingPathComponent(record.relativePath) }

    func restoreSession(_ sessionId: UUID) {
        for p in projects.indices {
            if let s = projects[p].sessions.firstIndex(where: { $0.id == sessionId }) {
                projects[p].sessions[s].endedAt = nil
                save(); return
            }
        }
    }

    func attachJob(sessionId: UUID, serverId: String, jobId: String) {
        for p in projects.indices {
            if let s = projects[p].sessions.firstIndex(where: { $0.id == sessionId }) {
                projects[p].sessions[s].serverId = serverId
                projects[p].sessions[s].jobId = jobId
                save(); return
            }
        }
    }

    func attachServer(sessionId: UUID, serverId: String) {
        for p in projects.indices {
            if let s = projects[p].sessions.firstIndex(where: { $0.id == sessionId }) {
                projects[p].sessions[s].serverId = serverId
                save(); return
            }
        }
    }

    private func load() {
        guard fileManager.fileExists(atPath: indexURL.path) else { return }
        do {
            projects = try JSONDecoder().decode([CaptureProject].self, from: Data(contentsOf: indexURL))
            // Preserve the index on corruption. Never overwrite it with an empty list.
        } catch { indexUnreadable = true; errorMessage = "项目索引读取失败：\(error.localizedDescription)" }
    }

    @discardableResult
    private func save() -> Bool {
        guard !indexUnreadable else { errorMessage = "项目索引不可读，已保留原文件，请先修复后采集"; return false }
        do {
            let data = try JSONEncoder().encode(projects)
            try data.write(to: indexURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            return true
        } catch { errorMessage = "项目记录写入失败，原始文件仍保留：\(error.localizedDescription)"; return false }
    }
}
