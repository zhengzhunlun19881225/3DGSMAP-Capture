import React, { useEffect, useRef, useState } from 'react';
import { emptyChanges, loadLocalWorkspace, saveLocalWorkspace, syncDeletedJobs, Workspace } from '../lib/localWorkspace';

export function LocalWorkspaceStorage({ projects, tasks, onRestore, onRemoveJobs }: Workspace & { onRestore: (workspace: Workspace) => void; onRemoveJobs: (ids: string[]) => void }) {
  const changes = useRef(emptyChanges());
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('正在读取本地项目…');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const restore = useRef(onRestore);
  restore.current = onRestore;
  const removeJobs = useRef(onRemoveJobs);
  removeJobs.current = onRemoveJobs;
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    syncDeletedJobs().then(ids => {
      if (!cancelled && ids.length) removeJobs.current(ids);
      return loadLocalWorkspace(changes.current);
    }).then(workspace => {
      if (cancelled) return;
      restore.current(workspace);
      setReady(true);
    }).catch(failure => {
      if (!cancelled) { setError(true); setStatus(`读取失败：${String(failure)}`); }
    });
    return () => { cancelled = true; };
  }, [ready, retry]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let running = false;
    const applied = new Set<string>();
    const timer = window.setInterval(async () => {
      if (running) return;
      running = true;
      try {
        const ids = await syncDeletedJobs();
        if (!cancelled && ids.some(id => !applied.has(id))) {
          removeJobs.current(ids);
          ids.forEach(id => applied.add(id));
        }
      } catch (failure) {
        if (!cancelled) { setError(true); setStatus(`删除同步失败：${String(failure)}`); }
      } finally { running = false; }
    }, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [ready, retry]);
  useEffect(() => {
    if (!ready) return;
    const current = ++generation.current;
    setStatus('正在保存到本地…'); setError(false);
    queue.current = queue.current.catch(() => {}).then(() => saveLocalWorkspace({ projects, tasks }, changes.current));
    queue.current.then(() => {
      if (generation.current === current) setStatus('已保存到本地');
    }).catch(failure => {
      if (generation.current === current) { setError(true); setStatus(`保存失败：${String(failure)}`); }
    });
  }, [projects, tasks, ready, retry]);
  useEffect(() => {
    if (ready && status === '已保存到本地') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [ready, status]);
  if (!error) return null;
  return <div role="alert" className="fixed bottom-4 right-4 z-[10000] rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-xs text-red-200 shadow-lg">
    <span>{status}</span>
    <button className="ml-3 underline" onClick={() => setRetry(value => value + 1)}>重试</button>
  </div>;
}
