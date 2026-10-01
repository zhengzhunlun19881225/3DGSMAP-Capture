/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  const [currentTab, setCurrentTab] = useState<'projects' | 'viewer' | 'gcp' | 'sdk' | 'dual' | 'report'>('viewer');
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [activeProject, setActiveProject] = useState<Project>(INITIAL_PROJECTS[0]);
  const [tasks, setTasks] = useState<ReconstructionTask[]>(INITIAL_TASKS);
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

  // Switch project
  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    const projTasks = tasks.filter((t) => t.projectId === project.id);
    if (projTasks.length > 0) {
      setActiveTask(projTasks[0]);
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
      photoCount: 120,
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
      photoCount: 120,
      calibratedPhotoCount: 120,
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
        humanRemoval: true,
      },
    };
    setTasks([newTask, ...tasks]);
    setActiveTask(newTask);
    setCurrentTab('viewer');
  };

  // Create Task
  const handleConfirmNewTask = (taskType: TaskType, name: string) => {
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
      photoCount: 240,
      calibratedPhotoCount: 240,
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
        humanRemoval: true,
      },
    };

    setTasks([newTask, ...tasks]);
    setActiveTask(newTask);
    setActiveLeftTab('params');
    setCurrentTab('viewer');
  };

  // Update Task Parameters
  const handleUpdateParams = (newParams: ReconstructionParams) => {
    const updated = { ...activeTask, params: newParams };
    setActiveTask(updated);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  // Update Photos imported into the task
  const handleUpdatePhotos = (newPhotos: PhotoAsset[]) => {
    const updated: ReconstructionTask = {
      ...activeTask,
      photos: newPhotos,
      photoCount: newPhotos.length,
      calibratedPhotoCount: newPhotos.filter((p) => p.isCalibrated).length,
    };
    setActiveTask(updated);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

    // Sync project photo count
    setActiveProject((proj) => ({
      ...proj,
      photoCount: Math.max(proj.photoCount, newPhotos.length),
    }));
  };

  // Start Reconstruction Pipeline
  const handleStartReconstruction = async () => {
    setPipelineError(null);
    if (!reconstructionApi) {
      setPipelineError('此站点为界面预览。真实照片重建请在本地启动 COLMAP / Brush 服务后，访问 http://127.0.0.1:3000。');
      return;
    }
    const files = (activeTask.photos || []).filter((photo) => photo.file).map((photo) => photo.file as File);
    if (files.length < 2) {
      setPipelineError('请先导入至少 2 张本地照片。预设样本只有演示元数据，无法提交给 COLMAP。');
      return;
    }

    const form = new FormData();
    form.append('metadata', JSON.stringify({
      taskName: activeTask.name,
      steps: activeTask.params.quality === 'ultra' ? 30000 : activeTask.params.quality === 'high' ? 18000 : 8000,
      maxGaussianPoints: activeTask.params.maxGaussianPointsMode === 'auto'
        ? 4000000
        : activeTask.params.customMaxPoints,
      maxResolution: activeTask.params.quality === 'ultra' ? 1920 : 1280,
    }));
    files.forEach((file) => form.append('images', file, file.name));

    try {
      const response = await fetch(`${reconstructionApi}/api/reconstruct`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok || !payload.job_id) throw new Error(payload.error || '无法启动本地重建服务');
      const updated = { ...activeTask, status: 'processing' as const, progress: 0, pipelineJobId: payload.job_id };
      setActiveTask(updated);
      setTasks((prev) => prev.map((task) => task.id === updated.id ? updated : task));
      setPipelineJobId(payload.job_id);
      setShowReconstructionModal(true);
    } catch (error) {
      setPipelineError(error instanceof Error ? error.message : '无法连接本地重建服务，请确认 API 已启动');
    }
  };

  // Finish Reconstruction from progress modal
  const handleFinishReconstruction = (job: ReconstructionJob) => {
    if (job.status !== 'completed' || !job.artifact) return;
    const completedTask: ReconstructionTask = {
      ...activeTask,
      status: 'completed',
      progress: 100,
      pipelineJobId: job.id,
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
        activeTaskName={activeTask?.name}
      />

      {/* Main Content Router */}
      {!reconstructionApi && (
        <div className="bg-amber-950 px-4 py-2 text-xs text-amber-200">
          公网界面预览 · 示例场景为演示数据 · 照片解算与高斯训练需要本地 COLMAP / Brush 服务
        </div>
      )}
      <main className="flex-1 flex overflow-hidden">
        {currentTab === 'projects' && (
          <ProjectList
            projects={projects}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
          />
        )}

        {currentTab === 'viewer' && activeLeftTab === 'results' && (
          <ReconstructionViewer
            project={activeProject}
            tasks={tasks.filter((t) => t.projectId === activeProject.id || tasks.length <= 4)}
            activeTask={activeTask}
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
            task={activeTask}
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
            onBack={() => setCurrentTab('viewer')}
            onOpenCrsModal={() => setShowCrsModal(true)}
            currentCrs={activeTask.params.crs}
          />
        )}

        {currentTab === 'dual' && (
          <DualScreenComparison
            task={activeTask}
            onBack={() => setCurrentTab('viewer')}
          />
        )}

        {currentTab === 'sdk' && <DeveloperSdkHub />}
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
          currentCrs={activeTask.params.crs}
          onSelect={(crsName) => {
            handleUpdateParams({ ...activeTask.params, crs: crsName });
          }}
          onClose={() => setShowCrsModal(false)}
        />
      )}

      {showReportModal && (
        <QualityReportModal
          task={activeTask}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {showReconstructionModal && (
        <ReconstructionProgressModal
          task={activeTask}
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
