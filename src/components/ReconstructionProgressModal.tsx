import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Clock,
  Play,
  Check,
  ChevronRight,
  Eye,
  FileCheck2,
} from 'lucide-react';
import { ReconstructionTask } from '../types/reconstruction';

interface ReconstructionProgressModalProps {
  task: ReconstructionTask;
  onFinish: () => void;
  onCancel: () => void;
}

export const ReconstructionProgressModal: React.FC<ReconstructionProgressModalProps> = ({
  task,
  onFinish,
  onCancel,
}) => {
  const [progress, setProgress] = useState(12);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] 初始化 MipMap 重建引擎核心 (v3.2.3)...`,
    `[${new Date().toLocaleTimeString()}] 载入影像数据集: 共 ${task.photoCount} 张无人机测区照片`,
    `[${new Date().toLocaleTimeString()}] 读取相机参数: Camera-1 (焦距 24.0mm, 传感器尺寸 13.2x8.8mm)`,
  ]);

  const handleInstantFinish = () => {
    setProgress(100);
    setIsDone(true);
    setLogs((l) => [
      ...l,
      `[${new Date().toLocaleTimeString()}] 触发快速流水线完成，所有成果已就绪！`,
    ]);
  };

  const templateName =
    task.params.template === 'gaussian_splat'
      ? '高斯泼溅 (3DGS)'
      : task.params.template === 'mesh'
      ? '实景三维网格 (Mesh)'
      : task.params.template === 'fast_2d'
      ? '快速二维正射 (DOM)'
      : task.params.template === 'at'
      ? '仅空三平差 (AT)'
      : '快速三维预览';

  // Stages tailored specifically to the chosen template
  const getStages = () => {
    const baseStage1 = {
      title: '空三解算与光束法平差 (Bundle Adjustment)',
      desc: `SIFT 特征提取匹配 (${task.photoCount} 张影像) · 自由网平差与 POS 先验约束`,
    };

    if (task.params.template === 'gaussian_splat') {
      return [
        baseStage1,
        {
          title: '3DGS 高斯泼溅致密化训练 (Gaussian Training)',
          desc: `迭代学习 30,000 步 · ${task.params.maxGaussianPointsMode === 'auto' ? '自适应点数' : `${(task.params.customMaxPoints / 1000000).toFixed(1)}M点`} · ${task.params.humanRemoval ? '动态行人消除滤波' : '全场景着色'}`,
        },
        {
          title: '空间视锥剪枝与球谐系数压缩 (SH Compression)',
          desc: '优化透明度与各向异性协方差矩阵 · 剔除不可视浮空噪点',
        },
        {
          title: '成果导出与 PlayCanvas / PLY 瓦片流化',
          desc: `打包 ${task.params.gaussianFormats.join(', ')} 成果格式`,
        },
      ];
    } else if (task.params.template === 'mesh') {
      return [
        baseStage1,
        {
          title: '密集几何点云重建 (Dense Matching)',
          desc: '多视立体视觉 MVS 密集深度图估计 · 稠密点云过滤',
        },
        {
          title: '泊松三角网构网与水域平整 (Mesh Reconstruction)',
          desc: `TIN 空间三角剖分 · ${task.params.waterFlattening ? '水面自动识别平整' : '原始曲面'} · 几何简化率 ${task.params.meshSimplifyRatio}%`,
        },
        {
          title: '纹理映射烘焙与 3D Tiles / OSGB 瓦片分块',
          desc: `贴图 UV 解包与白模纹理贴附 · 输出 ${task.params.meshFormats.join(', ')}`,
        },
      ];
    } else if (task.params.template === 'fast_2d') {
      return [
        baseStage1,
        {
          title: '真正射纠正与数字表面模型生成 (DSM)',
          desc: '高程点内插与局部微地貌三角化 · DSM 栅格高程图解算',
        },
        {
          title: '数字正射影像图辐射校正与匀色 (Color Balancing)',
          desc: `自动航带接缝线消除 · 像元分辨率 ${task.params.domResolutionCm}cm/px`,
        },
        {
          title: 'GeoTIFF / MBTiles 正射金字塔切片',
          desc: `构建 ${task.params.crs} 坐标系空间瓦片`,
        },
      ];
    } else {
      return [
        baseStage1,
        {
          title: '连接点云生成与精度检核',
          desc: '高精连接点提取与重投影中误差收敛评估',
        },
        {
          title: '相机位姿视锥与检校内参输出',
          desc: '导出外方位元素 (POS) 与像控点检核报告',
        },
      ];
    }
  };

  const stages = getStages();

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsDone(true);
          return 100;
        }

        const next = Math.min(100, prev + Math.floor(Math.random() * 12) + 6);

        // Update stage based on progress
        const stageIdx = Math.min(
          stages.length - 1,
          Math.floor((next / 100) * stages.length)
        );
        setCurrentStageIndex(stageIdx);

        // Add real-time logs tailored to template
        if (next > 20 && next < 35 && prev <= 20) {
          setLogs((l) => [
            ...l,
            `[${new Date().toLocaleTimeString()}] [空三阶段] 特征匹配完成，共建立 ${(task.photoCount * 3900).toLocaleString()} 组同名点，重投影误差 0.32px`,
            `[${new Date().toLocaleTimeString()}] 启用 GPU 硬件加速: NVIDIA RTX 4090 (CUDA Core 100% 满载，显存占用 14.8GB)`,
          ]);
        } else if (next > 45 && next < 65 && prev <= 45) {
          if (task.params.template === 'gaussian_splat') {
            setLogs((l) => [
              ...l,
              `[${new Date().toLocaleTimeString()}] [3DGS 训练] 高斯椭球致密化分裂中: Iteration 7000/30000 (Loss: 0.0142)`,
              task.params.humanRemoval
                ? `[${new Date().toLocaleTimeString()}] [智能消除] 语义分割检测到动态行人物体，已执行几何掩膜消除`
                : `[${new Date().toLocaleTimeString()}] [3DGS 训练] 当前活动高斯点数: 3,420,190`,
            ]);
          } else if (task.params.template === 'mesh') {
            setLogs((l) => [
              ...l,
              `[${new Date().toLocaleTimeString()}] [网格重建] 泊松三角剖分生成顶点数: 2,840,110 面片数: 5,680,220`,
              task.params.waterFlattening
                ? `[${new Date().toLocaleTimeString()}] [水域优化] 自动侦测到河道水体边界，已执行高程基准面拉平`
                : `[${new Date().toLocaleTimeString()}] [几何简化] 执行 QEM 网格抽稀至 ${task.params.meshSimplifyRatio}%`,
            ]);
          } else {
            setLogs((l) => [
              ...l,
              `[${new Date().toLocaleTimeString()}] [正射校正] 像素级透视纠正完成，接缝线寻优无缝羽化`,
            ]);
          }
        } else if (next > 75 && next < 90 && prev <= 75) {
          setLogs((l) => [
            ...l,
            `[${new Date().toLocaleTimeString()}] [切片导出] 构建多层级空间索引树 (Octree LOD)...`,
            `[${new Date().toLocaleTimeString()}] 坐标系转换至目标基准: ${task.params.crs}`,
          ]);
        } else if (next >= 100 && prev < 100) {
          setLogs((l) => [
            ...l,
            `[${new Date().toLocaleTimeString()}] 重建完成！成果文件已写入本地高速存储，准备就绪。`,
          ]);
        }

        return next;
      });
    }, 450);

    return () => clearInterval(timer);
  }, [task, stages.length]);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4 select-none">
      <div className="bg-[#1C1E26] border border-[#323646] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-16 border-b border-[#2C3040] px-6 flex items-center justify-between bg-[#171821] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">{task.name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-600/30 text-blue-300 border border-blue-500/40">
                  {templateName}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-[#282B38] text-neutral-300 font-medium">
                  {task.params.quality === 'ultra' ? '超高精度' : task.params.quality === 'high' ? '均衡质量' : '快速草图'}
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                正在执行三维重建流水线 · 计算模式: {task.computationMode === 'desktop' ? '单机本地 GPU' : task.computationMode === 'local_cluster' ? '本地多卡集群' : '弹性云端集群'}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold font-mono text-blue-400 tabular-nums">
              {progress}%
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">
              {isDone ? '计算完成' : '预计剩余 ~18 秒'}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-[#242735]">
          <div
            className={`h-full transition-all duration-300 ${
              isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Configuration Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-[#222532] border border-[#2F3345]">
              <div className="text-[10px] text-neutral-400">导入影像数量</div>
              <div className="font-mono text-white font-semibold mt-0.5">{task.photoCount} 张</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#222532] border border-[#2F3345]">
              <div className="text-[10px] text-neutral-400">坐标基准</div>
              <div className="font-mono text-blue-400 font-semibold mt-0.5 truncate">{task.params.crs}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#222532] border border-[#2F3345]">
              <div className="text-[10px] text-neutral-400">特征优化项</div>
              <div className="text-neutral-200 font-medium mt-0.5 truncate">
                {task.params.template === 'gaussian_splat'
                  ? task.params.humanRemoval ? '人物消除开启' : '完整场景'
                  : task.params.template === 'mesh'
                  ? task.params.waterFlattening ? '水域平整开启' : `简化至${task.params.meshSimplifyRatio}%`
                  : `分辨率 ${task.params.domResolutionCm}cm`}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#222532] border border-[#2F3345]">
              <div className="text-[10px] text-neutral-400">输出成果格式</div>
              <div className="font-mono text-emerald-400 font-semibold mt-0.5 truncate">
                {task.params.template === 'gaussian_splat'
                  ? task.params.gaussianFormats.join(', ')
                  : task.params.template === 'mesh'
                  ? task.params.meshFormats.join(', ')
                  : 'DOM (GeoTIFF)'}
              </div>
            </div>
          </div>

          {/* Reconstruction Stages Stepper */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              阶段进度流水线 (Reconstruction Stages)
            </div>
            <div className="space-y-2">
              {stages.map((stage, idx) => {
                const isPassed = currentStageIndex > idx || isDone;
                const isCurrent = currentStageIndex === idx && !isDone;
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isPassed
                        ? 'bg-[#212533] border-emerald-500/40 text-neutral-200'
                        : isCurrent
                        ? 'bg-[#252A3C] border-blue-500 shadow-md text-white'
                        : 'bg-[#1E202B] border-[#2A2E3D] text-neutral-500 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isPassed
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isCurrent
                            ? 'bg-blue-600 text-white animate-pulse'
                            : 'bg-[#2B2F3E] text-neutral-400'
                        }`}
                      >
                        {isPassed ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{stage.title}</div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">{stage.desc}</div>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono shrink-0 pl-3">
                      {isPassed ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>已完成</span>
                        </span>
                      ) : isCurrent ? (
                        <span className="text-blue-400 animate-pulse">正在处理...</span>
                      ) : (
                        <span>等待中</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Terminal Output */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>计算引擎实时输出 (Engine Terminal Log)</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">RTX 4090 · 48GB VRAM</span>
            </div>
            <div className="h-28 rounded-xl bg-[#111217] border border-[#282B38] p-3 overflow-y-auto font-mono text-[11px] text-emerald-400 leading-relaxed space-y-1">
              {logs.map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap">{log}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-16 border-t border-[#2C3040] px-6 flex items-center justify-between bg-[#171821] shrink-0">
          <div className="text-xs text-neutral-400">
            {isDone ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>重建计算已完成，成果模型与瓦片已生成！</span>
              </span>
            ) : (
              <span>任务执行中，请勿关闭窗口...</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isDone ? (
              <>
                <button
                  onClick={onCancel}
                  className="px-3.5 py-2 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-[#282B38] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleInstantFinish}
                  className="px-3.5 py-2 text-xs text-amber-300 hover:text-amber-200 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors flex items-center gap-1.5"
                  title="跳过计算等待，立即生成成果瓦片"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>跳过等待直接出图</span>
                </button>
              </>
            ) : null}

            <button
              onClick={onFinish}
              disabled={!isDone}
              className={`px-5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
                isDone
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                  : 'bg-[#292D3B] text-neutral-500 cursor-not-allowed'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>进入三维视口查看成果</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
