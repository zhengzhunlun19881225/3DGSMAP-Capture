# 3DGSMAP Capture

iPhone 原生采集 App，以及本地 Gaussian Splatting 重建网页与服务。

## iPhone App · 0.2.8

- 照片、视频两种采集模式，项目和素材保存在手机。
- 横屏房间拍摄引导：站位 → 水平 → 仰视 → 俯视 → 物体细节。
- 拍摄界面右上角配置按钮可切换 **4K（3840×2160）/ 1080p（1920×1080）**，实际改变相机采集配置；视频 30 fps，照片按 16:9 输出。
- 录制、保存或间隔拍摄中禁止切换分辨率，成功选择后自动记住设置。
- 支持两种横屏方向、照片间隔拍摄及上一张照片参考。
- 项目中的采集记录左滑显示「删除」，二次确认后删除本机记录与素材。
- 采集批次和视频预览支持「保存到相册」/「导出到文件」，复制原视频并保留 App 内原件；默认本机导出目录支持电脑文件共享。
- 保留 0.2.7 的大视频上传校验缓存、续传恢复和独立进度显示。

直接在 Mac / Xcode 打开 [ios/GSMapCapture.xcodeproj](ios/GSMapCapture.xcodeproj)。最低 iOS 17，真机安装需要自己的 Apple 开发签名。

- [iPhone 安装和使用说明](ios/README.md)
- [最新 iOS 源码压缩包](release/GSMapCapture-iOS-source.zip)
- [更新记录](CHANGELOG.md)
- [测试运行说明](ios/Tests/README.md)
- [iPhone 13 真实分辨率测量报告](docs/validation/iphone13-resolution-v0.2.6.json)
- [训练电脑接入任务清单](docs/TRAINING_COMPUTER_TASKS.md)：补齐手机视频上传、抽帧、训练队列和手机成果页。
- [视频本地保存和数据线传输](docs/VIDEO_LOCAL_EXPORT.md)：已有视频无需上传即可导出副本。

2026-10-12，0.2.6 已在 iPhone 13 / iOS 26.2 上完成 1080p → 4K → 1080p 的实际拍摄验证。两个横屏方向共生成 12 个照片/视频文件，真实尺寸全部匹配所选档位，6 段视频均为 30 fps。照片编码回归及模拟器设置/四步引导界面测试通过。

## 电脑重建与联调范围

电脑端使用方法见 [本地重建流水线](README-local-pipeline.md)。

原生 App 包含局域网连接、分块上传和成果查看客户端；所需的手机接入网关（如 `mobile_gateway.py`）目前不在此仓库。仓库内已有的 `server/reconstruction_server.py` 不能直接等同于该手机网关。本次验证涵盖 iPhone 采集，尚未完成手机上传、训练和三维成果的端到端联调。
