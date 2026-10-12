import Foundation
import Combine
import Security

enum MobileError: LocalizedError {
    case message(String)
    case http(Int, String)
    var errorDescription: String? { switch self { case .message(let message), .http(_, let message): message } }
}

@MainActor
final class TransferProgress: ObservableObject {
    @Published var value: UploadProgress?
}

@MainActor
final class MobileConnection: ObservableObject {
    @Published var address = UserDefaults.standard.string(forKey: "mobile.server.address") ?? ""
    @Published var token = ""
    @Published private(set) var serverId: String?
    @Published private(set) var status = "尚未连接电脑"
    @Published private(set) var working = false
    let transfer = TransferProgress()
    private let service = "com.3dgsmap.capture.connection"

    init() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: "lan-token", kSecReturnData as String: true]
        var result: CFTypeRef?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data {
            token = String(data: data, encoding: .utf8) ?? ""
        }
    }

    func baseURL() throws -> URL {
        let value = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let components = URLComponents(string: value), let url = components.url,
              ["http", "https"].contains(components.scheme?.lowercased() ?? ""),
              components.host != nil, components.user == nil, components.password == nil,
              components.query == nil, components.fragment == nil,
              components.path == "" || components.path == "/" else {
            throw MobileError.message("请输入电脑地址，例如 http://192.168.1.10:8788")
        }
        guard !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw MobileError.message("请输入电脑连接密钥") }
        return url
    }

    private func saveSettings() throws {
        UserDefaults.standard.set(address, forKey: "mobile.server.address")
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: "lan-token"]
        let data = Data(token.utf8)
        let result = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if result == errSecItemNotFound {
            var create = query
            create[kSecValueData as String] = data
            create[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(create as CFDictionary, nil) == errSecSuccess else { throw MobileError.message("连接密钥无法写入钥匙串") }
        } else if result != errSecSuccess { throw MobileError.message("连接密钥无法更新") }
    }

    func request(_ path: String, method: String = "GET", payload: [String: Any]? = nil, bytes: Data? = nil) async throws -> [String: Any] {
        let url = try baseURL().appendingPathComponent(path)
        var request = URLRequest(url: url, timeoutInterval: 120)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let payload {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        }
        if let bytes {
            request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
            request.httpBody = bytes
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw MobileError.message("电脑响应无效") }
        let result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard (200...299).contains(response.statusCode) else { throw MobileError.http(response.statusCode, result["error"] as? String ?? "HTTP \(response.statusCode)") }
        return result
    }

    func probe() async throws {
        let result = try await request("api/mobile/health")
        guard (result["mobile_api_version"] as? Int) == 1, let id = result["server_id"] as? String else {
            throw MobileError.message("这个地址不是手机接入服务，请使用 8788 端口")
        }
        serverId = id
        try saveSettings()
        status = (result["training_online"] as? Bool) == true ? "已连接电脑，训练 API 在线" : "已连接接入服务，训练 API 离线"
    }

    func upload(session: CaptureSessionRecord, store: CaptureStore, engine: String, profile: String, frameInterval: Double) async {
        guard !working else { return }
        working = true
        transfer.value = nil
        status = "正在连接电脑"
        defer { working = false }
        do {
            try await probe()
            guard let currentServer = serverId else { throw MobileError.message("电脑身份读取失败") }
            if let previousServer = session.serverId, previousServer != currentServer {
                throw MobileError.message("当前电脑与此批次的训练电脑不同，请连接原电脑")
            }
            if let job = session.jobId {
                status = "该批次已提交任务 \(job)，请查看进度"; return
            }
            if session.serverId != currentServer { store.attachServer(sessionId: session.id, serverId: currentServer) }
            if session.endedAt == nil && !store.finishSession(sessionId: session.id) {
                throw MobileError.message(store.errorMessage ?? "批次记录保存失败")
            }
            let id = session.id.uuidString
            // Recover an accepted job before rereading originals or resubmitting.
            do {
                let existing = try await request("api/capture-sessions/\(id)")
                if let job = existing["job_id"] as? String {
                    store.attachJob(sessionId: session.id, serverId: currentServer, jobId: job)
                    status = "已恢复任务 \(job)"; return
                }
                if ["queued", "preparing", "submitting", "submitted", "submission_uncertain"].contains(existing["status"] as? String ?? "") {
                    try await waitForJob(id: id, session: session, store: store, server: currentServer)
                    return
                }
            } catch MobileError.http(404, _) { /* First upload has no server receipt. */ }
              catch MobileError.http(400, let message) where message == "采集批次不存在" { /* Older v1 gateway. */ }
            status = "正在校验手机原始素材"
            let files = session.media.map { UploadInput(id: $0.id.uuidString, url: store.fileURL($0), mode: $0.mode.rawValue,
                stage: $0.stage.rawValue, capturedAt: $0.createdAt.timeIntervalSince1970) }
            let cacheRoot = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            let worker = UploadFileWorker(cacheURL: cacheRoot.appendingPathComponent("GSMapCapture/\(id)-checksums.json"))
            let manifests = try await worker.manifests(files) { [weak self] update in
                await MainActor.run { self?.transfer.value = update }
            }
            try Task.checkCancellation()
            let manifest = manifests.map(\.json)
            status = "正在创建电脑上传批次"
            var remote = try await request("api/capture-sessions", method: "POST", payload: [
                "session_id": id, "project_id": session.projectId.uuidString, "mode": session.mode.rawValue,
                "expected_assets": manifest, "events": session.skippedStages.map { ["stage": $0.rawValue, "action": "skipped"] }])
            if let existing = remote["job_id"] as? String {
                store.attachJob(sessionId: session.id, serverId: currentServer, jobId: existing)
                status = "已恢复任务 \(existing)"; return
            }
            remote = try await request("api/capture-sessions/\(id)")
            let chunks = remote["received_chunks"] as? [String: [Int]] ?? [:]
            let completeAssets = Set((remote["assets"] as? [[String: Any]] ?? []).compactMap { $0["asset_id"] as? String })
            let total = manifests.reduce(Int64(0)) { $0 + $1.size }
            var confirmed: Int64 = 0
            for item in manifests {
                if completeAssets.contains(item.input.id) { confirmed += item.size; continue }
                for index in Set(chunks[item.input.id] ?? []) where index >= 0 && index < item.chunkCount {
                    confirmed += min(Int64(UploadFileWorker.chunkSize), item.size - Int64(index) * Int64(UploadFileWorker.chunkSize))
                }
            }
            status = "正在上传素材"
            var lastUpdate = ContinuousClock.now
            for (number, item) in manifests.enumerated() {
                try Task.checkCancellation()
                let assetId = item.input.id
                if completeAssets.contains(assetId) { continue }
                transfer.value = UploadProgress(phase: "上传", file: number + 1, files: manifests.count, bytes: confirmed, total: total)
                for index in 0..<item.chunkCount {
                    try Task.checkCancellation()
                    if chunks[assetId]?.contains(index) == true { continue }
                    let data = try await worker.chunk(item, index: index)
                    try Task.checkCancellation()
                    _ = try await request("api/capture-sessions/\(id)/assets/\(assetId)/chunks/\(index)", method: "PUT", bytes: data)
                    confirmed += Int64(data.count)
                    if lastUpdate.duration(to: .now) >= .milliseconds(250) || index == item.chunkCount - 1 {
                        transfer.value = UploadProgress(phase: "上传", file: number + 1, files: manifests.count, bytes: confirmed, total: total)
                        lastUpdate = .now
                    }
                }
                _ = try await request("api/capture-sessions/\(id)/complete", method: "POST", payload: manifest[number])
            }
            try Task.checkCancellation()
            transfer.value = nil
            status = "上传完成，正在提交抽帧任务"
            _ = try await request("api/capture-sessions/\(id)/reconstruct", method: "POST", payload: [
                "frame_interval": frameInterval, "metadata": ["engine": engine, "profile": profile]])
            try await waitForJob(id: id, session: session, store: store, server: currentServer)
        } catch {
            if Task.isCancelled || error is CancellationError || (error as? URLError)?.code == .cancelled {
                status = "上传已暂停，再次上传将从电脑确认的分块继续"
            } else { status = error.localizedDescription + "；保留原件，可重试续传" }
        }
    }

    private func waitForJob(id: String, session: CaptureSessionRecord, store: CaptureStore, server: String) async throws {
            transfer.value = nil
            status = "等待电脑确认任务"
            for _ in 0..<1800 {
                try Task.checkCancellation()
                let result = try await request("api/capture-sessions/\(id)")
                if let jobId = result["job_id"] as? String {
                    store.attachJob(sessionId: session.id, serverId: server, jobId: jobId)
                    status = "电脑已接收任务 \(jobId)，可离开 Wi-Fi"; return
                }
                let phase = result["status"] as? String ?? "unknown"
                if ["failed", "submission_uncertain"].contains(phase) {
                    throw MobileError.message(result["error"] as? String ?? "电脑端预处理失败")
                }
                let next = phase == "preparing" ? "电脑正在抽帧与准备图像" : "等待电脑确认任务"
                if status != next { status = next }
                try await Task.sleep(for: .seconds(2))
            }
            status = "预处理仍在运行，请稍后重试恢复任务记录"
    }
}
