# 训练电脑接入任务：iPhone 视频上传 → 抽帧 → 3DGS 训练 → 手机查看

日期：2026-10-12

协议基线：iPhone App **0.2.6（build 8）**，仓库提交 **1179750**。0.2.7/build 9 保持该 v1 上传协议，增加客户端校验进度、缓存和响应性改进。

2026-10-12 更新：实际 Windows 训练机已部署手机网关和训练台接入展示；本文下方清单保留作为通用部署任务，不表示本机所有项目仍未实施。已知状态、档位映射和待完成的真机验收见 [CAPTURE_UPLOAD_UPDATE.md](CAPTURE_UPLOAD_UPDATE.md)。不要用本仓库旧桌面代码覆盖已运行的 Windows 训练台。

仓库：<https://github.com/zhengzhunlun19881225/3DGSMAP-Capture>

**用途：把本文件交给训练电脑上的开发助手执行。本文是待办和接口约束，不表示电脑端功能已经实现或验收。** 用户已经用手机拍摄了真实视频；第一目标是保留这些素材，完成一次真实上传、抽帧和训练。

## 1. 可直接复制给开发助手的任务

> 请先读取当前电脑的项目说明和本文件，核对操作系统、显卡、已有训练服务及正在运行的任务。以本机真实代码为准，补齐与 iPhone App 0.2.6 兼容的手机接入服务、可恢复的分块上传、视频抽帧、已有训练队列适配和手机成果页。先打通已有训练引擎的一条真实链路，再扩展其他引擎。沿用手机端现有接口，不要求用户重新拍摄或修改手机中的项目索引。保护已有原件、训练任务、成果和环境配置，不覆盖本地改动，不为启动新服务而直接终止正在训练的进程。逐项执行本文任务，测试与实机验收要区分，失败要保留原件、状态和日志。完成后给出准确的手机连接地址、连接密钥的本地查看方式、启动/恢复命令、实际训练 job_id 和验收报告。不要用模拟上传、假进度、示例模型或仅健康检查通过代替端到端成功。

## 2. 当前实际状态与边界

| 部分 | 已核对的现状 | 训练电脑要完成的工作 |
| --- | --- | --- |
| iPhone 采集 | 已安装 0.2.6；4K / 1080p 照片、30 fps 视频已做真机尺寸验证 | 使用用户已经拍好的批次，保留手机原件 |
| iPhone 上传客户端 | 已实现 Bearer 鉴权、4 MiB 分块、续传、任务轮询 | 服务端必须兼容下文路径、字段及返回格式 |
| 手机接入服务 | 当前公开仓库没有 `server/mobile_gateway.py` | 在本机检查是否已有其他版本；有则适配，无则实现 |
| 视频接入/抽帧 | 当前公开仓库没有 `server/capture_ingest.py` | 接收原视频，验证后在电脑抽帧，保存来源记录 |
| 训练 API | 仓库的 `server/reconstruction_server.py` 接收图片 multipart，默认 `127.0.0.1:8787` | 复用既有真实队列，不能把 MOV 直接当图片提交 |
| 引擎 | 此仓库实现 COLMAP + Brush；`settings()` 当前不处理 `engine` | 核实训练机是否另有 Nerfstudio，明确能力和映射 |
| 手机成果页 | App 会打开 `/viewer/mobile.html?job=...`，仓库没有该页面 | 补齐同源、带鉴权的真实成果页 |

代码依据：

- [手机请求与上传流程](../ios/GSMapCapture/MobileConnection.swift)
- [连接界面、训练选项、状态页及 WebView](../ios/GSMapCapture/TransferViews.swift)
- [手机项目及阶段模型](../ios/GSMapCapture/CaptureModels.swift)
- [当前训练 API](../server/reconstruction_server.py)、[计算流程](../server/pipeline.py)
- [已有性能档位](../config/reconstruction_profiles.json)
- [现有真实高斯查看组件](../src/components/GaussianResultViewport.tsx)

