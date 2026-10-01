#!/usr/bin/env python3
"""Local photo -> COLMAP -> Brush Gaussian Splat pipeline.

The web UI talks to this small localhost service.  COLMAP is provided by
pycolmap (which has an Apple Silicon wheel); Brush is an optional official
release binary downloaded into tools/brush.  If Brush is unavailable the job
stops after producing the real COLMAP sparse reconstruction and reports the
exact install hint instead of pretending that training completed.
"""

from __future__ import annotations

import cgi
import io
import json
import mimetypes
import os
import shutil
import subprocess
import threading
import time
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "runtime" / "jobs"
RUNTIME.mkdir(parents=True, exist_ok=True)
BRUSH_STEPS = int(os.environ.get("BRUSH_STEPS", "30000"))

_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _brush_binary() -> Path | None:
    configured = os.environ.get("BRUSH_BIN")
    if configured and Path(configured).exists():
        return Path(configured)
    candidates = sorted((ROOT / "tools" / "brush").glob("**/brush"))
    candidates += sorted((ROOT / "tools" / "brush").glob("**/brush-app"))
    candidates += sorted((ROOT / "tools" / "brush").glob("**/brush_app"))
    for path in candidates:
        if path.is_file() and os.access(path, os.X_OK):
            return path
    return None


def _log(job_id: str, message: str, progress: int | None = None, stage: int | None = None):
    with _lock:
        job = _jobs[job_id]
        job["logs"].append(f"[{time.strftime('%H:%M:%S')}] {message}")
        if progress is not None:
            job["progress"] = max(0, min(100, progress))
        if stage is not None:
            job["stage"] = stage


def _fail(job_id: str, message: str):
    with _lock:
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = message
    _log(job_id, f"失败：{message}")


