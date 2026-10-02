import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

export interface GaussianViewportHandle {
  reset: () => void;
  zoom: (factor: number) => void;
  snapshot: () => string | undefined;
}
interface CameraPose {
  name: string;
  width: number;
  height: number;
  intrinsics: number[][];
  worldFromCamera: number[][];
}
interface Props {
  url: string;
  mode: 'GS' | 'AT' | 'Mesh' | 'Point';
  visible: boolean;
}

/** The real pipeline output has no mesh: GS and Point deliberately use different renderers. */
export const GaussianResultViewport = forwardRef<GaussianViewportHandle, Props>(({ url, mode, visible }, ref) => {
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<{
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    splats: SplatMesh;
    points?: THREE.Points;
    reset: () => void;
  } | null>(null);
  const display = useRef({ mode, visible });
  display.current = { mode, visible };
  const [status, setStatus] = useState('正在加载真实高斯成果…');
  const [error, setError] = useState('');
  const [poseCount, setPoseCount] = useState(0);
  const poses = useRef<CameraPose[]>([]);
  const selectPose = useRef<(index: number) => void>(() => {});
  const [poseIndex, setPoseIndex] = useState(0);

  useImperativeHandle(ref, () => ({
    reset: () => engine.current?.reset(),
    zoom: (factor) => {
      const e = engine.current;
      if (!e) return;
      e.camera.position.sub(e.controls.target).multiplyScalar(factor).add(e.controls.target);
      e.controls.update();
    },
    snapshot: () => engine.current?.renderer.domElement.toDataURL('image/png'),
  }), []);

  useEffect(() => {
    if (!container.current) return;
    const host = container.current;
    let disposed = false;
    let splats: SplatMesh | undefined;
    let points: THREE.Points | undefined;
    let spark: SparkRenderer | undefined;
    let renderer: THREE.WebGLRenderer;
    setStatus('正在加载真实高斯成果…');
    setError('');
    setPoseCount(0);
    setPoseIndex(0);
    poses.current = [];
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    } catch {
      setError('无法启动 WebGL2 高斯渲染，请启用浏览器硬件加速后重试。');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NoToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#131418');
    const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.02;
    host.appendChild(renderer.domElement);
    const resize = () => {
      const width = host.clientWidth || 800;
      const height = host.clientHeight || 600;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const abort = new AbortController();
    let sceneRadius = 10;
    const showPose = (index: number) => {
      const pose = poses.current[index];
      if (!pose) return;
      const m = pose.worldFromCamera;
      // COLMAP looks down +Z with +Y down; Three.js cameras look down -Z with +Y up.
      const world = new THREE.Matrix4().set(...[
        ...m[0], ...m[1], ...m[2], 0, 0, 0, 1,
      ] as Parameters<THREE.Matrix4['set']>);
      world.multiply(new THREE.Matrix4().makeScale(1, -1, -1));
      world.decompose(camera.position, camera.quaternion, new THREE.Vector3());
      camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(pose.height / (2 * pose.intrinsics[1][1])));
      camera.updateProjectionMatrix();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      controls.target.copy(camera.position).addScaledVector(forward, Math.max(1, sceneRadius));
      controls.update();
    };
    selectPose.current = showPose;
    const poseRequest = fetch(url.replace(/\/artifact\/[^/]+$/, '/view'), { signal: abort.signal })
      .then(async (response) => response.ok ? (await response.json()).cameras as CameraPose[] : [])
      .catch(() => [] as CameraPose[]);

    void (async () => {
      try {
        spark = new SparkRenderer({ renderer });
        scene.add(spark);
        // Fetch can be cancelled when switching projects; failed loads never fall back to demo geometry.
        const response = await fetch(url, { signal: abort.signal });
        if (!response.ok) throw new Error(`成果下载失败（HTTP ${response.status}）`);
        const bytes = await response.arrayBuffer();
        if (disposed) return;
        splats = new SplatMesh({ fileBytes: bytes, fileName: 'result.ply' });
        await splats.initialized;
        if (disposed) { splats.dispose(); return; }
        scene.add(splats);
        const positions: number[] = [];
        const colors: number[] = [];
        const bounds = new THREE.Box3();
        // Bound the diagnostic point view's CPU/GPU memory; GS still renders every splat.
        const stride = Math.max(1, Math.ceil(splats.numSplats / 200000));
        splats.forEachSplat((index, center, _scales, _rotation, opacity, color) => {
          if (index % stride !== 0) return;
          if (opacity < 0.05) return;
          positions.push(center.x, center.y, center.z);
          colors.push(color.r, color.g, color.b);
          bounds.expandByPoint(center);
        });
        if (!positions.length) throw new Error('成果不包含可见的高斯点');
        const center = bounds.getCenter(new THREE.Vector3());
        // Ignore distant outliers for the initial orbit distance, without removing them from the result.
        const distances: number[] = [];
        const sample = new THREE.Vector3();
        for (let i = 0; i < positions.length; i += 3 * Math.max(1, Math.ceil(positions.length / 30000))) {
          distances.push(sample.set(positions[i], positions[i + 1], positions[i + 2]).distanceTo(center));
        }
        distances.sort((a, b) => a - b);
        sceneRadius = Math.max(1, distances[Math.floor(distances.length * 0.8)]);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        points = new THREE.Points(geometry, new THREE.PointsMaterial({
          size: sceneRadius * 0.003, vertexColors: true, sizeAttenuation: true,
        }));
        scene.add(points);
        const fit = () => {
          camera.up.set(0, -1, 0);
          controls.target.copy(center);
          camera.position.copy(center).add(new THREE.Vector3(0, 0, -sceneRadius * 2));
          controls.update();
        };
        const cameraPoses = await poseRequest;
        if (disposed) return;
        poses.current = cameraPoses;
        setPoseCount(cameraPoses.length);
        const reset = () => {
          if (poses.current.length) { showPose(0); setPoseIndex(0); } else fit();
        };
        engine.current = { renderer, camera, controls, splats, points, reset };
        reset();
        setStatus(`真实高斯成果 · ${splats.numSplats.toLocaleString()} 个高斯${splats.numSplats < 10000 ? ' · 点数较少，细节可能不足' : ''}`);
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error ? failure.message : '高斯成果加载失败');
      }
    })();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize();
      const vector = new THREE.Vector3();
      switch (event.key.toLowerCase()) {
        case 'w': vector.copy(direction); break;
        case 's': vector.copy(direction).negate(); break;
        case 'a': vector.copy(right).negate(); break;
        case 'd': vector.copy(right); break;
        case 'q': vector.copy(camera.up); break;
        case 'e': vector.copy(camera.up).negate(); break;
        default: return;
      }
      vector.multiplyScalar(sceneRadius * 0.025 * (event.shiftKey ? 3 : event.ctrlKey ? 0.3 : 1));
      camera.position.add(vector);
      controls.target.add(vector);
      controls.update();
    };
    window.addEventListener('keydown', onKeyDown);
    renderer.setAnimationLoop(() => {
      if (splats) splats.visible = display.current.visible && display.current.mode === 'GS';
      if (points) points.visible = display.current.visible && display.current.mode === 'Point';
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      disposed = true;
      abort.abort();
      renderer.setAnimationLoop(null);
      observer.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      controls.dispose();
      engine.current = null;
      points?.geometry.dispose();
      (points?.material as THREE.Material | undefined)?.dispose();
      // An in-flight SplatMesh is disposed after its initialization finishes.
      if (splats?.isInitialized) splats.dispose();
      spark?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url]);

  return <>
    <div ref={container} className="absolute inset-0" data-testid="gaussian-viewport" />
    <div className="absolute top-16 left-4 z-10 max-w-[75%] rounded-lg border border-white/10 bg-[#16181f]/90 px-3 py-2 text-xs text-neutral-300">
      <div role="status">{error || status}</div>
      {poseCount > 0 && <label className="mt-2 flex items-center gap-2">
        拍摄视角
        <select aria-label="拍摄视角" className="max-w-60 rounded bg-[#292d39] px-2 py-1" value={poseIndex}
          onChange={(event) => { const index = Number(event.target.value); setPoseIndex(index); selectPose.current(index); }}>
          {poses.current.map((pose, index) => <option key={pose.name} value={index}>{index + 1}. {pose.name}</option>)}
        </select>
      </label>}
    </div>
  </>;
});
