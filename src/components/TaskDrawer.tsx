import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Image as ImageIcon,
  Folder,
  Video,
  Camera,
  Navigation,
  Globe,
  Settings2,
  Trash2,
  HelpCircle,
  Check,
  ChevronDown,
  Layers,
  MapPin,
  Play,
  Save,
  Info,
  Maximize2,
  Compass,
  Upload,
  CheckCircle2,
  Eye,
  Sparkles,
} from 'lucide-react';
import {
  ReconstructionTask,
  ReconstructionParams,
  TemplateType,
  QualityLevel,
  PhotoAsset,
} from '../types/reconstruction';
import {
  ASSET_ORTHOPHOTO,
  ASSET_TERRAIN,
  ASSET_DRONE_PHOTO,
  MOCK_PHOTOS,
} from '../data/mockData';
import { PhotoManagerModal } from './PhotoManagerModal';
import { OpenSourceEngineModal } from './OpenSourceEngineModal';
import { RotateCw, Code2 } from 'lucide-react';

interface TaskDrawerProps {
  task: ReconstructionTask;
  onUpdateParams: (newParams: ReconstructionParams) => void;
  onUpdatePhotos: (photos: PhotoAsset[]) => void;
  onBack: () => void;
  onOpenGcpModal: () => void;
  onOpenCrsModal: () => void;
  onStartReconstruction: () => void;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  task,
  onUpdateParams,
  onUpdatePhotos,
  onBack,
  onOpenGcpModal,
  onOpenCrsModal,
  onStartReconstruction,
}) => {
  const [params, setParams] = useState<ReconstructionParams>(task.params);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showPhotoGalleryModal, setShowPhotoGalleryModal] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoFps, setVideoFps] = useState(1);
  const [mapCoords, setMapCoords] = useState({ lon: 114.305218, lat: 30.592812 });
  const [notification, setNotification] = useState<string | null>(null);
  const [isReconstructing, setIsReconstructing] = useState(false);
  const [showEngineGuide, setShowEngineGuide] = useState(false);

  // Hidden file inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const updateParam = <K extends keyof ReconstructionParams>(
    key: K,
    value: ReconstructionParams[K]
  ) => {
    const updated = { ...params, [key]: value };
    setParams(updated);
    onUpdateParams(updated);
  };

  const toggleArrayItem = <T,>(arr: T[], item: T): T[] => {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  };

  // Generate synthetic geotagged flight photos for local files
  const createPhotoAssetsFromFiles = (files: File[]): PhotoAsset[] => {
    const baseLat = 30.5928;
    const baseLon = 114.3052;
    const baseAlt = 120.0;
    const sampleImgs = [ASSET_TERRAIN, ASSET_DRONE_PHOTO, ASSET_ORTHOPHOTO];

    return files.map((file, idx) => {
      // Simulate serpentine flight line coordinates
      const row = Math.floor(idx / 12);
      const col = idx % 12;
      const lat = baseLat + row * 0.00045;
      const lon = baseLon + (row % 2 === 0 ? col : 11 - col) * 0.00045;
      const url = URL.createObjectURL(file);

      return {
        id: `photo-user-${Date.now()}-${idx}`,
        name: file.name,
        url: file.type.startsWith('image/') ? url : sampleImgs[idx % sampleImgs.length],
        width: 5472,
        height: 3648,
        lat,
        lon,
        alt: baseAlt + (Math.random() - 0.5) * 1.5,
        focalLength: 24,
        isCalibrated: true,
      };
    });
  };

  // Handle single/multiple image selection
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const newAssets = createPhotoAssetsFromFiles(files);
    const updatedPhotos = [...(task.photos || []), ...newAssets];
    onUpdatePhotos(updatedPhotos);
    showNotice(`成功导入 ${files.length} 张无人机航测影像，已自动解析 EXIF POS 经纬度`);
    e.target.value = '';
  };

  // Handle folder upload
  const handleFolderFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const allFiles = Array.from(e.target.files);
    // Filter image extensions
    const imgFiles = allFiles.filter((f) =>
      /\.(jpg|jpeg|png|tif|tiff|dng)$/i.test(f.name)
    );

    if (imgFiles.length === 0) {
      showNotice('所选文件夹中未找到支持的影像格式 (.jpg .png .tif .dng)');
      return;
    }

    const newAssets = createPhotoAssetsFromFiles(imgFiles);
    const updatedPhotos = [...(task.photos || []), ...newAssets];
    onUpdatePhotos(updatedPhotos);
    showNotice(`成功自文件夹扫描并导入 ${imgFiles.length} 张影像`);
    e.target.value = '';
  };

  // Quick preset sample datasets
  const handleLoadPresetDataset = (count: number, label: string) => {
    const baseLat = 30.5928;
    const baseLon = 114.3052;
    const sampleImgs = [ASSET_TERRAIN, ASSET_DRONE_PHOTO, ASSET_ORTHOPHOTO];

    const generatedPhotos: PhotoAsset[] = Array.from({ length: count }, (_, idx) => {
      const row = Math.floor(idx / 12);
      const col = idx % 12;
      const lat = baseLat + row * 0.00045;
      const lon = baseLon + (row % 2 === 0 ? col : 11 - col) * 0.00045;
      return {
        id: `photo-preset-${idx + 1}`,
        name: `DJI_20261001_${String(idx + 1).padStart(4, '0')}.JPG`,
        url: sampleImgs[idx % sampleImgs.length],
        width: 5472,
        height: 3648,
        lat,
        lon,
        alt: 120.0 + (Math.random() - 0.5) * 1.5,
        focalLength: 24,
        isCalibrated: true,
      };
    });

    onUpdatePhotos(generatedPhotos);
    showNotice(`已载入「${label}」：共 ${count} 张高精倾斜摄影原图及 POS 位姿`);
  };

  // Clear all photos
  const handleClearPhotos = () => {
    onUpdatePhotos([]);
    showNotice('已清空当前任务的照片数据集');
  };

  const currentPhotos = task.photos || MOCK_PHOTOS;
  const currentPhotoCount = task.photoCount || currentPhotos.length;
  const calibratedCount = task.calibratedPhotoCount || currentPhotos.filter((p) => p.isCalibrated).length;

  return (
    <div className="flex-1 flex bg-[#16171B] text-[#E1E4EA] h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Hidden file input elements for real imports */}
      <input
        type="file"
        ref={imageInputRef}
        multiple
        accept=".jpg,.jpeg,.png,.tif,.tiff,.dng"
        className="hidden"
        onChange={handleImageFileChange}
      />
      <input
        type="file"
        ref={folderInputRef}
        multiple
        {...({ webkitdirectory: '', directory: '' } as any)}
        className="hidden"
        onChange={handleFolderFileChange}
      />

      {/* Left Column: Task Parameters Panel matching Screenshots 4, 5, 6, 7 */}
      <div className="w-[420px] bg-[#1B1C22] border-r border-[#282A33] flex flex-col shrink-0 h-full overflow-hidden">
        {/* Header */}
        <div className="h-12 border-b border-[#282A33] px-4 flex items-center gap-3 shrink-0">
          <button
            onClick={onBack}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-[#252731] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-white">任务参数</span>
        </div>

        {/* Scrollable parameters form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {/* 1. Name */}
          <div>
            <label className="block text-neutral-400 mb-1 font-medium">名称</label>
            <input
              type="text"
              value={params.name}
              onChange={(e) => updateParam('name', e.target.value)}
              className="w-full h-8 px-3 bg-[#15161A] border border-[#2F323D] rounded text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 2. Photos Import - Highlighted by User Request */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 font-medium">照片 (Photos)</span>
              <span className="text-[11px] text-blue-400 font-mono">
                已导入 {currentPhotoCount} 张
              </span>
            </div>

            {/* 3 Main Import Buttons matching Screenshot */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="h-16 rounded-lg bg-[#22242D] hover:bg-[#2A2D39] border border-[#30333E] hover:border-blue-500/50 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group"
              >
                <ImageIcon className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-neutral-200 font-medium">导入图像</span>
                <span className="text-[10px] text-neutral-500">.jpg .png .tif</span>
              </button>

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="h-16 rounded-lg bg-[#22242D] hover:bg-[#2A2D39] border border-[#30333E] hover:border-amber-500/50 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group"
              >
                <Folder className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="text-neutral-200 font-medium">导入文件夹</span>
                <span className="text-[10px] text-neutral-500">.jpg .png .tif</span>
              </button>

              <button
                type="button"
                onClick={() => setVideoModalOpen(true)}
                className="h-16 rounded-lg bg-[#22242D] hover:bg-[#2A2D39] border border-[#30333E] hover:border-emerald-500/50 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group"
              >
                <Video className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-neutral-200 font-medium">导入视频</span>
                <span className="text-[10px] text-neutral-500">.mp4 .insv</span>
              </button>
            </div>

            {/* Quick Test Survey Datasets */}
            <div className="p-2.5 rounded-lg bg-[#1E2028] border border-[#2B2E3A] space-y-1.5">
              <div className="text-[11px] text-neutral-400 flex items-center justify-between">
                <span>测区样本快速载入 (无需本地照片即可测试)</span>
                <Sparkles className="w-3 h-3 text-blue-400" />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleLoadPresetDataset(240, '无人机测区 240张')}
                  className="px-2.5 py-1 rounded bg-[#272A36] hover:bg-[#323646] text-blue-300 text-[11px] font-mono border border-blue-500/30 transition-colors"
                >
                  + 测区 240张
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadPresetDataset(380, '崇山公路 380张')}
                  className="px-2.5 py-1 rounded bg-[#272A36] hover:bg-[#323646] text-emerald-300 text-[11px] font-mono border border-emerald-500/30 transition-colors"
                >
                  + 公路 380张
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadPresetDataset(84, '立面倾斜 84张')}
                  className="px-2.5 py-1 rounded bg-[#272A36] hover:bg-[#323646] text-amber-300 text-[11px] font-mono border border-amber-500/30 transition-colors"
                >
                  + 立面 84张
                </button>
              </div>
            </div>

            {/* Camera Item card matching Screenshot 4/5 */}
            <div className="mt-3 p-2.5 rounded-lg bg-[#21232B] border border-[#2F323E] flex items-center justify-between">
              <div
                onClick={() => setShowPhotoGalleryModal(true)}
                className="flex items-center gap-2 cursor-pointer group"
                title="点击查看/管理已导入照片"
              >
                <Camera className="w-4 h-4 text-blue-400" />
                <span className="font-medium text-white group-hover:text-blue-300 transition-colors">
                  Camera-1
                </span>
                <span className="text-neutral-400">
                  <span className="text-rose-400 font-semibold font-mono">{currentPhotoCount} 张</span>，
                  <span className="text-emerald-400 font-mono">{calibratedCount} 张已定位</span>
                </span>
                <Eye className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
              </div>
              <button
                type="button"
                onClick={handleClearPhotos}
                className="text-neutral-500 hover:text-rose-400 transition-colors p-1"
                title="清空已导入照片"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[11px] text-neutral-500 mt-1 flex items-center justify-between">
              <span>共 1 个相机，{currentPhotoCount} 张，{calibratedCount} 张已定位。</span>
              <button
                type="button"
                onClick={() => setShowPhotoGalleryModal(true)}
                className="text-blue-400 hover:underline"
              >
                查看影像列表
              </button>
            </div>
          </div>

          <div className="h-px bg-[#262832]" />

          {/* 3. 空三 Aerial Triangulation */}
          <div>
            <div className="text-xs font-semibold text-neutral-300 mb-2">空三 (Aerial Triangulation)</div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">像控点:</span>
              <button
                type="button"
                onClick={onOpenGcpModal}
                className="px-4 py-1.5 rounded-md bg-[#252833] hover:bg-[#2F3342] border border-[#393D4E] text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span>设置像控点</span>
              </button>
            </div>
          </div>

          <div className="h-px bg-[#262832]" />

          {/* 4. 重建 Reconstruction Options */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-neutral-300">重建</div>

            {/* Template Selector matching Screenshot 5 */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-neutral-400">模板:</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="w-full h-8 px-3 rounded bg-[#20222A] border border-[#30333E] flex items-center justify-between text-neutral-200 hover:border-blue-500 transition-colors"
              >
                <span>
                  {params.template === 'at' && '空三 (Aerial Triangulation)'}
                  {params.template === 'mesh' && '网格模型 (Mesh 3D Model)'}
                  {params.template === 'gaussian_splat' && '高斯 (Gaussian Splatting / 3DGS)'}
                  {params.template === 'fast_2d' && '快速二维 (Fast 2D Ortho)'}
                  {params.template === 'fast_3d' && '快速三维 (Fast 3D Mesh)'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {showTemplateDropdown && (
                <div className="absolute top-10 left-0 w-full rounded-lg bg-[#22242D] border border-[#353946] shadow-2xl p-1 z-30 space-y-0.5">
                  <div className="px-2 py-1 text-[10px] text-neutral-500 font-semibold uppercase">
                    系统模板
                  </div>
                  {[
                    { id: 'gaussian_splat', label: '高斯 (Gaussian Splatting)' },
                    { id: 'mesh', label: '网格模型 (Textured Mesh)' },
                    { id: 'fast_2d', label: '快速二维 (DOM Orthophoto)' },
                    { id: 'fast_3d', label: '快速三维 (Preview Mesh)' },
                    { id: 'at', label: '空三 (Aerial Triangulation)' },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        updateParam('template', tpl.id as TemplateType);
                        setShowTemplateDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                        params.template === tpl.id
                          ? 'bg-blue-600/30 text-blue-300'
                          : 'text-neutral-300 hover:bg-[#2B2E3A]'
                      }`}
                    >
                      <span>{tpl.label}</span>
                      {params.template === tpl.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quality Selector matching Screenshot 4 */}
            <div>
              <div className="text-neutral-400 mb-1.5">重建质量:</div>
              <div className="grid grid-cols-3 gap-1 bg-[#1A1C22] p-1 rounded-lg border border-[#2B2E38]">
                {[
                  { id: 'ultra', label: '超高 (最佳效果)' },
                  { id: 'high', label: '高 (均衡)' },
                  { id: 'medium', label: '中 (最快速度)' },
                ].map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => updateParam('quality', q.id as QualityLevel)}
                    className={`py-1.5 text-center rounded-md font-medium transition-colors text-[11px] ${
                      params.quality === q.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ROI / Sub-division */}
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">ROI/分块:</span>
              <button
                type="button"
                onClick={() => showNotice('已激活测区 ROI 感兴趣区域与多 GPU 分块调度工具')}
                className="px-3 py-1.5 rounded-md bg-[#252833] hover:bg-[#2F3342] border border-[#393D4E] text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                设置感兴趣区域/分块
              </button>
            </div>
          </div>

          <div className="h-px bg-[#262832]" />

          {/* 5. 二维成果 2D Outputs matching Screenshot 4 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-300">二维成果:</span>
              <input
                type="checkbox"
                checked={params.output2D}
                onChange={(e) => updateParam('output2D', e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-[#252833] border-[#383C4A] cursor-pointer"
              />
            </div>

            {params.output2D && (
              <div className="p-2.5 rounded-lg bg-[#20222B] border border-[#2C2F3B] space-y-2">
                <div className="h-16 rounded overflow-hidden relative border border-[#363A47]">
                  <img
                    src={ASSET_ORTHOPHOTO}
                    alt="DOM Orthophoto Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-between px-3 text-[11px] text-white">
                    <span>DOM 数字正射影像</span>
                    <span>DSM 表面高程</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-neutral-400">成果坐标系:</span>
                  <button
                    type="button"
                    onClick={onOpenCrsModal}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#282B37] hover:bg-[#323646] border border-[#3B3F4F] text-blue-300 transition-colors"
                  >
                    <span>{params.crs}</span>
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-[#262832]" />

          {/* 6. 三维成果 3D Outputs matching Screenshots 6 & 7 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-300">三维成果:</span>
              <input
                type="checkbox"
                checked={params.output3D}
                onChange={(e) => updateParam('output3D', e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-[#252833] border-[#383C4A] cursor-pointer"
              />
            </div>

            {params.output3D && (
              <div className="space-y-4 pt-1">
                {/* 6.1 Mesh Model matching Screenshot 6 */}
                <div className="p-3 rounded-lg bg-[#20222B] border border-[#2D303C] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">网格模型 (Mesh):</span>
                    <input
                      type="checkbox"
                      checked={params.meshEnabled}
                      onChange={(e) => updateParam('meshEnabled', e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 bg-[#252833] border-[#383C4A] cursor-pointer"
                    />
                  </div>

                  {params.meshEnabled && (
                    <div className="space-y-2.5 pt-1">
                      {/* Format tags */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(['B3DM', 'OSGB', 'OBJ', 'PLY'] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() =>
                              updateParam('meshFormats', toggleArrayItem(params.meshFormats, fmt))
                            }
                            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                              params.meshFormats.includes(fmt)
                                ? 'bg-blue-600/40 text-blue-300 border border-blue-500/50'
                                : 'bg-[#282B36] text-neutral-400 hover:text-white'
                            }`}
                          >
                            {fmt} {params.meshFormats.includes(fmt) && '✕'}
                          </button>
                        ))}
                      </div>

                      {/* Water Flattening */}
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="flex items-center gap-1">
                          <span>水域平整:</span>
                          <HelpCircle className="w-3 h-3 text-neutral-500" />
                        </span>
                        <input
                          type="checkbox"
                          checked={params.waterFlattening}
                          onChange={(e) => updateParam('waterFlattening', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-[#282B36] border-[#3A3E4E] cursor-pointer"
                        />
                      </div>

                      {/* Mesh Decimation Slider */}
                      <div>
                        <div className="flex justify-between text-neutral-400 mb-1">
                          <span>模型简化率:</span>
                          <span className="text-white font-mono">{params.meshSimplifyRatio}%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          step="15"
                          value={params.meshSimplifyRatio}
                          onChange={(e) => updateParam('meshSimplifyRatio', Number(e.target.value))}
                          className="w-full accent-blue-500 bg-[#2B2E3B] h-1.5 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
                          <span>轻量 10%</span>
                          <span>25%</span>
                          <span>50%</span>
                          <span>精细 100%</span>
                        </div>
                      </div>

                      {/* Remove Floating Outliers */}
                      <div className="flex items-center justify-between text-neutral-300">
                        <span>剔除悬浮物:</span>
                        <input
                          type="checkbox"
                          checked={params.removeFloatingOutliers}
                          onChange={(e) => updateParam('removeFloatingOutliers', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-[#282B36] border-[#3A3E4E] cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 6.2 Point Cloud matching Screenshot 6 */}
                <div className="p-3 rounded-lg bg-[#20222B] border border-[#2D303C] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">点云 (Point Cloud):</span>
                    <input
                      type="checkbox"
                      checked={params.pointCloudEnabled}
                      onChange={(e) => updateParam('pointCloudEnabled', e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 bg-[#252833] border-[#383C4A] cursor-pointer"
                    />
                  </div>

                  {params.pointCloudEnabled && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {(['PNTS', 'LAS', 'PLY'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() =>
                            updateParam('pointCloudFormats', toggleArrayItem(params.pointCloudFormats, fmt))
                          }
                          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                            params.pointCloudFormats.includes(fmt)
                              ? 'bg-blue-600/40 text-blue-300 border border-blue-500/50'
                              : 'bg-[#282B36] text-neutral-400 hover:text-white'
                          }`}
                        >
                          {fmt} {params.pointCloudFormats.includes(fmt) && '✕'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6.3 3D Gaussian Splatting matching Screenshot 7 */}
                <div className="p-3 rounded-lg bg-[#20222B] border border-blue-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-300">高斯泼溅 (Gaussian Splatting):</span>
                    <input
                      type="checkbox"
                      checked={params.gaussianSplatEnabled}
                      onChange={(e) => updateParam('gaussianSplatEnabled', e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 bg-[#252833] border-[#383C4A] cursor-pointer"
                    />
                  </div>

                  {params.gaussianSplatEnabled && (
                    <div className="space-y-2.5 pt-1">
                      {/* Splat Formats */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(['PlayCanvas LOD', 'PLY', 'Splat', 'SPZ'] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() =>
                              updateParam('gaussianFormats', toggleArrayItem(params.gaussianFormats, fmt))
                            }
                            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                              params.gaussianFormats.includes(fmt)
                                ? 'bg-blue-600/40 text-blue-300 border border-blue-500/50'
                                : 'bg-[#282B36] text-neutral-400 hover:text-white'
                            }`}
                          >
                            {fmt} {params.gaussianFormats.includes(fmt) && '✕'}
                          </button>
                        ))}
                      </div>

                      {/* Max Points Mode */}
                      <div>
                        <div className="flex items-center justify-between text-neutral-300 mb-1">
                          <span className="flex items-center gap-1">
                            <span>最大高斯点数:</span>
                            <HelpCircle className="w-3 h-3 text-neutral-500" />
                          </span>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name="maxPoints"
                                checked={params.maxGaussianPointsMode === 'auto'}
                                onChange={() => updateParam('maxGaussianPointsMode', 'auto')}
                                className="text-blue-600"
                              />
                              <span>自动</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name="maxPoints"
                                checked={params.maxGaussianPointsMode === 'custom'}
                                onChange={() => updateParam('maxGaussianPointsMode', 'custom')}
                                className="text-blue-600"
                              />
                              <span>自定义</span>
                            </label>
                          </div>
                        </div>

                        {params.maxGaussianPointsMode === 'custom' && (
                          <input
                            type="number"
                            value={params.customMaxPoints}
                            onChange={(e) => updateParam('customMaxPoints', Number(e.target.value))}
                            step="500000"
                            className="w-full h-7 px-2.5 bg-[#17181D] border border-[#333644] rounded text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                          />
                        )}
                      </div>

                      {/* Human / Dynamic Object Removal */}
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="flex items-center gap-1">
                          <span>人物消除 (Pedestrian Removal):</span>
                          <HelpCircle className="w-3 h-3 text-neutral-500" />
                        </span>
                        <input
                          type="checkbox"
                          checked={params.humanRemoval}
                          onChange={(e) => updateParam('humanRemoval', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-[#282B36] border-[#3A3E4E] cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions matching Screenshot 4 */}
        <div className="p-4 border-t border-[#282A33] bg-[#1B1C22] space-y-2 shrink-0">
          {/* Open source engine reference guide */}
          <button
            type="button"
            onClick={() => setShowEngineGuide(true)}
            className="w-full py-1.5 px-2 bg-blue-950/30 hover:bg-blue-900/40 border border-blue-500/30 text-blue-300 rounded text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="查看底层空三、3DGS与网格模型所使用的开源库"
          >
            <Code2 className="w-3.5 h-3.5 text-blue-400" />
            <span>底层开源引擎架构 (COLMAP / gsplat / OpenMVS)</span>
          </button>

          <button
            type="button"
            disabled={isReconstructing}
            onClick={() => {
              setIsReconstructing(true);
              showNotice('正在启动重建流水线...');
              onStartReconstruction();
              setTimeout(() => setIsReconstructing(false), 1200);
            }}
            className="w-full h-9 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-lg flex items-center justify-center gap-2 text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            {isReconstructing ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>正在启动重建计算...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>开始重建</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => showNotice('当前三维与二维参数已成功保存为自定义模板')}
            className="w-full h-8 text-neutral-400 hover:text-white text-xs flex items-center justify-center gap-1.5 hover:bg-[#252731] rounded-lg transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-blue-400" />
            <span>保存参数到模板</span>
          </button>
        </div>
      </div>

      {/* Right Column: 2D GIS Map Preview matching Screenshot 4 */}
      <div className="flex-1 bg-[#121316] relative flex flex-col overflow-hidden">
        {/* Map Header */}
        <div className="h-10 border-b border-[#282A33] px-4 flex items-center justify-between bg-[#191A20] z-10">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Compass className="w-4 h-4 text-blue-400" />
            <span>地图预览 (GIS Aerial Survey Map)</span>
          </div>
          <div className="text-[11px] text-neutral-400 font-mono">
            影像总覆盖区域: 0.85 km² · 影像数: <strong className="text-white">{currentPhotoCount}</strong> 张
          </div>
        </div>

        {/* Interactive Simulated Map Canvas */}
        <div className="flex-1 relative overflow-hidden bg-[#242A35]">
          {/* Map Layer Vector Visualization */}
          <div className="absolute inset-0 bg-[#323E50] flex items-center justify-center">
            <svg
              className="w-full h-full opacity-70"
              viewBox="0 0 1000 600"
              preserveAspectRatio="xMidYMid slice"
            >
              {/* Landmass outlines */}
              <path
                d="M 150 120 Q 250 80 350 140 T 550 130 T 750 180 T 900 240 L 920 450 Q 800 520 650 490 T 400 480 T 180 430 Z"
                fill="#47576E"
                stroke="#5D718E"
                strokeWidth="1.5"
              />
              <path
                d="M 500 200 Q 580 180 640 220 T 700 320 T 620 400 T 510 330 Z"
                fill="#3E4C60"
                stroke="#52647E"
                strokeWidth="1.5"
              />

              {/* Dynamic Drone Survey Flight Lines & Camera Positions based on currentPhotoCount */}
              <g stroke="#38BDF8" strokeWidth="2" strokeDasharray="4 2">
                <line x1="360" y1="240" x2="360" y2="390" />
                <line x1="410" y1="390" x2="410" y2="240" />
                <line x1="460" y1="240" x2="460" y2="390" />
                <line x1="510" y1="390" x2="510" y2="240" />
                {currentPhotoCount > 150 && <line x1="560" y1="240" x2="560" y2="390" />}
              </g>

              {/* Camera Photo dots dynamically generated from count */}
              {Array.from({ length: Math.min(32, Math.max(8, Math.floor(currentPhotoCount / 8))) }).map((_, idx) => {
                const cols = 5;
                const col = idx % cols;
                const row = Math.floor(idx / cols);
                const cx = 360 + col * 50;
                const cy = 240 + row * 25;
                return (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="#F59E0B"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                );
              })}

              {/* GCP Target markers */}
              <circle cx="370" cy="250" r="6" fill="#EF4444" stroke="#FFF" strokeWidth="1.5" />
              <text x="380" y="254" fill="#FFF" fontSize="10" fontWeight="bold">GCP_01</text>
              <circle cx="500" cy="380" r="6" fill="#EF4444" stroke="#FFF" strokeWidth="1.5" />
              <text x="510" y="384" fill="#FFF" fontSize="10" fontWeight="bold">GCP_02</text>
            </svg>
          </div>

          {/* Floating Controls matching Screenshot 4 */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => showNotice('已切换至高分卫星遥感底图')}
              className="w-9 h-9 rounded-lg bg-[#1B1D23]/90 hover:bg-[#252832] backdrop-blur border border-[#333642] flex items-center justify-center text-white shadow-lg cursor-pointer"
              title="底图图层"
            >
              <Layers className="w-4 h-4 text-blue-400" />
            </button>
          </div>

          {/* Bottom Coordinate Readout matching Screenshot 4 */}
          <div className="absolute bottom-3 left-4 z-20 px-3 py-1.5 rounded bg-[#1B1D23]/90 backdrop-blur border border-[#30333E] text-xs font-mono text-neutral-300">
            经度: {mapCoords.lon.toFixed(6)} 纬度: {mapCoords.lat.toFixed(6)}
          </div>
        </div>
      </div>

      {/* Video Keyframe Extract Modal */}
      {videoModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#21232B] border border-[#353847] rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-emerald-400" />
              <span>无人机航拍视频抽帧建模 (.mp4 .insv)</span>
            </h3>
            <p className="text-xs text-neutral-300">
              系统将根据飞行航速自动抽取关键视频帧并生成空间位姿，推荐抽帧频率为每秒 1 ~ 2 帧。
            </p>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">抽帧采样频率 (帧/秒)</label>
              <div className="grid grid-cols-3 gap-2">
                {[0.5, 1, 2].map((fps) => (
                  <button
                    key={fps}
                    type="button"
                    onClick={() => setVideoFps(fps)}
                    className={`py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                      videoFps === fps
                        ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
                        : 'bg-[#1C1E26] text-neutral-400 border-[#2F323E]'
                    }`}
                  >
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  handleLoadPresetDataset(180, '视频抽帧序列 (180张)');
                  setVideoModalOpen(false);
                }}
                className="px-4 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm"
              >
                开始抽帧并导入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Gallery & Metadata Modal */}
      {showPhotoGalleryModal && (
        <PhotoManagerModal
          photos={currentPhotos}
          onClose={() => setShowPhotoGalleryModal(false)}
          onDeletePhoto={(id) => {
            const updated = currentPhotos.filter((p) => p.id !== id);
            onUpdatePhotos(updated);
          }}
          onClearAll={handleClearPhotos}
        />
      )}

      {/* Open Source Engine Architecture Guide Modal */}
      {showEngineGuide && (
        <OpenSourceEngineModal onClose={() => setShowEngineGuide(false)} />
      )}

      {/* Floating Notification */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium shadow-2xl border border-blue-400/40 animate-fade-in flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{notification}</span>
        </div>
      )}
    </div>
  );
};
