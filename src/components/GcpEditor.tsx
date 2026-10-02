import React, { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Globe,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Crosshair,
  Camera,
  Play,
  RotateCcw,
  Plus,
} from 'lucide-react';
import { GroundControlPoint, PhotoAsset } from '../types/reconstruction';
import { MOCK_GCPS } from '../data/mockData';
import { useTaskPhotos } from '../lib/useTaskPhotos';

interface GcpEditorProps {
  photos: PhotoAsset[];
  jobId?: string;
  onBack: () => void;
  onOpenCrsModal: () => void;
  currentCrs: string;
}

export const GcpEditor: React.FC<GcpEditorProps> = ({
  photos: taskPhotos,
  jobId,
  onBack,
  onOpenCrsModal,
  currentCrs,
}) => {
  const { photos, message: photoMessage } = useTaskPhotos(taskPhotos, jobId);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const selectedPhoto = photos.find(photo => photo.id === selectedPhotoId) || photos[0];
  const [gcps, setGcps] = useState<GroundControlPoint[]>(MOCK_GCPS);
  const [selectedGcpId, setSelectedGcpId] = useState<string>('gcp-1');
  const [usePosPrior, setUsePosPrior] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationComplete, setOptimizationComplete] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [markerPos, setMarkerPos] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMarkerPos(null);
    setZoomLevel(1);
  }, [selectedPhoto?.id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Clicking on photo to prick GCP point
  const handlePhotoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !selectedPhoto) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    setMarkerPos({ x: xPct, y: yPct });

    // Increment mark count for active GCP
    setGcps((prev) =>
      prev.map((g) => (g.id === selectedGcpId ? { ...g, markCount: g.markCount + 1 } : g))
    );
    showToast(`已在当前影像完成像控点 [${gcps.find((g) => g.id === selectedGcpId)?.name}] 刺点标定`);
  };

  // Run Bundle Adjustment Optimization
  const handleRunOptimization = () => {
    setIsOptimizing(true);
    showToast('正在执行高精光束法区域网联合平差计算 (Bundle Adjustment)...');
    setTimeout(() => {
      setIsOptimizing(false);
      setOptimizationComplete(true);
      // Improve errors slightly to simulate convergence
      setGcps((prev) =>
        prev.map((g) => ({
          ...g,
          reprojectionErrorPx: Number((g.reprojectionErrorPx * 0.85).toFixed(2)),
          errorXCm: Number((g.errorXCm * 0.88).toFixed(2)),
          errorYCm: Number((g.errorYCm * 0.88).toFixed(2)),
          errorZCm: Number((g.errorZCm * 0.88).toFixed(2)),
        }))
      );
      showToast('空三联合平差优化完成！平均重投影中误差降低至 0.28 px');
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#141518] text-[#E1E4EA] h-[calc(100vh-3.5rem)] overflow-hidden select-none">
      {/* Top Header matching Screenshot 8 */}
      <div className="h-12 bg-[#1B1C22] border-b border-[#282A33] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-[#252731] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-white">像控点刺点工作区 (GCP Station)</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span>测区像控点: <strong className="text-white font-mono">{gcps.length}</strong> 个</span>
          <span>已刺点总数: <strong className="text-white font-mono">{gcps.reduce((acc, g) => acc + g.markCount, 0)}</strong> 次</span>
        </div>
      </div>

      {/* Main Split: Left Photos List, Right Upper Photo Pricking Canvas, Lower GCP Table */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Photos Filmstrip matching Screenshot 8 */}
        <div className="w-64 bg-[#18191E] border-r border-[#272932] flex flex-col shrink-0">
          <div className="h-10 border-b border-[#272932] px-3 flex items-center justify-between bg-[#1B1C22]">
            <span className="text-xs font-semibold text-white">照片列表 ({photos.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {photos.map((photo) => {
              const isSelected = photo.id === selectedPhoto?.id;
              return (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhotoId(photo.id)}
                  className={`p-1.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#252834] border-blue-500 ring-1 ring-blue-500/40'
                      : 'bg-[#202127] border-[#2E303A] hover:border-[#3E4250]'
                  }`}
                >
                  <div className="h-28 rounded bg-black/40 overflow-hidden relative border border-white/5">
                    <img
                      src={photo.url}
                      alt={photo.name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    {photo.markedGCPs && photo.markedGCPs.length > 0 && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-mono">
                        {photo.markedGCPs.length} 点已刺
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-neutral-300 mt-1 truncate">
                    {photo.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Split: Photo Marking Canvas (Top) + GCP Table (Bottom) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Half: Photo Inspection & Prick Canvas */}
          <div className="flex-1 bg-[#0F1012] relative overflow-hidden flex items-center justify-center p-4">
            {selectedPhoto ? <div
              ref={canvasRef}
              onClick={handlePhotoClick}
              style={{ transform: `scale(${zoomLevel})` }}
              className="relative max-h-full max-w-full rounded border border-[#2B2D37] shadow-2xl overflow-hidden cursor-crosshair transition-transform duration-100"
            >
              <img
                src={selectedPhoto.url}
                alt={`当前影像：${selectedPhoto.name}`}
                referrerPolicy="no-referrer"
                className="max-h-[46vh] object-contain select-none"
              />

              {/* Red Crosshair Prick Target Marker */}
              {markerPos && (
                <div
                  style={{ left: `${markerPos.x}%`, top: `${markerPos.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full border-2 border-red-500 animate-pulse flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    </div>
                    {/* Crosshair lines */}
                    <div className="absolute top-1/2 -left-3 w-3 h-0.5 bg-red-500 -translate-y-1/2" />
                    <div className="absolute top-1/2 -right-3 w-3 h-0.5 bg-red-500 -translate-y-1/2" />
                    <div className="absolute -top-3 left-1/2 h-3 w-0.5 bg-red-500 -translate-x-1/2" />
                    <div className="absolute -bottom-3 left-1/2 h-3 w-0.5 bg-red-500 -translate-x-1/2" />
                    <span className="absolute -top-5 left-3 text-[10px] font-bold text-red-400 bg-black/80 px-1 rounded whitespace-nowrap">
                      {gcps.find((g) => g.id === selectedGcpId)?.name || 'GCP'}
                    </span>
                  </div>
                </div>
              )}
            </div> : <div className="text-sm text-neutral-500">{photoMessage || '当前任务尚未上传照片，请返回导入照片'}</div>}

            {/* Floating Zoom / Pan Controls matching Screenshot 8 */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 bg-[#1B1D23]/90 backdrop-blur-md p-1 rounded-lg border border-[#323642] shadow-lg">
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 rounded hover:bg-[#2A2E3B] text-neutral-300 hover:text-white"
                title="重置缩放"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                className="p-1.5 rounded hover:bg-[#2A2E3B] text-neutral-300 hover:text-white"
                title="放大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                className="p-1.5 rounded hover:bg-[#2A2E3B] text-neutral-300 hover:text-white"
                title="缩小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
            </div>

            {/* Instruction badge */}
            {selectedPhoto && <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-md bg-black/70 backdrop-blur text-xs text-neutral-300 border border-white/10 flex items-center gap-2">
              <Crosshair className="w-3.5 h-3.5 text-red-400" />
              <span>在影像特征点上单击十字光标完成刺点</span>
            </div>}
          </div>

          {/* Bottom Half: GCP Table and Bundle Adjustment matching Screenshot 8 */}
          <div className="h-64 bg-[#18191E] border-t border-[#262832] flex flex-col shrink-0">
            {/* Table Action Bar matching Screenshot 8 */}
            <div className="h-10 border-b border-[#262832] px-4 flex items-center justify-between bg-[#1B1C22] shrink-0 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-white">像控点列表</span>
                <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                  <span className="text-neutral-400">坐标系:</span>
                  <button
                    onClick={onOpenCrsModal}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#242731] hover:bg-[#2E323F] border border-[#353947] text-blue-300 transition-colors"
                  >
                    <span>{currentCrs}</span>
                    <Globe className="w-3 h-3 text-blue-400" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => showToast('已导出刺点文件 (PrickPoints.xml)')}
                  className="px-2.5 py-1 rounded bg-[#242731] hover:bg-[#2E323F] text-neutral-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>导出刺点</span>
                </button>
                <button
                  onClick={() => showToast('请选择刺点文件导入')}
                  className="px-2.5 py-1 rounded bg-[#242731] hover:bg-[#2E323F] text-neutral-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  <span>导入刺点</span>
                </button>
                <button
                  onClick={() => showToast('已成功解析控制点坐标表 (GCP_Points.csv)')}
                  className="px-2.5 py-1 rounded bg-[#242731] hover:bg-[#2E323F] text-neutral-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                  <span>导入控制点</span>
                </button>
                <button
                  onClick={() => setGcps([])}
                  className="px-2.5 py-1 rounded bg-[#242731] hover:bg-rose-950/40 text-rose-400 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>清除像控点</span>
                </button>
              </div>
            </div>

            {/* GCP Data Table */}
            <div className="flex-1 overflow-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#1F2128] text-neutral-400 sticky top-0 border-b border-[#292B35]">
                  <tr>
                    <th className="py-2 px-3 font-medium">名称</th>
                    <th className="py-2 px-3 font-medium">类型</th>
                    <th className="py-2 px-3 font-medium">刺点数</th>
                    <th className="py-2 px-3 font-medium">经度/X</th>
                    <th className="py-2 px-3 font-medium">纬度/Y</th>
                    <th className="py-2 px-3 font-medium">高度/Z</th>
                    <th className="py-2 px-3 font-medium">重投影误差 (px)</th>
                    <th className="py-2 px-3 font-medium">X误差 (cm)</th>
                    <th className="py-2 px-3 font-medium">Y误差 (cm)</th>
                    <th className="py-2 px-3 font-medium">Z误差 (cm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242630] font-mono text-neutral-300 tabular-nums">
                  {gcps.map((gcp) => {
                    const isSelected = gcp.id === selectedGcpId;
                    return (
                      <tr
                        key={gcp.id}
                        onClick={() => setSelectedGcpId(gcp.id)}
                        className={`hover:bg-[#242733] cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-950/30 text-white' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-sans font-semibold text-white flex items-center gap-1.5">
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                          <span>{gcp.name}</span>
                        </td>
                        <td className="py-2 px-3 font-sans">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              gcp.type === 'control'
                                ? 'bg-blue-600/30 text-blue-300'
                                : 'bg-amber-600/30 text-amber-300'
                            }`}
                          >
                            {gcp.type === 'control' ? '控制点' : '检查点'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-white">{gcp.markCount}</td>
                        <td className="py-2 px-3">{gcp.x.toFixed(6)}</td>
                        <td className="py-2 px-3">{gcp.y.toFixed(6)}</td>
                        <td className="py-2 px-3">{gcp.z.toFixed(2)}m</td>
                        <td className="py-2 px-3 text-emerald-400 font-semibold">
                          {gcp.reprojectionErrorPx}
                        </td>
                        <td className="py-2 px-3">{gcp.errorXCm}</td>
                        <td className="py-2 px-3">{gcp.errorYCm}</td>
                        <td className="py-2 px-3">{gcp.errorZCm}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions Bar matching Screenshot 8 */}
            <div className="h-12 border-t border-[#262832] px-4 flex items-center justify-between bg-[#1B1C22] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-300">使用影像位置信息约束:</span>
                <input
                  type="checkbox"
                  checked={usePosPrior}
                  onChange={(e) => setUsePosPrior(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-[#252833] border-[#383C4A] cursor-pointer"
                />
              </div>

              <button
                onClick={handleRunOptimization}
                disabled={isOptimizing || !selectedPhoto}
                className="h-8 px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-md transition-colors cursor-pointer"
              >
                {isOptimizing ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>平差优化迭代中...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>空三优化</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium shadow-2xl border border-blue-400/40 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
};
