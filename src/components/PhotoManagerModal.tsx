import React from 'react';
import { X, Camera, MapPin, CheckCircle2, Image as ImageIcon, Trash2, Download } from 'lucide-react';
import { PhotoAsset } from '../types/reconstruction';

interface PhotoManagerModalProps {
  photos: PhotoAsset[];
  onClose: () => void;
  onDeletePhoto: (id: string) => void;
  onClearAll: () => void;
}

export const PhotoManagerModal: React.FC<PhotoManagerModalProps> = ({
  photos,
  onClose,
  onDeletePhoto,
  onClearAll,
}) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#1C1E25] border border-[#303340] rounded-xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden text-xs text-[#E1E4EA]">
        {/* Header */}
        <div className="h-14 border-b border-[#2C2E3A] px-6 flex items-center justify-between bg-[#17181F] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                已导入照片与 POS 元数据管理 (Photo Asset Gallery)
              </h3>
              <div className="text-[11px] text-neutral-400">
                共 <span className="text-white font-mono font-semibold">{photos.length}</span> 张影像 · 
                已定位: <span className="text-emerald-400 font-mono font-semibold">{photos.filter((p) => p.isCalibrated).length}</span> 张
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {photos.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空当前照片</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-[#282A36]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Photos Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {photos.length === 0 ? (
            <div className="text-center py-16 text-neutral-500">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂未导入任何照片</p>
              <p className="text-xs text-neutral-600 mt-1">请通过导入图像、导入文件夹或加载测区样本添加影像</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="group bg-[#22242D] border border-[#2E313E] rounded-lg overflow-hidden flex flex-col hover:border-blue-500/50 transition-all"
                >
                  <div className="h-28 bg-black/60 relative overflow-hidden">
                    <img
                      src={photo.url}
                      alt={photo.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] font-mono text-white">
                      #{idx + 1}
                    </div>
                    {photo.isCalibrated ? (
                      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-emerald-600/80 backdrop-blur text-[10px] font-mono text-white flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>POS 已定位</span>
                      </div>
                    ) : (
                      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-neutral-800/80 backdrop-blur text-[10px] text-neutral-400">
                        无GPS
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-mono font-medium text-white truncate" title={photo.name}>
                        {photo.name}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                        {photo.width} × {photo.height} · 焦距 {photo.focalLength}mm
                      </div>
                    </div>

                    <div className="pt-2 mt-2 border-t border-[#2B2E3A] flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                      <div className="truncate max-w-[130px]">
                        {photo.lat.toFixed(5)}°, {photo.lon.toFixed(5)}°
                      </div>
                      <button
                        onClick={() => onDeletePhoto(photo.id)}
                        className="text-neutral-500 hover:text-rose-400 transition-colors p-1"
                        title="删除该照片"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 border-t border-[#2C2E3A] px-6 flex items-center justify-between bg-[#17181F] shrink-0 text-neutral-400">
          <span>支持格式: JPEG / PNG / TIFF / DNG 原始航测影像及 EXIF GPS 元数据</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
