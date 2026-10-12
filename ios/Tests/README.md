# 拍摄流程测试

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
