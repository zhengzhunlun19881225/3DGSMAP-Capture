import SwiftUI
import AVKit
import WebKit
import UIKit

struct ConnectionSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var connection: MobileConnection
    @State private var checking = false
    @State private var message = ""
    var body: some View {
        NavigationStack {
            Form {
                Section("本地训练电脑") {
                    TextField("http://192.168.1.10:8788", text: $connection.address).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("电脑连接密钥", text: $connection.token).textInputAutocapitalization(.never).autocorrectionDisabled()
                    Text("电脑运行手机接入服务后，从 runtime/mobile-gateway.json 查看连接密钥。两台设备连接同一 Wi-Fi。").font(.footnote).foregroundStyle(.secondary)
                    Button(checking ? "正在检查" : "检查连接并保存") {
                        checking = true
                        Task {
                            do { try await connection.probe(); message = connection.status }
                            catch { message = error.localizedDescription }
                            checking = false
                        }
                    }.disabled(checking || connection.working)
                    if !message.isEmpty { Text(message).font(.footnote) }
                }.disabled(connection.working)
                Section { Text("外出采集时无需联网。回到电脑所在 Wi-Fi 后再上传，电脑收到任务后独立训练。").font(.footnote).foregroundStyle(.secondary) }
            }.navigationTitle("连接电脑")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
        }
    }
}

struct CaptureSessionDetailView: View {
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var store: CaptureStore
    @EnvironmentObject private var connection: MobileConnection
    let projectId: UUID
    let sessionId: UUID
    @State private var engine = "nerfstudio"
    @State private var profile = "preview"
    @State private var frameInterval = 0.5
    @State private var uploadTask: Task<Void, Never>?
    @State private var selectedMedia: MediaRecord?
    @State private var settings = false
    @StateObject private var exporter = VideoLocalExporter()

    private var session: CaptureSessionRecord? {
        store.projects.first(where: { $0.id == projectId })?.sessions.first(where: { $0.id == sessionId })
    }

    var body: some View {
        ScrollView {
          LazyVStack(alignment: .leading, spacing: 18) {
            if let session {
                Section("原始素材") {
                    ForEach(session.media) { asset in
                        Button { selectedMedia = asset } label: {
                            CaptureMediaRow(asset: asset)
                        }
                        .disabled(connection.working || exporter.busy)
                    }
                    if session.media.isEmpty { Text("本批次没有已保存素材").foregroundStyle(.secondary) }
                }
                if session.media.contains(where: { $0.mode == .video }) {
                    Section("保存视频到手机") {
                        VideoLocalExportControls(exporter: exporter,
                            urls: session.media.filter { $0.mode == .video }.map { store.fileURL($0) },
                            disabled: connection.working)
                    }
                }
                Section("拍摄阶段记录") {
                    ForEach(CaptureStage.captureOrder) { stage in
                        HStack { Text(stage.title); Spacer(); Text(session.media.contains(where: { $0.stage == stage }) ? "有素材" : session.skippedStages.contains(stage) ? "已跳过" : "未采集").foregroundStyle(.secondary) }
                    }
                }
                if let job = session.jobId {
                    Section("训练任务") { NavigationLink("查看训练进度与成果") { ReconstructionStatusView(jobId: job, serverId: session.serverId) } }
                } else {
                    Section("上传并训练") {
                        Picker("方案", selection: $engine) { Text("原有方案").tag("original"); Text("Nerfstudio 普通").tag("nerfstudio"); Text("Nerfstudio Big").tag("nerfstudio-big") }
                            .pickerStyle(.menu).disabled(connection.working)
                        Picker("档位", selection: $profile) { Text("预览 · 15,000 步").tag("preview"); Text("均衡 · 30,000 步").tag("balanced"); Text("完整质量 · 45,000 步").tag("quality") }
                            .pickerStyle(.menu).disabled(connection.working)
                        if session.mode == .video { Stepper("抽帧间隔 \(frameInterval.formatted()) 秒", value: $frameInterval, in: 0.1...10, step: 0.1).disabled(connection.working) }
                        Button("连接电脑") { settings = true }.disabled(connection.working)
                        Button(connection.working ? "正在上传 / 预处理" : "上传此批次并训练") {
                            uploadTask = Task { await connection.upload(session: session, store: store, engine: engine, profile: profile, frameInterval: frameInterval) }
                        }.disabled(connection.working || session.media.isEmpty)
                        if connection.working { Button("暂停手机传输") { uploadTask?.cancel() } }
                        Text(connection.status).font(.footnote).foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                        UploadProgressView(progress: connection.transfer)
                        Text("上传时保持 APP 在前台。断线后可重试续传；收到任务编号后，电脑独立训练。").font(.footnote).foregroundStyle(.secondary)
                    }.disabled(exporter.busy)
                }
            }
          }.padding()
        }.navigationTitle("采集批次")
            .sheet(isPresented: $settings) { ConnectionSettingsView() }
            .sheet(item: $selectedMedia) { asset in LocalMediaPreview(asset: asset, url: store.fileURL(asset)) }
            .navigationBarBackButtonHidden(exporter.busy)
            .interactiveDismissDisabled(exporter.busy)
            .onChange(of: connection.working) { _, working in UIApplication.shared.isIdleTimerDisabled = working }
            .onChange(of: scenePhase) { _, phase in if phase == .background { uploadTask?.cancel() } }
            .onDisappear { uploadTask?.cancel(); UIApplication.shared.isIdleTimerDisabled = false }
    }
}

