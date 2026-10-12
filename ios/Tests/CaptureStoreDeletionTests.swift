import Foundation

@main
struct CaptureStoreDeletionTests {
    @MainActor
    static func main() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent("gsmap-delete-test-\(UUID())", isDirectory: true)
        try fm.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: root) }
        let store = CaptureStore(directory: root)
        let project = store.createProject(name: "Delete fixture")
        let otherProject = store.createProject(name: "Other project")
        let deletedID = store.startSession(projectId: project.id, mode: .video)
        let retainedID = store.startSession(projectId: project.id, mode: .video)
        let otherID = store.startSession(projectId: otherProject.id, mode: .video)
        for id in [deletedID, retainedID, otherID] {
            let source = root.appendingPathComponent("fixture-\(id).mov")
            try Data("fixture \(id)".utf8).write(to: source)
            assert(store.addMedia(sessionId: id, url: source, mode: .video, stage: .middle, duration: 3))
        }
        func media(_ id: UUID, from source: CaptureStore) -> MediaRecord {
            source.projects.flatMap { $0.sessions }.first { $0.id == id }!.media[0]
        }
        let deletedFile = store.fileURL(media(deletedID, from: store))
        let retainedFile = store.fileURL(media(retainedID, from: store))
        let otherFile = store.fileURL(media(otherID, from: store))
        assert(store.deleteSession(sessionId: deletedID))
        assert(!fm.fileExists(atPath: deletedFile.path))
        assert(fm.fileExists(atPath: retainedFile.path) && fm.fileExists(atPath: otherFile.path))
        let reloaded = CaptureStore(directory: root)
        assert(reloaded.sessionLocation(sessionId: deletedID) == nil)
        assert(reloaded.sessionLocation(sessionId: retainedID) == project.id)
        assert(reloaded.sessionLocation(sessionId: otherID) == otherProject.id)
        assert(reloaded.projects.count == 2)
        assert(!reloaded.deleteSession(sessionId: deletedID), "Repeated deletion is rejected")

        // Force an atomic index write to fail. Records and originals must survive.
        let index = root.appendingPathComponent("projects.json")
        let backup = root.appendingPathComponent("index-backup.json")
        try fm.moveItem(at: index, to: backup)
        try fm.createDirectory(at: index, withIntermediateDirectories: false)
        assert(!reloaded.deleteSession(sessionId: retainedID))
        assert(reloaded.sessionLocation(sessionId: retainedID) == project.id)
        assert(fm.fileExists(atPath: retainedFile.path))
        try fm.removeItem(at: index)
        try fm.moveItem(at: backup, to: index)

        // An indexed path outside assets must never trigger deletion there.
        let sentinel = root.appendingPathComponent("keep.mov")
        try Data("keep me".utf8).write(to: sentinel)
        var projects = try JSONDecoder().decode([CaptureProject].self, from: Data(contentsOf: index))
        let p = projects.firstIndex { $0.id == project.id }!
        let s = projects[p].sessions.firstIndex { $0.id == retainedID }!
        let record = projects[p].sessions[s].media[0]
        projects[p].sessions[s].media = [MediaRecord(id: record.id, mode: .video, relativePath: "assets/../keep.mov", createdAt: record.createdAt, stage: .middle, duration: 3, byteCount: nil)]
        try JSONEncoder().encode(projects).write(to: index)
        let guarded = CaptureStore(directory: root)
        assert(guarded.deleteSession(sessionId: retainedID))
        assert(guarded.errorMessage != nil)
        assert(fm.fileExists(atPath: sentinel.path))
        assert(fm.fileExists(atPath: otherFile.path))

        let corrupt = Data("invalid index".utf8)
        try corrupt.write(to: index)
        let unreadable = CaptureStore(directory: root)
        assert(!unreadable.deleteSession(sessionId: otherID))
        let unchangedIndex = try Data(contentsOf: index)
        assert(unchangedIndex == corrupt)
        assert(fm.fileExists(atPath: otherFile.path))
        print("PASS: record and file deletion, restart persistence, other batches/projects preserved, failed index write rollback, path containment, corrupt index protection")
    }
}
