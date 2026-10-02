import {
  Project,
  ReconstructionTask,
  GroundControlPoint,
  PhotoAsset,
  CoordinateSystem,
  SdkEndpoint,
} from '../types/reconstruction';

// Generated image assets from batch generation
export const ASSET_TERRAIN = '/src/assets/images/survey_aerial_terrain_1790825408866.jpg';
export const ASSET_ORTHOPHOTO = '/src/assets/images/orthophoto_satellite_map_1790825420592.jpg';
export const ASSET_DRONE_PHOTO = '/src/assets/images/drone_inspection_photo_1790825437111.jpg';

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_TASKS: ReconstructionTask[] = [
  {
    id: 'task-20260923',
    projectId: 'proj-3dgs',
    name: '3dgs-20260923',
    taskType: 'visible_light',
    quality: 'ultra',
    status: 'completed',
    progress: 100,
    currentStepMessage: '建模已完成，成果瓦片准备就绪',
    computationMode: 'desktop',
    captureDate: '未知拍摄日期',
    createdAt: '2026-09-23 13:16:02',
    startedAt: '2026-09-23 13:16:02',
    completedAt: '2026-09-23 16:41:44',
    softwareVersion: '3DGSMAP Desktop(3.2.3)',
    photoCount: 380,
    calibratedPhotoCount: 380,
    thumbnailUrl: ASSET_TERRAIN,
    reportSummary: {
      tiePointsCount: 1482920,
      meanReprojectionError: 0.42,
      groundSampleDistance: 1.84,
      overlapRatio: 84.6,
      areaCoveredKm2: 0.85,
    },
    params: {
      name: '3dgs-20260923',
      taskType: 'visible_light',
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
  },
  {
    id: 'task-20260929',
    projectId: 'proj-3dgs',
    name: '3dgs-20260929-Ortho',
    taskType: 'visible_light',
    quality: 'high',
    status: 'completed',
    progress: 100,
    currentStepMessage: '正射影像 DOM 瓦片构建完成',
    computationMode: 'local_cluster',
    captureDate: '2026-03-29',
    createdAt: '2026-03-29 09:20:11',
    startedAt: '2026-03-29 09:21:00',
    completedAt: '2026-03-29 10:45:18',
    softwareVersion: '3DGSMAP Desktop(3.2.3)',
    photoCount: 220,
    calibratedPhotoCount: 220,
    thumbnailUrl: ASSET_ORTHOPHOTO,
    reportSummary: {
      tiePointsCount: 890410,
      meanReprojectionError: 0.38,
      groundSampleDistance: 2.1,
      overlapRatio: 78.2,
      areaCoveredKm2: 1.2,
    },
    params: {
      name: '3dgs-20260929-Ortho',
      taskType: 'visible_light',
      quality: 'high',
      template: 'fast_2d',
      crs: 'CGCS2000 / 3度分带 39带',
      usePosPrior: true,
      roiEnabled: false,
      output2D: true,
      generateDom: true,
      generateDsm: true,
      domResolutionCm: 3.0,
      output3D: false,
      meshEnabled: false,
      meshFormats: ['OSGB'],
      waterFlattening: true,
      meshSimplifyRatio: 50,
      removeFloatingOutliers: false,
      pointCloudEnabled: false,
      pointCloudFormats: ['LAS'],
      gaussianSplatEnabled: false,
      gaussianFormats: ['PLY'],
      maxGaussianPointsMode: 'auto',
      customMaxPoints: 2000000,
      humanRemoval: false,
    },
  },
  {
    id: 'task-20260930',
    projectId: 'proj-3dgs',
    name: '3dgs-20260930',
    taskType: 'visible_light',
    quality: 'high',
    status: 'ready',
    progress: 0,
    currentStepMessage: '就绪，等待下发空三计算任务',
    computationMode: 'desktop',
    captureDate: '未知拍摄日期',
    createdAt: '2026-09-30 19:40:00',
    startedAt: '2026-09-30 19:40:00',
    softwareVersion: '3DGSMAP Desktop(3.2.3)',
    photoCount: 84,
    calibratedPhotoCount: 0,
    thumbnailUrl: ASSET_DRONE_PHOTO,
    params: {
      name: '3dgs-20260930',
      taskType: 'visible_light',
      quality: 'high',
      template: 'gaussian_splat',
      crs: '本地坐标系',
      usePosPrior: true,
      roiEnabled: false,
      output2D: true,
      generateDom: true,
      generateDsm: false,
      domResolutionCm: 5.0,
      output3D: true,
      meshEnabled: true,
      meshFormats: ['B3DM', 'OSGB'],
      waterFlattening: false,
      meshSimplifyRatio: 100,
      removeFloatingOutliers: false,
      pointCloudEnabled: true,
      pointCloudFormats: ['PNTS', 'LAS'],
      gaussianSplatEnabled: true,
      gaussianFormats: ['PlayCanvas LOD', 'PLY'],
      maxGaussianPointsMode: 'auto',
      customMaxPoints: 3000000,
      humanRemoval: false,
    },
  },
];

export const MOCK_GCPS: GroundControlPoint[] = [
  {
    id: 'gcp-1',
    name: 'GCP_K01',
    type: 'control',
    markCount: 8,
    x: 114.305218,
    y: 30.592812,
    z: 42.15,
    reprojectionErrorPx: 0.34,
    errorXCm: 1.12,
    errorYCm: 0.98,
    errorZCm: 1.45,
  },
  {
    id: 'gcp-2',
    name: 'GCP_K02',
    type: 'control',
    markCount: 12,
    x: 114.307115,
    y: 30.594192,
    z: 45.82,
    reprojectionErrorPx: 0.28,
    errorXCm: 0.85,
    errorYCm: 0.72,
    errorZCm: 1.15,
  },
  {
    id: 'gcp-3',
    name: 'GCP_K03',
    type: 'control',
    markCount: 6,
    x: 114.303911,
    y: 30.595604,
    z: 39.40,
    reprojectionErrorPx: 0.41,
    errorXCm: 1.40,
    errorYCm: 1.15,
    errorZCm: 1.80,
  },
  {
    id: 'gcp-4',
    name: 'CHK_P01',
    type: 'check',
    markCount: 7,
    x: 114.306120,
    y: 30.593740,
    z: 43.10,
    reprojectionErrorPx: 0.39,
    errorXCm: 1.25,
    errorYCm: 1.05,
    errorZCm: 1.62,
  },
];

export const MOCK_PHOTOS: PhotoAsset[] = [
  {
    id: 'p-1',
    name: 'DJI_20260924_001.JPG',
    url: ASSET_DRONE_PHOTO,
    width: 5472,
    height: 3648,
    lat: 30.592815,
    lon: 114.305210,
    alt: 120.4,
    focalLength: 24,
    isCalibrated: true,
    markedGCPs: [{ gcpId: 'gcp-1', x: 2650, y: 1780 }],
  },
  {
    id: 'p-2',
    name: 'DJI_20260924_002.JPG',
    url: ASSET_TERRAIN,
    width: 5472,
    height: 3648,
    lat: 30.592980,
    lon: 114.305450,
    alt: 120.2,
    focalLength: 24,
    isCalibrated: true,
    markedGCPs: [{ gcpId: 'gcp-1', x: 2100, y: 1620 }],
  },
  {
    id: 'p-3',
    name: 'DJI_20260924_003.JPG',
    url: ASSET_ORTHOPHOTO,
    width: 5472,
    height: 3648,
    lat: 30.593410,
    lon: 114.306020,
    alt: 119.8,
    focalLength: 24,
    isCalibrated: true,
    markedGCPs: [{ gcpId: 'gcp-2', x: 3100, y: 1950 }],
  },
  {
    id: 'p-4',
    name: 'DJI_20260924_004.JPG',
    url: ASSET_DRONE_PHOTO,
    width: 5472,
    height: 3648,
    lat: 30.593850,
    lon: 114.306500,
    alt: 120.1,
    focalLength: 24,
    isCalibrated: true,
    markedGCPs: [{ gcpId: 'gcp-2', x: 1850, y: 1530 }],
  },
  {
    id: 'p-5',
    name: 'DJI_20260924_005.JPG',
    url: ASSET_TERRAIN,
    width: 5472,
    height: 3648,
    lat: 30.594210,
    lon: 114.307100,
    alt: 120.5,
    focalLength: 24,
    isCalibrated: true,
  },
];

export const COORDINATE_SYSTEMS: CoordinateSystem[] = [
  {
    id: 'wgs84',
    name: 'WGS 84 (GPS / 椭球高)',
    epsg: 'EPSG:4326',
    category: 'common',
    description: '全球地理坐标系，GPS、无人机机载POS常用默认坐标系',
  },
  {
    id: 'cgcs2000',
    name: 'China Geodetic Coordinate System 2000 (CGCS2000)',
    epsg: 'EPSG:4490',
    category: 'common',
    description: '中国国家2000大地坐标系统，国内测绘与自然资源行业标准',
  },
  {
    id: 'local_arbitrary',
    name: '本地坐标系 (Local Tangent Plane)',
    category: 'local',
    description: '以首张照片或场景中心为原点的三维笛卡尔直角坐标系 (米制)',
  },
  {
    id: 'cgcs2000_3degree_39',
    name: 'CGCS2000 / 3度分带 39带 (高斯克吕格)',
    epsg: 'EPSG:4527',
    category: 'projected',
    description: '投影坐标系，适用于中央经线 117°E 区域大比例尺地形图测绘',
  },
  {
    id: 'utm_50n',
    name: 'WGS 84 / UTM zone 50N',
    epsg: 'EPSG:32650',
    category: 'projected',
    description: '通用横轴墨卡托投影，广泛用于国际工程与无人机航测',
  },
];

export const SDK_ENDPOINTS: SdkEndpoint[] = [
  {
    method: 'POST',
    path: '/api/v1/reconstruction/tasks',
    title: '创建空间重建任务 (Create Task)',
    description: '提交无人机影像或激光雷达数据，启动空三、正射、3DGS或网格重建流水线',
    category: 'Aerial Triangulation',
    parameters: [
      { name: 'name', type: 'string', required: true, description: '任务自定义标识名称' },
      { name: 'task_type', type: 'string', required: true, description: '"visible_light" | "lidar"' },
      { name: 'images_path', type: 'string', required: true, description: '本地目录路径或云端 OSS/S3 URI' },
      { name: 'template', type: 'string', required: true, description: '"gaussian_splat" | "mesh" | "at" | "fast_2d"' },
      { name: 'crs', type: 'string', required: false, description: '目标坐标系，如 "EPSG:4490" 或 "LOCAL"' },
    ],
    pythonExample: `import map_reconstruct_sdk as mrs

# 1. 初始化客户端 (支持单机本地引擎 / 私有服务器集群 / 公有云)
client = mrs.Client(
    mode=mrs.EngineMode.LOCAL_CLUSTER,  # or mrs.EngineMode.DESKTOP, mrs.EngineMode.CLOUD
    host="http://192.168.1.100:8080",
    api_key="mrs_live_sec_9934afbc"
)

# 2. 配置重建参数
config = mrs.ReconstructionConfig(
    name="mountain-road-3dgs",
    task_type=mrs.TaskType.VISIBLE_LIGHT,
    template=mrs.Template.GAUSSIAN_SPLAT,
    quality=mrs.Quality.ULTRA,
    crs="EPSG:4490",
    # 高斯泼溅参数
    gaussian_splat=mrs.GaussianOptions(
        format=[mrs.SplatFormat.PLAYCANVAS_LOD, mrs.SplatFormat.PLY],
        max_points=5000000,
        remove_pedestrians=True
    ),
    # 同时输出高精网格与正射影像
    mesh=mrs.MeshOptions(formats=["OSGB", "B3DM"], simplify_ratio=0.8),
    ortho=mrs.OrthoOptions(enable_dom=True, resolution_cm=2.0)
)

# 3. 提交任务并监听进度流
task = client.create_task(
    image_dir="/mnt/survey_data/dji_mavic3e_raw/",
    config=config
)

print(f"Task started: {task.id}")
for event in task.stream_progress():
    print(f"[{event.phase}] {event.progress:.1f}% - {event.message}")

# 4. 获取成果下载或挂载路径
result = task.wait_for_completion()
print(f"3DGS Output: {result.gaussian_splat_url}")
print(f"DOM Ortho: {result.dom_tif_path}")`,
    cppExample: `#include <iostream>
#include <map_reconstruct_sdk/client.hpp>

int main() {
    // 桌面端 Native C++ 核心引擎调用 (直接驱动多卡 CUDA/TensorRT)
    mrs::EngineConfig engine_cfg;
    engine_cfg.gpu_ids = {0, 1}; // 双卡并行计算
    engine_cfg.memory_limit_gb = 48;
    
    mrs::ReconstructionEngine engine(engine_cfg);
    
    mrs::TaskParams params;
    params.name = "bridge_pier_dense";
    params.input_images_dir = "D:/DroneSurvey/BridgePhotos/";
    params.template_type = mrs::TemplateType::GaussianSplat;
    params.gaussian_points_limit = 4000000;
    params.export_b3dm = true;
    params.export_las = true;
    
    // 异步回调
    engine.StartReconstruction(params, [](const mrs::ProgressInfo& info) {
        std::cout << "[" << info.stage_name << "] " 
                  << info.percent << "% - " << info.detail_msg << std::endl;
    });
    
    engine.WaitUntilFinished();
    return 0;
}`,
    nodeExample: `import { MapReconstructClient, SplatFormat } from '@mipmap/reconstruct-sdk';

const client = new MapReconstructClient({
  endpoint: process.env.MIPMAP_API_URL || 'http://localhost:3000/api',
  token: 'mrs_dev_tok_88291a'
});

async function main() {
  const task = await client.reconstruction.create({
    name: 'smartpark-phase2',
    taskType: 'visible_light',
    images: ['s3://survey-bucket/flight-01/'],
    template: 'gaussian_splat',
    gaussianConfig: {
      formats: [SplatFormat.PLY, SplatFormat.PLAYCANVAS_LOD],
      humanRemoval: true
    }
  });

  console.log('Task submitted:', task.id);
}`,
    curlExample: `curl -X POST https://api.mipmap.internal/v1/reconstruction/tasks \\
  -H "Authorization: Bearer mrs_live_sec_9934afbc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "highway-3dgs-at",
    "task_type": "visible_light",
    "template": "gaussian_splat",
    "images_url": "s3://aerial-survey-raw/proj-2026/",
    "crs": "EPSG:4490",
    "quality": "ultra",
    "gaussian_splat": {
      "formats": ["PlayCanvas LOD", "PLY"],
      "max_points": 5000000,
      "human_removal": true
    }
  }'`,
    responseSample: `{
  "code": 200,
  "message": "Task queued successfully",
  "data": {
    "task_id": "task-8f92b10a",
    "status": "QUEUED",
    "worker_node": "node-gpu-h800-02",
    "estimated_duration_sec": 420,
    "websocket_stream_url": "wss://api.mipmap.internal/v1/tasks/task-8f92b10a/events"
  }
}`,
  },
  {
    method: 'POST',
    path: '/api/v1/at/optimize-gcp',
    title: '像控点空三联合平差 (GCP Bundle Adjustment)',
    description: '导入测量像控点与刺点坐标，执行高精区域网联合光束法平差计算',
    category: 'GCP & Calibration',
    parameters: [
      { name: 'task_id', type: 'string', required: true, description: '对应重建任务 ID' },
      { name: 'gcps', type: 'array', required: true, description: '像控点列表 (名称, 经纬高, 测站刺点像素坐标)' },
      { name: 'use_pos_prior', type: 'boolean', required: false, description: '是否使用相机 POS 先验约束' },
    ],
    pythonExample: `import map_reconstruct_sdk as mrs

# 批量设置地面像控点 (GCP)
gcp_batch = [
    mrs.GCP(name="K01", x=114.305218, y=30.592812, z=42.15, type=mrs.GCPType.CONTROL),
    mrs.GCP(name="K02", x=114.307115, y=30.594192, z=45.82, type=mrs.GCPType.CONTROL),
    mrs.GCP(name="CHK1", x=114.306120, y=30.593740, z=43.10, type=mrs.GCPType.CHECK)
]

# 提交刺点与平差优化
result = client.at.optimize_with_gcp(
    task_id="task-20260923",
    gcps=gcp_batch,
    use_pos_prior=True
)

print(f"平差完成，中误差: {result.mean_reprojection_error} px")
for point in result.gcp_residuals:
    print(f"Point {point.name} dx={point.dx_cm}cm dy={point.dy_cm}cm dz={point.dz_cm}cm")`,
    cppExample: `mrs::GCPDataset gcp_dataset;
gcp_dataset.LoadFromCSV("D:/SurveyData/GCP_Points.csv");
gcp_dataset.LoadPricksFromXML("D:/SurveyData/PrickPoints.xml");

mrs::ATResult at_result = engine.RunBundleAdjustment(gcp_dataset);
std::cout << "Mean Reprojection Error: " << at_result.reprojection_error << " px" << std::endl;`,
    nodeExample: `const atResult = await client.at.optimize({
  taskId: 'task-20260923',
  usePosPrior: true,
  gcpList: [
    { name: 'K01', x: 114.305218, y: 30.592812, z: 42.15, type: 'control' }
  ]
});`,
    curlExample: `curl -X POST https://api.mipmap.internal/v1/at/optimize-gcp \\
  -H "Authorization: Bearer mrs_live_sec_9934afbc" \\
  -H "Content-Type: application/json" \\
  -d '{
    "task_id": "task-20260923",
    "use_pos_prior": true,
    "gcps": [
      {"name": "GCP01", "x": 114.305218, "y": 30.592812, "z": 42.15, "type": "control"}
    ]
  }'`,
    responseSample: `{
  "code": 200,
  "data": {
    "status": "OPTIMIZED",
    "mean_reprojection_error_px": 0.32,
    "checkpoint_rmse_xyz_cm": 1.48,
    "camera_calibrated_count": 380
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/reconstruction/tasks/{id}/export',
    title: '成果产物打包下载与流式分发 (Export & 3D Streaming)',
    description: '获取 3D Tiles (B3DM), OSGB, 3DGS (PlayCanvas / PLY / Splat), 点云 LAS 及数字正射 DOM 成果',
    category: 'Gaussian Splatting',
    parameters: [
      { name: 'id', type: 'string', required: true, description: '任务 ID' },
      { name: 'format', type: 'string', required: false, description: '"3dtiles" | "ply" | "splat" | "osgb" | "dom_tif"' },
    ],
    pythonExample: `result = client.tasks.get_export(
    task_id="task-20260923",
    format="splat"
)
print("Splat WebGL Stream URL:", result.stream_url)
print("Tileset JSON URL:", result.tileset_json_url)`,
    cppExample: `mrs::ExportPackage pkg = engine.ExportOutputs({
    mrs::ExportFormat::GaussianSplat_PLY,
    mrs::ExportFormat::Tileset_B3DM,
    mrs::ExportFormat::DOM_GeoTIFF
}, "D:/ReconstructionResults/3dgs-20260923/");`,
    nodeExample: `const exportUrls = await client.tasks.getExportUrls('task-20260923');
console.log('PlayCanvas LOD URL:', exportUrls.playCanvasLod);`,
    curlExample: `curl -X GET "https://api.mipmap.internal/v1/reconstruction/tasks/task-20260923/export?format=splat" \\
  -H "Authorization: Bearer mrs_live_sec_9934afbc"`,
    responseSample: `{
  "task_id": "task-20260923",
  "files": {
    "gaussian_splat_ply": "https://storage.mipmap.internal/results/3dgs-20260923/point_cloud.ply",
    "gaussian_splat_lod": "https://storage.mipmap.internal/results/3dgs-20260923/playcanvas_lod.json",
    "mesh_osgb_zip": "https://storage.mipmap.internal/results/3dgs-20260923/Data.zip",
    "tileset_b3dm": "https://storage.mipmap.internal/results/3dgs-20260923/tileset.json",
    "dom_orthophoto_tif": "https://storage.mipmap.internal/results/3dgs-20260923/dom_wgs84.tif",
    "dsm_tif": "https://storage.mipmap.internal/results/3dgs-20260923/dsm_wgs84.tif"
  }
}`,
  },
];
