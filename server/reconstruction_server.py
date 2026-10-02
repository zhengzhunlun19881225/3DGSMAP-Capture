#!/usr/bin/env python3
"""Local photo -> COLMAP -> Brush API. Run with Python 3.12."""
from __future__ import annotations

import cgi
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

from pipeline import ROOT, settings, sfm_key, feature_count, brush_step, run_process, brush_command
from viewer_metadata import camera_metadata

RUNTIME = ROOT / 'runtime' / 'jobs'
CACHE = ROOT / 'runtime' / 'sfm-cache'
RUNTIME.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
_jobs = {}
_lock = threading.RLock()
# One CPU/GPU pipeline at a time: Apple Silicon shares RAM across both.
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='pipeline')


@contextmanager
def multipart_form(**kwargs):
    form = cgi.FieldStorage(**kwargs)
    try:
        yield form
    finally:
        for item in form.list or []:
            if item.file is not None:
                item.file.close()


def _brush_binary():
    configured = os.environ.get('BRUSH_BIN')
    if configured and Path(configured).is_file() and os.access(configured, os.X_OK):
        return Path(configured).resolve()
    for name in ('brush_app', 'brush', 'brush-app'):
        for file in sorted((ROOT / 'tools' / 'brush').glob(f'**/{name}')):
            if file.is_file() and os.access(file, os.X_OK): return file.resolve()
    return None


def _save(job_id):
    target = RUNTIME / job_id / 'status.json'
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(_jobs[job_id], ensure_ascii=False))
    temp.replace(target)


def _update(job_id, **values):
    with _lock:
        _jobs[job_id].update(values, updated_at=time.time())
        _save(job_id)


def _log(job_id, message, **values):
    with _lock:
        job = _jobs[job_id]
        job['logs'].append(f"[{time.strftime('%H:%M:%S')}] {message}")
        job['logs'] = job['logs'][-120:]
        _update(job_id, **values)


def _run_job(job_id, config):
    job_dir = RUNTIME / job_id
    images, output = job_dir / 'images', job_dir / 'output'
    try:
        # Also serialize across separately launched versions of this service.
        with (ROOT / 'runtime' / 'compute.lock').open('a') as compute_lock:
            fcntl.flock(compute_lock, fcntl.LOCK_EX)
            if (job_dir / 'cancelled.json').exists():
                with _lock:
                    _jobs[job_id] = json.loads((job_dir / 'cancelled.json').read_text())
                    _save(job_id)
                return
            _compute(job_id, config, job_dir, images, output)
    except Exception as exc:
        _log(job_id, f'失败：{exc}', status='failed', error=str(exc), finished_at=time.time())


