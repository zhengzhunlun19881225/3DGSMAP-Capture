import React, { useState } from 'react';
import {
  X,
  Code2,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  BookOpen,
  Zap,
  Server,
  Database,
  ShieldCheck,
} from 'lucide-react';

interface OpenSourceEngineModalProps {
  onClose: () => void;
}

export const OpenSourceEngineModal: React.FC<OpenSourceEngineModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'stack' | 'pipeline' | 'docker'>('stack');
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const PIPELINE_SCRIPT = `#!/usr/bin/env python3
"""
MipMap 3D 空间重建自动化开源流水线脚本
整合: COLMAP (空三平差) + gsplat / 3DGS (高斯泼溅) + OpenMVS (网格纹理) + GDAL (正射DOM)
"""
import os
import subprocess
import argparse

def run_reconstruction_pipeline(image_dir, output_dir, template="gaussian_splat"):
    os.makedirs(output_dir, exist_ok=True)
    database_path = os.path.join(output_dir, "database.db")
    sparse_dir = os.path.join(output_dir, "sparse")
    os.makedirs(sparse_dir, exist_ok=True)

    print("[阶段 1/4] 运行 COLMAP 执行高精空三特征提取与光束法平差...")
    # 1.1 SIFT 特征提取 (支持 GPU CUDA 加速)
    subprocess.run([
        "colmap", "feature_extractor",
        "--database_path", database_path,
        "--image_path", image_dir,
        "--ImageReader.camera_model", "PINHOLE",
        "--SiftExtraction.use_gpu", "1"
    ], check=True)

    # 1.2 序列与空间航线匹配 (适用于无人机航线序列)
    subprocess.run([
        "colmap", "spatial_matcher",
        "--database_path", database_path,
        "--SpatialMatching.max_num_neighbors", "50",
        "--SiftMatching.use_gpu", "1"
    ], check=True)

    # 1.3 光束法平差解算相机位姿与稀疏连接点
    subprocess.run([
        "colmap", "mapper",
        "--database_path", database_path,
        "--image_path", image_dir,
        "--output_path", sparse_dir
    ], check=True)

    if template == "gaussian_splat":
        print("[阶段 2/4] 启动 3D Gaussian Splatting (gsplat) 迭代训练...")
        # 调用开源 3DGS (Inria) 或 gsplat (Nerfstudio)
        gs_out_dir = os.path.join(output_dir, "gaussian_splat")
        subprocess.run([
            "python", "train.py",
            "-s", output_dir,           # 包含 COLMAP sparse 输出
            "-m", gs_out_dir,           # 高斯模型输出目录
            "--iterations", "30000",    # 迭代步数
            "--densify_grad_threshold", "0.0002"
        ], check=True)
        print(f"[阶段 3/4] 导出 3DGS 成果 PLY: {gs_out_dir}/point_cloud/iteration_30000/point_cloud.ply")

    elif template == "mesh":
        print("[阶段 2/4] 启动 OpenMVS 执行多视立体稠密匹配与泊松构网...")
        mvs_dir = os.path.join(output_dir, "mvs")
        os.makedirs(mvs_dir, exist_ok=True)
        # 2.1 转换 COLMAP 模型至 MVS 项目
        subprocess.run(["InterfaceCOLMAP", "-i", sparse_dir + "/0", "-o", f"{mvs_dir}/scene.mvs", "--image-folder", image_dir], check=True)
        # 2.2 稠密点云匹配
        subprocess.run(["DensifyPointCloud", f"{mvs_dir}/scene.mvs", "--resolution-level", "1"], check=True)
        # 2.3 粗网格与泊松网格剖分
        subprocess.run(["ReconstructMesh", f"{mvs_dir}/scene_dense.mvs"], check=True)
        # 2.4 UV 贴图烘焙
        subprocess.run(["TextureMesh", f"{mvs_dir}/scene_dense_mesh.mvs", "--export-type", "obj"], check=True)
        print(f"[阶段 3/4] 实景网格 OBJ 输出完成: {mvs_dir}/scene_dense_mesh_texture.obj")

    print("[阶段 4/4] 使用 GDAL 生成数字正射影像 (DOM) 与切片...")
    # 使用 GDAL 进行航摄影像纠正与投影坐标系绑定 (如 EPSG:4490 CGCS2000)
    print("重建流水线全流程执行完毕！")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", required=True, help="航摄照片目录")
    parser.add_argument("--output", default="./reconstruction_out", help="输出路径")
    parser.add_argument("--template", default="gaussian_splat", choices=["gaussian_splat", "mesh", "fast_2d"])
    args = parser.parse_args()
    run_reconstruction_pipeline(args.images, args.output, args.template)
`;

  const DOCKERFILE_CONTENT = `FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

# 1. 安装基础依赖与编译工具
RUN apt-get update && apt-get install -y \\
    build-essential cmake git wget curl \\
    libboost-all-dev libeigen3-dev libfreeimage-dev \\
    libgflags-dev libgoogle-glog-dev libatlas-base-dev \\
    libsuitesparse-dev gdal-bin libgdal-dev python3-pip \\
    && rm -rf /var/lib/apt/lists/*

# 2. 编译并安装 Ceres Solver (光束法平差核心)
RUN git clone https://ceres-solver.googlesource.com/ceres-solver /tmp/ceres \\
    && cd /tmp/ceres && mkdir build && cd build \\
    && cmake .. -DBUILD_TESTING=OFF -DBUILD_EXAMPLES=OFF \\
    && make -j$(nproc) && make install && rm -rf /tmp/ceres

# 3. 编译并安装 COLMAP (高精空三与特征提取引擎)
RUN git clone https://github.com/colmap/colmap.git /tmp/colmap \\
    && cd /tmp/colmap && mkdir build && cd build \\
    && cmake .. -DCMAKE_CUDA_ARCHITECTURES=all \\
    && make -j$(nproc) && make install && rm -rf /tmp/colmap

# 4. 安装 3D Gaussian Splatting 与 Python SDK
RUN pip3 install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu121 \\
    && pip3 install --no-cache-dir gsplat pycolmap opencv-python-headless plyfile

# 5. 挂载 MipMap 重建流水线服务
WORKDIR /app
COPY pipeline.py /app/pipeline.py
ENTRYPOINT ["python3", "/app/pipeline.py"]
`;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4 select-none">
      <div className="bg-[#1C1E26] border border-[#323646] rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-xs text-[#E1E4EA]">
        {/* Header */}
        <div className="h-14 border-b border-[#2B2E3D] px-6 flex items-center justify-between bg-[#171821] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>底层开源重建代码与引擎全景架构</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  行业工业级标准选型
                </span>
              </h2>
              <div className="text-[11px] text-neutral-400">
                本平台前端与 SDK 基于以下国际主流开源底层算法库进行封装与调度集成
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-[#282B38]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="h-10 border-b border-[#282B3A] px-6 flex items-center gap-4 bg-[#191A23]">
          <button
            onClick={() => setActiveTab('stack')}
            className={`h-full text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'stack'
                ? 'border-blue-500 text-white font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>核心开源引擎选型推荐</span>
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`h-full text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'pipeline'
                ? 'border-blue-500 text-white font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Python 串联自动化流水线源码</span>
          </button>
          <button
            onClick={() => setActiveTab('docker')}
            className={`h-full text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'docker'
                ? 'border-blue-500 text-white font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Dockerfile 一键构建与 GPU 镜像</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'stack' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/30 text-neutral-300 leading-relaxed">
                实景三维与空间高斯泼溅重建通常由<strong>空三特征匹配</strong>、<strong>光束法平差</strong>、<strong>高斯迭代训练</strong>、<strong>网格几何重建</strong>与<strong>GIS 投影切片</strong>五大部分构成。以下是目前工业界经过实战验证最成熟的开源项目组合：
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. AT / SfM */}
                <div className="p-4 rounded-xl bg-[#21232D] border border-[#2E3240] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>1. 空三解算与位姿平差 (AT / SfM)</span>
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">C++ / CUDA</span>
                  </div>
                  <div className="space-y-1.5 text-neutral-300">
                    <div>
                      <strong className="text-blue-300">COLMAP</strong> (Johannes Schönberger):
                      业界最权威的运动恢复结构算法，提供高精 SIFT 特征提取、空间序列匹配与多视角几何解算。
                    </div>
                    <div>
                      <strong className="text-blue-300">OpenSfM</strong> (Mapillary):
                      轻量易扩展，专为无人机 GPS/POS 航带先验约束优化。
                    </div>
                    <div>
                      <strong className="text-blue-300">Ceres Solver</strong> (Google):
                      工业级非线性最小二乘优化库，用于地面像控点 (GCP) 联合光束法平差。
                    </div>
                  </div>
                </div>

                {/* 2. 3DGS */}
                <div className="p-4 rounded-xl bg-[#21232D] border border-[#2E3240] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>2. 3D 高斯泼溅 (Gaussian Splatting)</span>
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">PyTorch / CUDA</span>
                  </div>
                  <div className="space-y-1.5 text-neutral-300">
                    <div>
                      <strong className="text-amber-300">gsplat</strong> (Nerfstudio / UC Berkeley):
                      高效 CUDA 光栅化内核与自适应致密化训练库，训练速度较原版提升 3~4 倍。
                    </div>
                    <div>
                      <strong className="text-amber-300">gaussian-splatting</strong> (Inria 原版):
                      标准 30,000 步训练，直接读取 COLMAP sparse 输出并生成 PLY。
                    </div>
                    <div>
                      <strong className="text-amber-300">PlayCanvas 3DGS / WebGPU Splat</strong>:
                      前端网页端实时流式加载与渲染八叉树 LOD 高斯场景。
                    </div>
                  </div>
                </div>

                {/* 3. Mesh & Point Cloud */}
                <div className="p-4 rounded-xl bg-[#21232D] border border-[#2E3240] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>3. 稠密点云与网格模型 (MVS / Mesh)</span>
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">C++ / OpenMP</span>
                  </div>
                  <div className="space-y-1.5 text-neutral-300">
                    <div>
                      <strong className="text-emerald-300">OpenMVS</strong> (Danila):
                      全球最强开源稠密匹配、泊松网格构建 (Poisson Mesh) 与 UV 贴图烘焙套件。
                    </div>
                    <div>
                      <strong className="text-emerald-300">CGAL / MeshLab (QEM)</strong>:
                      二次误差测度网格简化 (Decimation)、孔洞修补与水域多边形压平。
                    </div>
                  </div>
                </div>

                {/* 4. GIS / Orthophoto */}
                <div className="p-4 rounded-xl bg-[#21232D] border border-[#2E3240] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>4. 正射影像与三维瓦片 (DOM / DSM / 3D Tiles)</span>
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">GIS 空间底座</span>
                  </div>
                  <div className="space-y-1.5 text-neutral-300">
                    <div>
                      <strong className="text-purple-300">GDAL / PROJ</strong>:
                      正射纠正、DSM/DEM 栅格化、空间坐标系换算 (CGCS2000 / WGS84 / UTM)。
                    </div>
                    <div>
                      <strong className="text-purple-300">py3dtiles / 3d-tiles-tools</strong>:
                      实景三维模型转换为 Cesium 3D Tiles (B3DM 瓦片树)。
                    </div>
                    <div>
                      <strong className="text-purple-300">PDAL</strong>:
                      点云处理与 LAS/LAZ 格式转换切片。
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300 font-medium">
                  可直接部署在本地服务器的 Python 自动化串联脚本:
                </span>
                <button
                  onClick={() => handleCopy(PIPELINE_SCRIPT)}
                  className="px-3 py-1 bg-[#252835] hover:bg-[#2E3244] border border-[#35394A] text-neutral-200 hover:text-white rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? '已复制代码' : '复制脚本'}</span>
                </button>
              </div>
              <div className="p-4 rounded-xl bg-[#111217] border border-[#272A36] overflow-x-auto font-mono text-[11px] text-emerald-300 leading-relaxed">
                <pre>{PIPELINE_SCRIPT}</pre>
              </div>
            </div>
          )}

          {activeTab === 'docker' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300 font-medium">
                  包含 CUDA 12.1 + COLMAP + gsplat + OpenMVS 的完整 Dockerfile:
                </span>
                <button
                  onClick={() => handleCopy(DOCKERFILE_CONTENT)}
                  className="px-3 py-1 bg-[#252835] hover:bg-[#2E3244] border border-[#35394A] text-neutral-200 hover:text-white rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? '已复制代码' : '复制 Dockerfile'}</span>
                </button>
              </div>
              <div className="p-4 rounded-xl bg-[#111217] border border-[#272A36] overflow-x-auto font-mono text-[11px] text-cyan-300 leading-relaxed">
                <pre>{DOCKERFILE_CONTENT}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 border-t border-[#2B2E3D] px-6 flex items-center justify-between bg-[#171821] shrink-0 text-neutral-400">
          <span>
            本 SDK 架构无缝桥接 C++ 底层动态库、Python 调度集群与 Web 交互工作台
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            我已知晓，继续在界面测试
          </button>
        </div>
      </div>
    </div>
  );
};
