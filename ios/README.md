# 3DGSMAP Capture · iPhone 原生采集

当前版本 **0.2.6（build 8）**，最低 iOS 17。SwiftUI + AVFoundation + Core Motion，无第三方 iOS 依赖。

## Mac 编译与安装

1. 克隆仓库，或下载并解压 `release/GSMapCapture-iOS-source.zip`，保留完整 `ios` 文件夹。
2. 用 Xcode 打开 `ios/GSMapCapture.xcodeproj`。无需 CocoaPods 或 Swift Package。
3. 在 target **GSMapCapture → Signing & Capabilities** 中选择自己的 Team，并使用自己可签名的 Bundle Identifier。工程中保留了当前安装使用的标识；首次在其他账号运行时需调整。
4. 连接并解锁 iPhone，信任 Mac，按系统提示启用开发者模式，再选择手机作为运行设备。
5. 点击 Run，首次拍摄允许相机访问。视频不录音，不申请麦克风权限。

模拟器编译：

```sh
xcodebuild -project ios/GSMapCapture.xcodeproj -scheme GSMapCapture -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

模拟器没有真实后置摄像头，只用于界面验证。相机不可用时，分辨率切换和拍摄按钮不可用。

使用免费 Personal Team 安装的开发版本需要定期重新签名。已有手机数据时，保持原 Team 和 Bundle Identifier，通过覆盖安装更新；不要先卸载 App。

## 采集操作

1. 我的项目 → 新项目 → 照片采集 / 视频采集。
2. 视频需横置手机。按提示站在房间边缘、背靠墙面，依次完成水平、仰视、俯视、物体细节四阶段。允许跳过阶段，成功保存后才进入下一步。
3. 点击右上角配置按钮，选择 **4K（3840×2160）/ 1080p（1920×1080）**。相机实际切换采集配置，成功选择后自动记住；视频固定 30 fps。
4. 照片使用足够尺寸的原生相机像素，按 16:9 居中裁切并缩小至所选尺寸；竖拍宽高互换。不会将低分辨率来源放大为 4K，像素不足时显示错误。
5. 录制、保存或间隔拍摄中不能切换分辨率。配置失败显示错误并恢复之前设置。
6. 照片支持手动拍摄、2 秒间隔拍摄和上一张照片半透明参考。视频参考线可在设置中手动调节，参考线与引导图不会写入素材。
7. 素材和项目索引保存在 App 内，可离线采集。手机系统「照片」相册中没有这些文件是正常的。
8. 项目内采集记录左滑 → 删除 → 二次确认。删除本机记录及所属素材，不删除电脑上已经提交的训练任务。

## 上传与电脑联调

客户端实现了局域网地址/密钥设置、分块上传、任务状态与 WebKit 成果查看。手机接入网关（如 `mobile_gateway.py`、`capture_ingest.py`）当前不在此仓库；不能将已有的 `server/reconstruction_server.py` 直接视为兼容的手机网关。

如已有兼容网关，手机与电脑连接同一 Wi-Fi，在 App 填入实际电脑局域网地址和连接密钥，检查连接后上传。密钥存放在系统钥匙串；上传期间保持 App 在前台。

本次没有完成手机上传、断线续传、训练和三维成果端到端联调。电脑端现有独立流水线见仓库根目录 `README-local-pipeline.md`。

## 已执行验证

2026-10-12 在 iPhone 13 / iOS 26.2 上完成签名、安装、启动与真实分辨率切换：1080p → 4K → 1080p，每档位在两个横屏方向分别生成照片和约 2 秒视频，共 12 个文件。直接读取 JPEG 尺寸和 MOV 视频轨道后全部通过，6 个视频均为 30 fps，录制中切换均被拒绝。测试素材由独立测试入口生成并清理，不加入用户项目。

照片编码回归和模拟器设置/四步引导回归通过。完整报告位于仓库的 `docs/validation/iphone13-resolution-v0.2.6.json`；测试方法见 [Tests/README.md](Tests/README.md)。源码压缩包只包含 `ios`，完整报告请在仓库查看。

## 源码结构

- `CameraService.swift`：相机配置、真实分辨率切换、拍照/录像、方向与运动提示。
- `PhotoResolutionEncoder.swift`：照片方向规范化、16:9 裁切、尺寸与元数据处理。
- `CaptureModels.swift` / `CaptureStore.swift`：采集状态、项目索引、素材归属和删除事务。
- `CaptureViews.swift`：项目、四阶段引导、相机界面和配置面板。
- `MobileConnection.swift` / `TransferViews.swift`：电脑连接、上传及成果客户端。
- `Tests/`：状态、删除、照片编码及 UI 回归源码。

`generate_xcode_project.py` 可生成基础工程；已有签名配置时不要直接覆盖现有工程。仅 Debug 版本在显式传入 `--verify-capture-resolutions` 启动参数时运行真机分辨率测试，正常启动不运行测试。
