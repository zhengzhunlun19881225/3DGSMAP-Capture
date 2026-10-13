import SwiftUI
import UIKit

struct ProjectListView: View {
    @EnvironmentObject private var store: CaptureStore
    @State private var showingNewProject = false
    @State private var newName = ""
    @State private var showingConnection = false

    var body: some View {
        NavigationStack {
            List {
                if store.projects.isEmpty {
                    ContentUnavailableView("还没有项目", systemImage: "cube.transparent", description: Text("创建项目后开始照片或视频采集"))
                }
                if let error = store.errorMessage { Text(error).foregroundStyle(.red).font(.footnote) }
                ForEach(store.projects) { project in
                    NavigationLink {
                        ProjectDetailView(project: project)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(project.name).font(.headline)
                            Text("\(store.mediaCount(project: project)) 个素材 · \(project.sessions.count) 个采集批次")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("我的项目")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button { showingConnection = true } label: { Label("连接电脑", systemImage: "desktopcomputer") } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingNewProject = true } label: { Label("新项目", systemImage: "plus") }.disabled(!store.canCapture)
                }
            }
            .sheet(isPresented: $showingConnection) { ConnectionSettingsView() }
            .sheet(isPresented: $showingNewProject) {
                NavigationStack {
                    Form { TextField("项目名称", text: $newName) }
                        .navigationTitle("新建项目")
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) { Button("取消") { showingNewProject = false } }
                            ToolbarItem(placement: .confirmationAction) {
                                Button("创建") { _ = store.createProject(name: newName); newName = ""; showingNewProject = false }
                            }
                        }
                }
                .presentationDetents([.medium])
            }
        }
    }
}

struct ProjectDetailView: View {
    @EnvironmentObject private var store: CaptureStore
    @EnvironmentObject private var connection: MobileConnection
    let project: CaptureProject
    @State private var captureRoute: CaptureRoute?
    @State private var pendingDeletion: CaptureSessionRecord?
    @State private var deletionAlert = false
    @State private var deletionError: String?

    private var current: CaptureProject { store.projects.first(where: { $0.id == project.id }) ?? project }

    var body: some View {
        List {
            Section("开始采集") {
                Button { begin(.photo) } label: { Label("照片采集", systemImage: "camera") }
                Button { begin(.video) } label: { Label("视频采集", systemImage: "video") }
            }.disabled(!store.canCapture)
            Section("项目记录") {
                if current.sessions.isEmpty { Text("照片、视频和阶段记录会归到同一项目").foregroundStyle(.secondary) }
                ForEach(current.sessions) { session in
                    NavigationLink {
                        CaptureSessionDetailView(projectId: current.id, sessionId: session.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("\(session.mode.title) · \(session.createdAt.formatted(date: .abbreviated, time: .shortened))")
                            Text("\(session.media.count) 个素材 · 跳过 \(session.skippedStages.count) 个阶段")
                                .font(.caption).foregroundStyle(.secondary)
                            if let job = session.jobId { Text("任务 \(job)").font(.caption).foregroundStyle(.green) }
                        }
                    }
                    .accessibilityIdentifier("capture.session.\(session.id.uuidString)")
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button("删除", role: .destructive) {
                            pendingDeletion = session
                            deletionAlert = true
                        }
                            .disabled(connection.working || !store.canCapture)
                    }
                    if session.endedAt == nil && session.serverId == nil {
                        Button("继续未完成的\(session.mode.title)") {
                            store.restoreSession(session.id)
                            captureRoute = CaptureRoute(id: session.id, mode: session.mode)
                        }
                    }
                }
            }
            Section("下一步") {
                Label("回到训练电脑所在 Wi-Fi 后上传", systemImage: "wifi")
                    .font(.footnote).foregroundStyle(.secondary)
                Text("点击采集批次，检查素材并上传训练").font(.footnote)
            }
        }
        .navigationTitle(current.name)
        .alert("删除采集记录？", isPresented: $deletionAlert, presenting: pendingDeletion) { session in
            Button("取消", role: .cancel) { pendingDeletion = nil }
            Button("删除", role: .destructive) {
                guard !connection.working else {
                    deletionError = "正在上传素材，请结束传输后再删除"; return
                }
                let deleted = store.deleteSession(sessionId: session.id)
                pendingDeletion = nil
                if !deleted || store.errorMessage != nil { deletionError = store.errorMessage ?? "删除失败，请重试" }
            }
        } message: { session in
            Text("将删除这条\(session.mode.title)记录及其 \(session.media.count) 个本机素材，删除后无法恢复。电脑上的任务和成果会保留。")
        }
        .alert("删除提示", isPresented: Binding(get: { deletionError != nil }, set: { if !$0 { deletionError = nil } })) {
            Button("知道了", role: .cancel) { deletionError = nil }
        } message: { Text(deletionError ?? "") }
        .fullScreenCover(item: $captureRoute) { route in
            CaptureView(projectId: current.id, sessionId: route.id, mode: route.mode)
                .environmentObject(store)
        }
    }

    private func begin(_ mode: CaptureMode) {
        let sessionId = store.startSession(projectId: current.id, mode: mode)
        captureRoute = CaptureRoute(id: sessionId, mode: mode)
    }
}