def _compute(job_id, config, job_dir, images, output):
    total = len(list(images.iterdir()))
    _log(job_id, f"开始 {config['label']}：{total} 张照片；SIFT {config['sfmMaxSize']}px / {config['threads']} 线程",
         status='processing', started_at=time.time(), progress=2, stage=0, phase='extraction')
    key = sfm_key(images, config)
    cache = CACHE / key
    cache.mkdir(exist_ok=True)
    _update(job_id, cache_key=key)
    config_file = job_dir / 'config.json'
    if (cache / 'result.json').exists():
        _log(job_id, '命中相同照片及解算参数的缓存，复用 COLMAP 相机与稀疏点', cache_hit=True)
    else:
        started = time.monotonic()
        last_count = [-1]
        last_log = [0.0]

        def sfm_tick():
            if _jobs[job_id]['phase'] != 'extraction': return
            count = feature_count(cache / 'database.db')
            if count == last_count[0]: return
            last_count[0] = count
            elapsed = time.monotonic() - started
            # Existing rows may be from an interrupted extraction; don't invent ETA.
            _update(job_id, feature_images=count, image_count=total,
                    progress=round(8 + 10 * min(count / total, 1), 1), phase_elapsed_seconds=round(elapsed))

        def sfm_line(line):
            phases = {'matching': (18, '匹配'), 'mapping': (30, '相机解算'), 'solved': (42, '解算完成')}
            if line.startswith('PIPELINE_STAGE '):
                phase = line.split()[-1]
                if phase in phases:
                    progress, label = phases[phase]
                    _log(job_id, f'COLMAP：{label}', phase=phase, progress=progress)
                return
            if time.monotonic() - last_log[0] > 2:
                _log(job_id, line[-300:])
                last_log[0] = time.monotonic()

        run_process([sys.executable, str(ROOT / 'server' / 'pipeline.py'), str(cache),
                     str(images), str(config_file)], job_dir / 'colmap.log', sfm_line, sfm_tick)
    stats = json.loads((cache / 'result.json').read_text())
    shutil.copytree(cache / 'sparse', job_dir / 'sparse', dirs_exist_ok=True)
    _log(job_id, f"COLMAP 完成：注册 {stats['registered_images']}/{total} 台相机，{stats['sparse_points']} 个稀疏点",
         **stats, progress=42, feature_images=feature_count(cache / 'database.db'))
    if stats['registered_images'] < total:
        _log(job_id, '部分照片未注册；快速档可提高档位后重试以改善解算完整度')
    brush = _brush_binary()
    if not brush: raise RuntimeError('未找到 Brush，请配置 BRUSH_BIN')
    _log(job_id, f"Brush：{config['steps']} 步 / {config['maxResolution']}px / 最多 {config['maxGaussianPoints']} 点 / SH{config['shDegree']}",
         progress=45, stage=1, phase='training', training_step=0, training_total=config['steps'])
    first_sample = [None]
    last_step = [0]
    last_emit = [0.0]
    last_log = [0.0]

    def training_line(line):
        step = brush_step(line, config['steps'])
        if step is not None and step > last_step[0]:
            now = time.monotonic()
            if step < config['steps'] and now - last_emit[0] < 1: return
            last_emit[0] = now
            if first_sample[0] is None: first_sample[0] = (now, step)
            start_time, start_step = first_sample[0]
            duration = now - start_time
            rate = (step - start_step) / duration if duration >= 10 else None
            _update(job_id, training_step=step, progress=round(45 + 49 * step / config['steps'], 1),
                    steps_per_second=round(rate, 2) if rate else None,
                    eta_seconds=round((config['steps'] - step) / rate) if rate else None)
            last_step[0] = step
            if now - last_log[0] >= 10:
                _log(job_id, f"训练 {step}/{config['steps']} 步")
                last_log[0] = now
        elif step is None and any(word in line.lower() for word in ('error', 'warning', 'loaded dataset', 'training took')):
            _log(job_id, line[-400:])

    run_process(brush_command(brush, job_dir, output, config), job_dir / 'brush.log', training_line, terminal=True)
    # Do not call a partial export a completed training result.
    result = output / f"export_{config['steps']}.ply"
    if not result.is_file() or result.stat().st_size == 0:
        raise RuntimeError('训练退出但未找到最终步数的 PLY；保留中间导出供检查')
    _log(job_id, '训练完成，最终 PLY 已写入磁盘', status='completed', phase='completed',
         progress=100, stage=3, artifact=result.name, training_step=config['steps'], eta_seconds=0, finished_at=time.time())


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == '/api/deleted-jobs':
            tombstones = ROOT / 'runtime' / 'deleted-jobs.json'
            self._json(200, {'job_ids': json.loads(tombstones.read_text()) if tombstones.exists() else []})
            return
        if path == '/api/health':
            self._json(200, dict(ok=True, api_version=2, brush=bool(_brush_binary()), max_concurrent_jobs=1))
            return
        bits = path.strip('/').split('/')
        if len(bits) < 3 or bits[:2] != ['api', 'jobs']:
            self._json(404, {'error': 'Not found'}); return
        job_id = bits[2]
        if not re.fullmatch(r'[a-f0-9]{12}', job_id):
            self._json(404, {'error': '任务不存在'}); return
        with _lock:
            job = _jobs.get(job_id)
            if job:
                payload = dict(job, logs=list(job['logs']))
            else:
                state = RUNTIME / job_id / 'status.json'
                payload = json.loads(state.read_text()) if state.exists() else None
                if payload and payload['status'] in ('processing', 'queued'):
                    payload.update(status='failed', error='服务曾重启；请重新提交相同照片，已有 COLMAP 缓存将复用')
            cancelled = RUNTIME / job_id / 'cancelled.json'
            if cancelled.exists():
                payload = json.loads(cancelled.read_text())
        if not payload:
            self._json(404, {'error': '任务不存在'}); return
        if len(bits) == 4 and bits[3] == 'view':
            try:
                self._json(200, camera_metadata(RUNTIME / job_id))
            except (RuntimeError, ValueError, OSError):
                self._json(404, {'error': '相机解算结果尚不可用'})
            return
        if len(bits) == 5 and bits[3] == 'artifact':
            if bits[4] != payload.get('artifact'):
                self._json(404, {'error': '最终成果尚不可用'}); return
            artifact = RUNTIME / job_id / 'output' / bits[4]
            if not artifact.is_file():
                self._json(404, {'error': '成果文件不存在'}); return
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(artifact.stat().st_size))
            self.end_headers()
            with artifact.open('rb') as source: shutil.copyfileobj(source, self.wfile)
            return
        self._json(200, payload)

    def do_POST(self):
        if urlparse(self.path).path != '/api/reconstruct':
            self._json(404, {'error': 'Not found'}); return
        job_dir = None
        try:
            if 'multipart/form-data' not in self.headers.get('Content-Type', ''):
                raise ValueError('请使用 multipart/form-data 上传照片')
            # Stream multipart to temporary files: never copy the entire photo set into RAM.
            with multipart_form(fp=self.rfile, headers=self.headers, environ={
                'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers.get('Content-Type', ''),
                'CONTENT_LENGTH': self.headers.get('Content-Length', '0')}, keep_blank_values=True) as form:
                metadata = json.loads(form.getfirst('metadata', '{}'))
                config = settings(metadata)
                items = [item for item in form.list or [] if item.name == 'images' and item.filename]
                if len(items) < 2: raise ValueError('至少需要 2 张有重叠的照片')
                if not _brush_binary(): raise ValueError('未安装 Brush，请先配置 BRUSH_BIN')
                job_id = uuid.uuid4().hex[:12]
                job_dir = RUNTIME / job_id
                images = job_dir / 'images'
                images.mkdir(parents=True)
                (job_dir / 'output').mkdir()
                names = set()
                for item in items:
                    name = Path(item.filename).name
                    if name in ('', '.', '..') or name.casefold() in names:
                        raise ValueError('照片文件名为空或重复；请先重命名后重新上传')
                    names.add(name.casefold())
                    with (images / name).open('wb') as target:
                        shutil.copyfileobj(item.file, target, length=1024 * 1024)
                (job_dir / 'config.json').write_text(json.dumps(config))
                with _lock:
                    _jobs[job_id] = dict(id=job_id, status='queued', progress=0, stage=0,
                        phase='queued', logs=[], artifact=None, image_count=len(items), config=config,
                        created_at=time.time(), registered_images=0, sparse_points=0)
                    _log(job_id, '照片已保存，等待本机计算队列（同时运行 1 个任务）')
                _executor.submit(_run_job, job_id, config)
                self._json(202, {'job_id': job_id})
        except (ValueError, TypeError, OSError) as exc:
            # Failed, unpublished uploads are disposable; never touch existing jobs.
            if job_dir and job_dir.name not in _jobs: shutil.rmtree(job_dir)
            self._json(400, {'error': str(exc)})

    def log_message(self, fmt, *args):
        # 2s browser polls should not flood/block the service's terminal pipe.
        if args and str(args[1]) not in ('200', '202'): super().log_message(fmt, *args)


if __name__ == '__main__':
    port = int(os.environ.get('RECONSTRUCTION_PORT', '8787'))
    print(f'3DGSMAP API v2 http://127.0.0.1:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
