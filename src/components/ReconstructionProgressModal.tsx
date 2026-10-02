import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Clock,
  Check,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { ReconstructionJob, ReconstructionTask } from '../types/reconstruction';
import { readReconstructionJob } from '../lib/reconstructionApi';

interface ReconstructionProgressModalProps {
  task: ReconstructionTask;
  jobId: string | null;
  onFinish: (job: ReconstructionJob) => void;
  onCancel: () => void;
}

export const ReconstructionProgressModal: React.FC<ReconstructionProgressModalProps> = ({
  task,
  jobId,
  onFinish,
  onCancel,
}) => {
  const [job, setJob] = useState<ReconstructionJob | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const templateName = '高斯泼溅 (3DGS)';
  const stages = [
    { title: 'COLMAP 特征提取、匹配与相机解算', desc: '按照片内容缓存解算结果；重复训练可复用' },
    { title: 'Brush 高斯训练', desc: job?.config
      ? `${job.config.label} · ${job.config.steps.toLocaleString()} 步 · ${job.config.maxResolution}px · 最多 ${job.config.maxGaussianPoints.toLocaleString()} 点`
      : '读取实际训练配置中（旧服务不提供逐步进度）' },
    { title: '最终 PLY 导出', desc: '训练中定期保存中间 PLY，结束后检查最终文件' },
    { title: '成果就绪', desc: '最终 PLY 可下载并加载至三维视口' },
  ];
  const detail = job?.status === 'queued' ? '排队中：等待当前计算任务完成'
    : job?.phase === 'extraction' ? `SIFT：${job.feature_images || 0} / ${job.image_count || task.photoCount} 张`
    : job?.phase === 'training' ? `训练：${job.training_step || 0} / ${job.training_total || 0} 步${job.steps_per_second ? ` · ${job.steps_per_second} 步/秒` : ''}`
    : job?.phase === 'matching' ? '影像匹配中'
    : job?.phase === 'mapping' ? '相机解算中'
    : '阶段进度（非实测完成比例）';

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let terminal = false;
      try {
        const next = await readReconstructionJob(jobId, controller.signal);
        if (cancelled) return;
        setJob(next);
        setProgress(next.progress);
        setCurrentStageIndex(Math.min(stages.length - 1, next.stage));
        setLogs(next.logs || []);
        setIsDone(next.status === 'completed');
        terminal = next.status === 'completed' || next.status === 'failed';
      } catch (error) {
        if (!cancelled) setLogs((items) => [...items.slice(-119), `状态连接失败：${error instanceof Error ? error.message : '稍后重试'}`]);
      } finally {
        clearTimeout(timeout);
        if (!cancelled && !terminal) timer = setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [jobId, stages.length]);

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
                  {job?.config?.label || '当前任务'}
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                本地流水线 · COLMAP CPU 解算 / Brush GPU 训练
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold font-mono text-blue-400 tabular-nums">
              {progress}%
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">
              {isDone ? '计算完成' : job?.phase === 'cancelled' ? '已取消' : job?.status === 'failed' ? '执行失败' : detail}
            </div>
          </div>
        </div>

        {job?.eta_seconds != null && job.eta_seconds > 0 && (
          <div className="px-6 py-2 text-xs text-neutral-400">按已观测训练速度估算剩余约 {Math.ceil(job.eta_seconds / 60)} 分钟（不含导出，速度会随点数变化）</div>
        )}
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
                完整场景（未实现自动人物消除）
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#222532] border border-[#2F3345]">
              <div className="text-[10px] text-neutral-400">输出成果格式</div>
              <div className="font-mono text-emerald-400 font-semibold mt-0.5 truncate">
                PLY
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
                const isCurrent = currentStageIndex === idx && job?.status === 'processing';
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
              <span className="text-[10px] text-neutral-500 font-mono">pycolmap · Brush · 本地</span>
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
                <span>重建计算已完成，最终 PLY 已生成！</span>
              </span>
            ) : job?.status === 'failed' ? (
              <span className="text-red-300 font-medium">重建失败：{job.error || '请检查照片重叠度和本地依赖'}</span>
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
                  收起（后台继续）
                </button>
              </>
            ) : null}

            <button
              onClick={() => job && onFinish(job)}
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
