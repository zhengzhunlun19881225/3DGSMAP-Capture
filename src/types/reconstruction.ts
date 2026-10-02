export type TaskType = 'visible_light' | 'lidar';

export type QualityLevel = 'ultra' | 'high' | 'medium';

export type ReconstructionStatus = 'ready' | 'processing' | 'completed' | 'failed';

export interface ReconstructionJob {
  id: string;
  status: ReconstructionStatus | 'queued';
  progress: number;
  stage: number;
  logs: string[];
  artifact?: string | null;
  registered_images?: number;
  sparse_points?: number;
  mean_reprojection_error?: number;
  error?: string;
  phase?: string;
  image_count?: number;
  feature_images?: number;
  training_step?: number;
  training_total?: number;
  steps_per_second?: number | null;
  eta_seconds?: number | null;
  created_at?: number;
  started_at?: number;
  finished_at?: number;
  config?: { label: string; steps: number; maxResolution: number; maxGaussianPoints: number; profile?: 'preview' | 'balanced' | 'quality' };

}

export type TemplateType = 'at' | 'mesh' | 'gaussian_splat' | 'fast_2d' | 'fast_3d';

export type ComputationMode = 'desktop' | 'local_cluster' | 'cloud_serverless';

export type CoordinateSystem = {
  id: string;
  name: string;
  epsg?: string;
  category: 'common' | 'projected' | 'geographic' | 'local' | 'custom';
  description: string;
};

export interface PhotoAsset {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  lat: number;
  lon: number;
  alt: number;
  focalLength: number;
  isCalibrated: boolean;
  /** Original browser file retained for the local reconstruction upload. */
  file?: File;
  markedGCPs?: { gcpId: string; x: number; y: number }[];
}

export interface GroundControlPoint {
  id: string;
  name: string;
  type: 'control' | 'check';
  markCount: number;
  x: number; // or Lon
  y: number; // or Lat
  z: number; // Altitude
  reprojectionErrorPx: number;
  errorXCm: number;
  errorYCm: number;
  errorZCm: number;
}

export interface ReconstructionParams {
  performanceProfile?: 'preview' | 'balanced' | 'quality';
  matchingMode?: 'exhaustive' | 'sequential';
  name: string;
  taskType: TaskType;
  quality: QualityLevel;
  template: TemplateType;
  crs: string;
  usePosPrior: boolean;
  roiEnabled: boolean;
  
  // 2D Output options
  output2D: boolean;
  generateDom: boolean;
  generateDsm: boolean;
  domResolutionCm: number;
  
  // 3D Output options
  output3D: boolean;
  // Mesh
  meshEnabled: boolean;
  meshFormats: ('B3DM' | 'OSGB' | 'OBJ' | 'PLY')[];
  waterFlattening: boolean;
  meshSimplifyRatio: number; // 10, 25, 50, 100
  removeFloatingOutliers: boolean;
  
  // Point Cloud
  pointCloudEnabled: boolean;
  pointCloudFormats: ('PNTS' | 'LAS' | 'PLY')[];
  
  // 3DGS Gaussian Splatting
  gaussianSplatEnabled: boolean;
  gaussianFormats: ('PlayCanvas LOD' | 'PLY' | 'Splat' | 'SPZ')[];
  maxGaussianPointsMode: 'auto' | 'custom';
  customMaxPoints: number;
  humanRemoval: boolean;
}

export interface ReconstructionTask {
  id: string;
  projectId: string;
  name: string;
  taskType: TaskType;
  quality: QualityLevel;
  status: ReconstructionStatus;
  progress: number;
  currentStepMessage?: string;
  computationMode: ComputationMode;
  captureDate?: string;
  createdAt: string;
  startedAt: string;
  completedAt?: string;
  softwareVersion: string;
  photoCount: number;
  calibratedPhotoCount: number;
  photos?: PhotoAsset[];
  params: ReconstructionParams;
  thumbnailUrl: string;
  pipelineJobId?: string;
  artifactUrl?: string;
  reportSummary?: {
    tiePointsCount: number;
    meanReprojectionError: number; // px
    groundSampleDistance: number; // cm/px
    overlapRatio: number; // percentage
    areaCoveredKm2: number;
  };
}

export interface Project {
  id: string;
  name: string;
  badge: string;
  updatedAt: string;
  taskCount: number;
  photoCount: number;
  thumbnailUrl: string;
  description: string;
}

export interface SdkEndpoint {
  method: 'GET' | 'POST' | 'DELETE' | 'WS';
  path: string;
  title: string;
  description: string;
  category: 'Aerial Triangulation' | 'Orthophoto (DOM)' | '3D Mesh' | 'Gaussian Splatting' | 'GCP & Calibration' | 'Cluster Management';
  pythonExample: string;
  cppExample: string;
  nodeExample: string;
  curlExample: string;
  parameters: { name: string; type: string; required: boolean; description: string }[];
  responseSample: string;
}
