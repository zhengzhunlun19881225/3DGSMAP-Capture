import React, { useState } from 'react';
import {
  Code2,
  Cpu,
  Server,
  Cloud,
  Terminal,
  Copy,
  Check,
  Play,
  Download,
  BookOpen,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { SDK_ENDPOINTS } from '../data/mockData';
import { SdkEndpoint } from '../types/reconstruction';
import { OpenSourceEngineModal } from './OpenSourceEngineModal';

export const DeveloperSdkHub: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<SdkEndpoint>(SDK_ENDPOINTS[0]);
  const [activeLang, setActiveLang] = useState<'python' | 'cpp' | 'node' | 'curl'>('python');
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);
  const [showEngineGuide, setShowEngineGuide] = useState(false);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecute = () => {
    setIsRunning(true);
    setExecutionOutput('Connecting to MipMap Reconstruct Engine Core...\nDispatching payload to compute node (Node-GPU-RTX4090-01)...\n');
    setTimeout(() => {
      setExecutionOutput(
        (prev) =>
          prev +
          '[Phase 1] Feature Extraction: 380 photos processed in 1.4s\n' +
          '[Phase 2] Bundle Adjustment (AT): Reprojection error = 0.32 px (Converged)\n' +
          '[Phase 3] 3D Gaussian Splatting: 4.8M gaussians trained (Iteration 30,000)\n' +
          '[Phase 4] Output Packaged: PlayCanvas LOD & B3DM ready\n\n' +
          selectedEndpoint.responseSample
      );
      setIsRunning(false);
    }, 1800);
  };

  const getCodeSnippet = () => {
    switch (activeLang) {
      case 'python':
        return selectedEndpoint.pythonExample;
      case 'cpp':
        return selectedEndpoint.cppExample;
      case 'node':
        return selectedEndpoint.nodeExample;
      case 'curl':
        return selectedEndpoint.curlExample;
    }
  };

  return (
    <div className="flex-1 bg-[#141519] text-[#E1E4EA] h-[calc(100vh-3.5rem)] overflow-y-auto p-6 select-none">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Hero Section */}
        <div className="relative rounded-2xl bg-gradient-to-r from-[#1B1D26] via-[#1E222F] to-[#181922] border border-[#2D3142] p-8 overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Map 空间重建 SDK 全能力开放</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              实景三维、高精空三与高斯泼溅 (3DGS) 开发者平台
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              以现代化 SDK 与高性能 API 提供从影像解算、光束法平差 (AT)、正射影像 (DOM/DSM)、实景网格 (Mesh/3D Tiles)
              到毫米级高斯泼溅 (3DGS) 的全流程空间计算能力，深度赋能桌面软件、私有服务器集群与云原生系统。
            </p>

            {/* Quick Install Bar */}
            <div className="pt-2 flex flex-wrap items-center gap-3 font-mono text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-neutral-300 flex items-center gap-2">
                <span className="text-blue-400">$</span>
                <span>pip install map-reconstruct-sdk</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-neutral-300 flex items-center gap-2">
                <span className="text-emerald-400">$</span>
                <span>vcpkg install map-reconstruct-sdk</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-neutral-300 flex items-center gap-2">
                <span className="text-amber-400">$</span>
                <span>npm i @mipmap/reconstruct-sdk</span>
              </div>

              <button
                type="button"
                onClick={() => setShowEngineGuide(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/40 border border-blue-500/50 text-blue-300 font-sans font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>底层开源引擎架构详解 (COLMAP / gsplat)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Integration Architectures (Desktop, Local Cluster, Cloud) */}
        <div>
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <span>三大部署集成形态全支持</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Desktop */}
            <div className="p-5 rounded-xl bg-[#1C1E26] border border-[#2D303E] hover:border-amber-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">桌面端集成 (Desktop SDK)</h3>
                <div className="text-[11px] text-amber-400/90 font-mono mt-0.5">
                  C++ Native / Qt / Electron / Python
                </div>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                面向桌面行业测绘、无人机地面站与 GIS 软件提供原生动态链接库 (DLL / .so)。直接调度本机 NVIDIA GPU (CUDA / TensorRT) 算力，支持无网离线加密狗授权。
              </p>
              <div className="pt-2 border-t border-[#292B38] text-[11px] text-neutral-400 flex items-center justify-between">
                <span>延迟: 毫秒级</span>
                <span className="text-amber-400 font-medium">支持 CUDA 12.x</span>
              </div>
            </div>

            {/* 2. On-Premise Cluster */}
            <div className="p-5 rounded-xl bg-[#1C1E26] border border-[#2D303E] hover:border-emerald-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">本地服务器集群 (On-Premise)</h3>
                <div className="text-[11px] text-emerald-400/90 font-mono mt-0.5">
                  Docker / Slurm / K8s / 多机多卡并行
                </div>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                面向企事业单位局域网与私有数据中心，提供多节点任务分发与 GPU 资源调度。单任务自动划分 ROI 切块并在多台节点协同平差与高斯渲染。
              </p>
              <div className="pt-2 border-t border-[#292B38] text-[11px] text-neutral-400 flex items-center justify-between">
                <span>吞吐: 10万+ 照片/天</span>
                <span className="text-emerald-400 font-medium">内网数据安全闭环</span>
              </div>
            </div>

            {/* 3. Cloud */}
            <div className="p-5 rounded-xl bg-[#1C1E26] border border-[#2D303E] hover:border-blue-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">云端弹性集成 (Cloud Native)</h3>
                <div className="text-[11px] text-blue-400/90 font-mono mt-0.5">
                  RESTful / OpenAPI 3.0 / WebSocket RPC
                </div>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                面向 Web SaaS 平台与互联网应用，对接对象存储 (OSS/S3/MinIO)，以异步任务队列表述空三、高斯泼溅生成，并推送实时 Webhook 回调。
              </p>
              <div className="pt-2 border-t border-[#292B38] text-[11px] text-neutral-400 flex items-center justify-between">
                <span>算力: Serverless 自动扩缩</span>
                <span className="text-blue-400 font-medium">99.9% 可用性保障</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive API Explorer & Code Runner */}
        <div className="rounded-2xl bg-[#1A1C24] border border-[#2D303E] overflow-hidden shadow-2xl">
          <div className="h-14 border-b border-[#2C2E3C] px-6 flex items-center justify-between bg-[#17181F]">
            <div className="flex items-center gap-3">
              <Code2 className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-white">交互式 SDK 接口演练场 (API Playground)</span>
            </div>

            {/* Language Switcher Tabs */}
            <div className="flex items-center gap-1 bg-[#22242E] p-1 rounded-lg border border-[#303342]">
              {(['python', 'cpp', 'node', 'curl'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveLang(lang)}
                  className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    activeLang === lang
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {lang === 'python' && 'Python'}
                  {lang === 'cpp' && 'C++'}
                  {lang === 'node' && 'Node.js'}
                  {lang === 'curl' && 'cURL / REST'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
            {/* Left Column: API List */}
            <div className="lg:col-span-4 border-r border-[#2B2D3B] p-4 space-y-2 bg-[#181921]">
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-2">
                核心 SDK 模块与能力
              </div>
              {SDK_ENDPOINTS.map((ep, idx) => {
                const isSelected = selectedEndpoint.path === ep.path;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedEndpoint(ep);
                      setExecutionOutput(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#252834] border-blue-500 shadow-md'
                        : 'bg-[#1F212B] border-[#2E313E] hover:border-[#3E4254]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-600/30 text-blue-300">
                        {ep.method}
                      </span>
                      <span className="text-xs font-semibold text-white truncate">{ep.title}</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 line-clamp-2">
                      {ep.description}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Code Editor & Execution Output */}
            <div className="lg:col-span-8 flex flex-col bg-[#14151B]">
              {/* Code Bar */}
              <div className="h-10 border-b border-[#282A37] px-4 flex items-center justify-between bg-[#191A22]">
                <div className="text-xs font-mono text-neutral-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{selectedEndpoint.path}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(getCodeSnippet())}
                    className="px-2.5 py-1 text-xs text-neutral-300 hover:text-white rounded hover:bg-[#282A37] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? '已复制' : '复制代码'}</span>
                  </button>

                  <button
                    onClick={handleExecute}
                    disabled={isRunning}
                    className="px-3.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>{isRunning ? '调用执行中...' : '测试运行'}</span>
                  </button>
                </div>
              </div>

              {/* Code Box */}
              <div className="flex-1 p-4 overflow-x-auto font-mono text-xs text-neutral-200 leading-relaxed bg-[#111216]">
                <pre>{getCodeSnippet()}</pre>
              </div>

              {/* Console Output if Executed */}
              {executionOutput && (
                <div className="h-44 border-t border-[#282A37] bg-[#0E0F13] p-4 overflow-y-auto font-mono text-xs text-emerald-400 leading-relaxed">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
                    终端响应日志 (Terminal Response Log)
                  </div>
                  <pre className="text-emerald-300 whitespace-pre-wrap">{executionOutput}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEngineGuide && (
        <OpenSourceEngineModal onClose={() => setShowEngineGuide(false)} />
      )}
    </div>
  );
};
