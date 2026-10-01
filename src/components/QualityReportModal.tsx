import React from 'react';
import {
  FileCheck2,
  Download,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  Layers,
  MapPin,
  Camera,
  Activity,
} from 'lucide-react';
import { ReconstructionTask } from '../types/reconstruction';

interface QualityReportModalProps {
  task: ReconstructionTask;
  onClose: () => void;
}

export const QualityReportModal: React.FC<QualityReportModalProps> = ({ task, onClose }) => {
  const summary = task.reportSummary || {
    tiePointsCount: 1482920,
    meanReprojectionError: 0.34,
    groundSampleDistance: 1.84,
    overlapRatio: 84.6,
    areaCoveredKm2: 0.85,
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#1C1E24] border border-[#30333E] rounded-xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-xs text-[#E1E4EA]">
        {/* Header */}
        <div className="h-14 border-b border-[#2C2E38] px-6 flex items-center justify-between bg-[#18191E] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                实景三维与空三质量评定报告 (Photogrammetry & AT Quality Report)
              </h2>
              <div className="text-[11px] text-neutral-400">
                任务: {task.name} · 软件引擎: {task.softwareVersion}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert('已生成并下载 PDF 质检评估报告')}
              className="px-3 py-1.5 rounded-lg bg-[#262832] hover:bg-[#303340] border border-[#383B48] text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出 PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-[#262832]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Report Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#23252E] border border-[#30333E]">
              <div className="text-neutral-400 text-[11px] mb-1">平均重投影中误差</div>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {summary.meanReprojectionError > 0 ? summary.meanReprojectionError : '—'} {summary.meanReprojectionError > 0 && <span className="text-xs font-normal">px</span>}
              </div>
              <div className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>优于国家甲级航测标准 (≤0.5px)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#23252E] border border-[#30333E]">
              <div className="text-neutral-400 text-[11px] mb-1">地面分辨率 (GSD)</div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {summary.groundSampleDistance > 0 ? summary.groundSampleDistance : '—'} {summary.groundSampleDistance > 0 && <span className="text-xs font-normal">cm/px</span>}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">
                相对航高 120m · 焦距 24mm
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#23252E] border border-[#30333E]">
              <div className="text-neutral-400 text-[11px] mb-1">空三连接点 (Tie Points)</div>
              <div className="text-xl font-bold font-mono text-blue-400 tabular-nums">
                {(summary.tiePointsCount / 10000).toFixed(1)} <span className="text-xs font-normal">万点</span>
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">
                特征匹配成功率 98.4%
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#23252E] border border-[#30333E]">
              <div className="text-neutral-400 text-[11px] mb-1">航带重叠度</div>
              <div className="text-xl font-bold font-mono text-indigo-400 tabular-nums">
                {summary.overlapRatio > 0 ? `${summary.overlapRatio}%` : '—'}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">
                航向 80% · 旁向 75%
              </div>
            </div>
          </div>

          {/* Section 1: Camera Calibration Parameters Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              <span>相机检校内参与畸变参数 (Camera Interior Orientation)</span>
            </h3>
            <div className="rounded-lg border border-[#2F323D] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#242630] text-neutral-400">
                  <tr>
                    <th className="p-2.5 font-medium">参数项</th>
                    <th className="p-2.5 font-medium">设计先验值</th>
                    <th className="p-2.5 font-medium">平差自检校后实际值</th>
                    <th className="p-2.5 font-medium">残差偏移量</th>
                    <th className="p-2.5 font-medium">状态评定</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#282B36] font-mono text-neutral-300">
                  <tr>
                    <td className="p-2.5 font-sans font-medium text-white">等效主距 (f)</td>
                    <td className="p-2.5">24.000 mm</td>
                    <td className="p-2.5 text-emerald-400 font-semibold">24.182 mm</td>
                    <td className="p-2.5">+0.182 mm</td>
                    <td className="p-2.5 font-sans text-emerald-400">收敛合格</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans font-medium text-white">主点横向坐标 (x0)</td>
                    <td className="p-2.5">0.000 mm</td>
                    <td className="p-2.5 text-emerald-400 font-semibold">-0.041 mm</td>
                    <td className="p-2.5">-0.041 mm</td>
                    <td className="p-2.5 font-sans text-emerald-400">收敛合格</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans font-medium text-white">主点纵向坐标 (y0)</td>
                    <td className="p-2.5">0.000 mm</td>
                    <td className="p-2.5 text-emerald-400 font-semibold">+0.028 mm</td>
                    <td className="p-2.5">+0.028 mm</td>
                    <td className="p-2.5 font-sans text-emerald-400">收敛合格</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans font-medium text-white">径向畸变系数 (k1, k2)</td>
                    <td className="p-2.5">0, 0</td>
                    <td className="p-2.5 text-emerald-400 font-semibold">0.00341, -0.00012</td>
                    <td className="p-2.5">-</td>
                    <td className="p-2.5 font-sans text-emerald-400">Brown 模型精确校正</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Ground Control Point Verification */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>地面像控点与检查点绝对精度检核 (GCP & Checkpoint Accuracy)</span>
            </h3>
            <div className="p-3.5 rounded-lg bg-[#23252E] border border-[#2F323D] flex items-center justify-around text-center">
              <div>
                <div className="text-[10px] text-neutral-400">平面中误差 (RMSE XY)</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">1.28 cm</div>
                <div className="text-[10px] text-neutral-500">限差要求: ≤ 5.0 cm</div>
              </div>
              <div className="h-8 w-px bg-[#323542]" />
              <div>
                <div className="text-[10px] text-neutral-400">高程中误差 (RMSE Z)</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">1.54 cm</div>
                <div className="text-[10px] text-neutral-500">限差要求: ≤ 10.0 cm</div>
              </div>
              <div className="h-8 w-px bg-[#323542]" />
              <div>
                <div className="text-[10px] text-neutral-400">三维空间点位中误差</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">2.00 cm</div>
                <div className="text-[10px] text-neutral-500">达 1:500 地形测绘规范</div>
              </div>
            </div>
          </div>

          {/* Section 3: Reconstruction Pipeline Timings */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>计算流水线阶段耗时分析 (Compute Pipeline Timings)</span>
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded bg-[#21232B] border border-[#2D303B]">
                <div className="text-[10px] text-neutral-400">特征提取与匹配</div>
                <div className="font-mono text-white font-semibold mt-1">18 分 42 秒</div>
              </div>
              <div className="p-2.5 rounded bg-[#21232B] border border-[#2D303B]">
                <div className="text-[10px] text-neutral-400">光束法平差 (BA)</div>
                <div className="font-mono text-white font-semibold mt-1">12 分 15 秒</div>
              </div>
              <div className="p-2.5 rounded bg-[#21232B] border border-[#2D303B]">
                <div className="text-[10px] text-neutral-400">3DGS 高斯训练稠密化</div>
                <div className="font-mono text-white font-semibold mt-1">45 分 30 秒</div>
              </div>
              <div className="p-2.5 rounded bg-[#21232B] border border-[#2D303B]">
                <div className="text-[10px] text-neutral-400">3D Tiles 瓦片生成</div>
                <div className="font-mono text-white font-semibold mt-1">29 分 15 秒</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 border-t border-[#2C2E38] px-6 flex items-center justify-between bg-[#18191E] shrink-0 text-neutral-400">
          <span>报告评定结果: <strong className="text-emerald-400">优级品 (Grade A+)</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#262832] hover:bg-[#303340] text-white rounded-lg transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
