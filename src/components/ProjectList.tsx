import React, { useState } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List as ListIcon,
  RotateCw,
  Plus,
  HardDrive,
  MoreVertical,
  ChevronRight,
  FolderOpen,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Project } from '../types/reconstruction';
import { ProjectThumbnail } from './ProjectThumbnail';

interface ProjectListProps {
  projects: (Project & { thumbnailJobId?: string })[];
  onSelectProject: (project: Project) => void;
  onCreateProject: (name: string, description: string) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onSelectProject,
  onCreateProject,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'photos'>('updated');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProject(newProjectName.trim(), newProjectDesc.trim());
    setNewProjectName('');
    setNewProjectDesc('');
    setShowNewModal(false);
  };

  return (
    <div className="flex-1 bg-[#1A1B1F] flex flex-col min-h-screen text-[#E1E4EA]">
      {/* Top Filter and Actions Bar - Exactly matching Screenshot 1 */}
      <div className="h-16 border-b border-[#2A2C33] px-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white tracking-wide">项目列表</span>
          <span className="text-xs text-neutral-400 font-mono tabular-nums">
            ({filteredProjects.length})
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search box */}
          <div className="relative">
            <input
              type="text"
              placeholder="请输入关键字"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 h-8 pl-8 pr-3 text-xs bg-[#24262D] border border-[#32353E] rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Filter dropdown */}
          <div className="relative">
            <button className="h-8 px-3 text-xs bg-[#24262D] border border-[#32353E] rounded-md text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors">
              <Filter className="w-3.5 h-3.5 text-neutral-400" />
              <span>过滤</span>
            </button>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5 bg-[#24262D] border border-[#32353E] rounded-md px-2.5 h-8">
            <span className="text-xs text-neutral-400">排序:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="updated" className="bg-[#24262D]">创建时间</option>
              <option value="name" className="bg-[#24262D]">项目名称</option>
              <option value="photos" className="bg-[#24262D]">照片数量</option>
            </select>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-[#24262D] border border-[#32353E] rounded-md p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-[#373A44] text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="网格视图"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list' ? 'bg-[#373A44] text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="列表视图"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => {}}
            className="w-8 h-8 rounded-md bg-[#24262D] border border-[#32353E] flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            title="刷新项目"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* New Project button */}
          <button
            onClick={() => setShowNewModal(true)}
            className="h-8 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建项目</span>
          </button>
        </div>
      </div>

      {/* Projects Display Area */}
      <div className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-20 text-neutral-500">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无匹配项目</p>
            <p className="text-xs text-neutral-600 mt-1">请尝试修改搜索词或创建新项目</p>
          </div>
        ) : viewMode === 'list' ? (
          /* List Mode - Exactly matching Screenshot 1 */
          <div className="space-y-2">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="group h-16 bg-[#23242A] hover:bg-[#282A31] border border-[#2F323A] rounded-md px-4 flex items-center justify-between cursor-pointer transition-all duration-150"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Thumbnail */}
                  <div className="w-12 h-10 rounded overflow-hidden bg-black/40 border border-[#383B46] shrink-0 relative">
                    <ProjectThumbnail src={project.thumbnailUrl} jobId={project.thumbnailJobId} name={project.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  </div>

                  {/* Name and description */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                        {project.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2D3039] text-blue-300 border border-[#3E4250]">
                        {project.badge}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-400 truncate max-w-md hidden sm:block">
                      {project.description}
                    </div>
                  </div>
                </div>

                {/* Right metadata and menu */}
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-neutral-400 tabular-nums">{project.updatedAt}</div>
                    <div className="text-[11px] text-neutral-500 tabular-nums">
                      {project.photoCount} 张影像 · {project.taskCount} 个重建任务
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-[#343742] transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Grid Mode */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="group bg-[#23242A] hover:bg-[#282A31] border border-[#2F323A] rounded-lg overflow-hidden cursor-pointer transition-all duration-150 flex flex-col"
              >
                <div className="h-40 relative overflow-hidden bg-black/60">
                  <ProjectThumbnail src={project.thumbnailUrl} jobId={project.thumbnailJobId} name={project.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#23242A] via-transparent to-black/20" />
                  <span className="absolute top-3 left-3 text-[11px] font-mono px-2 py-0.5 rounded bg-black/70 backdrop-blur text-blue-300 border border-white/10">
                    {project.badge}
                  </span>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                      {project.description}
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#2F323A] flex items-center justify-between text-xs text-neutral-400">
                    <span>{project.photoCount} 照片</span>
                    <span className="tabular-nums">{project.updatedAt}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#212329] border border-[#333640] rounded-xl w-full max-w-md shadow-2xl p-6">
            <h3 className="text-base font-semibold text-white mb-4">新建重建工程</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  工程名称
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如: Highway-Survey-3DGS"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-[#1A1B20] border border-[#353842] rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  工程描述 (可选)
                </label>
                <textarea
                  rows={3}
                  placeholder="项目测区范围、无人机机型或业务用途备注..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full p-2.5 text-xs bg-[#1A1B20] border border-[#353842] rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-xs text-neutral-300 hover:text-white rounded-lg hover:bg-[#2C2E37] transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
                >
                  创建并进入
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