struct CaptureView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var store: CaptureStore
    @StateObject private var camera = CameraService()
    @StateObject private var motion = MotionService()
    let projectId: UUID
    let sessionId: UUID
    let mode: CaptureMode
    @State private var flow = CaptureFlow()
    @State private var linePosition = CaptureStage.middle.linePosition
    @State private var landscape = false
    @State private var settings = false
    @State private var permissionAlert = false
    @State private var exitAlert = false
    @State private var showingBatch = false
    @State private var showGhost = false
    @State private var lastPhoto: UIImage?
    @State private var intervalEnabled = false
    @State private var intervalRunning = false
    @State private var intervalTimer: Timer?
    @State private var feedback = ""

    private var sessionRecord: CaptureSessionRecord? {
        store.projects.first(where: { $0.id == projectId })?.sessions.first(where: { $0.id == sessionId })
    }
    private var needsRotation: Bool { mode == .video && !landscape && flow.screen != .review }
    private var recording: Bool { flow.inFlight && mode == .video }
    private var savedCount: Int { sessionRecord?.media.count ?? 0 }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if flow.screen == .review { completion }
            else {
                CameraPreview(session: camera.session).ignoresSafeArea()
                if flow.screen == .ready && !needsRotation {
                    ReferenceOverlay(stage: flow.stage, linePosition: linePosition, showGhost: showGhost, lastPhoto: lastPhoto)
                    captureControls
                }
                if flow.screen != .ready || needsRotation {
                    Color.black.opacity(needsRotation ? 0.96 : 0.82).ignoresSafeArea()
                    if needsRotation { rotationPrompt }
                    else if flow.screen == .positioning { positioning }
                    else { tutorial }
                }
                header
                if flow.screen != .ready && !feedback.isEmpty && !needsRotation {
                    VStack { Spacer(); Text(feedback).font(.caption).multilineTextAlignment(.center)
                        .padding(10).background(.black.opacity(0.8), in: Capsule()) }.padding(.bottom, 6)
                        .allowsHitTesting(false)
                }
                if flow.saving {
                    Color.black.opacity(0.6).ignoresSafeArea()
                    VStack(spacing: 12) { ProgressView().tint(.white); Text("正在保存当前素材…").font(.subheadline) }
                        .padding(24).background(.black.opacity(0.7), in: RoundedRectangle(cornerRadius: 18))
                }
            }
        }
        .foregroundStyle(.white)
        .preferredColorScheme(.dark)
        .statusBarHidden(true)
        .onAppear(perform: prepare)
        .onDisappear { stopInterval(); camera.pauseSession(); motion.stop(); UIDevice.current.endGeneratingDeviceOrientationNotifications() }
        .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in updateRotation() }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                stopInterval(); camera.pauseSession(); motion.stop()
                feedback = "拍摄已暂停，已拍素材会保留"
            } else if flow.screen != .review { camera.requestAndConfigure(); motion.start(); updateRotation() }
        }
        .onChange(of: camera.errorMessage) { _, error in
            if let error { feedback = error; stopInterval(); _ = flow.mediaSaved(success: false) }
        }
        .onChange(of: camera.isBusy) { _, busy in if !busy { updateRotation() } }
        .onChange(of: camera.permissionDenied) { _, denied in permissionAlert = denied }
        .alert("相机不可用", isPresented: $permissionAlert) {
            Button("打开设置") { if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) } }
            Button("暂不设置", role: .cancel) { }
        } message: { Text("请在系统设置中允许相机权限后拍摄") }
        .alert("结束本次采集？", isPresented: $exitAlert) {
            Button("保存并退出") { request(.exit) }
            Button("继续拍摄", role: .cancel) { }
        } message: { Text("当前片段会先保存，已拍素材保留在项目中。") }
        .sheet(isPresented: $settings) { captureSettings }
        .sheet(isPresented: $showingBatch) {
            NavigationStack {
                CaptureSessionDetailView(projectId: projectId, sessionId: sessionId)
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { showingBatch = false } } }
            }
        }
    }

    private var header: some View {
        VStack {
            HStack(alignment: .center) {
                Button { if flow.inFlight || savedCount > 0 { exitAlert = true } else { request(.exit) } } label: {
                    Image(systemName: "xmark").font(.system(size: 20, weight: .medium)).frame(width: 44, height: 44)
                        .background(.black.opacity(0.24), in: Circle()).overlay(Circle().stroke(.white.opacity(0.18)))
                }.accessibilityLabel("退出采集")
                Spacer()
                if recording && !needsRotation {
                    if let started = camera.recordingStartedAt {
                        TimelineView(.periodic(from: started, by: 1)) { context in
                            let seconds = max(0, Int(context.date.timeIntervalSince(started)))
                            HStack(spacing: 6) {
                                Circle().fill(.red).frame(width: 6, height: 6)
                                Text(String(format: "%02d:%02d", seconds / 60, seconds % 60)).monospacedDigit()
                            }.font(.caption).padding(10).background(.black.opacity(0.45), in: Capsule())
                        }
                    }
                    Button { request(flow.stage == .detail ? .finish : .next) } label: {
                        Text(flow.stage == .detail ? "完成 (4/4)" : "下一步 (\(flow.stage.number)/4)")
                            .font(.subheadline.weight(.semibold)).padding(.horizontal, 20).frame(height: 44)
                            .foregroundStyle(.black).background(.white, in: RoundedRectangle(cornerRadius: 12))
                    }.accessibilityIdentifier("capture.next").disabled(flow.saving)
                } else if flow.screen == .ready && !needsRotation {
                    Button { settings = true } label: {
                        Image(systemName: "slider.horizontal.3").font(.system(size: 20)).frame(width: 44, height: 44)
                            .background(.black.opacity(0.35), in: RoundedRectangle(cornerRadius: 12))
                    }.accessibilityLabel("拍摄设置")
                }
            }
            Spacer()
        }.padding(.horizontal, 18).padding(.top, 12)
    }

    private var rotationPrompt: some View {
        VStack(spacing: 24) {
            Image(systemName: "iphone.gen3.landscape").font(.system(size: 72, weight: .ultraLight))
            Image(systemName: "arrow.triangle.2.circlepath").font(.system(size: 26))
            Text("请将手机横置").font(.title3.weight(.semibold))
            if recording {
                Text("当前片段仍在录制，请恢复横屏").font(.footnote).foregroundStyle(.white.opacity(0.65))
                Button("结束并保存片段") { request(.finish) }.buttonStyle(.bordered)
            }
        }.accessibilityIdentifier("capture.rotation")
    }

    private var positioning: some View {
        VStack(spacing: 20) {
            RoomGuideIllustration(stage: .middle, positioning: true).frame(width: 210, height: 110)
                .overlay(alignment: .bottomTrailing) {
                    Image(systemName: "location.north.fill").font(.system(size: 32))
                        .foregroundStyle(.blue).offset(y: 8)
                }
            Text("请站在房间边缘，背靠墙面").font(.title3.weight(.semibold))
            whiteButton("已就位", id: "capture.positioned") { flow.screen = .tutorial }
        }.padding(.top, 32)
    }

    private var tutorial: some View {
        GeometryReader { proxy in
            VStack(spacing: 12) {
                if mode == .video {
                    HStack(spacing: 16) {
                        ForEach(CaptureStage.captureOrder) { stage in
                            Text("\(stage.number)").font(.subheadline.weight(.semibold)).frame(width: 28, height: 28)
                                .background(stage == flow.stage ? .white.opacity(0.25) : .clear, in: Circle())
                                .overlay(Circle().stroke(.white.opacity(0.25)))
                                .foregroundStyle(stage.number < flow.stage.number ? .green : .white)
                        }
                    }.accessibilityLabel("第 \(flow.stage.number) 步，共 4 步")
                }
                Text(mode == .video ? "第\(flow.stage.number)步：\(flow.stage.guideTitle)" : "照片采集准备")
                    .font(.title3.weight(.semibold)).accessibilityIdentifier("capture.guideTitle")
                if mode == .video {
                    AnimatedRoomGuide(stage: flow.stage)
                        .frame(width: min(300, proxy.size.width - 80), height: min(120, proxy.size.height * 0.30))
                        .padding(12).background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 16))
                } else { Image(systemName: "camera.viewfinder").font(.system(size: 44)).padding(12) }
                Text(mode == .video ? flow.stage.instruction : "缓慢移动机位，保持相邻照片重叠。原图保存在手机。")
                    .font(.subheadline).foregroundStyle(.white.opacity(0.75)).multilineTextAlignment(.center)
                HStack(spacing: 16) {
                    if mode == .video {
                        Button("跳过") { skipStage() }.font(.subheadline.weight(.medium))
                            .frame(width: 140, height: 44).overlay(RoundedRectangle(cornerRadius: 10).stroke(.white.opacity(0.25)))
                            .accessibilityIdentifier("capture.skip")
                    }
                    whiteButton(mode == .video && flow.stage == .detail ? "开始拍摄" : "进入拍摄", id: "capture.continue") {
                        flow.screen = .ready
                        feedback = camera.errorMessage ?? ""
                        if mode == .video && flow.stage == .detail && camera.isConfigured { shutter() }
                    }
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity).padding(.top, 44).padding(.bottom, 12)
        }
    }

    private var captureControls: some View {
        GeometryReader { proxy in
            if !recording && !intervalRunning {
                VStack(spacing: 10) {
                    if mode == .video {
                        AnimatedRoomGuide(stage: flow.stage).frame(width: 150, height: 92)
                            .padding(8).background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 6))
                    }
                    Text(mode == .video ? flow.stage.instruction : "保持相邻照片重叠，缓慢移动机位")
                        .font(.subheadline.weight(.medium)).multilineTextAlignment(.center)
                    Text(mode == .video ? "点击红色按钮开始拍摄" : "点击白色按钮拍摄")
                        .font(.caption).foregroundStyle(.white.opacity(0.75))
                    if mode == .video {
                        Button("查看步骤") { flow.screen = .tutorial }.font(.caption).padding(8)
                            .accessibilityIdentifier("capture.help")
                    }
                }.frame(width: max(180, proxy.size.width - (landscape ? 200 : 40)))
                    .position(x: proxy.size.width / 2, y: proxy.size.height * (landscape ? 0.58 : 0.40))
            }
            if !recording || mode == .photo {
                Button(action: shutter) {
                    ZStack {
                        Circle().stroke(.white, lineWidth: 3).frame(width: 70, height: 70)
                        Circle().fill(mode == .video ? Color(red: 1, green: 0.24, blue: 0.21) : .white).frame(width: 61, height: 61)
                        if intervalRunning { RoundedRectangle(cornerRadius: 4).fill(.black).frame(width: 20, height: 20) }
                    }
                }.accessibilityLabel(intervalRunning ? "停止间隔拍摄" : mode == .video ? "开始录制" : "拍摄照片")
                    .disabled(!camera.isConfigured || flow.inFlight || camera.isBusy)
                    .position(x: landscape ? proxy.size.width - 55 : proxy.size.width / 2, y: landscape ? proxy.size.height / 2 : proxy.size.height - 70)
            }
            VStack {
                Spacer()
                if motion.isMovingTooFast && flow.inFlight {
                    Label("转动较快，请放慢", systemImage: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                        .font(.subheadline).padding(10).background(.black.opacity(0.7), in: Capsule())
                } else if recording && flow.stage == .detail {
                    Text("环绕拍摄各物体，补充细节").font(.caption).padding(10).background(.black.opacity(0.6), in: Capsule())
                }
                if !feedback.isEmpty {
                    Text(feedback).font(.caption).multilineTextAlignment(.center).padding(10)
                        .background(.black.opacity(0.7), in: Capsule()).accessibilityIdentifier("capture.feedback")
                }
                if mode == .photo {
                    Button("完成拍摄") { request(.finish) }.buttonStyle(.bordered).disabled(flow.saving)
                        .padding(.bottom, landscape ? 0 : 105)
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity).padding(.horizontal, 70).padding(.bottom, 12)
        }
    }

    private var completion: some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 42)).foregroundStyle(.green)
            Text("采集已保存").font(.title2.weight(.semibold))
            Text("\(savedCount) 个素材已保存在手机").font(.subheadline).foregroundStyle(.white.opacity(0.65))
            if mode == .video {
                HStack(spacing: 24) {
                    ForEach(CaptureStage.captureOrder) { stage in
                        VStack(spacing: 6) {
                            Image(systemName: sessionRecord?.media.contains(where: { $0.stage == stage }) == true ? "checkmark.circle.fill" : "minus.circle")
                                .foregroundStyle(sessionRecord?.media.contains(where: { $0.stage == stage }) == true ? .green : .gray)
                            Text(stage.title).font(.caption)
                            Text(sessionRecord?.media.contains(where: { $0.stage == stage }) == true ? "已拍摄" : sessionRecord?.skippedStages.contains(stage) == true ? "已跳过" : "未拍摄")
                                .font(.caption2).foregroundStyle(.white.opacity(0.5))
                        }
                    }
                }
            }
            HStack(spacing: 16) {
                Button("返回项目") { dismiss() }.frame(width: 140, height: 44)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(.white.opacity(0.25)))
                whiteButton("检查素材与上传", id: "capture.review") { showingBatch = true }
            }
        }.padding(24)
    }

    private var captureSettings: some View {
        NavigationStack {
            Form {
                Section("采集分辨率") {
                    Picker("分辨率", selection: Binding(get: { camera.resolution }, set: { camera.setResolution($0) })) {
                        ForEach(CaptureResolution.allCases) { resolution in
                            Text(resolution.title).tag(resolution)
                                .disabled(!camera.supportedResolutions.contains(resolution))
                        }
                    }.pickerStyle(.segmented).accessibilityIdentifier("capture.resolution")
                        .disabled(!camera.isConfigured || camera.isBusy || flow.inFlight || intervalRunning)
                    if camera.isChangingResolution {
                        ProgressView("正在切换相机分辨率…")
                    } else if camera.isConfigured {
                        Text("\(camera.resolution.dimensionsLabel) · 视频 30 fps")
                            .accessibilityIdentifier("capture.resolution.applied")
                    } else { Text("相机就绪后可切换分辨率").foregroundStyle(.secondary) }
                    Text("照片与视频使用此分辨率。照片按 16:9 保存；竖拍时宽高互换。录制、保存或间隔拍摄中不能切换。")
                        .font(.footnote).foregroundStyle(.secondary)
                    if let error = camera.errorMessage { Text(error).font(.footnote).foregroundStyle(.orange) }
                }
                if mode == .video {
                    Section("视频防抖") {
                        Toggle("启用视频防抖", isOn: Binding(
                            get: { camera.videoStabilizationEnabled },
                            set: { camera.setVideoStabilization($0) }
                        ))
                        .accessibilityIdentifier("capture.video-stabilization")
                        .disabled(!camera.isConfigured || (!camera.videoStabilizationAvailable && !camera.videoStabilizationEnabled) || camera.isBusy || flow.inFlight || intervalRunning)
                        if camera.videoStabilizationEnabled && camera.videoStabilizationActive {
                            Text("已生效：录制画面会更平滑。防抖会裁切或轻微变形画面，重建几何精度可能下降。")
                                .font(.footnote).foregroundStyle(.secondary)
                        } else if !camera.videoStabilizationAvailable {
                            Text("当前相机或分辨率不支持视频防抖。")
                                .font(.footnote).foregroundStyle(.secondary)
                        } else if camera.videoStabilizationEnabled {
                            Text("已开启防抖，实际生效状态由相机确定。")
                                .font(.footnote).foregroundStyle(.secondary)
                        } else {
                            Text("默认关闭，适合需要保持重建几何精度的采集。")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
                Section("自动防强光") {
                    Toggle("启用自动防强光", isOn: Binding(
                        get: { camera.highlightProtectionEnabled },
                        set: { camera.setHighlightProtection($0) }
                    ))
                    .accessibilityIdentifier("capture.highlight-protection")
                    .disabled(!camera.isConfigured || (!camera.highlightProtectionAvailable && !camera.highlightProtectionEnabled) || camera.isBusy || flow.inFlight || intervalRunning)
                    if !camera.isConfigured {
                        Text("相机就绪后可开启。").font(.footnote).foregroundStyle(.secondary)
                    } else if !camera.highlightProtectionAvailable {
                        Text("当前相机无法使用自动防强光。").font(.footnote).foregroundStyle(.secondary)
                    } else if camera.highlightProtectionEnabled {
                        Text(camera.highlightExposureBias < -0.05
                             ? String(format: "亮部保护中：曝光 %.1f EV", camera.highlightExposureBias)
                             : "已开启，正在自动检测画面高亮。")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                    Text("默认关闭。开启后自动降低高亮场景曝光，光线恢复时缓慢回调；照片和视频均生效。暗部可能变暗，不能消除镜头眩光。拍摄中不能切换。")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                if mode == .video && flow.stage != .detail {
                    Section("手动对齐参考线") {
                        Slider(value: $linePosition, in: 0.18...0.82)
                        Button("恢复本阶段位置") { linePosition = flow.stage.linePosition }
                        Text("将参考线对齐墙面交界。它只显示在预览中，不会写入视频。").font(.footnote).foregroundStyle(.secondary)
                    }
                }
                if mode == .photo {
                    Toggle("2 秒间隔拍摄", isOn: $intervalEnabled).disabled(intervalRunning)
                    Toggle("显示上一张照片参考", isOn: $showGhost)
                }
                Section("拍摄提示") {
                    Text("缓慢绕行，保持相邻画面重叠。转动过快时会出现橙色提醒。")
                    Text("\(savedCount) 个素材已保存到本次采集")
                }
            }.navigationTitle("拍摄设置")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { settings = false } } }
        }
    }

    private func whiteButton(_ text: String, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { Text(text).font(.subheadline.weight(.semibold)).frame(minWidth: 140).padding(.horizontal, 18).frame(height: 44) }
            .foregroundStyle(.black).background(.white, in: RoundedRectangle(cornerRadius: 10)).accessibilityIdentifier(id)
    }

    private func prepare() {
        camera.onPhotoSaved = { url in
            lastPhoto = UIImage(contentsOfFile: url.path)
            let saved = store.addMedia(sessionId: sessionId, url: url, mode: .photo, stage: flow.capturedStage, duration: nil)
            mediaSaved(saved)
        }
        camera.onVideoSaved = { url, duration, width, height, codec in
            let saved = store.addMedia(sessionId: sessionId, url: url, mode: .video, stage: flow.capturedStage, duration: duration, width: width, height: height, codec: codec)
            mediaSaved(saved)
        }
        if mode == .photo { flow.screen = .tutorial }
        if let record = sessionRecord {
            if let last = record.media.last {
                flow.stage = last.stage
                if last.mode == .photo { lastPhoto = UIImage(contentsOfFile: store.fileURL(last).path) }
            }
            if let activeStage = record.activeStage { flow.stage = activeStage }
            while record.skippedStages.contains(flow.stage), let next = flow.stage.next { flow.stage = next }
        }
        linePosition = flow.stage.linePosition
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
        camera.requestAndConfigure(); motion.start(); updateRotation()
    }

    private func shutter() {
        if intervalRunning { stopInterval(); return }
        // Read the current scene orientation again immediately before capture.
        updateRotation()
        guard camera.isConfigured, !camera.isBusy, (mode == .photo || landscape), flow.beginCapture() else { return }
        feedback = ""; camera.errorMessage = nil
        if mode == .video { camera.toggleVideo() }
        else {
            camera.capturePhoto()
            if intervalEnabled {
                intervalRunning = true
                intervalTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { _ in
                    updateRotation()
                    guard !flow.inFlight, !camera.isBusy, flow.beginCapture() else { return }
                    camera.capturePhoto()
                }
            }
        }
    }

    private func mediaSaved(_ success: Bool) {
        let action = flow.mediaSaved(success: success)
        feedback = success ? "\(mode == .video ? "视频片段" : "照片")已保存" : (store.errorMessage ?? "保存失败，请重试")
        if !success { stopInterval() }
        if let action { apply(action) }
    }

    private func request(_ action: CaptureCompletionAction) {
        stopInterval()
        if flow.request(action) { apply(action) }
        else if flow.saving { camera.stop() }
    }

    private func apply(_ action: CaptureCompletionAction) {
        if action == .next, let next = flow.stage.next {
            if store.checkpoint(stage: next, sessionId: sessionId) {
                flow.advance(); linePosition = flow.stage.linePosition; feedback = ""
            } else { feedback = store.errorMessage ?? "阶段记录保存失败，请重试" }
        } else if store.finishSession(sessionId: sessionId) {
            camera.pauseSession(); motion.stop()
            if action == .exit { dismiss() } else { flow.screen = .review }
        } else { feedback = store.errorMessage ?? "项目保存失败，请重试" }
    }

    private func skipStage() {
        guard !flow.inFlight, store.skip(stage: flow.stage, sessionId: sessionId) else {
            feedback = store.errorMessage ?? "阶段记录保存失败"; return
        }
        apply(flow.stage == .detail ? .finish : .next)
    }
    private func stopInterval() { intervalTimer?.invalidate(); intervalTimer = nil; intervalRunning = false }
    private func updateRotation() {
        let orientation = (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.interfaceOrientation ?? .portrait
        landscape = orientation.isLandscape
        guard !flow.inFlight, !camera.isBusy else { return }
        let angle = CaptureOrientation.cameraRotation(for: orientation)
        camera.setRotation(angle)
    }
}

struct ReferenceOverlay: View {
    let stage: CaptureStage
    let linePosition: Double
    let showGhost: Bool
    let lastPhoto: UIImage?
    private let guideColor = Color(red: 0.35, green: 0.98, blue: 0.63)
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                if showGhost, let lastPhoto {
                    Image(uiImage: lastPhoto).resizable().scaledToFill().frame(width: proxy.size.width, height: proxy.size.height).clipped().opacity(0.20)
                }
                if stage == .detail {
                    Image(systemName: "viewfinder").resizable().fontWeight(.ultraLight).frame(width: min(320, proxy.size.width * 0.6), height: min(210, proxy.size.height * 0.65))
                        .foregroundStyle(guideColor)
                    Image(systemName: "plus").foregroundStyle(guideColor).font(.system(size: 20, weight: .ultraLight))
                } else {
                    Path { path in
                        path.move(to: CGPoint(x: 0, y: proxy.size.height * linePosition))
                        path.addLine(to: CGPoint(x: proxy.size.width, y: proxy.size.height * linePosition))
                    }.stroke(guideColor.opacity(0.85), style: StrokeStyle(lineWidth: 2, dash: [5, 5]))
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity)
        }.allowsHitTesting(false).accessibilityHidden(true)
    }
}

struct AnimatedRoomGuide: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let stage: CaptureStage
    var body: some View {
        Group {
            if stage == .upper || stage == .lower {
                TimelineView(.animation(minimumInterval: 0.05, paused: reduceMotion)) { context in
                    let phase = reduceMotion ? 0.5 : (sin(context.date.timeIntervalSinceReferenceDate * 2) + 1) / 2
                    RoomGuideIllustration(stage: stage).overlay {
                        Image(systemName: stage == .upper ? "arrow.up" : "arrow.down")
                            .font(.system(size: 30, weight: .bold)).foregroundStyle(.green.opacity(0.45 + phase * 0.55))
                            .offset(y: stage == .upper ? -phase * 12 : phase * 12)
                    }
                }
            } else {
                RoomGuideIllustration(stage: stage)
            }
        }.accessibilityLabel(stage.guideTitle)
    }
}