def _run_command(job_id: str, args: list[str], cwd: Path, stage: int, progress: int):
    _log(job_id, f"执行：{' '.join(args)}", progress, stage)
    process = subprocess.Popen(
        args,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    assert process.stdout is not None
    for line in process.stdout:
        line = line.strip()
        if line:
            _log(job_id, line[-500:])
    result = process.wait()
    if result != 0:
        raise RuntimeError(f"命令退出码 {result}: {args[0]}")


def _run_job(job_id: str, metadata: dict, image_files: list[tuple[str, bytes]]):
    job_dir = RUNTIME / job_id
    images = job_dir / "images"
    sparse = job_dir / "sparse" / "0"
    output = job_dir / "output"
    images.mkdir(parents=True, exist_ok=True)
    sparse.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    try:
        for name, content in image_files:
            safe_name = Path(name).name
            (images / safe_name).write_bytes(content)
        count = len(image_files)
        _log(job_id, f"已保存 {count} 张原始影像到 {images}", 2, 0)
        if count < 2:
            raise RuntimeError("至少需要 2 张照片；建议使用有 60% 以上重叠的多视角照片")

        import pycolmap

        database = job_dir / "database.db"
        _log(job_id, "COLMAP：提取 SIFT 特征", 8, 0)
        pycolmap.extract_features(str(database), str(images), camera_mode=pycolmap.CameraMode.AUTO)
        _log(job_id, "COLMAP：建立影像匹配图", 18, 0)
        if count <= 80:
            pycolmap.match_exhaustive(str(database))
        else:
            pycolmap.match_sequential(str(database))
        _log(job_id, "COLMAP：增量式 SfM / Bundle Adjustment", 32, 0)
        reconstructions = pycolmap.incremental_mapping(str(database), str(images), str(job_dir / "sparse"))
        if not reconstructions:
            raise RuntimeError("COLMAP 未能注册足够的相机。请增加照片重叠、避免模糊或减少重复画面")
        reconstruction = max(reconstructions.values(), key=lambda r: r.num_images())
        reconstruction.write_binary(str(sparse))
        reconstruction.export_PLY(str(sparse / "points3D.ply"))
        _log(
            job_id,
            f"COLMAP 完成：注册 {reconstruction.num_images()} 台相机，{reconstruction.num_points3D()} 个稀疏点",
            42,
            0,
        )

        brush = _brush_binary()
        if brush is None:
            raise RuntimeError("已完成 COLMAP 相机解算，但找不到 Brush。请将官方 Brush macOS 二进制放入 tools/brush，或设置 BRUSH_BIN")

        max_splats = int(metadata.get("maxGaussianPoints", 4000000))
        steps = int(metadata.get("steps", BRUSH_STEPS))
        _log(job_id, f"Brush：开始 Metal/WebGPU 高斯训练（{steps:,} 步）", 45, 1)
        _run_command(
            job_id,
            [
                str(brush),
                str(job_dir),
                "--total-steps",
                str(steps),
                "--max-resolution",
                str(int(metadata.get("maxResolution", 1600))),
                "--max-splats",
                str(max_splats),
                "--export-every",
                str(steps),
                "--export-path",
                str(output),
                "--export-name",
                "export_{iter}.ply",
            ],
            ROOT,
            1,
            45,
        )
        exports = sorted(output.glob("*.ply"), key=lambda p: p.stat().st_mtime)
        if not exports:
            raise RuntimeError("Brush 训练结束但没有找到 PLY 导出文件")
        result = exports[-1]
        _log(job_id, f"高斯训练完成：已导出 {result.name}", 96, 2)
        with _lock:
            _jobs[job_id].update(
                status="completed",
                progress=100,
                artifact=result.name,
                registered_images=reconstruction.num_images(),
                sparse_points=reconstruction.num_points3D(),
                mean_reprojection_error=float(reconstruction.compute_mean_reprojection_error()),
            )
        _log(job_id, "真实重建流水线完成，PLY 可在三维视口加载", 100, 3)
    except Exception as exc:  # noqa: BLE001 - surfaced to the UI as a job error
        _fail(job_id, str(exc))


class Handler(BaseHTTPRequestHandler):
    server_version = "3DGSMAP-Reconstruction/1.0"

    def _json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):  # noqa: N802
        path = unquote(urlparse(self.path).path)
        if path == "/api/health":
            self._json(200, {"ok": True, "pycolmap": True, "brush": bool(_brush_binary())})
            return
        if path.startswith("/api/jobs/"):
            bits = path.split("/")
            job_id = bits[3] if len(bits) > 3 else ""
            with _lock:
                job = _jobs.get(job_id)
                payload = dict(job) if job else None
            if not payload:
                self._json(404, {"error": "任务不存在"})
                return
            if len(bits) >= 6 and bits[4] == "artifact":
                filename = Path(bits[5]).name
                artifact = RUNTIME / job_id / "output" / filename
                if not artifact.exists():
                    self._json(404, {"error": "成果文件不存在"})
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Length", str(artifact.stat().st_size))
                self.end_headers()
                with artifact.open("rb") as source:
                    shutil.copyfileobj(source, self.wfile)
                return
            self._json(200, payload)
            return
        self._json(404, {"error": "Not found"})

    def do_POST(self):  # noqa: N802
        if urlparse(self.path).path != "/api/reconstruct":
            self._json(404, {"error": "Not found"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        content_type = self.headers.get("Content-Type", "")
        body = self.rfile.read(length)
        form = cgi.FieldStorage(
            fp=io.BytesIO(body),
            headers=self.headers,
            environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": content_type, "CONTENT_LENGTH": str(length)},
            keep_blank_values=True,
        )
        try:
            metadata = json.loads(form.getfirst("metadata", "{}"))
            image_files: list[tuple[str, bytes]] = []
            for item in form.list or []:
                if item.name == "images" and getattr(item, "filename", None):
                    image_files.append((item.filename, item.file.read()))
            if not image_files:
                raise ValueError("没有收到照片文件，请重新选择照片或文件夹")
            job_id = uuid.uuid4().hex[:12]
            with _lock:
                _jobs[job_id] = {
                    "id": job_id,
                    "status": "processing",
                    "progress": 0,
                    "stage": 0,
                    "logs": [],
                    "artifact": None,
                    "registered_images": 0,
                    "sparse_points": 0,
                }
            thread = threading.Thread(target=_run_job, args=(job_id, metadata, image_files), daemon=True)
            thread.start()
            self._json(202, {"job_id": job_id})
        except Exception as exc:  # noqa: BLE001
            self._json(400, {"error": str(exc)})

    def log_message(self, fmt, *args):  # noqa: D401
        print(f"[reconstruction] {fmt % args}", flush=True)


if __name__ == "__main__":
    port = int(os.environ.get("RECONSTRUCTION_PORT", "8787"))
    print(f"3DGSMAP reconstruction API listening on http://127.0.0.1:{port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