旧文档中可能有“Windows 已验证”“接入网关已完成”的历史表述；除非在当前电脑找到实现并重新验证，不得把这些文字当作当前验收结果。本文件不假定训练电脑的操作系统、IP 或工作目录。

## 3. P0：先核对训练机环境

- [ ] 记录操作系统、CPU、内存、显卡/显存、驱动、可用磁盘空间，以及 Python、Node、pnpm、FFmpeg / ffprobe 版本。
- [ ] 确认实际仓库路径、分支、提交和未提交改动。已有改动先保留；不要执行 `git reset --hard`、`git clean` 或覆盖已有训练环境。
- [ ] 查看 8787 / 8788 是否已被占用，确认对应程序及正在运行的训练任务。已有服务可用时直接对接；不要重复启动或强行结束。
- [ ] 核对 `GET /api/health` 和一条已有任务的真实状态，确认依赖及训练可执行文件确实可用。仅 `ok: true` 不等于完整训练链路可用。
- [ ] 查找本机是否已有 `mobile_gateway.py`、`capture_ingest.py`、`requirements-mobile.txt`、手机成果页；若已有，先比较协议和测试，不重复覆盖。
- [ ] 在隔离环境检查本仓库的 Python 兼容性：`cgi` 已在 Python 3.13 移除；保留现有 multipart 实现时使用 Python 3.12，或明确替换解析器并验证大文件流式处理。[Python 官方说明](https://docs.python.org/3/library/cgi.html)
- [ ] 如果训练机是 Windows，处理当前源码的 `fcntl`、`pty`、`termios`、Unix 管道读取和进程管理；`fcntl` 仅支持 Unix，不能直接照搬运行。也要检查 Brush 可执行文件发现逻辑对 `.exe` 的支持。[Python 官方说明](https://docs.python.org/3/library/fcntl.html)
- [ ] 若采用 WSL，额外验证 GPU、模型/数据路径、进程锁和手机到网关的网络可达性，不能仅验证 WSL 内的 localhost。

已有稳定训练服务优先复用。需要修正其兼容性或增加幂等提交接口时，先在隔离端口测试，安排无训练任务的时机再切换。

## 4. 目标结构与建议交付文件

```text
iPhone App 0.2.6（前台上传）
    │ Wi-Fi；Bearer 密钥；4 MiB 分块
    ▼
手机接入服务：电脑局域网地址:8788
    ├─ 持久上传批次、分块回执、原始 MOV/JPEG
    ├─ 哈希/长度校验 → 方向处理/抽帧 → 训练图像 + 来源 manifest
    ├─ multipart 图片 → 既有训练 API 127.0.0.1:8787 → 单计算队列
    └─ 手机任务状态、同源成果页面及真实 PLY 代理
```

建议新增文件；训练机已有等价实现时可复用，但须标明对应关系：

| 路径 | 责任 |
| --- | --- |
| `server/mobile_gateway.py` | 鉴权、健康检查、批次接口、任务/成果代理、静态资源 |
| `server/capture_ingest.py` | 持久分块、校验、预处理、提交/恢复状态机 |
| `server/requirements-mobile.txt` | 网关及预处理依赖，版本与实际训练环境验证一致 |
| `server/tests/test_capture_ingest.py` | 分块、重复请求、校验、目录约束测试 |
| `server/tests/test_mobile_gateway.py` | 完整手机协议、鉴权、后端错误传播测试 |
| `server/tests/test_mobile_recovery.py` | 崩溃恢复、断线、提交结果不确定性测试 |
| `server/tests/test_video_preprocessing.py` | 实际视频解码、方向、时间戳、4K/1080p 测试 |
| `mobile.html`、`src/mobile.tsx` | 手机真实成果页，可复用现有查看组件 |
| `scripts/start-mobile.ps1` 或 `.sh` | 与实际系统匹配的启动入口，检查端口/依赖/路径 |
| `docs/mobile-gateway-setup.md` | 安装、连接、运行、停止、恢复和错误排查 |
| `docs/mobile-e2e-validation.md` | 本机实测结果、证据、待验收项 |

运行数据继续放在已忽略的 `runtime/`，不要提交原视频、连接密钥或训练成果到 Git。

## 5. P1：实现与已安装手机兼容的接口

### 5.1 通用约定

- Base URL 为 `http://<电脑局域网IPv4>:8788`，不附带 `/api`；手机会自行追加路径。
- 原生 App 所有请求带 `Authorization: Bearer <token>`；JSON 请求带 `Content-Type: application/json`，分块带 `application/octet-stream`。
- JSON 返回值必须是顶层对象，不要套 `data` 包装。错误返回非 2xx，并包含 `{"error":"用户可读的错误原因"}`。
- 鉴权失败返回 401/403；协议参数错误返回 400；同一标识的数据冲突返回 409；磁盘/依赖失败明确返回错误，不得伪装 2xx 成功。
- 手机 UUID 字符串通常为大写；统一比较与持久化规则，GET 中以 `asset_id` 为键的回执必须能与手机发送的原始 ID 匹配。
- 单个请求客户端超时为 120 秒。长时间抽帧/排队使用后台工作线程或进程，接口及时返回，手机通过 GET 查询。

### 5.2 健康检查与电脑身份

`GET /api/mobile/health` 至少返回：

```json
{
  "mobile_api_version": 1,
  "server_id": "此网关首次启动生成并长期保留的稳定标识",
  "training_online": true
}
```

- [ ] `training_online` 来自真实后端探测，不写死。
- [ ] 在 `runtime/mobile-gateway.json` 持久保存随机连接密钥和稳定 `server_id`；重启、升级不能重新生成导致手机失去任务关联。
- [ ] 给用户提供本地查看密钥的方法，日志/网页 URL 不带密钥。手机换电脑会比较 `server_id` 并拒绝错误关联，不能通过伪造旧 ID 绕过。
- [ ] 训练 API 离线时仍可按设计接收素材，但重建请求必须返回清晰状态/错误，不谎称已开始训练。

### 5.3 创建或恢复批次

`POST /api/capture-sessions`。以下是字段形状示例，尖括号内容为占位值，不可直接作为测试请求：

```json
{
  "session_id": "<手机批次UUID>",
  "project_id": "<手机项目UUID>",
  "mode": "video",
  "expected_assets": [
    {
      "asset_id": "<素材UUID>",
      "name": "capture-example.mov",
      "mode": "video",
      "size": 5000000,
      "chunk_count": 2,
      "sha256": "<整个原件的64位小写十六进制SHA-256>",
      "stage": "middle",
      "captured_at": 1791770400.0
    }
  ],
  "events": [{"stage": "upper", "action": "skipped"}]
}
```

- `mode` 为 `photo` / `video`；`stage` 为 `middle` / `upper` / `lower` / `detail`。保存阶段与跳过记录，不能重排成另一套编号。
- `captured_at` 是 Unix 时间戳秒，可有小数。
- 当前手机上传清单**没有** `pixelWidth`、`pixelHeight`、`duration`、`codec`、项目名称等字段。服务端不能强制要求这些字段；尺寸、编码和时长从原件检测。
- [ ] 相同 `session_id` 和相同清单应恢复既有批次；清单内容冲突应返回 409，不覆盖已收原件。
- [ ] 如果已提交训练，响应带相同的顶层 `job_id`，手机据此恢复任务。

### 5.4 查询回执

`GET /api/capture-sessions/{session_id}`。上传过程中至少返回：

```json
{
  "session_id": "<手机批次UUID>",
  "status": "uploading",
  "received_chunks": {"<素材UUID>": [0]},
  "assets": [],
  "job_id": null,
  "error": null
}
```

素材完成整体校验之后才可出现在：

```json
{"assets": [{"asset_id": "<素材UUID>"}]}
```

手机会跳过 `assets` 中的整个素材，并跳过 `received_chunks` 中的块。因此这些字段必须反映已可靠落盘的数据，不能提前确认。重启后仍要能读取准确回执。

### 5.5 接收分块

`PUT /api/capture-sessions/{session_id}/assets/{asset_id}/chunks/{index}`

- 请求体为原始二进制，不是 multipart 或 Base64。
- `index` 从 0 开始；每块 **4,194,304 字节**，最后一块可较小。
- `chunk_count = ceil(size / 4194304)`，`size` 是字节数。
- [ ] 校验批次、素材、索引及预期块长度；未知 ID、负数/越界索引、额外数据应拒绝。
- [ ] 同一块相同内容重传返回成功；内容不同返回冲突，不能悄悄覆盖。
- [ ] 先写临时文件，完成持久化后原子发布块文件/回执；为同一批次并发写入加锁。
- [ ] 流式处理，不能把全部 4K 视频加载到内存。处理路径时使用服务端控制的目录/ID，不直接信任上传文件名。

### 5.6 完成一个素材

`POST /api/capture-sessions/{session_id}/complete`

请求体为 5.3 中**一个素材的完整 manifest 对象**，不是整个批次，也不是空请求。

- [ ] 检查所有块齐全、拼接顺序正确、总长度和 SHA-256 与预声明一致。
- [ ] 校验通过后，原件原子写入最终位置并把素材加入 `assets`。
- [ ] 同一素材重复 complete 幂等返回成功；缺块或哈希错误不得标记完成，不得进入训练。
- [ ] 训练图像与原件分开存储，不覆盖原视频/原照片。

### 5.7 请求抽帧与训练

`POST /api/capture-sessions/{session_id}/reconstruct`

```json
{
  "frame_interval": 0.5,
  "metadata": {
    "engine": "original",
    "profile": "preview"
  }
}
```

手机允许的值：

| 字段 | 当前手机发送值 |
| --- | --- |
| `frame_interval` | 默认 0.5 秒；界面范围 0.1～10 秒 |
| `metadata.engine` | `original`、`nerfstudio`、`nerfstudio-big` |
| `metadata.profile` | `preview`、`balanced`、`quality` |

**手机默认 engine 是 `nerfstudio`。如果本机仅有 Brush，首次验收应明确让用户选择「原有方案」。服务端必须拒绝未实现的引擎，不能忽略参数、静默改用 Brush，然后宣称运行了 Nerfstudio。** 此项优先在服务端兼容，手机暂不要求更新。

- [ ] 所有预声明素材校验完成后才可重建，默认不使用不完整批次。
- [ ] 校验参数类型、范围和引擎能力，避免每次上传都重新触发训练。
- [ ] 长任务快速返回 202 和 JSON，随后 GET 返回 `queued` / `preparing` / `submitting` / `submitted`；错误使用 `failed` / `submission_uncertain` 并带 `error`。
- [ ] 获得真实训练任务后持久保存 `job_id`。手机约每 2 秒 GET 一次，最多约 1 小时；超过此轮等待后再次进入要能恢复。
- [ ] 在相同批次、相同参数下，重复请求只恢复同一任务；参数改变不能覆盖已提交任务，应返回明确冲突或要求新建批次。

### 5.8 任务和成果代理

必须代理并保留原有顶层数据形状：

- `GET /api/jobs/{job_id}`
- `GET /api/jobs/{job_id}/view`
- `GET /api/jobs/{job_id}/artifact/{file_name}`

手机状态页读取 `status`、`phase`、`progress`（0～100）、`error`。支持 `queued`、`processing`、`completed`、`failed`、`cancelled`；`completed` 必须对应真实最终成果，而非仅完成抽帧。

## 6. P1：视频预处理与来源记录

- [ ] 用 ffprobe 检测真实容器、编码、时长、像素尺寸、时间基、帧时间戳和旋转信息；处理手机生成的 `.mov`，不能仅接受 `.mp4` 或根据扩展名判断编码。
- [ ] 至少验证 1920×1080、3840×2160，以及两个横屏方向；兼容实际文件中的 H.264 / HEVC，明确报错缺失的解码器。
- [ ] 按 `frame_interval` 选择并解码实际源帧。可变帧率必须按真实时间戳选择；不得用 `帧序号 × 0.5` 虚构源 PTS，也不得把插值/重复补帧当作新增拍摄视角。
- [ ] 明确采用哪一步处理旋转矩阵，确保只旋转一次；防止 FFmpeg 自动旋转后再次手动旋转导致倒置。
- [ ] 保留 4K 源文件。预处理若需要缩小训练图像，应单独记录输出尺寸和原因，不把下采样图标记为原生 4K；原有训练档位本身也会限制训练分辨率。
- [ ] 多段视频输出文件名必须唯一，保留资产和片段边界。不能把独立阶段/片段简单拼成一个连续序列并默认使用相邻匹配。
- [ ] MVP 优先使用已有全量匹配；确需相邻匹配时明确片段内顺序和跨片段连接方式，并实测注册结果。
- [ ] 照片路径使用真实解码、EXIF 方向规范化和独立训练副本；已经归一化为 orientation=1 的照片不能再旋转一次。
- [ ] 至少 2 张有效图像是当前训练入口要求，不代表必然能解算。空视频、损坏视频、全黑/不可解码输入和帧数不足必须终止预处理并保留错误日志。
- [ ] 明确设置磁盘占用、输入字节数、抽帧总量和预处理并发上限。例如首版可采用可配置 2000 帧上限；这是待实现策略，不是现有保证。超限应提示增大间隔或分批，不能静默截断。

为每张训练图像记录：`session_id`、`asset_id`、`stage`、源文件 SHA-256、真实源 PTS/时间基或其精确秒值、采样目标时间、旋转处理、原始/输出尺寸、输出文件 SHA-256、预处理参数和工具版本。未知值记录为未知，不编造。

来源 manifest 原子保存。原件、预处理结果和临时文件使用不同目录；失败后可清理本次不完整的派生文件，但保留原件及已完成的训练任务。

参考：[ffprobe 文档](https://ffmpeg.org/ffprobe.html)、[FFmpeg 文档](https://ffmpeg.org/ffmpeg.html)。具体解码/抽帧命令需按本机实际版本验证后写进安装说明。

## 7. P1：接入已有队列，解决重复提交与恢复

仓库当前训练入口为 `POST /api/reconstruct`，接收 `multipart/form-data`：

- 多个文件字段均名为 `images`。
- 普通表单字段 `metadata` 的内容是 JSON 字符串，包含 `profile` 等训练参数。
- 成功响应 HTTP 202，形如 `{"job_id":"12位十六进制任务编号"}`。

网关采用流式 multipart 转发，避免把所有图片放入内存。复用现有计算队列和模型输出；视频预处理队列可独立限流，不额外启动绕开既有锁的 GPU 训练器。

**当前训练 API 每次 POST 都会生成新 job_id，没有幂等键支持。单靠网关在响应后保存 job_id，不能消除“后端已接受、响应丢失”造成的重复训练。**

- [ ] 为每个批次/参数建立稳定的提交标识和持久提交意图，在请求后端前落盘。
- [ ] 优先给训练 API 增加向后兼容的幂等提交能力：可选请求头或 metadata 字段、持久化键到 job_id 的映射，以及按键查询接口。字段名称由实现定义并写入文档，不能假装原 API 已支持。
- [ ] 相同键和相同输入/参数返回同一 job_id；同键但内容不同返回冲突。持久化状态、进程重启及任务入队也要覆盖，不能只在内存保存去重表。
- [ ] 如果暂时无法修改后端，遇到超时、断线或提交期间重启，应标记 `submission_uncertain`，明确要求核对原任务；不能自动重新 POST。此降级不算“自动恢复/严格防重复提交”已验收。
- [ ] 上传回执、manifest、预处理状态、参数、job_id 及错误均持久化；网关重启不丢失 `server_id` 或关联。
- [ ] 预处理被中断时，恢复或显式失败后重试均可，但必须保证不会把旧的不完整帧混入新训练输入。
- [ ] 现有训练服务重启后的行为需实测。仓库中的旧任务重启后可能标记失败；不能声称 GPU 训练会自动续训。

建议状态路径：

```text
uploading → ready → queued → preparing → submitting → submitted（带 job_id）
                      │          │           └→ submission_uncertain
                      └──────────┴→ failed（带 error，保留原件）
```

手机端目前不会发送单独“准备就绪”请求；`ready` 必须由服务端在全部素材 complete 后计算出来。实际 GPU 任务状态通过 `/api/jobs/{job_id}` 独立呈现。

## 8. P1：手机成果页

- [ ] 提供 `/viewer/mobile.html?job=<job_id>`，真实加载该任务的最终 PLY；复用 `GaussianResultViewport` 或等价真实渲染逻辑。
- [ ] 所有页面资源、API、`/view` 和 PLY 都从网关同源访问。不能让 iPhone 请求 `localhost:8787`，也不能继承桌面 `reconstructionApi` 的空地址/localhost 默认配置。
- [ ] App 的 WKWebView 会设置名为 **`mobile_token`**、Path `/`、域为网关 host 的 Cookie。对成果页面及其只读 API/资源接受这个 Cookie；原生上传写请求继续要求 Bearer。
- [ ] 修改 Vite 构建入口和资源 base，使 `mobile.html` 及 JS/CSS 在 `/viewer/` 下实际可访问。用生产构建验证，不能只检查 Vite 开发服务器。
- [ ] Windows 下 JavaScript/CSS 的 MIME 类型正确；鉴权失败时不能把 HTML 错误页作为成功的 JS 返回。
- [ ] 手机触控可旋转、缩放和复位；只有确实实现的模式才显示入口。加载失败不显示示例模型替代。
- [ ] 限制渲染像素比、释放离开页面后的资源，在 iPhone 13 上验证实际成果的内存与帧率。大型成果若需轻量预览，应作为独立派生成果说明，不能冒充原始模型。

当前电脑网页可能依赖浏览器自己的项目索引。若要求手机任务自动出现在电脑项目列表，应另补任务发现/导入入口；不能仅因后端有 job_id 就假定网页列表已同步。

## 9. P1：局域网与启动交付

- [ ] 网关可监听 `0.0.0.0:8788`；向用户显示可供手机访问的真实 LAN IPv4，不能让手机填写 `0.0.0.0`、`127.0.0.1` 或 `localhost`。
- [ ] 后端训练 API 可保留回环地址 8787，只由网关访问。手机连接的是 **8788**。
- [ ] 手机与电脑处于可互访网络，检查访客 Wi-Fi 隔离、VPN/虚拟网卡、系统防火墙；只开放必要的局域网入口。
- [ ] 启动脚本验证依赖、端口、FFmpeg 和训练 API，打印明确状态；已占用时报告已有服务，不直接杀进程。
- [ ] 提供正常停止/重启方法，保留配置、接收原件、批次回执和关联。停止网关不应自动终止已提交的独立训练任务。

建议实现以下环境变量，名称需在最终文档确认：

| 变量 | 建议默认值/意义 |
| --- | --- |
| `MOBILE_HOST` | `0.0.0.0` |
| `MOBILE_PORT` | `8788` |
| `MOBILE_TRAINING_API` | `http://127.0.0.1:8787` |
| `MOBILE_DATA_DIR` | 独立的批次/原件持久目录 |
| `FFMPEG_BIN` / `FFPROBE_BIN` | 可选自定义工具路径 |

以下是**实现完成后的预期启动模板**，现在缺少对应文件，不能直接当作现成安装命令：

```powershell
# Windows 示例：先切换到实际仓库目录，并完成环境/已有服务检查
.\.venv\Scripts\python.exe -m pip install -r server\requirements-mobile.txt
$env:MOBILE_TRAINING_API = "http://127.0.0.1:8787"
$env:MOBILE_PORT = "8788"
.\.venv\Scripts\python.exe server\mobile_gateway.py
```

```sh
# macOS / Linux 示例：已有兼容训练服务运行时
.venv/bin/python -m pip install -r server/requirements-mobile.txt
MOBILE_TRAINING_API=http://127.0.0.1:8787 MOBILE_PORT=8788 .venv/bin/python server/mobile_gateway.py
```

前端生产构建使用仓库现有 `pnpm lint` / `pnpm build`，添加手机入口后检查生成文件及实际路由。最终交付替换为训练机真实可运行的命令和路径，不写死历史电脑的 IP。

## 10. 验收清单：先协议测试，再真实手机上传

### 自动测试（使用隔离目录/端口）

- [ ] 健康检查真实反映后端状态；错误密钥不能读写；重启后 `server_id` 不变。
- [ ] 覆盖照片和 MOV 的清单、块索引/长度、最后一块、相同块重传、冲突块、缺块、完整 SHA-256、重复 complete。
- [ ] 中断上传、重启网关后 GET 回执准确，手机只补传缺失块；校验失败不会进入 `assets`。
- [ ] 实际生成/解码带旋转元数据的视频，检查画面方向；验证 VFR/实际 PTS、抽帧间隔、同名片段与 4K/1080p 输入。
- [ ] 覆盖不支持的 engine、参数冲突、后端离线、磁盘空间不足、损坏视频；错误带可读 `error`。
- [ ] 同批次重复 reconstruct、后端已接受但响应断开、网关在提交时重启，验证不会无提示地创建第二个任务。
- [ ] 代理 `/api/jobs`、`/view`、PLY 和 `/viewer/` 页面资源，覆盖 Cookie 鉴权与 MIME。
- [ ] 模拟后端只能证明协议；必须另列真实后端、真实 GPU/SfM 训练的验收结果。

### 用户现有视频的端到端验收

1. 保持手机项目/原件，先选一个有充分重叠、机位发生平移的小批次；不要用仅原地旋转的数据作为唯一质量验收样本。
2. 电脑启动已验证训练服务和网关，提供 LAN 地址及本地连接密钥。
3. 手机「连接电脑」→ 输入 `http://<实际IP>:8788` 和密钥 →「检查连接并保存」，显示“训练 API 在线”。
4. 打开已采集批次。若本机只有 Brush，选择「原有方案」；先用「预览」，视频抽帧间隔初次可用 0.5 秒，超量时明确调整。
5. 点「上传此批次并训练」，保持 App 前台和 Wi-Fi。逐文件比对手机上传清单与电脑原件的长度/SHA-256。
6. 检查抽帧数量、尺寸、方向和来源记录；记录 COLMAP 实际注册图像数、训练日志、最终 PLY 文件及其非零有效内容。
7. 手机收到真实 job_id 后可离开上传页面；返回原批次能读取同一任务进度。重开 App、重启网关后关联仍正确。
8. 训练完成后手机打开三维成果，确认显示的是本批次真实模型，可旋转和缩放。
9. 另用测试批次验证上传中断/续传和重复点击，不对用户唯一原件执行删除或破坏测试。

**通过标准：真实视频上传校验成功 + 真实源帧生成 + 真实训练任务结束 + 本批次真实模型在手机可查看。** 短步数烟雾测试仅证明链路，不保证室内重建质量；质量结论需依据实际模型和注册率记录。

## 11. 完成后必须交付

- [ ] 源码及测试，说明复用了哪些本机已有实现、改动了哪些训练接口。
- [ ] 训练电脑系统/显卡/软件版本、支持的 engine 列表及已验证的档位。
- [ ] 用户可直接执行的启动、停止、恢复步骤；手机填写的准确地址；密钥只在本机查看，不写入公开提交。
- [ ] `docs/mobile-e2e-validation.md`：时间、提交、测试命令、通过/失败/未测项、真实批次/任务标识、输入视频与抽帧数量、实际耗时、模型路径和已知限制。报告不包含密钥或用户原始画面。
- [ ] 更新 README，明确“已完成”与“待补齐”；不能将本任务勾选项本身作为测试证据。
- [ ] 经用户安排同步代码到 GitHub，保留运行数据与个人配置在本机。

可后续优化：动态展示服务器引擎能力、电脑网页项目同步、更智能的抽帧/模糊过滤、离线成果下载、后台上传。本轮先完成上述真实闭环，不以这些扩展拖延现有视频上传和训练。
