/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { ProjectList } from './components/ProjectList';
import { ReconstructionViewer } from './components/ReconstructionViewer';
import { TaskDrawer } from './components/TaskDrawer';
import { GcpEditor } from './components/GcpEditor';
import { CoordinateSystemModal } from './components/CoordinateSystemModal';
import { NewTaskModal } from './components/NewTaskModal';
import { QualityReportModal } from './components/QualityReportModal';
import { DualScreenComparison } from './components/DualScreenComparison';
import { DeveloperSdkHub } from './components/DeveloperSdkHub';
import { ReconstructionProgressModal } from './components/ReconstructionProgressModal';
import { reconstructionApi } from './lib/reconstructionApi';
import { LocalWorkspaceStorage } from './components/LocalWorkspaceStorage';

import {
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  ASSET_TERRAIN,
  ASSET_ORTHOPHOTO,
} from './data/mockData';
import {
  Project,
  ReconstructionTask,
  ComputationMode,
  TaskType,
  ReconstructionParams,
  PhotoAsset,
  ReconstructionJob,
} from './types/reconstruction';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'projects' | 'viewer' | 'gcp' | 'sdk' | 'dual' | 'report'>('projects');
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ReconstructionTask[]>(INITIAL_TASKS);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [activeTask, setActiveTask] = useState<ReconstructionTask>(INITIAL_TASKS[0]);
  const [activeLeftTab, setActiveLeftTab] = useState<'results' | 'params'>('results');
  const [computationMode, setComputationMode] = useState<ComputationMode>('desktop');

  // Modals
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showCrsModal, setShowCrsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReconstructionModal, setShowReconstructionModal] = useState(false);
  const [pipelineJobId, setPipelineJobId] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Remove the three deleted seed records from an already-open session as well.
  useEffect(() => {
    const deletedIds = new Set(['proj-3dgs', 'proj-smartpark', 'proj-bridge-inspect']);
    setProjects(previous => previous.filter(project => !deletedIds.has(project.id)));
  }, []);

  // A completed local result can be reopened without uploading or training again.
  useEffect(() => {
    // IndexedDB must finish restoring first: otherwise its older processing state
    // can overwrite the authoritative completed API response and artifact URL.
    if (!workspaceLoaded) return;
    const id = new URLSearchParams(window.location.search).get('job');
    if (!reconstructionApi || !id || !/^[a-f0-9]{12}$/.test(id)) return;
    const abort = new AbortController();
    void fetch(`${reconstructionApi}/api/jobs/${id}`, { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('本地成果不存在');
        const job: ReconstructionJob = await response.json();
        if (abort.signal.aborted || job.status !== 'completed' || !job.artifact) return;
        let saved: Partial<ReconstructionTask> & { projectName?: string } = {};
        try { saved = JSON.parse(localStorage.getItem(`3dgs-result-${id}`) || '{}'); } catch { /* Storage is optional. */ }
        const timestamp = (value?: number) => value ? new Date(value * 1000).toLocaleString() : '—';
        const restored: ReconstructionTask = {
          ...INITIAL_TASKS[0], ...saved,
          id: saved.id || `result-${id}`, projectId: saved.projectId || 'proj-local-results',
          name: saved.name || `本地重建 ${id.slice(0, 6)}`,
          status: 'completed', progress: 100, pipelineJobId: id,
          artifactUrl: `${reconstructionApi}/api/jobs/${id}/artifact/${encodeURIComponent(job.artifact)}`,
          softwareVersion: 'pycolmap + Brush', thumbnailUrl: '', photos: [],
          photoCount: job.image_count || 0, calibratedPhotoCount: job.registered_images || 0,
          captureDate: saved.captureDate || '未知拍摄日期', createdAt: timestamp(job.created_at),
          startedAt: timestamp(job.started_at), completedAt: timestamp(job.finished_at),
          params: { ...INITIAL_TASKS[0].params, ...saved.params, template: 'gaussian_splat',
            performanceProfile: job.config?.profile || saved.params?.performanceProfile || 'preview',
            humanRemoval: false, waterFlattening: false, crs: saved.params?.crs || '本地坐标系' },
          reportSummary: { tiePointsCount: job.sparse_points || 0,
            meanReprojectionError: job.mean_reprojection_error || 0,
            groundSampleDistance: 0, overlapRatio: 0, areaCoveredKm2: 0 },
        };
        const project: Project = { id: restored.projectId, name: saved.projectName || '本地重建成果', badge: 'GS',
          updatedAt: '已保存', taskCount: 1, photoCount: restored.photoCount,
          thumbnailUrl: '', description: '从本地训练文件加载的真实成果' };
        setProjects((previous) => previous.some(item => item.id === project.id) ? previous : [project, ...previous]);
        setTasks((previous) => {
          const persisted = previous.find(item => item.id === restored.id);
          return [{ ...restored, photos: persisted?.photos || restored.photos }, ...previous.filter((item) => item.id !== restored.id)];
        });
        setActiveProject(project);
        setActiveTask(restored);
        setCurrentTab('viewer');
      }).catch((error) => { if (!abort.signal.aborted) setPipelineError(String(error)); });
    return () => abort.abort();
  }, [workspaceLoaded]);

  const selectedTask = tasks.find(task => task.id === activeTask.id) || activeTask;

  // Switch project
  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    const projTasks = tasks.filter((t) => t.projectId === project.id);
    if (projTasks.length > 0) {
      setActiveTask(projTasks[0]);
    } else {
      setCurrentTab('projects');
      setShowNewTaskModal(true);
      return;
    }
    setCurrentTab('viewer');
  };

  // Create Project
  const handleCreateProject = (name: string, description: string) => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name,
      badge: 'GS',
      updatedAt: '刚刚更新',
      taskCount: 1,
      photoCount: 0,
      thumbnailUrl: ASSET_TERRAIN,
      description: description || '实景三维与高斯泼溅空间重建工程',
    };
    setProjects([newProj, ...projects]);
    setActiveProject(newProj);

    // Initial default task for project
    const newTask: ReconstructionTask = {
      id: `task-${Date.now()}`,
      projectId: newProj.id,
      name: `${name}-20261001`,
      taskType: 'visible_light',
      quality: 'ultra',
      status: 'ready',
      progress: 0,
      computationMode,
      captureDate: '2026-10-01',
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      startedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      softwareVersion: '3DGSMAP Desktop(3.2.3)',
      photoCount: 0,
      calibratedPhotoCount: 0,
      photos: [],
      thumbnailUrl: ASSET_TERRAIN,
      params: {
        name: `${name}-20261001`,
        taskType: 'visible_light',
        quality: 'ultra',
        template: 'gaussian_splat',
        crs: '本地坐标系',
        usePosPrior: true,
        roiEnabled: false,
        output2D: true,
        generateDom: true,
        generateDsm: true,
        domResolutionCm: 2.5,
        output3D: true,
        meshEnabled: true,
        meshFormats: ['B3DM', 'OSGB'],
        waterFlattening: false,
        meshSimplifyRatio: 100,
        removeFloatingOutliers: true,
        pointCloudEnabled: true,
        pointCloudFormats: ['PNTS', 'LAS'],
        gaussianSplatEnabled: true,
        gaussianFormats: ['PlayCanvas LOD', 'PLY'],
        maxGaussianPointsMode: 'auto',
        customMaxPoints: 4000000,
        humanRemoval: false,
      },
    };
    setTasks([newTask, ...tasks]);
    setActiveTask(newTask);
    setCurrentTab('viewer');
  };

  // Create Task
  const handleConfirmNewTask = (taskType: TaskType, name: string) => {
    if (!activeProject) return;
    const newTask: ReconstructionTask = {
      id: `task-${Date.now()}`,
      projectId: activeProject.id,
      name,
      taskType,
      quality: 'ultra',
      status: 'ready',
      progress: 0,
      computationMode,
      captureDate: '2026-10-01',
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      startedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      softwareVersion: '3DGSMAP Desktop(3.2.3)',
      photoCount: 0,
      calibratedPhotoCount: 0,
      photos: [],
      thumbnailUrl: taskType === 'lidar' ? ASSET_ORTHOPHOTO : ASSET_TERRAIN,
      params: {
        name,
        taskType,
        quality: 'ultra',
        template: 'gaussian_splat',
        crs: '本地坐标系',
        usePosPrior: true,
        roiEnabled: false,
        output2D: true,
        generateDom: true,
        generateDsm: true,
        domResolutionCm: 2.0,
        output3D: true,
        meshEnabled: true,
        meshFormats: ['B3DM', 'OSGB'],
        waterFlattening: false,
        meshSimplifyRatio: 100,
        removeFloatingOutliers: true,
        pointCloudEnabled: true,
        pointCloudFormats: ['PNTS', 'LAS'],
        gaussianSplatEnabled: true,
        gaussianFormats: ['PlayCanvas LOD', 'PLY'],
        maxGaussianPointsMode: 'auto',
        customMaxPoints: 5000000,
        humanRemoval: false,
      },
    };

    setTasks([newTask, ...tasks]);
    setActiveTask(newTask);
    setActiveLeftTab('params');
    setCurrentTab('viewer');
  };

  // Update Task Parameters
  const handleUpdateParams = (newParams: ReconstructionParams) => {
    const updated = { ...selectedTask, params: newParams };
    setActiveTask(updated);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  // Update Photos imported into the task
  const handleUpdatePhotos = (newPhotos: PhotoAsset[]) => {
    const updated: ReconstructionTask = {
      ...selectedTask,
      photos: newPhotos,
      photoCount: newPhotos.length,
      calibratedPhotoCount: newPhotos.filter((p) => p.isCalibrated).length,
    };
    setActiveTask(updated);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

    // Sync project photo count
    setActiveProject((proj) => proj ? ({
      ...proj,
      photoCount: newPhotos.length,
    }) : null);
    setProjects(previous => previous.map(project => project.id === selectedTask.projectId
      ? { ...project, photoCount: newPhotos.length } : project));
  };

  const submissionPending = useRef(false);

  // Start Reconstruction Pipeline
  const handleStartReconstruction = async () => {
    if (submissionPending.current) return;
    setPipelineError(null);
    if (!reconstructionApi) {
      setPipelineError('此站点为界面预览。真实照片重建请在本地启动 COLMAP / Brush 服务后，访问 http://127.0.0.1:3000。');
      return;
    }
    const currentTask = selectedTask;
    const files = (currentTask.photos || []).filter((photo) => photo.file).map((photo) => photo.file as File);
    if (files.length < 2) {
      setPipelineError('请先导入至少 2 张本地照片。预设样本只有演示元数据，无法提交给 COLMAP。');
      return;
    }

    submissionPending.current = true;
    const form = new FormData();
    form.append('metadata', JSON.stringify({
      taskName: selectedTask.name,
      profile: selectedTask.params.performanceProfile || 'preview',
      matching: selectedTask.params.matchingMode || 'exhaustive',
      ...(selectedTask.params.maxGaussianPointsMode === 'custom'
        ? { maxGaussianPoints: selectedTask.params.customMaxPoints } : {}),
    }));
    files.forEach((file) => form.append('images', file, file.name));

    try {
      const health = await fetch(`${reconstructionApi}/api/health`, { signal: AbortSignal.timeout(10000) });
      const service = await health.json();
      if (!health.ok || service.api_version !== 2) {
        throw new Error('优化代码已就绪，但当前服务仍是旧版本。请等现有任务结束后重启本地 API，再使用新的性能档位。');
      }
      const response = await fetch(`${reconstructionApi}/api/reconstruct`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok || !payload.job_id) throw new Error(payload.error || '无法启动本地重建服务');
      const updated = { ...selectedTask, status: 'processing' as const, progress: 0, pipelineJobId: payload.job_id };
      setActiveTask(updated);
      setTasks((prev) => prev.map((task) => task.id === updated.id ? updated : task));
      setPipelineJobId(payload.job_id);
      setShowReconstructionModal(true);
    } catch (error) {
      setPipelineError(error instanceof Error ? error.message : '无法连接本地重建服务，请确认 API 已启动');
    } finally {
      submissionPending.current = false;
    }
  };

  // Finish Reconstruction from progress modal
  const handleFinishReconstruction = (job: ReconstructionJob) => {
    if (job.status !== 'completed' || !job.artifact) return;
    const completedTask: ReconstructionTask = {
      ...selectedTask,
      status: 'completed',
      progress: 100,
      pipelineJobId: job.id,
      params: { ...selectedTask.params, performanceProfile: job.config?.profile || selectedTask.params.performanceProfile },
      artifactUrl: `${reconstructionApi}/api/jobs/${job.id}/artifact/${encodeURIComponent(job.artifact)}`,
      softwareVersion: 'pycolmap + Brush 0.3.0',
      completedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      currentStepMessage: 'COLMAP 相机解算与 Brush 高斯训练完成，PLY 已生成',
      reportSummary: {
        tiePointsCount: job.sparse_points || 0,
        meanReprojectionError: job.mean_reprojection_error || 0,
        groundSampleDistance: 0,
        overlapRatio: 0,
        areaCoveredKm2: 0,
      },
    };

    setActiveTask(completedTask);
    try {
      const { photos, ...metadata } = completedTask;
      localStorage.setItem(`3dgs-result-${job.id}`, JSON.stringify({ ...metadata, projectName: activeProject?.name }));
    } catch { /* The result remains available from the local API without browser storage. */ }
    const resultUrl = new URL(window.location.href);
    resultUrl.searchParams.set('job', job.id);
    window.history.replaceState(null, '', resultUrl);
    setTasks((prev) => prev.map((t) => (t.id === completedTask.id ? completedTask : t)));
    setShowReconstructionModal(false);
    setActiveLeftTab('results');
    setCurrentTab('viewer');
    setPipelineJobId(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#121316] text-[#E1E4EA] font-sans antialiased overflow-hidden">
      {/* Top Bar Contract (3 Zones) */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'report') {
            setShowReportModal(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        computationMode={computationMode}
        onChangeComputationMode={setComputationMode}
        activeProjectName={activeProject?.name}
        activeTaskName={selectedTask?.name}
      />

      <LocalWorkspaceStorage projects={projects} tasks={tasks}
        onRemoveJobs={(ids) => {
          setTasks(previous => previous.filter(task => !ids.includes(task.pipelineJobId || '')));
          if (ids.includes(pipelineJobId || '') || ids.includes(selectedTask.pipelineJobId || '')) {
            setShowReconstructionModal(false);
            setPipelineJobId(null);
            setActiveProject(null);
            setCurrentTab('projects');
          }
        }}
        onRestore={(workspace) => {
          const deletedIds = new Set(['proj-3dgs', 'proj-smartpark', 'proj-bridge-inspect']);
          const savedProjects = workspace.projects.filter(project => !deletedIds.has(project.id));
          const savedTasks = workspace.tasks.filter(task => savedProjects.some(project => project.id === task.projectId));
          setProjects(previous => [...savedProjects, ...previous.filter(project => !savedProjects.some(saved => saved.id === project.id))]);
          setTasks(previous => [...savedTasks, ...previous.filter(task => !savedTasks.some(saved => saved.id === task.id))]);
          setActiveProject(previous => savedProjects.find(project => project.id === previous?.id) || previous);
          setActiveTask(previous => savedTasks.find(task => task.id === previous.id) || previous);
          setWorkspaceLoaded(true);
        }} />

      {/* Main Content Router */}
      {!reconstructionApi && (
        <div className="bg-amber-950 px-4 py-2 text-xs text-amber-200">
          公网界面预览 · 示例场景为演示数据 · 照片解算与高斯训练需要本地 COLMAP / Brush 服务
        </div>
      )}
      <main className="flex-1 flex overflow-hidden">
        {(currentTab === 'projects' || (currentTab === 'viewer' && !activeProject)) && (
          <ProjectList
            projects={projects.map(project => {
              const projectTasks = tasks.filter(task => task.projectId === project.id);
              const firstPhoto = projectTasks.flatMap(task => task.photos || [])
                .find(photo => photo.file || photo.url.startsWith('blob:'));
              return { ...project, taskCount: projectTasks.length,
                thumbnailUrl: firstPhoto?.url || '',
                thumbnailJobId: projectTasks.find(task => task.pipelineJobId)?.pipelineJobId,
                photoCount: projectTasks.reduce((sum, task) => sum + task.photoCount, 0) };
            })}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
          />
        )}

        {activeProject && currentTab === 'viewer' && activeLeftTab === 'results' && (
          <ReconstructionViewer
            project={activeProject}
            tasks={tasks.filter((t) => t.projectId === activeProject.id)}
            activeTask={selectedTask}
            onSelectTask={setActiveTask}
            onOpenNewTaskModal={() => setShowNewTaskModal(true)}
            onOpenReportModal={() => setShowReportModal(true)}
            onOpenDualScreen={() => setCurrentTab('dual')}
            onOpenGcpEditor={() => setCurrentTab('gcp')}
            onOpenSdkHub={() => setCurrentTab('sdk')}
            onStartReconstruction={handleStartReconstruction}
            activeLeftTab={activeLeftTab}
            onChangeLeftTab={setActiveLeftTab}
          />
        )}

        {currentTab === 'viewer' && activeLeftTab === 'params' && (
          <TaskDrawer
            key={selectedTask.id}
            task={selectedTask}
            onUpdateParams={handleUpdateParams}
            onUpdatePhotos={handleUpdatePhotos}
            onBack={() => setActiveLeftTab('results')}
            onOpenGcpModal={() => setCurrentTab('gcp')}
            onOpenCrsModal={() => setShowCrsModal(true)}
            onStartReconstruction={handleStartReconstruction}
          />
        )}

        {currentTab === 'gcp' && (
          <GcpEditor
            key={`${selectedTask.projectId}/${selectedTask.id}`}
            photos={selectedTask.photos || []}
            jobId={selectedTask.pipelineJobId}
            onBack={() => setCurrentTab('viewer')}
            onOpenCrsModal={() => setShowCrsModal(true)}
            currentCrs={selectedTask.params.crs}
          />
        )}

        {currentTab === 'dual' && (
          <DualScreenComparison
            task={selectedTask}
            onBack={() => setCurrentTab('viewer')}
          />
        )}

        {currentTab === 'sdk' && <DeveloperSdkHub
          project={activeProject}
          task={activeProject && selectedTask.projectId === activeProject.id ? selectedTask : null}
          tasks={tasks.filter(task => task.projectId === activeProject?.id)}
          onSelectTask={setActiveTask}
        />}
      </main>

      {/* Global Modals */}
      {showNewTaskModal && (
        <NewTaskModal
          onConfirm={handleConfirmNewTask}
          onClose={() => setShowNewTaskModal(false)}
        />
      )}

      {showCrsModal && (
        <CoordinateSystemModal
          currentCrs={selectedTask.params.crs}
          onSelect={(crsName) => {
            handleUpdateParams({ ...selectedTask.params, crs: crsName });
          }}
          onClose={() => setShowCrsModal(false)}
        />
      )}

      {showReportModal && (
        <QualityReportModal
          key={selectedTask.pipelineJobId || selectedTask.id}
          task={selectedTask}
          projectName={projects.find(project => project.id === selectedTask.projectId)?.name}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {showReconstructionModal && (
        <ReconstructionProgressModal
          task={selectedTask}
          jobId={pipelineJobId}
          onFinish={handleFinishReconstruction}
          onCancel={() => setShowReconstructionModal(false)}
        />
      )}
      {pipelineError && (
        <div className="fixed bottom-5 right-5 z-[10000] max-w-md rounded-xl border border-red-500/40 bg-[#27191d] px-4 py-3 text-xs text-red-200 shadow-2xl">
          {pipelineError}
          <button className="ml-3 text-red-300 underline" onClick={() => setPipelineError(null)}>关闭</button>
        </div>
      )}
    </div>
  );
}