struct RoomGuideIllustration: View {
    let stage: CaptureStage
    var positioning = false
    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let height = geometry.size.height
            let inset: CGFloat = 20
            ZStack {
                if positioning {
                    Path { path in
                        path.move(to: CGPoint(x: width - 2, y: 2))
                        path.addLine(to: CGPoint(x: width - inset, y: inset))
                        path.addLine(to: CGPoint(x: width - inset, y: height - inset))
                        path.addLine(to: CGPoint(x: width - 2, y: height - 2))
                        path.closeSubpath()
                    }.fill(.blue.opacity(0.30))
                }
                Path { path in
                    path.addRect(CGRect(x: 2, y: 2, width: width - 4, height: height - 4))
                    path.addRect(CGRect(x: inset, y: inset, width: width - inset * 2, height: height - inset * 2))
                    for point in [CGPoint(x: 2, y: 2), CGPoint(x: width - 2, y: 2), CGPoint(x: 2, y: height - 2), CGPoint(x: width - 2, y: height - 2)] {
                        path.move(to: point)
                        path.addLine(to: CGPoint(x: point.x < width / 2 ? inset : width - inset, y: point.y < height / 2 ? inset : height - inset))
                    }
                }.stroke(.white.opacity(0.65), lineWidth: 1)
                if !positioning && stage != .detail {
                    Path { path in
                        let y = stage == .upper ? inset : stage == .lower ? height - inset : height / 2
                        path.move(to: CGPoint(x: inset, y: y))
                        path.addLine(to: CGPoint(x: width - inset, y: y))
                    }.stroke(.green, style: StrokeStyle(lineWidth: 3, dash: [6, 5]))
                }
            }
        }.accessibilityLabel("房间拍摄参考示意：\(stage.title)")
    }
}
