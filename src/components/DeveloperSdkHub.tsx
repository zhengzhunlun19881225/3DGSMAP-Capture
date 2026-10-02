import React, { useEffect, useRef, useState } from 'react';
import { Code2, Copy, Check, RefreshCw, Download, Cpu, Camera, Layers } from 'lucide-react';
import { Project, ReconstructionJob, ReconstructionTask } from '../types/reconstruction';
import { reconstructionApi, readReconstructionJob } from '../lib/reconstructionApi';
import { API_OPERATIONS, ApiOperation, apiPath, sdkExample, SdkLanguage } from '../lib/sdkExamples';
import profiles from '../../config/reconstruction_profiles.json';
import { useTaskPhotos } from '../lib/useTaskPhotos';

type Props = { project: Project | null; task: ReconstructionTask | null; tasks: ReconstructionTask[]; onSelectTask: (task: ReconstructionTask) => void };
type Health = { ok: boolean; api_version: number; brush: boolean; max_concurrent_jobs: number };
const panel = 'rounded-xl border border-[#2D303E] bg-[#1C1E26]';
const button = 'rounded-md px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white';
const statusLabels: Record<string, string> = { queued: '排队中', processing: '处理中', completed: '已完成', failed: '已结束 / 失败' };

export function DeveloperSdkHub({ project, task, tasks, onSelectTask }: Props) {
  const [operation, setOperation] = useState<ApiOperation>('health');
  const [language, setLanguage] = useState<SdkLanguage>('python');
  const [health, setHealth] = useState<Health | null>(null);
  const [job, setJob] = useState<ReconstructionJob | null>(null);
  const [healthError, setHealthError] = useState('');
  const [jobError, setJobError] = useState('');
  const [updated, setUpdated] = useState('');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const request = useRef<AbortController | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobId = task?.pipelineJobId;
  const { photos: sourcePhotos } = useTaskPhotos(task?.photos || [], jobId);
  const liveJob = job?.id === jobId ? job : null;

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setHealth(null); setJob(null); setUpdated(''); setHealthError(''); setJobError('');
    if (!reconstructionApi) return;
    const poll = async () => {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]);
      const results = await Promise.allSettled([
        fetch(`${reconstructionApi}/api/health`, { signal, cache: 'no-store' }).then(async response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json() as Promise<Health>;
        }),
        jobId ? readReconstructionJob(jobId, signal) : Promise.resolve(null),
      ]);
      if (controller.signal.aborted) return;
      if (results[0].status === 'fulfilled') { setHealth(results[0].value); setHealthError(''); }
      else { setHealth(null); setHealthError(String(results[0].reason)); }
      if (results[1].status === 'fulfilled') { setJob(results[1].value); setJobError(''); }
      else { setJob(null); setJobError(String(results[1].reason)); }
      setUpdated(new Date().toLocaleTimeString());
      timer = setTimeout(poll, 5000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [jobId]);
  useEffect(() => {
    request.current?.abort(); setOutput(''); setRunning(false); setCopied(false);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    return () => { request.current?.abort(); if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, [operation, language, task?.id, jobId]);

  const definition = API_OPERATIONS.find(item => item.id === operation)!;
  const profile = liveJob?.config?.profile || task?.params.performanceProfile || 'preview';
  const metadata = {
    profile, matching: task?.params.matchingMode || 'exhaustive',
    ...(task?.params.maxGaussianPointsMode === 'custom' ? { maxGaussianPoints: task.params.customMaxPoints } : {}),
  };
  const path = apiPath(operation, jobId, liveJob?.artifact || undefined);
  const code = sdkExample(language, operation, reconstructionApi, jobId, liveJob?.artifact || undefined,
    metadata, sourcePhotos.map(photo => photo.name));
  const missingJob = operation !== 'health' && operation !== 'submit' && !jobId;
  const canDownload = operation === 'artifact' && liveJob?.status === 'completed' && !!liveJob.artifact;
  const unavailable = !reconstructionApi ? '当前为公网界面预览，未配置训练 API。请在本地启动服务后访问本地页面。'
    : missingJob ? '此任务还没有 job_id，请先从项目中提交照片重建。'
    : operation === 'artifact' && !canDownload ? '尚无最终 PLY。训练完成且响应包含 artifact 后可下载。' : '';

  const execute = async () => {
    if (unavailable || operation === 'submit' || operation === 'artifact') return;
    const controller = new AbortController(); request.current = controller;
    setRunning(true); setOutput('');
    const started = performance.now();
    try {
      const response = await fetch(`${reconstructionApi}${path}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: 'no-store' });
      const body = await response.text();
      let formatted = body;
      try { formatted = JSON.stringify(JSON.parse(body), null, 2); } catch { /* Display actual non-JSON errors too. */ }
      if (!controller.signal.aborted) setOutput(`GET ${reconstructionApi}${path}\nHTTP ${response.status} · ${Math.round(performance.now() - started)} ms · ${new Date().toLocaleTimeString()}\n\n${formatted}`);
    } catch (error) {
      if (!controller.signal.aborted) setOutput(`请求失败：${String(error)}\n请检查本地 API 是否运行。`);
    } finally { if (!controller.signal.aborted) setRunning(false); }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code); setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setOutput('复制失败，请手动选择代码复制。'); }
  };

  return <div className="flex-1 bg-[#141519] text-[#E1E4EA] h-[calc(100vh-3.5rem)] overflow-y-auto p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <section className={`${panel} p-6 space-y-3`}>
        <div className="text-xs text-blue-400 flex items-center gap-2"><Code2 size={16} />3DGSMAP · 开发者接入</div>
        <h1 className="text-2xl font-bold text-white">当前项目的本地重建 API</h1>
        <p className="text-sm text-neutral-400">照片 → COLMAP 相机解算 → Brush 高斯训练 → PLY。通过 HTTP 调用项目内的 Python 服务，目前没有独立发布的 Python、C++ 或 npm SDK 包。</p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span>项目：<strong>{project?.name || '尚未选择项目'}</strong></span>
          {project && <label className="flex items-center gap-2">任务：<select aria-label="SDK 当前任务" value={task?.id || ''}
            onChange={event => { const next = tasks.find(item => item.id === event.target.value); if (next) onSelectTask(next); }}
            className="bg-[#262830] border border-[#363946] rounded px-2 py-1">
            {!task && <option value="">选择任务</option>}
            {tasks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>}
          <span className="font-mono text-xs text-neutral-400">job_id：{jobId || '尚未提交'}</span>
        </div>
        {!project && <p className="text-xs text-amber-300">请先从项目列表打开项目；任务示例会使用所选任务的真实 ID。</p>}
        <div className="text-xs text-neutral-400 space-y-1">
          <p>API 地址：<code>{reconstructionApi || '未配置'}</code> · {health ? health.ok ? `服务在线 · API v${health.api_version} · Brush ${health.brush ? '已找到' : '未找到'}` : '服务报告异常' : healthError ? '服务连接失败' : reconstructionApi ? '正在检查…' : '仅界面预览'}</p>
          <p>任务状态：{jobError ? '读取失败' : liveJob ? liveJob.phase === 'cancelled' ? '已取消' : statusLabels[liveJob.status] || liveJob.status : jobId ? '正在读取…' : '未提交'}
            {liveJob && ` · ${liveJob.image_count ?? '—'} 张照片 · ${liveJob.training_step ?? 0} / ${liveJob.training_total ?? liveJob.config?.steps ?? '—'} 步`}
            {updated && ` · 最近检查 ${updated}`}</p>
          {(healthError || jobError) && <p role="alert" className="text-red-300">{healthError || jobError}</p>}
          {liveJob?.phase === 'cancelled' && <p className="text-amber-300">此任务已有本地取消记录。尚未重启的旧服务可能仍返回排队状态；下方保留原始 HTTP 响应，便于核对。</p>}
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4 text-sm">
        {[{ icon: Cpu, title: '本地顺序计算', text: `Python HTTP API 调用 pycolmap 和 Brush；${health ? `并发任务上限 ${health.max_concurrent_jobs}` : '服务配置为一次执行一个任务'}，重复照片与相同解算参数可复用 COLMAP 缓存。` },
          { icon: Camera, title: '实际计算数据', text: '任务接口返回注册相机数量、稀疏点数、重投影误差、训练步数和日志；相机接口返回内参与位姿。' },
          { icon: Layers, title: '真实成果与当前范围', text: '最终输出为高斯 PLY，网页使用 Spark 查看。尚未接入 GCP 联合平差、DOM/DSM、Mesh/3D Tiles、SPLAT 转换、集群调度或云端训练。' }].map(card =>
          <div key={card.title} className={`${panel} p-5 space-y-2`}><card.icon size={20} className="text-blue-400" /><h2 className="font-semibold">{card.title}</h2><p className="text-xs leading-6 text-neutral-400">{card.text}</p></div>)}
      </section>

      <section className={`${panel} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-[#2D303E] flex flex-wrap justify-between items-center gap-3">
          <h2 className="font-semibold">接口示例与真实响应</h2>
          <div className="flex gap-1">{(['python', 'javascript', 'curl'] as const).map(lang => <button key={lang} onClick={() => setLanguage(lang)}
            className={`px-3 py-1 rounded text-xs ${language === lang ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:bg-[#262830]'}`}>{lang === 'python' ? 'Python' : lang === 'javascript' ? 'JavaScript' : 'cURL'}</button>)}</div>
        </div>
        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="真实 API 接口" className="p-3 space-y-2 border-r border-[#2D303E]">{API_OPERATIONS.map(item => <button key={item.id} onClick={() => setOperation(item.id)}
            className={`w-full p-3 text-left rounded-lg border ${operation === item.id ? 'border-blue-500 bg-blue-950/30' : 'border-[#2D303E] hover:bg-[#252834]'}`}>
            <div className="text-sm font-medium"><span className="text-blue-400 text-xs font-mono mr-2">{item.method}</span>{item.label}</div>
            <div className="mt-1 text-xs text-neutral-400">{item.description}</div>
          </button>)}</nav>
          <div className="min-w-0 bg-[#111216]">
            <div className="p-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#2D303E]">
              <code className="text-xs break-all">{definition.method} {path}</code>
              <div className="flex gap-2"><button className="text-xs flex gap-1 items-center text-neutral-300" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? '已复制' : '复制代码'}</button>
                {operation !== 'submit' && operation !== 'artifact' && <button className={button} disabled={running || !!unavailable} onClick={execute}><RefreshCw size={12} className="inline mr-1" />{running ? '请求中…' : '发送 GET 请求'}</button>}
                {canDownload && reconstructionApi && <a className={button} href={`${reconstructionApi}${path}`} download={liveJob!.artifact!}><Download size={12} className="inline mr-1" />下载 PLY</a>}
              </div>
            </div>
            {unavailable && <p className="px-4 pt-3 text-xs text-amber-300">{unavailable}</p>}
            {operation === 'submit' && <p className="px-4 pt-3 text-xs text-amber-300">这是创建新任务的代码示例。执行后会上传照片并加入训练队列；当前页面不执行提交。至少 2 张照片，文件名必须唯一。预设示例图片无法用于重建。</p>}
            {operation === 'submit' && !sourcePhotos.length && <p className="px-4 pt-2 text-xs text-neutral-400">尚未读取到原始照片名称；示例中的 photo-1.jpg、photo-2.jpg 是待替换的文件名。</p>}
            {!reconstructionApi && <p className="px-4 pt-2 text-xs text-neutral-400">代码使用 localhost 示例地址，请在运行服务的电脑上执行。</p>}
            <pre className="p-4 text-xs leading-6 overflow-auto max-h-[440px] text-neutral-200 select-text" aria-label="API 示例代码">{code}</pre>
            <div className="border-t border-[#2D303E] p-4"><h3 className="text-xs text-neutral-500 mb-2">实际 HTTP 响应</h3>
              <pre role="status" aria-label="API 实际响应" className="text-xs text-emerald-300 whitespace-pre-wrap break-all max-h-80 overflow-auto select-text">{output || '尚未发送测试请求。此处仅显示真实响应，不生成模拟日志。'}</pre>
            </div>
          </div>
        </div>
      </section>
      <section className={`${panel} p-5 space-y-3`}>
        <h2 className="font-semibold">提交参数与性能档位</h2>
        <p className="text-xs text-neutral-400">multipart 字段：metadata 为 JSON 字符串；images 为可重复的照片文件字段。默认 profile=preview、matching=exhaustive；有序照片可用 sequential。可覆盖 steps（10–60000）、maxResolution（320–4096）、maxGaussianPoints（10000–10000000）。</p>
        <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="text-neutral-400"><tr>{['profile', '档位', '训练步数', '训练最长边', '高斯点数上限'].map(label => <th key={label} className="p-2 border-b border-[#303342]">{label}</th>)}</tr></thead><tbody>
          {Object.entries(profiles).map(([key, value]) => <tr key={key}><td className="p-2 font-mono">{key}</td><td className="p-2">{value.label}</td><td className="p-2">{value.steps.toLocaleString()}</td><td className="p-2">{value.maxResolution}px</td><td className="p-2">{value.maxGaussianPoints.toLocaleString()}</td></tr>)}
        </tbody></table></div>
        <p className="text-xs text-neutral-400">新请求的档位来自仓库配置；运行中的任务以状态响应里的 config 为准。示例只发送后端实际支持的计算参数。</p>
      </section>
      <section className={`${panel} p-5 text-xs text-neutral-400 space-y-2`}>
        <h2 className="text-sm font-semibold text-white">本地接入说明</h2>
        <p>在已安装依赖的项目根目录启动 API：<code className="text-neutral-200 select-text">./.venv/bin/python server/reconstruction_server.py</code>。已有训练运行时无需重复启动或重启服务。</p>
        <p>项目与照片副本存储在浏览器 IndexedDB；提交后的影像、状态、日志和 PLY 存储在 runtime/jobs/&lt;job_id&gt;/。HTTP API 不提供项目列表或浏览器数据库读取接口。</p>
        <p>服务默认仅监听 127.0.0.1:8787，尚未实现鉴权、集群、Webhook、暂停续训或通用取消接口。查询间隔建议 2–5 秒；404 表示任务或所需成果尚不可用，400 表示提交参数或文件校验失败。</p>
      </section>
    </div>
  </div>;
}
