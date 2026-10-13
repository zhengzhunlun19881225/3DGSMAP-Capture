# 防强光方案（0.2.11）

拍摄右上角配置 → 防强光方案，视频提供三个互斥选项：

| 选择 | 实际行为 | 范围 |
| --- | --- | --- |
| 关闭 | 停止亮度分析、曝光补偿回到 0 EV、显式关闭视频 HDR | 照片、视频 |
| 自动压曝光 | 保留原方案：采样亮度并平缓调整连续自动曝光，最低 −1.5 EV，暗部可能变暗；显式关闭视频 HDR | 照片、视频 |
| 系统 HDR | 开启相机公开的 HDR/EDR 合成，停止应用亮度分析并恢复 0 EV 补偿，合并不同曝光以扩大可记录范围 | 仅视频，按当前设备和格式判定支持 |

首次默认关闭，升级保留旧自动防强光选择。只保存一个方案值；录制、保存和间隔拍摄中不能切换。不支持 HDR 的相机档位禁用该选项。切换失败回滚；已选择 HDR 时若新分辨率不支持，保留原档位并提示。

照片设置只提供关闭和自动压曝光。若保存的视频选择为 HDR，进入照片时本次使用关闭，不改写保存的视频选择。选择其他方案才更新设置。

## 参考图的可实现范围

本次落实公开 AVFoundation 的系统视频 HDR/EDR 和应用曝光控制。系统负责合成和色调处理，App 不能指定其内部 ISP 分区权重、去鬼影或局部色调映射算法。本功能不是 10-bit HLG/Dolby Vision 录制，也没有新增 AI 修复。

镀膜、外接 ND/偏振镜、遮光罩、全局快门与传感器双原生 ISO 属于硬件条件，不能通过 App 增加。曝光处理不能消除光学眩光，不能保证恢复已经饱和丢失的细节。原视频和照片不重新处理。

苹果公开接口说明：

- [isVideoHDREnabled](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isvideohdrenabled)：仅在支持格式上手动启用，并关闭自动 HDR 决策。
- [isVideoHDRSupported](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isvideohdrsupported)：按相机当前格式查询支持情况。
- [automaticallyAdjustsVideoHDREnabled](https://developer.apple.com/documentation/avfoundation/avcapturedevice/automaticallyadjustsvideohdrenabled)：避免系统自动决策与单选状态不一致。

具体强光环境下的亮暗观感、移动鬼影与重建质量仍需同场景实拍对比；能力开关和文件尺寸验证不等同于画质评测。
