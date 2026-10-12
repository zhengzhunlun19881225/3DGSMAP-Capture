import Foundation
import Combine
import CryptoKit
import Security

enum MobileError: LocalizedError {
    case message(String)
    var errorDescription: String? { switch self { case .message(let message): message } }
}

@MainActor
final class MobileConnection: ObservableObject {
    @Published var address = UserDefaults.standard.string(forKey: "mobile.server.address") ?? ""
    @Published var token = ""
    @Published private(set) var serverId: String?
    @Published private(set) var status = "尚未连接电脑"
    @Published private(set) var working = false
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
        guard (200...299).contains(response.statusCode) else { throw MobileError.message(result["error"] as? String ?? "HTTP \(response.statusCode)") }
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
            store.attachServer(sessionId: session.id, serverId: currentServer)
            store.finishSession(sessionId: session.id)
            status = "正在校验手机原始素材"
            let files = session.media.map { ($0, store.fileURL($0)) }
            let manifest: [[String: Any]] = try await Task.detached(priority: .utility) {
                try files.map { record, url in
                    let handle = try FileHandle(forReadingFrom: url)
                    defer { try? handle.close() }
                    var digest = SHA256()
                    var size = 0
                    while let block = try handle.read(upToCount: 4 * 1024 * 1024), !block.isEmpty {
                        digest.update(data: block); size += block.count
                    }
                    return ["asset_id": record.id.uuidString, "name": url.lastPathComponent,
                            "mode": record.mode.rawValue, "size": size, "chunk_count": (size + 4194303) / 4194304,
                            "sha256": digest.finalize().map { String(format: "%02x", $0) }.joined(),
                            "stage": record.stage.rawValue, "captured_at": record.createdAt.timeIntervalSince1970]
                }
            }.value
            let id = session.id.uuidString
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
            for (number, pair) in files.enumerated() {
                try Task.checkCancellation()
                let (record, url) = pair
                let assetId = record.id.uuidString
                if completeAssets.contains(assetId) { continue }
                let handle = try FileHandle(forReadingFrom: url)
                defer { try? handle.close() }
                let count = manifest[number]["chunk_count"] as? Int ?? 0
                for index in 0..<count {
                    try Task.checkCancellation()
                    if chunks[assetId]?.contains(index) == true { continue }
                    try handle.seek(toOffset: UInt64(index * 4194304))
                    let data = try handle.read(upToCount: 4194304) ?? Data()
                    status = "上传素材 \(number + 1)/\(files.count) · 分块 \(index + 1)/\(count)"
                    _ = try await request("api/capture-sessions/\(id)/assets/\(assetId)/chunks/\(index)", method: "PUT", bytes: data)
                }
                _ = try await request("api/capture-sessions/\(id)/complete", method: "POST", payload: manifest[number])
            }
            _ = try await request("api/capture-sessions/\(id)/reconstruct", method: "POST", payload: [
                "frame_interval": frameInterval, "metadata": ["engine": engine, "profile": profile]])
            for _ in 0..<1800 {
                try Task.checkCancellation()
                let result = try await request("api/capture-sessions/\(id)")
                if let jobId = result["job_id"] as? String {
                    store.attachJob(sessionId: session.id, serverId: currentServer, jobId: jobId)
                    status = "电脑已接收任务 \(jobId)，可离开 Wi-Fi"; return
                }
                let phase = result["status"] as? String ?? "unknown"
                if ["failed", "submission_uncertain"].contains(phase) {
                    throw MobileError.message(result["error"] as? String ?? "电脑端预处理失败")
                }
                status = phase == "preparing" ? "电脑正在抽帧与准备图像" : "等待电脑确认任务"
                try await Task.sleep(for: .seconds(2))
            }
            status = "预处理仍在运行，请稍后重试恢复任务记录"
        } catch is CancellationError { status = "上传已暂停，再次上传将从电脑确认的分块继续" }
        catch { status = error.localizedDescription + "；保留原件，可重试续传" }
    }
}
