import React, { useEffect, useState } from 'react';
import { FileCheck2, Download, Printer, X, RefreshCw } from 'lucide-react';
import { ReconstructionTask } from '../types/reconstruction';
import { reconstructionApi, readReconstructionJob } from '../lib/reconstructionApi';
import { ReportSnapshot, ReportCamera, reportMetrics, reportDetails, reportState, reportTime, reportHtml, cameraValues } from '../lib/qualityReport';

interface QualityReportModalProps { task: ReconstructionTask; projectName?: string; onClose: () => void }
export const QualityReportModal: React.FC<QualityReportModalProps> = ({ task, projectName, onClose }) => {
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [photo, setPhoto] = useState('');
  const jobId = task.pipelineJobId;
  const current = snapshot?.job.id === jobId ? snapshot : null;
  const selectedCamera = current?.cameras.find(camera => camera.name === photo) || current?.cameras[0];
  useEffect(() => {
    setSnapshot(null); setError(''); setExportError(''); setPhoto('');
    if (!jobId || !reconstructionApi) {
      setLoading(false);
      setError(!jobId ? '当前任务尚未提交真实重建，暂无可用报告。' : '未配置重建 API，无法读取项目真实数据。');
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let cameras: ReportCamera[] = [];
    const poll = async () => {
      setLoading(true);
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
        const job = await readReconstructionJob(jobId, signal);
        if (job.id !== jobId) throw new Error('响应任务 ID 与当前项目不一致');
        let cameraNotice = '相机解算尚未完成，暂无内参数据';
        if ((job.registered_images || 0) > 0 && !cameras.length) {
          try {
            const response = await fetch(`${reconstructionApi}/api/jobs/${jobId}/view`, { signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            cameras = Array.isArray(data.cameras) ? data.cameras : [];
            cameraNotice = cameras.length ? '' : '相机接口没有返回数据';
          } catch (failure) { cameraNotice = `相机内参读取失败：${String(failure)}`; }
        }
        if (controller.signal.aborted) return;
        setSnapshot({ job, cameras, cameraNotice: cameras.length ? '' : cameraNotice, fetchedAt: Date.now() });
        setError('');
      } catch (failure) {
        if (controller.signal.aborted) return;
        setSnapshot(null); setError(`读取真实报告失败：${String(failure)}`);
      } finally {
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(poll, 5000); }
      }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [jobId, retry]);
  const exportJson = () => {
    if (!current) return;
    const data = { project: projectName || null, task: task.name, source: `${reconstructionApi}/api/jobs/${jobId}`,
      ...current, metrics: reportMetrics(current), details: reportDetails(current) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `3DGSMAP-report-${jobId}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const print = () => {
    if (!current) return;
    const target = window.open('', '_blank');
    if (!target) { setExportError('打印窗口被浏览器拦截，请允许弹出窗口后重试，或导出 JSON。'); return; }
    target.opener = null;
    target.document.open(); target.document.write(reportHtml(projectName || '未提供', task.name, current, reconstructionApi)); target.document.close();
    target.focus(); target.print();
  };
  const btn = 'px-3 py-1.5 rounded-lg bg-[#262832] hover:bg-[#303340] border border-[#383B48] disabled:opacity-40 flex items-center gap-1.5';
  return <div role="dialog" aria-modal="true" aria-label="项目重建数据报告" className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
    <div className="bg-[#1C1E24] border border-[#30333E] rounded-xl w-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-xs text-[#E1E4EA]">
      <header className="border-b border-[#2C2E38] px-5 py-4 flex flex-wrap gap-3 items-center justify-between bg-[#18191E] shrink-0">
        <div className="flex items-center gap-3"><FileCheck2 className="text-blue-400 w-6 h-6" /><div>
          <h2 className="text-base font-bold text-white">项目重建数据报告</h2>
          <p className="text-neutral-400 mt-1">项目：{projectName || '未提供'} · 任务：{task.name}</p>
        </div></div>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={exportJson} disabled={!current}><Download size={14} />导出 JSON</button>
          <button className={btn} onClick={print} disabled={!current}><Printer size={14} />打印 / 另存 PDF</button>
          <button aria-label="关闭报告" onClick={onClose} className="p-2"><X size={18} /></button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div className="text-neutral-400 space-y-1 break-all">
          <p>job_id：{jobId || '尚未提交'} · 数据来源：{jobId && reconstructionApi ? `${reconstructionApi}/api/jobs/${jobId}` : '暂无'}</p>
          {current && <p>报告读取时间：{new Date(current.fetchedAt).toLocaleString()} · 服务记录更新时间：{reportTime(current.job.updated_at)}</p>}
          <p>报告只展示本任务可获取的数据；未提供的指标不使用预设数值，也不自动判定精度等级。</p>
          {current?.job.phase === 'cancelled' && <p className="text-amber-300">状态来自本地取消记录；未重启的旧服务原始响应可能仍显示排队。</p>}
          {exportError && <p role="alert" className="text-amber-300">{exportError}</p>}
        </div>
        {error && <div role="alert" className="rounded border border-red-900 p-4 text-red-300">{error}<button className={`${btn} mt-3`} onClick={() => setRetry(value => value + 1)}><RefreshCw size={14} />重新读取</button></div>}
        {loading && !current && !error && <p role="status">正在读取当前任务的解算与训练数据…</p>}
        {current && <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{reportMetrics(current).map(([label, value, note]) => <div key={label} className="p-4 rounded-xl bg-[#23252E] border border-[#30333E] min-w-0">
            <h3 className="text-neutral-400">{label}</h3><div className="text-xl font-mono font-semibold text-blue-300 my-2 break-words">{value}</div><p className="text-[11px] text-neutral-500 leading-5">{note}</p>
          </div>)}</div>
          <section className="space-y-3"><h3 className="font-semibold text-sm">相机解算内参</h3>
            {selectedCamera ? <>
              <label className="flex flex-wrap gap-2 items-center">已注册照片（{current.cameras.length} 张）<select aria-label="报告相机照片" value={selectedCamera.name} onChange={event => setPhoto(event.target.value)} className="bg-[#262832] border border-[#383B48] rounded p-2 max-w-full">
                {current.cameras.map(camera => <option key={camera.name} value={camera.name}>{camera.name}</option>)}
              </select></label>
              <div className="overflow-x-auto"><table className="w-full text-left border border-[#30333E]"><thead className="bg-[#242630] text-neutral-400"><tr>{['照片', '图像宽 × 高', 'fx (px)', 'fy (px)', 'cx (px)', 'cy (px)'].map(label => <th key={label} className="p-3 font-normal">{label}</th>)}</tr></thead>
                <tbody><tr>{cameraValues(selectedCamera).map((value, index) => <td key={index} className="p-3 font-mono whitespace-nowrap">{value}</td>)}</tr></tbody></table></div>
              <p className="text-neutral-500">来自 COLMAP 相机内参矩阵，单位为像素。当前接口不提供畸变系数、设计先验值或检校收敛评价。</p>
            </> : <p className="text-neutral-400">{current.cameraNotice}</p>}
          </section>
          <section className="space-y-3"><h3 className="font-semibold text-sm">任务记录、耗时与指标可用性</h3>
            <div className="rounded-lg border border-[#30333E] overflow-hidden"><table className="w-full text-left"><tbody className="divide-y divide-[#30333E]">{reportDetails(current).map(([label, value]) => <tr key={label}><th className="p-3 w-1/3 font-normal text-neutral-400">{label}</th><td className="p-3 break-words">{value}</td></tr>)}</tbody></table></div>
          </section>
          {current.job.error && <p className="text-amber-300">任务说明：{current.job.error}</p>}
          <details><summary className="cursor-pointer text-neutral-300">查看服务日志（接口保留的最近记录）</summary><pre className="mt-3 p-3 bg-[#111216] rounded whitespace-pre-wrap break-all max-h-64 overflow-y-auto text-neutral-400">{current.job.logs.join('\n') || '未提供日志'}</pre></details>
        </>}
      </div>
      <footer className="px-5 py-3 border-t border-[#30333E] flex justify-between items-center gap-3 text-neutral-400">
        <span>{current ? `任务${reportState(current.job)} · 精度等级未评定` : '暂无可核验数据'}</span>
        <button className={btn} onClick={onClose}>关闭</button>
      </footer>
    </div>
  </div>;
};
