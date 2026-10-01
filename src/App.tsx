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
      softwareVersion: 'MipMap Desktop(3.2.3)',
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
      softwareVersion: 'MipMap Desktop(3.2.3)',
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
  const handleStartReconstruction = () => {
    setShowReconstructionModal(true);
  };

  // Finish Reconstruction from progress modal
  const handleFinishReconstruction = () => {
    const pCount = activeTask.photoCount || 240;
    const isUltra = activeTask.params.quality === 'ultra';
    const isHigh = activeTask.params.quality === 'high';

    const completedTask: ReconstructionTask = {
      ...activeTask,
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      currentStepMessage: '建模完成，三维瓦片准备就绪',
      reportSummary: {
        tiePointsCount: Math.round(pCount * (isUltra ? 4500 : isHigh ? 3300 : 2100)),
        meanReprojectionError: isUltra ? 0.32 : isHigh ? 0.42 : 0.65,
        groundSampleDistance: isUltra ? 1.84 : isHigh ? 2.30 : 3.50,
        overlapRatio: isUltra ? 86.4 : 78.5,
        areaCoveredKm2: Math.max(0.4, Number(((pCount * 0.0035)).toFixed(2))),
      },
    };

    setActiveTask(completedTask);
    setTasks((prev) => prev.map((t) => (t.id === completedTask.id ? completedTask : t)));
    setShowReconstructionModal(false);
    setActiveLeftTab('results');
    setCurrentTab('viewer');
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
          onFinish={handleFinishReconstruction}
          onCancel={() => setShowReconstructionModal(false)}
        />
      )}
    </div>
  );
}
