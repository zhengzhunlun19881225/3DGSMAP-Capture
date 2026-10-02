import { PhotoAsset, Project, ReconstructionTask } from '../types/reconstruction';
import { reconstructionApi } from './reconstructionApi';

const DATABASE = '3dgsmap-local-workspace';
const deletedJobs = new Set<string>();
const deletedTasks = new Set<string>();
const isDeleted = (task: StoredTask) => deletedTasks.has(task.id) || !!task.pipelineJobId && deletedJobs.has(task.pipelineJobId);
type StoredPhoto = Omit<PhotoAsset, 'file'> & { fileKey?: string };
type StoredTask = Omit<ReconstructionTask, 'photos'> & { photos?: StoredPhoto[] };
export interface Workspace { projects: Project[]; tasks: ReconstructionTask[] }
export interface WorkspaceChanges { projects: Map<string, string>; tasks: Map<string, string>; files: Map<string, File> }
export const emptyChanges = (): WorkspaceChanges => ({ projects: new Map(), tasks: new Map(), files: new Map() });

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      for (const store of ['projects', 'tasks', 'photos']) request.result.createObjectStore(store);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开本地数据库'));
    request.onblocked = () => reject(new Error('本地数据库被其他页面占用，请关闭旧页面后重试'));
  });
}
function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('本地保存已中断'));
    transaction.onerror = () => reject(transaction.error || new Error('本地保存失败'));
  });
}
function encodeTask(task: ReconstructionTask): StoredTask {
  return { ...task, thumbnailUrl: task.thumbnailUrl.startsWith('blob:') ? '' : task.thumbnailUrl,
    photos: task.photos?.map(({ file, ...photo }) => ({ ...photo,
      url: file || photo.url.startsWith('blob:') ? '' : photo.url,
      ...(file ? { fileKey: `${task.id}/${photo.id}` } : {}),
    })),
  };
}

/** Synchronize server deletions in every open tab, including associated photo copies. */
export async function syncDeletedJobs(): Promise<string[]> {
  if (!reconstructionApi) return [];
  let ids: string[];
  try {
    const response = await fetch(`${reconstructionApi}/api/deleted-jobs`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    const payload = await response.json();
    ids = payload.job_ids.filter((id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{12}$/.test(id));
  } catch { return []; } // Offline work remains available.
  ids.forEach(id => deletedJobs.add(id));
  if (!ids.length) return [];
  const db = await openDatabase();
  try {
    const tx = db.transaction(['tasks', 'photos'], 'readwrite');
    const done = complete(tx);
    const request = tx.objectStore('tasks').getAll();
    request.onsuccess = () => {
      const tasks: StoredTask[] = request.result;
      const retainedKeys = new Set(tasks.filter(task => !isDeleted(task)).flatMap(task => (task.photos || []).map(photo => photo.fileKey)));
      for (const task of tasks.filter(isDeleted)) {
        deletedTasks.add(task.id);
        tx.objectStore('tasks').delete(task.id);
        for (const photo of task.photos || []) {
          const key = photo.fileKey || `${task.id}/${photo.id}`;
          if (!retainedKeys.has(key)) tx.objectStore('photos').delete(key);
        }
      }
    };
    await done;
    ids.forEach(id => localStorage.removeItem(`3dgs-result-${id}`));
    return ids;
  } finally { db.close(); }
}

export async function loadLocalWorkspace(changes: WorkspaceChanges): Promise<Workspace> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['projects', 'tasks'], 'readonly');
    const [projects, storedTasks] = await Promise.all([
      result<Project[]>(tx.objectStore('projects').getAll()),
      result<StoredTask[]>(tx.objectStore('tasks').getAll()),
    ]);
    const files = new Map<string, File>();
    const fileKeys = [...new Set(storedTasks.flatMap(task => (task.photos || []).flatMap(photo => photo.fileKey ? [photo.fileKey] : [])))];
    if (fileKeys.length) {
      const read = db.transaction('photos', 'readonly');
      await Promise.all(fileKeys.map(async key => {
        const file = await result<File | undefined>(read.objectStore('photos').get(key));
        if (!file) throw new Error('本地照片文件缺失，已停止自动保存以保护现有记录');
        files.set(key, file);
      }));
    }
    const tasks = storedTasks.map(task => ({ ...task, photos: task.photos?.map(({ fileKey, ...photo }) => {
      const file = fileKey ? files.get(fileKey) : undefined;
      return { ...photo, ...(file ? { file, url: URL.createObjectURL(file) } : {}) };
    }) }));
    projects.forEach(project => changes.projects.set(project.id, JSON.stringify(project)));
    storedTasks.forEach(task => changes.tasks.set(task.id, JSON.stringify(task)));
    files.forEach((file, key) => changes.files.set(key, file));
    return { projects, tasks };
  } finally { db.close(); }
}

/** Atomic metadata + file storage. Only changed records are written, so an idle tab
 * cannot overwrite projects created in another tab. No browser blob URLs are persisted. */
export async function saveLocalWorkspace(workspace: Workspace, changes: WorkspaceChanges): Promise<void> {
  const projectIds = new Set(workspace.projects.map(project => project.id));
  const projects = workspace.projects.filter(project => changes.projects.get(project.id) !== JSON.stringify(project));
  const tasks = workspace.tasks.filter(task => projectIds.has(task.projectId) && !isDeleted(task)).map(task => ({ original: task, stored: encodeTask(task) }));
  const dirtyTasks = tasks.filter(({ original, stored }) => changes.tasks.get(stored.id) !== JSON.stringify(stored)
    || original.photos?.some(photo => photo.file && changes.files.get(`${original.id}/${photo.id}`) !== photo.file));
  if (!projects.length && !dirtyTasks.length) return;
  const db = await openDatabase();
  try {
    const tx = db.transaction(['projects', 'tasks', 'photos'], 'readwrite');
    const done = complete(tx);
    for (const project of projects) tx.objectStore('projects').put(project, project.id);
    for (const { original, stored } of dirtyTasks) {
      if (isDeleted(stored)) continue;
      for (const photo of original.photos || []) {
        const key = `${original.id}/${photo.id}`;
        if (photo.file && changes.files.get(key) !== photo.file) tx.objectStore('photos').put(photo.file, key);
      }
      tx.objectStore('tasks').put(stored, stored.id);
    }
    await done;
    projects.forEach(project => changes.projects.set(project.id, JSON.stringify(project)));
    dirtyTasks.forEach(({ original, stored }) => {
      changes.tasks.set(stored.id, JSON.stringify(stored));
      original.photos?.forEach(photo => { if (photo.file) changes.files.set(`${original.id}/${photo.id}`, photo.file); });
    });
  } finally { db.close(); }
}
