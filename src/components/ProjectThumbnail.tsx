import React, { useEffect, useState } from 'react';
import { reconstructionApi } from '../lib/reconstructionApi';

export function ProjectThumbnail({ src, jobId, name }: { src: string; jobId?: string; name: string }) {
  const [savedPhoto, setSavedPhoto] = useState('');
  const [failedSource, setFailedSource] = useState('');
  useEffect(() => {
    setSavedPhoto('');
    if (src || !jobId || !/^[a-f0-9]{12}$/.test(jobId) || !reconstructionApi) return;
    // Existing local results may predate browser photo storage. Read their original
    // camera image through Vite without interrupting the running training API.
    if (!import.meta.env.DEV || reconstructionApi !== 'http://127.0.0.1:8787') return;
    const controller = new AbortController();
    fetch(`${reconstructionApi}/api/jobs/${jobId}/view`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        const first = data.cameras?.[0]?.name;
        if (!controller.signal.aborted && typeof first === 'string' && !/[\\/]/.test(first)) {
          setSavedPhoto(`/runtime/jobs/${jobId}/images/${encodeURIComponent(first)}`);
        }
      }).catch(() => {});
    return () => controller.abort();
  }, [src, jobId]);
  const source = src || savedPhoto;
  return source && source !== failedSource ? <img src={source} alt={`${name}第一张照片`}
    onError={() => setFailedSource(source)}
    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
    : <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500">暂无照片</div>;
}