private struct CaptureMediaRow: View {
    let asset: MediaRecord
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Label("\(asset.stage.title) · \(asset.createdAt.formatted(date: .omitted, time: .shortened))",
                  systemImage: asset.mode == .photo ? "photo" : "video")
            Text(asset.duration.map { String(format: "%.1f 秒", $0) } ?? "照片原图")
                .font(.caption).foregroundStyle(.secondary)
            if let width = asset.pixelWidth, let height = asset.pixelHeight {
                Text("\(width) × \(height) · \(asset.codec ?? "")").font(.caption2).foregroundStyle(.secondary)
            }
            Text(ByteCountFormatter.string(fromByteCount: asset.byteCount ?? 0, countStyle: .file))
                .font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.vertical, 6)
    }
}

// Progress updates invalidate only this small view, not the batch and media list.
private struct UploadProgressView: View {
    @ObservedObject var progress: TransferProgress
    var body: some View {
        if let value = progress.value {
            VStack(alignment: .leading, spacing: 6) {
                Text("\(value.phase)文件 \(value.file)/\(value.files) · \(Int(value.fraction * 100))%")
                    .font(.footnote).monospacedDigit()
                ProgressView(value: value.fraction)
                Text("\(ByteCountFormatter.string(fromByteCount: value.bytes, countStyle: .file)) / \(ByteCountFormatter.string(fromByteCount: value.total, countStyle: .file))")
                    .font(.caption).monospacedDigit().foregroundStyle(.secondary)
            }.frame(maxWidth: .infinity, minHeight: 66, alignment: .leading)
        }
    }
}

struct LocalMediaPreview: View {
    @Environment(\.dismiss) private var dismiss
    let asset: MediaRecord
    let url: URL
    @State private var player: AVPlayer?
    @StateObject private var exporter = VideoLocalExporter()
    var body: some View {
        NavigationStack {
          VStack {
            if asset.mode == .photo {
                if let image = UIImage(contentsOfFile: url.path) { Image(uiImage: image).resizable().scaledToFit() }
                else { ContentUnavailableView("照片文件不可读", systemImage: "exclamationmark.triangle") }
            } else if let player { VideoPlayer(player: player) }
            if asset.mode == .video {
                VideoLocalExportControls(exporter: exporter, urls: [url]).padding()
            }
          }
          .navigationTitle(asset.mode == .video ? "视频预览" : "照片预览")
          .navigationBarTitleDisplayMode(.inline)
          .toolbar { ToolbarItem(placement: .confirmationAction) {
              Button("完成") { dismiss() }.disabled(exporter.busy)
          } }
        }.onAppear { if asset.mode == .video { player = AVPlayer(url: url) } }
            .onDisappear { player?.pause() }
            .onChange(of: exporter.busy) { _, busy in if busy { player?.pause() } }
            .interactiveDismissDisabled(exporter.busy)
    }
}

struct ReconstructionStatusView: View {
    @EnvironmentObject private var connection: MobileConnection
    let jobId: String
    let serverId: String?
    @State private var status = "正在读取任务"
    @State private var phase = ""
    @State private var progress: Double = 0
    @State private var completed = false
    @State private var showingResult = false
    var body: some View {
        Form {
            Section("电脑训练任务") {
                Text(jobId).font(.caption.monospaced())
                Text(status)
                if !phase.isEmpty { Text(phase).font(.footnote).foregroundStyle(.secondary) }
                ProgressView(value: min(100, max(0, progress)), total: 100)
                Text("阶段加权进度，不代表实际剩余时间").font(.caption).foregroundStyle(.secondary)
                if completed { Button("打开三维成果") { showingResult = true } }
            }
        }.navigationTitle("训练进度")
            .sheet(isPresented: $showingResult) {
                if let url = try? connection.baseURL() { ResultWebView(baseURL: url, token: connection.token, jobId: jobId) }
            }
            .task {
                do {
                    try await connection.probe()
                    if let serverId, serverId != connection.serverId { throw MobileError.message("请连接此任务所属的原训练电脑") }
                    while !Task.isCancelled {
                        let job = try await connection.request("api/jobs/\(jobId)")
                        let raw = job["status"] as? String ?? "unknown"
                        status = ["queued": "等待电脑计算队列", "processing": "电脑正在处理", "completed": "训练完成", "failed": "任务失败", "cancelled": "任务已取消"][raw] ?? raw
                        phase = (job["error"] as? String) ?? (job["phase"] as? String) ?? ""
                        progress = (job["progress"] as? NSNumber)?.doubleValue ?? 0
                        completed = raw == "completed"
                        if ["completed", "failed", "cancelled"].contains(raw) { break }
                        try await Task.sleep(for: .seconds(2))
                    }
                } catch is CancellationError { }
                catch { status = error.localizedDescription }
            }
    }
}

struct ResultWebView: UIViewRepresentable {
    let baseURL: URL
    let token: String
    let jobId: String
    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView()
        var components = URLComponents(url: baseURL.appendingPathComponent("viewer/mobile.html"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "job", value: jobId)]
        let properties: [HTTPCookiePropertyKey: Any] = [.domain: baseURL.host!, .path: "/", .name: "mobile_token", .value: token]
        if let cookie = HTTPCookie(properties: properties), let url = components.url {
            view.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) { view.load(URLRequest(url: url)) }
        }
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) { }
}
