import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Check, Globe } from 'lucide-react';
import { COORDINATE_SYSTEMS } from '../data/mockData';
import { CoordinateSystem } from '../types/reconstruction';

interface CoordinateSystemModalProps {
  currentCrs: string;
  onSelect: (crsName: string) => void;
  onClose: () => void;
}

export const CoordinateSystemModal: React.FC<CoordinateSystemModalProps> = ({
  currentCrs,
  onSelect,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<CoordinateSystem | null>(
    COORDINATE_SYSTEMS.find((c) => c.name === currentCrs) || COORDINATE_SYSTEMS[0]
  );
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    common: true,
    projected: true,
    geographic: false,
    local: true,
    custom: false,
  });

  const toggleCategory = (cat: string) => {
    setExpandedCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const filteredSystems = COORDINATE_SYSTEMS.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.epsg && c.epsg.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#21232A] border border-[#343743] rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* Header matching Screenshot 9 */}
        <div className="h-12 border-b border-[#30333E] px-5 flex items-center justify-between bg-[#1C1D24]">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Globe className="w-4 h-4 text-blue-400" />
            <span>选择坐标系</span>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>

        {/* Search input matching Screenshot 9 */}
        <div className="p-3 border-b border-[#2C2E38] bg-[#1E2027]">
          <div className="relative">
            <input
              type="text"
              placeholder="请输入关键字 (例如: WGS84, 2000, 3度带, UTM...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-[#17181E] border border-[#323541] rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
            />
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Content split: Left Tree, Right Detail Card */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Category Tree matching Screenshot 9 */}
          <div className="w-1/2 border-r border-[#2C2E38] overflow-y-auto p-3 space-y-1 text-xs">
            {/* 常用坐标系 */}
            <div>
              <button
                onClick={() => toggleCategory('common')}
                className="w-full flex items-center gap-1.5 py-1 text-neutral-300 font-medium hover:text-white"
              >
                {expandedCats.common ? <ChevronDown className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />}
                <span>常用坐标系</span>
              </button>
              {expandedCats.common && (
                <div className="pl-4 space-y-1 mt-0.5 border-l border-[#30323E] ml-2">
                  {filteredSystems
                    .filter((s) => s.category === 'common')
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedSystem(item)}
                        className={`w-full text-left px-2 py-1.5 rounded transition-colors text-xs flex items-center justify-between ${
                          selectedSystem?.id === item.id
                            ? 'bg-blue-600/30 text-blue-300 font-medium'
                            : 'text-neutral-300 hover:bg-[#2A2C36]'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        {selectedSystem?.id === item.id && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* 投影坐标系 */}
            <div>
              <button
                onClick={() => toggleCategory('projected')}
                className="w-full flex items-center gap-1.5 py-1 text-neutral-300 font-medium hover:text-white"
              >
                {expandedCats.projected ? <ChevronDown className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />}
                <span>投影坐标系 (Projected)</span>
              </button>
              {expandedCats.projected && (
                <div className="pl-4 space-y-1 mt-0.5 border-l border-[#30323E] ml-2">
                  {filteredSystems
                    .filter((s) => s.category === 'projected')
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedSystem(item)}
                        className={`w-full text-left px-2 py-1.5 rounded transition-colors text-xs flex items-center justify-between ${
                          selectedSystem?.id === item.id
                            ? 'bg-blue-600/30 text-blue-300 font-medium'
                            : 'text-neutral-300 hover:bg-[#2A2C36]'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        {selectedSystem?.id === item.id && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* 本地坐标系 */}
            <div>
              <button
                onClick={() => toggleCategory('local')}
                className="w-full flex items-center gap-1.5 py-1 text-neutral-300 font-medium hover:text-white"
              >
                {expandedCats.local ? <ChevronDown className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />}
                <span>本地坐标系 (Local Tangent)</span>
              </button>
              {expandedCats.local && (
                <div className="pl-4 space-y-1 mt-0.5 border-l border-[#30323E] ml-2">
                  {filteredSystems
                    .filter((s) => s.category === 'local')
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedSystem(item)}
                        className={`w-full text-left px-2 py-1.5 rounded transition-colors text-xs flex items-center justify-between ${
                          selectedSystem?.id === item.id
                            ? 'bg-blue-600/30 text-blue-300 font-medium'
                            : 'text-neutral-300 hover:bg-[#2A2C36]'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        {selectedSystem?.id === item.id && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Detail Card matching Screenshot 9 */}
          <div className="w-1/2 p-5 flex flex-col justify-center items-center text-center bg-[#191A20]">
            {selectedSystem ? (
              <div className="w-full text-left p-4 rounded-xl bg-[#23252E] border border-[#333644] space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{selectedSystem.name}</div>
                    {selectedSystem.epsg && (
                      <div className="text-[11px] font-mono text-blue-400">{selectedSystem.epsg}</div>
                    )}
                  </div>
                </div>

                <div className="text-xs text-neutral-300 leading-relaxed">
                  {selectedSystem.description}
                </div>

                <div className="pt-2 border-t border-[#313442] text-[11px] text-neutral-400 flex justify-between">
                  <span>投影单位: 米 (Meter)</span>
                  <span>椭球参数: GRS80 / WGS84</span>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-[#343744] rounded-xl text-neutral-500 text-xs">
                未选择坐标系!
              </div>
            )}
          </div>
        </div>

        {/* Footer actions matching Screenshot 9 */}
        <div className="h-14 border-t border-[#30333E] px-5 flex items-center justify-end gap-3 bg-[#1C1D24]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-neutral-300 hover:text-white rounded-lg hover:bg-[#2A2C36] transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (selectedSystem) onSelect(selectedSystem.name);
              onClose();
            }}
            disabled={!selectedSystem}
            className="px-5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};
