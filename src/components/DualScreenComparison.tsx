import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  ArrowLeft,
  Lock,
  Unlock,
  RotateCcw,
  Camera,
  Layers,
  Sparkles,
  Box,
} from 'lucide-react';
import { ReconstructionTask } from '../types/reconstruction';
import { ASSET_ORTHOPHOTO } from '../data/mockData';

interface DualScreenComparisonProps {
  task: ReconstructionTask;
  onBack: () => void;
}

export const DualScreenComparison: React.FC<DualScreenComparisonProps> = ({ task, onBack }) => {
  const [leftMode, setLeftMode] = useState<'GS' | 'PointCloud'>('GS');
  const [rightMode, setRightMode] = useState<'Mesh' | 'DOM'>('Mesh');
  const [isLocked, setIsLocked] = useState(true);

  const leftMountRef = useRef<HTMLDivElement>(null);
  const rightMountRef = useRef<HTMLDivElement>(null);

  // Synchronized Three.js views
  useEffect(() => {
    if (!leftMountRef.current || !rightMountRef.current) return;

    // Common camera parameters
    let spherical = { radius: 65, theta: 0.8, phi: 1.1 };
    let target = new THREE.Vector3(0, 0, 0);

    // Left Scene (3DGS / Point Cloud)
    const leftScene = new THREE.Scene();
    leftScene.background = new THREE.Color(0x121317);
    const leftCam = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const leftRenderer = new THREE.WebGLRenderer({ antialias: true });
    leftMountRef.current.innerHTML = '';
    leftMountRef.current.appendChild(leftRenderer.domElement);

    // Right Scene (Textured Mesh / Wireframe)
    const rightScene = new THREE.Scene();
    rightScene.background = new THREE.Color(0x15161b);
    const rightCam = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const rightRenderer = new THREE.WebGLRenderer({ antialias: true });
    rightMountRef.current.innerHTML = '';
    rightMountRef.current.appendChild(rightRenderer.domElement);

    // Lights
    [leftScene, rightScene].forEach((sc) => {
      sc.add(new THREE.AmbientLight(0xffffff, 0.9));
      const dl = new THREE.DirectionalLight(0xffffff, 1.5);
      dl.position.set(30, 60, 30);
      sc.add(dl);
    });

    // Populate Left Scene: Gaussian Particle Cloud
    const splatCount = 18000;
    const splatGeo = new THREE.BufferGeometry();
    const splatPos = new Float32Array(splatCount * 3);
    const splatCol = new Float32Array(splatCount * 3);
    for (let i = 0; i < splatCount; i++) {
      const x = (Math.random() - 0.5) * 60;
      const z = (Math.random() - 0.5) * 60;
      const y = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 6;
      splatPos[i * 3] = x;
      splatPos[i * 3 + 1] = y;
      splatPos[i * 3 + 2] = z;

      splatCol[i * 3] = 0.2 + (y + 6) / 20;
      splatCol[i * 3 + 1] = 0.5 + Math.random() * 0.3;
      splatCol[i * 3 + 2] = 0.2;
    }
    splatGeo.setAttribute('position', new THREE.BufferAttribute(splatPos, 3));
    splatGeo.setAttribute('color', new THREE.BufferAttribute(splatCol, 3));
    const splatMat = new THREE.PointsMaterial({ size: 0.6, vertexColors: true });
    leftScene.add(new THREE.Points(splatGeo, splatMat));

    // Populate Right Scene: Polygonal Mesh
    const planeGeo = new THREE.PlaneGeometry(60, 60, 48, 48);
    planeGeo.rotateX(-Math.PI / 2);
    const pos = planeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      pos.setY(i, Math.sin(vx * 0.1) * Math.cos(vz * 0.1) * 6);
    }
    planeGeo.computeVertexNormals();
    const meshMat = new THREE.MeshStandardMaterial({
      color: 0x4a6344,
      roughness: 0.7,
      wireframe: false,
    });
    rightScene.add(new THREE.Mesh(planeGeo, meshMat));

    const updateCameras = () => {
      const x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta) + target.x;
      const y = spherical.radius * Math.cos(spherical.phi) + target.y;
      const z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta) + target.z;
      leftCam.position.set(x, y, z);
      leftCam.lookAt(target);
      rightCam.position.set(x, y, z);
      rightCam.lookAt(target);
    };
    updateCameras();

    // Mouse synchronization
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;

    const handleDown = (e: MouseEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const handleMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;

      spherical.theta -= dx * 0.008;
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - dy * 0.008));
      updateCameras();
    };
    const handleUp = () => {
      isDragging = false;
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(10, Math.min(150, spherical.radius + e.deltaY * 0.05));
      updateCameras();
    };

    window.addEventListener('mousedown', handleDown);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    leftMountRef.current.addEventListener('wheel', handleWheel, { passive: false });
    rightMountRef.current.addEventListener('wheel', handleWheel, { passive: false });

    // Resize handling
    const resizeViews = () => {
      if (leftMountRef.current) {
        const lw = leftMountRef.current.clientWidth;
        const lh = leftMountRef.current.clientHeight;
        leftCam.aspect = lw / lh;
        leftCam.updateProjectionMatrix();
        leftRenderer.setSize(lw, lh);
      }
      if (rightMountRef.current) {
        const rw = rightMountRef.current.clientWidth;
        const rh = rightMountRef.current.clientHeight;
        rightCam.aspect = rw / rh;
        rightCam.updateProjectionMatrix();
        rightRenderer.setSize(rw, rh);
      }
    };
    resizeViews();
    window.addEventListener('resize', resizeViews);

    let reqId: number;
    const renderLoop = () => {
      reqId = requestAnimationFrame(renderLoop);
      leftRenderer.render(leftScene, leftCam);
      rightRenderer.render(rightScene, rightCam);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('resize', resizeViews);
      leftRenderer.dispose();
      rightRenderer.dispose();
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-[#141518] text-[#E1E4EA] h-[calc(100vh-3.5rem)] overflow-hidden select-none">
      {/* Top Header */}
      <div className="h-12 bg-[#1B1C22] border-b border-[#282A33] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-[#252731] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-white">双屏对比分析 (Dual-Screen Comparison)</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              isLocked
                ? 'bg-blue-600/30 text-blue-300 border-blue-500/40'
                : 'bg-[#242630] text-neutral-400 border-[#353846]'
            }`}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{isLocked ? '视角同步锁定中' : '自由独立漫游'}</span>
          </button>
        </div>
      </div>

      {/* Split Views */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Screen */}
        <div className="flex-1 border-r border-[#2C2E38] relative flex flex-col overflow-hidden">
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-black/80 backdrop-blur border border-white/10 text-white">
              视窗 A: 3D 高斯泼溅 (3DGS)
            </span>
          </div>
          <div ref={leftMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        </div>

        {/* Right Screen */}
        <div className="flex-1 relative flex flex-col overflow-hidden">
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-black/80 backdrop-blur border border-white/10 text-white">
              视窗 B: 实景三维网格 (Mesh)
            </span>
          </div>
          <div ref={rightMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        </div>

        {/* Center Divider Badge */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-blue-600/90 backdrop-blur text-white text-[11px] font-bold shadow-2xl border border-white/20">
            VS
          </div>
        </div>
      </div>
    </div>
  );
};
