"""Bounded local compute, content-addressed SfM cache and observable workers."""
from __future__ import annotations

import codecs
import errno
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pty
import re
import select
import sqlite3
import struct
import subprocess
import sys
import termios
import time

ROOT = Path(__file__).resolve().parents[1]
PROFILES = json.loads((ROOT / 'config/reconstruction_profiles.json').read_text())
ANSI = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')
STEPS = re.compile(r'(\d+)\s*/\s*(\d+)\s+Steps\b')


def settings(metadata):
    if not isinstance(metadata, dict):
        raise ValueError('metadata 必须为 JSON 对象')
    profile = metadata.get('profile', 'preview')
    if profile not in PROFILES:
        raise ValueError('未知性能档位')
    result = dict(PROFILES[profile], profile=profile)
    # Explicit user overrides remain possible, but accidental unbounded jobs do not.
    limits = {'steps': (10, 60000), 'maxResolution': (320, 4096),
              'maxGaussianPoints': (10000, 10000000)}
    for key, (low, high) in limits.items():
        if key in metadata:
            value = int(metadata[key])
            if not low <= value <= high:
                raise ValueError(f'{key} 必须在 {low}–{high} 之间')
            result[key] = value
    result['exportEvery'] = min(result['exportEvery'], result['steps'])
    result['threads'] = max(1, min(4, (os.cpu_count() or 2) // 2))
    result['matching'] = metadata.get('matching', 'exhaustive')
    if result['matching'] not in ('exhaustive', 'sequential'):
        raise ValueError('未知匹配模式')
    return result


def sfm_key(images: Path, config):
    digest = hashlib.sha256()
    # Include the COLMAP version and only parameters that affect SfM. Changing
    # training steps/splat budgets does not force camera solving again.
    import importlib.metadata
    signature = {k: config[k] for k in ('sfmMaxSize', 'sfmFeatures', 'firstOctave', 'matching')}
    signature['pycolmap'] = importlib.metadata.version('pycolmap')
    digest.update(json.dumps(signature, sort_keys=True).encode())
    for file in sorted(images.iterdir()):
        digest.update(file.name.encode() + b'\0')
        digest.update(str(file.stat().st_size).encode() + b'\0')
        with file.open('rb') as source:
            while block := source.read(1024 * 1024):
                digest.update(block)
    return digest.hexdigest()


def feature_count(database):
    if not database.exists():
        return 0
    try:
        with sqlite3.connect(f'file:{database}?mode=ro', uri=True, timeout=0.1) as conn:
            return conn.execute('SELECT COUNT(*) FROM descriptors WHERE rows > 0').fetchone()[0]
    except sqlite3.Error:
        return 0


def brush_step(line, total):
    match = STEPS.search(ANSI.sub('', line))
    if match and int(match[2]) == total:
        return min(total, int(match[1]))
    return None


def run_process(args, log_path, on_line, on_tick=lambda: None, terminal=False):
    """Drain output continuously. A PTY exposes Brush's indicatif progress bar."""
    master = slave = None
    if terminal:
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 32, 220, 0, 0))
    env = dict(os.environ, PYTHONUNBUFFERED='1', TERM='xterm-256color', COLUMNS='220')
    try:
        process = subprocess.Popen(args, stdout=slave if terminal else subprocess.PIPE,
                                   stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                   env=env, cwd=ROOT)
    except BaseException:
        if master is not None: os.close(master)
        if slave is not None: os.close(slave)
        raise
    if slave is not None:
        os.close(slave)
    fd = master if terminal else process.stdout.fileno()
    decoder = codecs.getincrementaldecoder('utf-8')(errors='replace')
    pending = ''
    last_tick = 0
    try:
        with log_path.open('ab', buffering=0) as logfile:
            while True:
                ready, _, _ = select.select([fd], [], [], 0.5)
                if time.monotonic() - last_tick >= 1:
                    on_tick()
                    last_tick = time.monotonic()
                if ready:
                    try:
                        data = os.read(fd, 65536)
                    except OSError as exc:
                        if exc.errno != errno.EIO: raise
                        data = b''
                    if not data:
                        break
                    logfile.write(data)
                    pending += decoder.decode(data)
                    lines = re.split(r'[\r\n]', pending)
                    pending = lines.pop()
                    for line in lines:
                        clean = ANSI.sub('', line).strip()
                        if clean:
                            on_line(clean)
                elif process.poll() is not None:
                    break
            if pending.strip(): on_line(ANSI.sub('', pending).strip())
        code = process.wait()
        on_tick()
        if code:
            raise RuntimeError(f'计算进程退出码 {code}，详见 {log_path.name}')
    finally:
        # Only this invocation's own child is stopped on an observer failure.
        if process.poll() is None:
            process.terminate()
            try: process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait()
        if master is not None: os.close(master)
        if process.stdout is not None: process.stdout.close()


