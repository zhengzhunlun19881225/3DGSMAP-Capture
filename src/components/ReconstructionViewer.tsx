import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Download,
  Camera,
  Cloud,
  HelpCircle,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layers,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Plus,
  SplitSquareVertical,
  Share2,
  Trash2,
  Eye,
  Sliders,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
} from 'lucide-react';
import { ReconstructionTask, Project } from '../types/reconstruction';

interface ReconstructionViewerProps {
  project: Project;
  tasks: ReconstructionTask[];
  activeTask: ReconstructionTask;
  onSelectTask: (task: ReconstructionTask) => void;
  onOpenNewTaskModal: () => void;
  onOpenReportModal: () => void;
  onOpenDualScreen: () => void;
  onOpenGcpEditor: () => void;
  onOpenSdkHub: () => void;
  onStartReconstruction?: (taskId: string) => void;
  activeLeftTab: 'results' | 'params';
  onChangeLeftTab: (tab: 'results' | 'params') => void;
}

export const ReconstructionViewer: React.FC<ReconstructionViewerProps> = ({
  project,
  tasks,
  activeTask,
  onSelectTask,
  onOpenNewTaskModal,
  onOpenReportModal,
  onOpenDualScreen,
  onOpenGcpEditor,
  onOpenSdkHub,
  onStartReconstruction,
  activeLeftTab,
  onChangeLeftTab,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'GS' | 'AT' | 'Mesh' | 'Point'>('GS');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showKeyboardHints, setShowKeyboardHints] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Layer Visibility
  const [layerAnnotations, setLayerAnnotations] = useState(true);
  const [layerResults, setLayerResults] = useState(true);
  const [layerPhotos, setLayerPhotos] = useState(false);
  const [datasetExpanded, setDatasetExpanded] = useState(true);

  // Three.js instances ref
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const splatGroupRef = useRef<THREE.Group | null>(null);
  const atGroupRef = useRef<THREE.Group | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Initialize Three.js 3D Scene
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131418);
    scene.fog = new THREE.FogExp2(0x131418, 0.008);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 35, 60);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.8);
    dirLight.position.set(40, 70, 30);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x738aff, 0.6);
    fillLight.position.set(-40, 20, -30);
    scene.add(fillLight);

    // 1. Grid helper & ground reference
    const grid = new THREE.GridHelper(100, 50, 0x3a3f4d, 0x22252e);
    grid.position.y = -5;
    scene.add(grid);

    // Groups for different view layers
    const meshGroup = new THREE.Group();
    const splatGroup = new THREE.Group();
    const atGroup = new THREE.Group();
    meshGroupRef.current = meshGroup;
    splatGroupRef.current = splatGroup;
    atGroupRef.current = atGroup;
    scene.add(meshGroup);
    scene.add(splatGroup);
    scene.add(atGroup);

    // Water Surface plane for water leveling simulation
    const waterGeo = new THREE.PlaneGeometry(80, 80);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1b5275,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.82,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = 0.5;
    waterMesh.visible = !!activeTask.params.waterFlattening;
    meshGroup.add(waterMesh);

    // Build Realistic Photogrammetry Terrain & Winding Road Mesh
    const terrainGeo = new THREE.PlaneGeometry(80, 80, 96, 96);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      // Realistic mountainous terrain height function
      const distFromCenter = Math.sqrt(vx * vx + vz * vz);
      const m1 = Math.sin(vx * 0.08) * Math.cos(vz * 0.08) * 8;
      const m2 = Math.sin(vx * 0.16 + vz * 0.12) * 3;
      const m3 = Math.cos(vx * 0.04) * 5;
      let y = m1 + m2 + m3;
      // Winding road carving through mountains
      const roadPath = Math.sin(vz * 0.1) * 12;
      const distToRoad = Math.abs(vx - roadPath);
      if (distToRoad < 4) {
        y = (y * 0.2) + 0.5; // flatten road
      }
      pos.setY(i, y);
    }
    terrainGeo.computeVertexNormals();

    // Terrain material with realistic colors
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x3f523a, // lush vegetation
      roughness: 0.85,
      metalness: 0.1,
      flatShading: false,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    meshGroup.add(terrainMesh);

    // Road ribbon mesh
    const roadCurvePoints: THREE.Vector3[] = [];
    for (let z = -38; z <= 38; z += 2) {
      const rx = Math.sin(z * 0.1) * 12;
      roadCurvePoints.push(new THREE.Vector3(rx, 1.2, z));
    }
    const roadCurve = new THREE.CatmullRomCurve3(roadCurvePoints);
    const roadGeo = new THREE.TubeGeometry(roadCurve, 64, 1.8, 8, false);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x484b54, // asphalt
      roughness: 0.6,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    meshGroup.add(roadMesh);

    // Add architectural structural site models on hillside
    const bldgGeo = new THREE.BoxGeometry(6, 4, 8);
    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.4 });
    const bldg = new THREE.Mesh(bldgGeo, bldgMat);
    bldg.position.set(10, 4.5, -8);
    meshGroup.add(bldg);

    // 2. High-Fidelity 3D Gaussian Splats (volumetric particles with rich color gradients)
    const splatCount = 28000;
    const splatGeo = new THREE.BufferGeometry();
    const splatPositions = new Float32Array(splatCount * 3);
    const splatColors = new Float32Array(splatCount * 3);

    const cForest = new THREE.Color(0x31562b);
    const cRock = new THREE.Color(0x736d64);
    const cRoad = new THREE.Color(0x8f939e);
    const cHighland = new THREE.Color(0x487538);

    for (let i = 0; i < splatCount; i++) {
      const sx = (Math.random() - 0.5) * 75;
      const sz = (Math.random() - 0.5) * 75;
      const roadPath = Math.sin(sz * 0.1) * 12;
      const distToRoad = Math.abs(sx - roadPath);
      let sy = Math.sin(sx * 0.08) * Math.cos(sz * 0.08) * 8 + Math.sin(sx * 0.16 + sz * 0.12) * 3 + (Math.random() * 1.5);
      if (distToRoad < 4) {
        sy = 0.8 + (Math.random() * 0.4);
      }
      splatPositions[i * 3] = sx;
      splatPositions[i * 3 + 1] = sy;
      splatPositions[i * 3 + 2] = sz;

      let col = cForest;
      if (distToRoad < 3) {
        col = cRoad;
      } else if (sy > 6) {
        col = cRock;
      } else if (sy > 2) {
        col = cHighland;
      }
      splatColors[i * 3] = col.r + (Math.random() - 0.5) * 0.08;
      splatColors[i * 3 + 1] = col.g + (Math.random() - 0.5) * 0.08;
      splatColors[i * 3 + 2] = col.b + (Math.random() - 0.5) * 0.08;
    }
    splatGeo.setAttribute('position', new THREE.BufferAttribute(splatPositions, 3));
    splatGeo.setAttribute('color', new THREE.BufferAttribute(splatColors, 3));

    const splatMat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
    });
    const splatCloud = new THREE.Points(splatGeo, splatMat);
    splatGroup.add(splatCloud);

    // 3. AT (Aerial Triangulation) Camera Poses & Pyramids
    const cameraFlightLinePoints: THREE.Vector3[] = [];
    const flightAltitude = 24;
    const flightLines = [-25, -12, 0, 12, 25];
    flightLines.forEach((x, lineIdx) => {
      const zStart = lineIdx % 2 === 0 ? -32 : 32;
      const zEnd = lineIdx % 2 === 0 ? 32 : -32;
      const steps = 14;
      for (let s = 0; s <= steps; s++) {
        const curZ = zStart + (zEnd - zStart) * (s / steps);
        const camPos = new THREE.Vector3(x + (Math.sin(s) * 0.5), flightAltitude + (Math.random() * 0.4), curZ);
        cameraFlightLinePoints.push(camPos);

        // Camera Frustum Pyramid wireframe
        const pyramidGeo = new THREE.ConeGeometry(1.2, 2.2, 4);
        pyramidGeo.rotateX(Math.PI);
        const pyramidWire = new THREE.WireframeGeometry(pyramidGeo);
        const line = new THREE.LineSegments(pyramidWire, new THREE.LineBasicMaterial({ color: 0x4aa3ff, opacity: 0.85, transparent: true }));
        line.position.copy(camPos);
        atGroup.add(line);
      }
    });

    // Flight line ribbon
    const flightLineGeo = new THREE.BufferGeometry().setFromPoints(cameraFlightLinePoints);
    const flightLineMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, linewidth: 2 });
    const flightLine = new THREE.Line(flightLineGeo, flightLineMat);
    atGroup.add(flightLine);

    // Initial visibility according to viewMode
    meshGroup.visible = false;
    splatGroup.visible = true;
    atGroup.visible = true;

    // Controls: Orbit & Keyboard
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let buttonPressed = 0;
    let spherical = { radius: 75, theta: 0.7, phi: 1.1 };
    let target = new THREE.Vector3(0, 0, 0);

    const updateCameraPos = () => {
      const x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta) + target.x;
      const y = spherical.radius * Math.cos(spherical.phi) + target.y;
      const z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta) + target.z;
      camera.position.set(x, y, z);
      camera.lookAt(target);
    };
    updateCameraPos();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      buttonPressed = e.button;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      if (buttonPressed === 0) {
        // Left click: Orbit / Rotate model
        spherical.theta -= dx * 0.007;
        spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - dy * 0.007));
      } else if (buttonPressed === 2 || buttonPressed === 1) {
        // Right click or Middle click: Pan target
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const up = camera.up.clone().normalize();
        target.addScaledVector(right, -dx * 0.06);
        target.addScaledVector(up, dy * 0.06);
      }
      updateCameraPos();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(8, Math.min(180, spherical.radius + e.deltaY * 0.05));
      updateCameraPos();
    };

    // Keyboard navigation (WASD, QE, Shift, Ctrl)
    const onKeyDown = (e: KeyboardEvent) => {
      const speed = e.shiftKey ? 2.5 : e.ctrlKey ? 0.4 : 1.2;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      switch (e.key.toLowerCase()) {
        case 'w':
          target.addScaledVector(forward, speed);
          break;
        case 's':
          target.addScaledVector(forward, -speed);
          break;
        case 'a':
          target.addScaledVector(right, -speed);
          break;
        case 'd':
          target.addScaledVector(right, speed);
          break;
        case 'q':
          target.y += speed;
          break;
        case 'e':
          target.y -= speed;
          break;
      }
      updateCameraPos();
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKeyDown);

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: nw, height: nh } = entry.contentRect;
        if (nw > 0 && nh > 0) {
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        }
      }
    });
    resizeObserver.observe(container);

    // Animation render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      renderer.dispose();
    };
  }, []);

  // Synchronize view mode with active task's template
  useEffect(() => {
    if (activeTask.params.template === 'gaussian_splat') {
      setViewMode('GS');
    } else if (activeTask.params.template === 'mesh') {
      setViewMode('Mesh');
    } else if (activeTask.params.template === 'at') {
      setViewMode('AT');
    } else if (activeTask.params.template === 'fast_2d') {
      setViewMode('Mesh');
    }
  }, [activeTask.id, activeTask.params.template, activeTask.completedAt]);

  // Update view mode layers dynamically
  useEffect(() => {
    if (!meshGroupRef.current || !splatGroupRef.current || !atGroupRef.current) return;
    if (viewMode === 'GS') {
      meshGroupRef.current.visible = false;
      splatGroupRef.current.visible = layerResults;
      atGroupRef.current.visible = layerPhotos;
    } else if (viewMode === 'AT') {
      meshGroupRef.current.visible = false;
      splatGroupRef.current.visible = false;
      atGroupRef.current.visible = true;
    } else if (viewMode === 'Mesh') {
      meshGroupRef.current.visible = layerResults;
      splatGroupRef.current.visible = false;
      atGroupRef.current.visible = layerPhotos;
    } else if (viewMode === 'Point') {
      meshGroupRef.current.visible = false;
      splatGroupRef.current.visible = layerResults;
      atGroupRef.current.visible = layerPhotos;
    }
  }, [viewMode, layerResults, layerPhotos]);

  const handleCaptureSnapshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${activeTask.name}_snapshot_${Date.now()}.png`;
    a.click();
    showToast('当前三维视角缩略图已成功保存！');
  };

  const handleResetCamera = () => {
    if (!cameraRef.current) return;
    cameraRef.current.position.set(0, 35, 60);
    cameraRef.current.lookAt(0, 0, 0);
    showToast('相机视角已重置至测区中心');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#141518] text-[#E1E4EA] h-[calc(100vh-3.5rem)] overflow-hidden select-none">
      {/* Sub-Header: Task carousel tabs matching Screenshot 2 */}
      <div className="h-16 bg-[#1A1B20] border-b border-[#282930] px-4 flex items-center justify-between gap-4 overflow-x-auto shrink-0 z-20">
        <div className="flex items-center gap-3 overflow-x-auto py-1">
          {tasks.map((task) => {
            const isSelected = task.id === activeTask.id;
            return (
              <button
                key={task.id}
                onClick={() => onSelectTask(task)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#252834] border-blue-500 shadow-md shadow-blue-500/10'
                    : 'bg-[#202126] border-[#2D2F38] hover:border-[#3D404C] opacity-80 hover:opacity-100'
                }`}
              >
                <div className="w-9 h-7 rounded bg-black/40 overflow-hidden relative border border-white/10 shrink-0">
                  <img
                    src={task.thumbnailUrl}
                    alt={task.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-0 right-0 text-[8px] bg-blue-600 text-white px-1 leading-none">
                    GS
                  </span>
                </div>
                <div className="text-left">
                  <div className="text-xs font-medium text-white max-w-[120px] truncate">
                    {task.name}
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    {task.captureDate || '未知拍摄日期'}
                  </div>
                </div>
              </button>
            );
          })}

          {/* New Task Button in carousel */}
          <button
            onClick={onOpenNewTaskModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#22242B] hover:bg-[#282B34] border border-dashed border-[#3A3D49] text-xs font-medium text-neutral-300 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            <span>新建任务</span>
          </button>
        </div>

        {/* Dual Screen Compare Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenDualScreen}
            className="px-3.5 py-1.5 bg-[#252832] hover:bg-[#2D313E] border border-blue-500/40 text-blue-300 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>双屏对比</span>
          </button>
        </div>
      </div>

      {/* Main Working Area: 3-column layout (Left Layers/Params Panel, Center 3D Viewport, Right Details Panel) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel: Layers and Parameters Tabs matching Screenshot 2 */}
        <div className="w-64 bg-[#18191E] border-r border-[#262830] flex flex-col shrink-0 z-10">
          {/* Top or Bottom tabs */}
          <div className="h-10 border-b border-[#262830] flex items-center px-2 bg-[#1B1C22]">
            <button
              onClick={() => onChangeLeftTab('results')}
              className={`flex-1 h-8 text-xs font-medium rounded transition-colors ${
                activeLeftTab === 'results'
                  ? 'bg-[#262933] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              成果列表
            </button>
            <button
              onClick={() => onChangeLeftTab('params')}
              className={`flex-1 h-8 text-xs font-medium rounded transition-colors ${
                activeLeftTab === 'params'
                  ? 'bg-[#262933] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              任务参数
            </button>
          </div>

          {/* Left Panel Body: Layers Tree */}
          {activeLeftTab === 'results' ? (
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-1">
                图层管理 (Layers)
              </div>

              <div className="space-y-1.5 text-xs text-neutral-300">
                {/* Layer 1: Annotations */}
                <div className="flex items-center justify-between p-1.5 rounded hover:bg-[#22232B] transition-colors">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerAnnotations}
                      onChange={(e) => setLayerAnnotations(e.target.checked)}
                      className="rounded bg-[#2B2D37] border-[#383B47] text-blue-500 focus:ring-0"
                    />
                    <span>标注 (Annotations)</span>
                  </label>
                  <span className="text-[10px] text-neutral-500 font-mono">0 个</span>
                </div>

                {/* Layer 2: Results Layer */}
                <div className="flex items-center justify-between p-1.5 rounded hover:bg-[#22232B] transition-colors">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerResults}
                      onChange={(e) => setLayerResults(e.target.checked)}
                      className="rounded bg-[#2B2D37] border-[#383B47] text-blue-500 focus:ring-0"
                    />
                    <span className="text-white font-medium">成果图层 (3DGS / Mesh)</span>
                  </label>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>

                {/* Layer 3: Dataset Tree */}
                <div className="rounded bg-[#1E2027] border border-[#2B2E38] p-2 space-y-1.5 mt-2">
                  <div
                    onClick={() => setDatasetExpanded(!datasetExpanded)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-white">
                      {datasetExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span>数据集 (Dataset)</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 tabular-nums">
                      {activeTask.photoCount} 张
                    </span>
                  </div>

                  {datasetExpanded && (
                    <div className="pl-4 pt-1 space-y-1 border-l border-[#2F323D] ml-2">
                      <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-[#252832]">
                        <input
                          type="checkbox"
                          checked={layerPhotos}
                          onChange={(e) => setLayerPhotos(e.target.checked)}
                          className="rounded bg-[#2B2D37] border-[#383B47] text-blue-500 focus:ring-0"
                        />
                        <Camera className="w-3.5 h-3.5 text-blue-400" />
                        <span>航线相机位姿 (Photos)</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Jump Buttons */}
              <div className="pt-4 border-t border-[#262830] space-y-2">
                <button
                  onClick={onOpenGcpEditor}
                  className="w-full py-2 px-3 bg-[#22242C] hover:bg-[#2B2E38] border border-[#333642] text-xs font-medium rounded-lg text-neutral-200 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>打开像控点平差刺点</span>
                </button>
                <button
                  onClick={onOpenSdkHub}
                  className="w-full py-2 px-3 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 text-xs font-medium rounded-lg text-blue-300 hover:text-blue-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>SDK 代码调用控制台</span>
                </button>
              </div>
            </div>
          ) : (
            /* Parameters Tab Summary - clicking edit opens full drawer */
            <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[#1E2027] border border-[#2B2D37] space-y-2">
                <div className="text-neutral-400">重建模板</div>
                <div className="font-semibold text-white">
                  {activeTask.params.template === 'gaussian_splat' && '高斯泼溅 (3DGS)'}
                  {activeTask.params.template === 'mesh' && '网格模型 (Mesh)'}
                  {activeTask.params.template === 'fast_2d' && '快速二维正射 (DOM)'}
                  {activeTask.params.template === 'at' && '仅空三平差'}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#1E2027] border border-[#2B2D37] space-y-1.5">
                <div className="text-neutral-400">成果坐标系</div>
                <div className="font-medium text-blue-400">{activeTask.params.crs}</div>
              </div>

              <div className="p-3 rounded-lg bg-[#1E2027] border border-[#2B2D37] space-y-1.5">
                <div className="text-neutral-400">3DGS 最大点数</div>
                <div className="font-medium text-white">
                  {activeTask.params.maxGaussianPointsMode === 'auto'
                    ? '自动计算'
                    : `${(activeTask.params.customMaxPoints / 1000000).toFixed(1)}M 点`}
                </div>
              </div>

              <button
                onClick={() => onChangeLeftTab('params')}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                修改重建参数
              </button>
            </div>
          )}
        </div>

        {/* Center 3D Interactive Viewport */}
        <div className="flex-1 relative overflow-hidden bg-[#121316]">
          {/* WebGL Canvas Container */}
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Top Left Floating: Export Button & Model Metadata HUD */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="h-8 px-3.5 bg-[#202228]/90 hover:bg-[#2A2C34] backdrop-blur-md border border-[#3A3D48] text-xs font-medium text-white rounded-lg flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>导出</span>
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>

              {showExportMenu && (
                <div className="absolute left-0 mt-1.5 w-52 rounded-lg bg-[#1F2128] border border-[#353844] shadow-2xl p-1.5 z-30 space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] text-neutral-400 font-semibold uppercase">
                    3D 成果产物
                  </div>
                  <button
                    onClick={() => {
                      showToast('正在打包 3DGS PlayCanvas LOD 成果产物...');
                      setShowExportMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-xs rounded hover:bg-[#2C2F3A] text-neutral-200 hover:text-white flex items-center justify-between"
                  >
                    <span>PlayCanvas LOD 3DGS</span>
                    <span className="text-[10px] text-neutral-500">.json / .splat</span>
                  </button>
                  <button
                    onClick={() => {
                      showToast('正在导出高精 3DGS PLY 原始高斯格式...');
                      setShowExportMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-xs rounded hover:bg-[#2C2F3A] text-neutral-200 hover:text-white flex items-center justify-between"
                  >
                    <span>Gaussian Splatting (PLY)</span>
                    <span className="text-[10px] text-neutral-500">.ply</span>
                  </button>
                  <button
                    onClick={() => {
                      showToast('正在导出 3D Tiles (B3DM) 倾斜摄影瓦片...');
                      setShowExportMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-xs rounded hover:bg-[#2C2F3A] text-neutral-200 hover:text-white flex items-center justify-between"
                  >
                    <span>Cesium 3D Tiles (B3DM)</span>
                    <span className="text-[10px] text-neutral-500">.b3dm</span>
                  </button>
                  <button
                    onClick={() => {
                      showToast('正在打包 OSGB 倾斜摄影格式...');
                      setShowExportMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-xs rounded hover:bg-[#2C2F3A] text-neutral-200 hover:text-white flex items-center justify-between"
                  >
                    <span>OSGB 实景三维模型</span>
                    <span className="text-[10px] text-neutral-500">.osgb</span>
                  </button>
                  <div className="px-2.5 py-1 text-[10px] text-neutral-400 font-semibold uppercase pt-1 border-t border-[#2F323D]">
                    二维正射与点云
                  </div>
                  <button
                    onClick={() => {
                      showToast('正在下载 DOM 数字正射影像 GeoTIFF...');
                      setShowExportMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-xs rounded hover:bg-[#2C2F3A] text-neutral-200 hover:text-white flex items-center justify-between"
                  >
                    <span>正射影像图 (DOM TIF)</span>
                    <span className="text-[10px] text-neutral-500">.tif</span>
                  </button>
                  <button
                    onClick={() => {
                      showToast('正在下载稠密激光点云 (LAS)...');
                      setShowExportMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-xs rounded hover:bg-[#2C2F3A] text-neutral-200 hover:text-white flex items-center justify-between"
                  >
                    <span>激光/密集点云 (LAS)</span>
                    <span className="text-[10px] text-neutral-500">.las</span>
                  </button>
                </div>
              )}
            </div>

            {/* Model Info HUD Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1B1D23]/90 backdrop-blur-md border border-[#323642] text-xs text-neutral-300 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">{activeTask.name}</span>
              <span className="text-neutral-600">·</span>
              <span className="text-blue-300 font-medium">
                {activeTask.params.template === 'gaussian_splat'
                  ? '3DGS 高斯泼溅'
                  : activeTask.params.template === 'mesh'
                  ? '实景网格 (Mesh)'
                  : activeTask.params.template === 'fast_2d'
                  ? '正射影像 (DOM)'
                  : '空三相机网'}
              </span>
              <span className="text-neutral-600">·</span>
              <span className="text-neutral-400 font-mono">{activeTask.photoCount} 张照片</span>
              {activeTask.params.waterFlattening && (
                <span className="text-[10px] text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30">
                  水域平整
                </span>
              )}
              {activeTask.params.humanRemoval && (
                <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  人物消除
                </span>
              )}
            </div>

            {/* Quick Reconfigure / Import Photos */}
            <button
              onClick={() => onChangeLeftTab('params')}
              className="h-8 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg"
              title="调整参数或重新导入照片建模"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>导入与参数设置</span>
            </button>
          </div>

          {/* Top Right Floating Icons matching Screenshot 2 */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <button
              onClick={handleCaptureSnapshot}
              className="w-8 h-8 rounded-lg bg-[#202228]/90 hover:bg-[#2A2C34] backdrop-blur-md border border-[#3A3D48] flex items-center justify-center text-neutral-300 hover:text-white shadow-lg transition-colors cursor-pointer"
              title="截图保存"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => showToast('已连接至私有化分布式存储与云端流媒体分发节点')}
              className="w-8 h-8 rounded-lg bg-[#202228]/90 hover:bg-[#2A2C34] backdrop-blur-md border border-[#3A3D48] flex items-center justify-center text-neutral-300 hover:text-white shadow-lg transition-colors cursor-pointer"
              title="云端分发状态"
            >
              <Cloud className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowKeyboardHints(!showKeyboardHints)}
              className="w-8 h-8 rounded-lg bg-[#202228]/90 hover:bg-[#2A2C34] backdrop-blur-md border border-[#3A3D48] flex items-center justify-center text-neutral-300 hover:text-white shadow-lg transition-colors cursor-pointer"
              title="快捷操作说明"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Keyboard & Mouse Navigation HUD matching Screenshot 2 */}
          {showKeyboardHints && (
            <div className="absolute top-16 right-4 z-20 w-60 rounded-xl bg-[#1B1D23]/85 backdrop-blur-md border border-[#2F323D] p-3 text-[11px] text-neutral-300 shadow-2xl space-y-2 pointer-events-auto">
              <div className="flex items-center justify-between pb-1 border-b border-[#2E313D] text-xs font-semibold text-white">
                <span>三维漫游操作提示</span>
                <button
                  onClick={() => setShowKeyboardHints(false)}
                  className="text-neutral-500 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2D303B] text-white">W</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2D303B] text-white">A</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2D303B] text-white">S</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2D303B] text-white">D</kbd>
                </span>
                <span className="text-neutral-400">前后左右平移</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2D303B] text-white">Q</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2D303B] text-white">E</kbd>
                </span>
                <span className="text-neutral-400">垂直上下升降</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2D303B] text-white">Shift</kbd> /
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2D303B] text-white">Ctrl</kbd>
                </span>
                <span className="text-neutral-400">加速 / 减速漫游</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#2E313D]">
                <span className="text-neutral-400">鼠标左键拖动</span>
                <span className="text-white">旋转模型</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">鼠标右键拖动</span>
                <span className="text-white">平移观察视点</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">滚轮缩放</span>
                <span className="text-white">推拉焦距</span>
              </div>
            </div>
          )}

          {/* Bottom Floating Control Bar matching Screenshot 2 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 rounded-xl bg-[#1B1D23]/90 backdrop-blur-md border border-[#323642] shadow-2xl">
            {/* View Mode Toggle: AT vs GS vs Mesh vs Point Cloud */}
            <div className="flex items-center bg-[#252832] rounded-lg p-0.5 border border-[#353946]">
              <button
                onClick={() => setViewMode('AT')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'AT' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                }`}
                title="空三相机与航线视锥"
              >
                AT
              </button>
              <button
                onClick={() => setViewMode('GS')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'GS' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                }`}
                title="3D 高斯泼溅 (Gaussian Splatting)"
              >
                GS
              </button>
              <button
                onClick={() => setViewMode('Mesh')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'Mesh' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                }`}
                title="三角网格三维模型"
              >
                Mesh
              </button>
              <button
                onClick={() => setViewMode('Point')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'Point' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                }`}
                title="稠密激光点云"
              >
                Point
              </button>
            </div>

            <div className="h-4 w-px bg-[#353946] mx-1" />

            {/* Quick Actions */}
            <button
              onClick={handleCaptureSnapshot}
              className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-[#2A2E3B] transition-colors"
              title="拍摄快照"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetCamera}
              className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-[#2A2E3B] transition-colors"
              title="视角复位"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (cameraRef.current) {
                  cameraRef.current.position.multiplyScalar(0.85);
                }
              }}
              className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-[#2A2E3B] transition-colors"
              title="放大"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (cameraRef.current) {
                  cameraRef.current.position.multiplyScalar(1.15);
                }
              }}
              className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-[#2A2E3B] transition-colors"
              title="缩小"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Right Floating Actions matching Screenshot 2 */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
            <button
              onClick={() => showToast('已生成当前测区高精缩略图封面')}
              className="h-8 px-3 rounded-lg bg-[#1B1D23]/90 hover:bg-[#262832] backdrop-blur-md border border-[#323642] text-xs font-medium text-neutral-300 hover:text-white flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              <span>采集缩略图</span>
            </button>
            <button
              onClick={() => showToast('已保存当前三维视点书签')}
              className="h-8 px-3 rounded-lg bg-[#1B1D23]/90 hover:bg-[#262832] backdrop-blur-md border border-[#323642] text-xs font-medium text-neutral-300 hover:text-white flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>保存当前视角</span>
            </button>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-blue-600/90 text-white text-xs font-medium backdrop-blur-md shadow-xl border border-blue-400/40 animate-fade-in">
              {toastMessage}
            </div>
          )}
        </div>

        {/* Right Details Panel: Metadata and Actions matching Screenshot 2 */}
        <div className="w-72 bg-[#18191E] border-l border-[#262830] flex flex-col shrink-0 z-10">
          <div className="h-10 border-b border-[#262830] flex items-center justify-between px-4 bg-[#1B1C22]">
            <span className="text-xs font-bold text-white truncate">{activeTask.name}</span>
            <Cloud className="w-4 h-4 text-blue-400 shrink-0" />
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {/* Metadata Table matching Screenshot 2 */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[#252731]">
                <span className="text-neutral-400">任务名称:</span>
                <span className="font-medium text-white truncate max-w-[140px]">
                  {activeTask.name}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#252731]">
                <span className="text-neutral-400">任务类型:</span>
                <span className="text-neutral-200">
                  {activeTask.taskType === 'visible_light' ? '可见光' : '激光雷达'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#252731]">
                <span className="text-neutral-400">成果质量:</span>
                <span className="text-neutral-200">
                  {activeTask.quality === 'ultra' ? '超高' : activeTask.quality === 'high' ? '高' : '中'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#252731]">
                <span className="text-neutral-400">数据采集时间:</span>
                <span className="text-neutral-400">{activeTask.captureDate || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#252731]">
                <span className="text-neutral-400">创建时间:</span>
                <span className="text-neutral-300 font-mono text-[11px] tabular-nums">
                  {activeTask.createdAt}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#252731]">
                <span className="text-neutral-400">开始时间:</span>
                <span className="text-neutral-300 font-mono text-[11px] tabular-nums">
                  {activeTask.startedAt}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#252731]">
                <span className="text-neutral-400">重建完成时间:</span>
                <span className="text-neutral-300 font-mono text-[11px] tabular-nums">
                  {activeTask.completedAt || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#252731]">
                <span className="text-neutral-400">软件版本:</span>
                <span className="text-neutral-300 font-mono text-[11px]">
                  {activeTask.softwareVersion}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#252731]">
                <span className="text-neutral-400">计算模式:</span>
                <span className="text-neutral-200">
                  {activeTask.computationMode === 'desktop'
                    ? '单机模式'
                    : activeTask.computationMode === 'local_cluster'
                    ? '本地集群'
                    : '云端弹性计算'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#252731]">
                <span className="text-neutral-400">处理状态:</span>
                <span className={`font-semibold ${activeTask.status === 'completed' ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {activeTask.status === 'completed' ? '建模完成' : '处理中'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-400">照片数量:</span>
                <span className="text-white font-mono tabular-nums font-semibold">
                  {activeTask.photoCount} 张
                </span>
              </div>
            </div>

            {/* Quick Metrics from Report */}
            {activeTask.reportSummary && (
              <div className="p-3 rounded-lg bg-[#202229] border border-[#2B2E38] space-y-2 text-xs">
                <div className="text-neutral-400 text-[11px]">空三成果精度概要</div>
                <div className="grid grid-cols-2 gap-2 text-neutral-300">
                  <div>
                    <div className="text-[10px] text-neutral-500">地面分辨率</div>
                    <div className="font-mono text-white">
                      {activeTask.reportSummary.groundSampleDistance} cm/px
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500">重投影误差</div>
                    <div className="font-mono text-emerald-400">
                      {activeTask.reportSummary.meanReprojectionError} px
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500">连接点数量</div>
                    <div className="font-mono text-white">
                      {(activeTask.reportSummary.tiePointsCount / 10000).toFixed(1)}万
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500">航带重叠度</div>
                    <div className="font-mono text-white">
                      {activeTask.reportSummary.overlapRatio}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons matching Screenshot 2 */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => showToast('已在三维视口打开当前成果详细层级与视锥')}
                className="w-full h-8 px-3 bg-[#242731] hover:bg-[#2C303D] border border-[#333744] text-xs font-medium rounded-lg text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>查看成果</span>
              </button>

              <button
                onClick={onOpenReportModal}
                className="w-full h-8 px-3 bg-[#242731] hover:bg-[#2C303D] border border-[#333744] text-xs font-medium rounded-lg text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>查看报告</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  showToast('成果在线分享链接已复制至剪贴板！');
                }}
                className="w-full h-8 px-3 bg-[#242731] hover:bg-[#2C303D] border border-[#333744] text-xs font-medium rounded-lg text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>分享成果</span>
              </button>

              <button
                onClick={() => showToast('删除操作已取消 (当前任务受保护)')}
                className="w-full h-8 px-3 bg-[#242731] hover:bg-rose-950/40 border border-[#333744] hover:border-rose-500/40 text-xs font-medium rounded-lg text-rose-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>删除成果</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
