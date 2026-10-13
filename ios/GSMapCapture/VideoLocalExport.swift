import SwiftUI
import Photos
import UIKit

enum VideoExportError: LocalizedError {
    case noVideos, unreadable(String), permissionDenied
    var errorDescription: String? {
        switch self {
        case .noVideos: return "没有可保存的视频"
        case .unreadable(let name): return "视频文件无法读取：\(name)。App 内原件未删除。"
        case .permissionDenied: return "未获准添加视频到相册。可在系统设置中允许照片访问，或选择导出到文件。"
        }
    }
}

enum PhotoLibraryVideoWriter {
    static func validate(_ urls: [URL]) throws {
        guard !urls.isEmpty else { throw VideoExportError.noVideos }
        for url in urls {
            guard url.isFileURL,
                  (try? url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true,
                  FileManager.default.isReadableFile(atPath: url.path) else {
                throw VideoExportError.unreadable(url.lastPathComponent)
            }
        }
    }

    static func authorize() async throws {
        var permission = PHPhotoLibrary.authorizationStatus(for: .addOnly)
        if permission == .notDetermined {
            permission = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        }
        guard permission == .authorized || permission == .limited else {
            throw VideoExportError.permissionDenied
        }
    }

    /// Photos copies the original file without loading it into app memory or transcoding it.
    /// The completion is awaited before reporting success; a failure never removes the source.
    static func saveVideo(at url: URL) async throws {
        try validate([url])
        try await PHPhotoLibrary.shared().performChanges {
            let options = PHAssetResourceCreationOptions()
            options.shouldMoveFile = false
            options.originalFilename = url.lastPathComponent
            PHAssetCreationRequest.forAsset().addResource(with: .video, fileURL: url, options: options)
        }
    }
}

struct VideoFileExportRequest: Identifiable {
    let id = UUID()
    let urls: [URL]
}

@MainActor
final class VideoLocalExporter: ObservableObject {
    @Published private(set) var busy = false
    @Published private(set) var status = ""
    @Published private(set) var permissionDenied = false
    @Published var fileRequest: VideoFileExportRequest?
    private var exportingFiles = false
    private(set) var fileDestinations: [URL] = []

    func saveToPhotos(_ urls: [URL]) {
        guard !busy else { return }
        busy = true
        permissionDenied = false
        status = "正在准备保存到相册…"
        let previousIdleSetting = UIApplication.shared.isIdleTimerDisabled
        UIApplication.shared.isIdleTimerDisabled = true
        Task {
            var saved = 0
            defer {
                busy = false
                UIApplication.shared.isIdleTimerDisabled = previousIdleSetting
            }
            do {
                try PhotoLibraryVideoWriter.validate(urls)
                try await PhotoLibraryVideoWriter.authorize()
                for url in urls {
                    status = "正在保存第 \(saved + 1) / \(urls.count) 个视频，请保持 App 在前台…"
                    try await PhotoLibraryVideoWriter.saveVideo(at: url)
                    saved += 1
                }
                status = "已保存 \(saved) 个视频到相册，App 内原件保留。"
            } catch {
                if case VideoExportError.permissionDenied = error { permissionDenied = true }
                status = "\(saved > 0 ? "已保存 \(saved) / \(urls.count) 个视频。" : "")\(error.localizedDescription) App 内原件保留。"
            }
        }
    }

    func exportToFiles(_ urls: [URL]) {
        guard !busy else { return }
        permissionDenied = false
        do {
            try PhotoLibraryVideoWriter.validate(urls)
            busy = true
            exportingFiles = true
            fileDestinations = []
            status = "请选择保存位置；保存在本机请选“我的 iPhone”。"
            fileRequest = VideoFileExportRequest(urls: urls)
        } catch { status = error.localizedDescription }
    }

    func finishFiles(destinations: [URL]?) {
        guard exportingFiles else { return }
        fileDestinations = destinations ?? []
        // Some providers return the destination directory, so URL count is not video count.
        status = destinations.map { _ in "视频已导出到文件，App 内原件保留。" }
            ?? "已取消导出，App 内原件保留。"
        busy = false
        exportingFiles = false
        fileRequest = nil
    }

}

struct VideoLocalExportControls: View {
    @ObservedObject var exporter: VideoLocalExporter
    let urls: [URL]
    var disabled = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button { exporter.saveToPhotos(urls) } label: {
                Label("保存到相册", systemImage: "photo.on.rectangle.angled")
            }.accessibilityIdentifier("video.export.photos")
                .disabled(disabled || exporter.busy || urls.isEmpty)
            Button { exporter.exportToFiles(urls) } label: {
                Label("导出到文件", systemImage: "folder")
            }.accessibilityIdentifier("video.export.files")
                .disabled(disabled || exporter.busy || urls.isEmpty)
            Text("复制 \(urls.count) 个视频，保持原分辨率；App 内原件和项目记录保留。")
                .font(.footnote).foregroundStyle(.secondary)
            if !exporter.status.isEmpty {
                HStack {
                    if exporter.busy { ProgressView() }
                    Text(exporter.status).font(.footnote).fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("video.export.status")
                }
            }
            if exporter.permissionDenied {
                Button("打开系统设置") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                }
            }
        }
        .buttonStyle(.bordered)
        .sheet(item: $exporter.fileRequest) { request in
            NavigationStack {
                VideoFilesPicker(urls: request.urls) { exporter.finishFiles(destinations: $0) }
                    .navigationTitle("保存视频到文件")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { ToolbarItem(placement: .cancellationAction) {
                        Button("取消导出") { exporter.finishFiles(destinations: nil) }
                            .accessibilityIdentifier("video.export.cancelFiles")
                    } }
                }
                .interactiveDismissDisabled()
        }
    }
}

struct VideoFilesPicker: UIViewControllerRepresentable {
    let urls: [URL]
    let completion: ([URL]?) -> Void

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        // asCopy is essential: the default exporting initializer can MOVE app originals.
        let picker = UIDocumentPickerViewController(forExporting: urls, asCopy: true)
        picker.delegate = context.coordinator
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("视频导出", isDirectory: true)
        if (try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)) != nil {
            picker.directoryURL = directory
        }
        return picker
    }
    func updateUIViewController(_ controller: UIDocumentPickerViewController, context: Context) { }
    func makeCoordinator() -> Coordinator { Coordinator(completion: completion) }

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let completion: ([URL]?) -> Void
        init(completion: @escaping ([URL]?) -> Void) { self.completion = completion }
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            completion(urls)
        }
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { completion(nil) }
    }
}
