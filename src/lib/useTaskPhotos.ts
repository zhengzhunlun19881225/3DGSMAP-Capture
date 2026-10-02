import { useEffect, useMemo, useState } from 'react';
import { PhotoAsset } from '../types/reconstruction';
import { reconstructionApi } from './reconstructionApi';

/** Uploaded files are authoritative; legacy results can recover their camera images. */
export function useTaskPhotos(input: PhotoAsset[], jobId?: string) {
  const uploaded = useMemo(() => input.filter(photo => photo.file || photo.url.startsWith('blob:')), [input]);
  const [recovered, setRecovered] = useState<{ jobId: string; photos: PhotoAsset[] } | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (uploaded.length || !jobId) { setMessage(''); return; }
    if (!import.meta.env.DEV || reconstructionApi !== 'http://127.0.0.1:8787') {
      setMessage('此任务未保存上传照片，请返回导入原始照片');
      return;
    }
    if (!/^[a-f0-9]{12}$/.test(jobId)) return;
    const controller = new AbortController();
    setMessage('正在读取本地任务照片…');
    fetch(`${reconstructionApi}/api/jobs/${jobId}/view`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('暂时无法读取任务照片，请返回导入原始照片');
        const data = await response.json();
        const photos: PhotoAsset[] = (data.cameras || []).filter((camera: { name: string }) =>
          typeof camera.name === 'string' && !/[\\/]/.test(camera.name)).map((camera: { name: string; width: number; height: number }) => ({
            id: `${jobId}/${camera.name}`, name: camera.name,
            url: `/runtime/jobs/${jobId}/images/${encodeURIComponent(camera.name)}`,
            width: camera.width, height: camera.height,
            lat: 0, lon: 0, alt: 0, focalLength: 0, isCalibrated: true,
          }));
        if (!controller.signal.aborted) { setRecovered({ jobId, photos }); setMessage(''); }
      }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [uploaded.length, jobId]);
  return { photos: uploaded.length ? uploaded : recovered && recovered.jobId === jobId ? recovered.photos : [], message };
}
