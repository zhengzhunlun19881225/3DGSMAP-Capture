# 拍摄流程测试

## 0.2.11 防强光互斥方案

`HighlightExposureTests.swift` 同时覆盖旧设置迁移、互斥持久化、照片模式不覆盖视频 HDR 偏好及曝光控制算法。

Debug 真机参数 `--verify-highlight-modes` 在 1080p 和 4K 依次切换 HDR → 自动压曝光 → 关闭 → HDR；检查设备 HDR 标志、自动 HDR 决策关闭、分析连接互斥、真实分析帧、曝光复位、录制中拒绝切换，并录制 8 段短视频检查尺寸及 30 fps。保持 HDR 从 1080p 切至 4K，最后恢复原设置。仅删除验证自身临时文件，不写项目记录。报告写入 `Library/Application Support/GSMapCapture/highlight-modes-verification.json`。

模拟器拍摄引导测试验证三个选项、默认关闭以及无真实相机时禁用，不声称模拟器验证了 HDR 画质。

## 0.2.10 自动防强光

`HighlightExposureTests.swift` 检查普通光线不压暗、忽略小亮点、窗户高亮压制、曝光滞回区、最大压暗限制、缓慢恢复、相机范围限制和关闭复位；GitHub workflow 已加入执行。

```sh
swiftc ios/GSMapCapture/CaptureModels.swift ios/Tests/HighlightExposureTests.swift -o /tmp/gsmap-highlight-tests
/tmp/gsmap-highlight-tests
```

模拟器引导用例确认开关默认关闭且无真实相机时禁用。Debug 真机参数 `--verify-highlight-protection` 在 1080p 和 4K 开启实时分析，验证确实收到相机帧、连续自动曝光启用、录制中拒绝切换，并实际保存检查两个横屏方向的照片/视频尺寸与帧率；最后关闭并检查 0 EV，再恢复原设置。只清理测试产生的临时素材，不加入用户项目。报告写入 `Library/Application Support/GSMapCapture/highlight-verification.json`。不同强光场景下的观感与长时间功耗需要真机实拍评估。

## 0.2.9 视频防抖

模拟器用例 `testGuidedRoomCaptureAndSkippedStagesPersist` 检查视频设置有防抖开关；没有真实相机时开关禁用，不声称防抖可用。

Debug 真机显式启动参数 `--verify-video-stabilization` 使用生产 CameraService，在 1080p / 4K 两档分别执行关闭 → 开启 → 关闭，核对实际 `activeVideoStabilizationMode`、持久化、录制中拒绝切换，以及生成 MOV 的尺寸和 30 fps。测试不调用 CaptureStore，不加入用户项目；删除自己生成的临时视频，最后恢复原分辨率及防抖选择。报告写入 `Library/Application Support/GSMapCapture/stabilization-verification.json`。正常启动和 Release 不执行此入口。

## 0.2.8 视频本地导出

UI 用例 `testVideoSaveToPhotosPreservesOriginalBytesAndIndex`、`testVideoFilesExportPreservesOriginalBytesAndIndex` 和 `testVideoFilesPickerCancellationPreservesOriginals` 使用显式启动参数 `--verify-video-export`，仅在 Debug **模拟器**上启用隔离测试界面。生成真实 1080p / 4K MOV，保存到相册或通过系统文件窗口复制，然后对比 SHA-256，验证 App 原文件和项目索引未改变。取消导出也核对原件与索引。

将 `VideoExportVerification.swift` 加入测试 App 的编译源（正式 Xcode 工程已配置）；非模拟器及 Release 构建不包含测试入口。相册副本读取测试额外使用 `--verify-photos-copy`，仅测试 App 的 Info.plist 需加入 `NSPhotoLibraryUsageDescription` 并允许读取相册；正式 App 只包含 `NSPhotoLibraryAddUsageDescription`，保存时只申请添加权限。不要在真实用户相册或手机采集目录中生成测试素材。

