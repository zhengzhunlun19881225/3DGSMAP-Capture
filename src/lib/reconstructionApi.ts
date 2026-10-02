// Public previews do not have a training server. Local development uses the
// localhost service; an explicit endpoint can be supplied at build time.
const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
export const reconstructionApi = (import.meta.env.VITE_RECONSTRUCTION_API_URL ||
  (local ? 'http://127.0.0.1:8787' : '')).replace(/\/$/, '');

/** Read cancellation receipts without restarting an older API during training. */
export async function readReconstructionJob(id: string, signal?: AbortSignal): Promise<import('../types/reconstruction').ReconstructionJob> {
  if (!/^[a-f0-9]{12}$/.test(id)) throw new Error('无效的任务编号');
  if (import.meta.env.DEV && local && reconstructionApi === 'http://127.0.0.1:8787') {
    const receipt = await fetch(`/runtime/jobs/${id}/cancelled.json`, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (receipt.ok && receipt.headers.get('content-type')?.includes('application/json')) return receipt.json();
  }
  const response = await fetch(`${reconstructionApi}/api/jobs/${id}`, { signal });
  if (!response.ok) throw new Error('无法读取本地重建任务状态');
  return response.json();
}
