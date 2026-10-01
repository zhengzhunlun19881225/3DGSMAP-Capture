import React, { useState } from 'react';
import { Camera, Radio, X } from 'lucide-react';
import { TaskType } from '../types/reconstruction';

interface NewTaskModalProps {
  onConfirm: (type: TaskType, name: string) => void;
  onClose: () => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ onConfirm, onClose }) => {
  const [selectedType, setSelectedType] = useState<TaskType>('visible_light');
  const [taskName, setTaskName] = useState(`3dgs-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#21232A] border border-[#343743] rounded-xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-5">
        {/* Title matching Screenshot 3 */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2E313C]">
          <h3 className="text-sm font-semibold text-white">任务类型</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Task Name Input */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1">任务名称</label>
          <input
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            className="w-full h-8 px-3 text-xs bg-[#17181D] border border-[#30333E] rounded-md text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Options matching Screenshot 3 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedType('visible_light')}
            className={`h-24 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
              selectedType === 'visible_light'
                ? 'bg-[#252834] border-blue-500 shadow-md ring-1 ring-blue-500/50'
                : 'bg-[#1C1E24] border-[#2D303B] hover:border-[#3C404E]'
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-white">可见光</span>
            <span className="text-[10px] text-neutral-400">无人机航拍 / 倾斜摄影</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('lidar')}
            className={`h-24 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
              selectedType === 'lidar'
                ? 'bg-[#252834] border-blue-500 shadow-md ring-1 ring-blue-500/50'
                : 'bg-[#1C1E24] border-[#2D303B] hover:border-[#3C404E]'
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-amber-600/20 text-amber-400 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-white">激光雷达</span>
            <span className="text-[10px] text-neutral-400">机载 / 车载 LiDAR 点云</span>
          </button>
        </div>

        {/* Bottom Actions matching Screenshot 3 */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-neutral-300 hover:text-white rounded-lg hover:bg-[#2B2E38] transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(selectedType, taskName);
              onClose();
            }}
            className="px-5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};