def brush_command(binary, dataset, output, config):
    return [str(binary), str(dataset), '--total-steps', str(config['steps']),
            '--max-resolution', str(config['maxResolution']),
            '--max-splats', str(config['maxGaussianPoints']),
            '--sh-degree', str(config['shDegree']),
            '--refine-every', str(config.get('refineEvery', 200)),
            '--growth-stop-iter', str(int(config['steps'] * config.get('growthStopRatio', 0.5))),
            '--export-every', str(config['exportEvery']),
            '--export-path', str(output), '--export-name', 'export_{iter}.ply']


def sfm_worker(cache, images, config):
    """Runs outside the HTTP server: native logs cannot block request handling."""
    import pycolmap
    cache, images = Path(cache), Path(images)
    database = cache / 'database.db'
    extraction = pycolmap.FeatureExtractionOptions()
    extraction.max_image_size = config['sfmMaxSize']
    extraction.num_threads = config['threads']
    extraction.sift.max_num_features = config['sfmFeatures']
    extraction.sift.first_octave = config['firstOctave']
    print('PIPELINE_STAGE extraction', flush=True)
    pycolmap.extract_features(str(database), str(images), extraction_options=extraction)
    print('PIPELINE_STAGE matching', flush=True)
    matching = pycolmap.FeatureMatchingOptions()
    matching.num_threads = config['threads']
    if config['matching'] == 'sequential':
        pairing = pycolmap.SequentialPairingOptions()
        pairing.overlap = 10
        pycolmap.match_sequential(str(database), matching_options=matching, pairing_options=pairing)
    else:
        pycolmap.match_exhaustive(str(database), matching_options=matching)
    print('PIPELINE_STAGE mapping', flush=True)
    options = pycolmap.IncrementalPipelineOptions()
    options.num_threads = config['threads']
    models_dir = cache / 'models'
    models_dir.mkdir(exist_ok=True)
    models = pycolmap.incremental_mapping(str(database), str(images), str(models_dir), options=options)
    if not models:
        raise RuntimeError('COLMAP 未能注册相机，请提高档位或检查照片重叠与匹配顺序')
    model = max(models.values(), key=lambda m: m.num_reg_images())
    if model.num_reg_images() < 2:
        raise RuntimeError('注册相机不足 2 台')
    sparse = cache / 'sparse' / '0'
    sparse.mkdir(parents=True, exist_ok=True)
    model.write_binary(str(sparse))
    stats = dict(registered_images=model.num_reg_images(), sparse_points=model.num_points3D(),
                 mean_reprojection_error=float(model.compute_mean_reprojection_error()))
    # This completion marker is published only after all sparse files are written.
    temp = cache / 'result.tmp'
    temp.write_text(json.dumps(stats))
    temp.replace(cache / 'result.json')
    print('PIPELINE_STAGE solved', flush=True)


if __name__ == '__main__':
    sfm_worker(sys.argv[1], sys.argv[2], json.loads(Path(sys.argv[3]).read_text()))