2026-10-12 三项模拟器测试全部通过；iPhone 13 同标识覆盖安装后正常启动，4 段已有视频名称/大小/修改时间未改变，项目索引逐字节一致。真机已有大视频导出尚未执行，详细验证范围见仓库 `docs/validation/video-local-export-v0.2.8.json`。

## 0.2.7 上传回归

在 Mac 上运行（仅创建临时测试文件）：

```sh
swiftc -swift-version 5 ios/GSMapCapture/UploadFileWorker.swift ios/Tests/UploadFileWorkerTests.swift -o /tmp/gsmap-upload-tests
/tmp/gsmap-upload-tests
```

覆盖 SHA-256 与4 MiB边界、缓存复用、原件变化拒绝、缓存失效、取消和原件保留。仓库 `Validate iOS capture` workflow 同时运行既有状态/存储测试和 iOS 模拟器编译；界面 watchdog 修复仍需真机 Instruments 复现验收。

纯状态测试，在项目根目录运行：

```sh
swiftc ios/GSMapCapture/CaptureModels.swift ios/Tests/CaptureFlowTests.swift -o /tmp/gsmap-capture-flow-tests
/tmp/gsmap-capture-flow-tests
```

`CaptureSmokeTests.swift` 是 XCTest UI 测试源码。将它加入以 GSMapCapture 为 Target Application 的 UI Testing Bundle 后，在安装了 iOS 18.5 runtime 的 iPhone 模拟器运行。模拟器不具备真实后置摄像头，测试覆盖引导、设置、跳过、保存记录、项目恢复与输入校验。

本次界面验证使用本机临时测试工程；临时工程与构建日志不纳入 Git。复现时将此 UI 测试源码加入自己的 UI Testing Bundle。拍摄状态测试独立于界面，也验证保存失败不会推进阶段及旧数据兼容。

删除功能的存储回归（仅创建和清理独立临时目录，不访问本机应用项目）：

```sh
swiftc ios/GSMapCapture/CaptureModels.swift ios/GSMapCapture/CaptureStore.swift ios/Tests/CaptureStoreDeletionTests.swift -o /tmp/gsmap-delete-tests
/tmp/gsmap-delete-tests
```

界面用例 `testSwipeDeleteRequiresConfirmationAndPersists` 覆盖左滑、取消、二次确认和重启持久化。

## 4K / 1080p 分辨率

JPEG 文件回归（实际编码后再用 ImageIO 解码检查，不访问相机或用户项目）：

```sh
swiftc ios/GSMapCapture/CaptureModels.swift ios/GSMapCapture/PhotoResolutionEncoder.swift ios/Tests/PhotoResolutionTests.swift -o /tmp/gsmap-resolution-tests
/tmp/gsmap-resolution-tests
```

覆盖 3840×2160 / 1920×1080、EXIF 1/3/6/8 方向与像素旋转、曝光/时间元数据、拒绝低分辨率放大以及无效图片。

Debug 工程启用了 `DEBUG` 编译条件。仅用启动参数 `--verify-capture-resolutions` 才进入真实相机集成测试，正常启动不执行测试。连接并解锁 iPhone 后可用 `devicectl device process launch ... <bundle-id> -- --verify-capture-resolutions` 启动，必须保持 App 前台及手机亮屏。测试依次使用生产 CameraService 切换 1080p → 4K → 1080p，每档位在 0° / 180° 方向生成照片和 2 秒视频，读取真实文件尺寸与帧率，验证录制中拒绝切换。测试不调用 CaptureStore，自动删除自己生成的临时素材，并恢复原分辨率；只在 `Library/Application Support/GSMapCapture/resolution-verification.json` 保存测量报告。结束后重新正常启动 App。

2026-10-12 在 iPhone 13 / iOS 26.2 上已通过，共 12 个文件，报告见 仓库内的 `docs/validation/iphone13-resolution-v0.2.6.json`。模拟器的 `testGuidedRoomCaptureAndSkippedStagesPersist` 同时确认设置面板有 4K/1080p 按钮；因为没有真实相机，按钮禁用且不会声称分辨率已生效。
