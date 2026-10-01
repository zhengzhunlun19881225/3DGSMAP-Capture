# 本地照片到 Gaussian Splat 流水线

当前页面已接入本地流水线代码：浏览器选中的原始照片会上传到 `server/reconstruction_server.py`，服务按顺序执行 `pycolmap` 的 SIFT 特征提取、影像匹配、增量式 SfM / Bundle Adjustment，然后把 COLMAP 数据交给官方 Brush CLI 训练并导出 PLY。任务完成后，三维视口使用 Three.js `PLYLoader` 显示点云；尚不是完整的高斯椭球渲染器。完整训练与成果视觉效果仍待端到端验收，目前没有 `.splat` 导出转换。

首次安装（Node.js 22、pnpm 10、Python 3.12；当前服务使用 Python 3.13 已移除的 cgi 模块）：

```bash
pnpm install --frozen-lockfile
python3.12 -m venv .venv
.venv/bin/python -m pip install -r server/requirements.txt
```

从 [Brush v0.3.0 官方发布页](https://github.com/ArthurBrussee/brush/releases/tag/v0.3.0) 下载适合系统的程序，解压到 `tools/brush/`，或设置 `BRUSH_BIN` 为可执行文件的绝对路径。程序本体不提交到 Git。

启动服务：

```bash
./.venv/bin/python server/reconstruction_server.py
```

另开终端启动页面：

```bash
pnpm dev
```

浏览器打开 `http://127.0.0.1:3000/`。请在参数抽屉中导入至少两张有重叠的本地照片；预设样本只包含演示元数据，不能提交给 COLMAP。

## 公网预览发布

`.github/workflows/pages.yml` 在推送到 `main` 或手动运行时检查、构建并上传 `web-preview` artifact。当前账号不支持私有仓库的 GitHub Pages，因此源码保留在私有 `3DGSMAP`，公网网页构建单独发布到公开 `3DGSMAP-preview` 仓库的 `main` 分支，由 Pages 部署。后续更新需从构建 artifact 同步文件到该预览仓库；源码仓库的 Actions 不会自动跨仓库推送。

构建基路径为 `/3DGSMAP-preview/`。公网预览只发布 `dist/`，不包含照片或任务数据，也不会部署 Python、COLMAP、Brush 服务。没有配置重建 API 时，页面显示预览提示并禁止提交重建任务。本地页面继续使用 `127.0.0.1:8787`。如需公网训练，需单独部署并保护后端，然后设置构建变量 `VITE_RECONSTRUCTION_API_URL`；当前 localhost 服务不是生产级公网 API。

`runtime/`、`.venv/`、`tools/`、`node_modules/` 均已排除出版本控制。运行中的任务只保存在内存和本地目录，请不要为部署前端而重启后端。

依赖来源：

- [COLMAP CLI](https://colmap.github.io/cli.html)
- [pycolmap](https://github.com/colmap/pycolmap)
- [Brush](https://github.com/ArthurBrussee/brush)
- [Three.js PLYLoader](https://threejs.org/docs/#examples/en/loaders/PLYLoader)
