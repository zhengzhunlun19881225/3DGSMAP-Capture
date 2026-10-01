import React, { useState } from 'react';
import {
  Bell,
  Cpu,
  Server,
  Cloud,
  Layers,
  Code2,
  MapPin,
  FileCheck2,
  SplitSquareVertical,
  CheckCircle2,
} from 'lucide-react';
import { ComputationMode } from '../types/reconstruction';

interface HeaderProps {
  currentTab: 'projects' | 'viewer' | 'gcp' | 'sdk' | 'dual' | 'report';
  onSelectTab: (tab: 'projects' | 'viewer' | 'gcp' | 'sdk' | 'dual' | 'report') => void;
  computationMode: ComputationMode;
  onChangeComputationMode: (mode: ComputationMode) => void;
  activeProjectName?: string;
  activeTaskName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  computationMode,
  onChangeComputationMode,
  activeProjectName,
  activeTaskName,
}) => {
  const [showNotification, setShowNotification] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  return (
    <header className="h-14 bg-[#18191D] border-b border-[#2B2D33] px-4 flex items-center justify-between select-none z-40 relative">
      {/* Zone 1: Single text element Brand wordmark with subtle breadcrumb */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => onSelectTab('projects')}
          className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-inner shadow-white/20">
            <span className="font-bold text-white text-xs tracking-tighter">3D</span>
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">
              3DGSMAP
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs text-neutral-400 font-normal">
              v3.2.3 Core
            </span>
          </div>
        </button>

        {activeProjectName && (
          <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-400 pl-3 border-l border-[#2F3138]">
            <span>{activeProjectName}</span>
            {activeTaskName && (
              <>
                <span className="text-neutral-600">/</span>
                <span className="text-neutral-200 font-medium">{activeTaskName}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Zone 2: 4-6 Clean text navigation links with subtle underline/active state */}
      <nav className="hidden md:flex items-center gap-1 xl:gap-2">
        <button
          onClick={() => onSelectTab('projects')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            currentTab === 'projects'
              ? 'text-white bg-[#262830]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#202227]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>项目列表</span>
        </button>

        <button
          onClick={() => onSelectTab('viewer')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            currentTab === 'viewer'
              ? 'text-white bg-[#262830]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#202227]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>三维重建工作台</span>
        </button>

        <button
          onClick={() => onSelectTab('gcp')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            currentTab === 'gcp'
              ? 'text-white bg-[#262830]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#202227]'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>像控点刺点</span>
        </button>

        <button
          onClick={() => onSelectTab('dual')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            currentTab === 'dual'
              ? 'text-white bg-[#262830]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#202227]'
          }`}
        >
          <SplitSquareVertical className="w-3.5 h-3.5" />
          <span>双屏对比</span>
        </button>

        <button
          onClick={() => onSelectTab('report')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            currentTab === 'report'
              ? 'text-white bg-[#262830]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#202227]'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>空三报告</span>
        </button>

        <button
          onClick={() => onSelectTab('sdk')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            currentTab === 'sdk'
              ? 'text-white bg-blue-600/30 text-blue-300 border border-blue-500/40'
              : 'text-blue-400 hover:text-blue-300 hover:bg-[#202227]'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>开发者 SDK</span>
        </button>
      </nav>

      {/* Zone 3: Primary Actions (Computation Mode, Notifications, User) */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Computation Engine Mode Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowModeDropdown(!showModeDropdown)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#202227] hover:bg-[#272930] border border-[#2F3138] text-xs font-medium text-neutral-300 transition-colors"
            title="切换运算集成环境"
          >
            {computationMode === 'desktop' && (
              <>
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">单机模式 (Desktop SDK)</span>
              </>
            )}
            {computationMode === 'local_cluster' && (
              <>
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">本地集群 (On-Premise)</span>
              </>
            )}
            {computationMode === 'cloud_serverless' && (
              <>
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">弹性云端 (Cloud API)</span>
              </>
            )}
          </button>

          {showModeDropdown && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-lg bg-[#1F2127] border border-[#2F3138] shadow-2xl py-1.5 z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                选择运行引擎架构
              </div>
              <button
                onClick={() => {
                  onChangeComputationMode('desktop');
                  setShowModeDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[#2A2C34] ${
                  computationMode === 'desktop' ? 'text-amber-300 bg-[#262832]' : 'text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="font-medium">单机工作站模式</div>
                    <div className="text-[11px] text-neutral-500">C++ Native / 本地 GPU (CUDA)</div>
                  </div>
                </div>
                {computationMode === 'desktop' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
              </button>

              <button
                onClick={() => {
                  onChangeComputationMode('local_cluster');
                  setShowModeDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[#2A2C34] ${
                  computationMode === 'local_cluster' ? 'text-emerald-300 bg-[#262832]' : 'text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-medium">本地服务器集群</div>
                    <div className="text-[11px] text-neutral-500">私有多节点调度 / Docker / Slurm</div>
                  </div>
                </div>
                {computationMode === 'local_cluster' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                onClick={() => {
                  onChangeComputationMode('cloud_serverless');
                  setShowModeDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[#2A2C34] ${
                  computationMode === 'cloud_serverless' ? 'text-blue-300 bg-[#262832]' : 'text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="font-medium">云端弹性集群</div>
                    <div className="text-[11px] text-neutral-500">REST API / OSS 自动化流水线</div>
                  </div>
                </div>
                {computationMode === 'cloud_serverless' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotification(!showNotification)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#202227] transition-colors relative"
            title="通知中心"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-[#18191D]" />
          </button>

          {showNotification && (
            <div className="absolute right-0 mt-1.5 w-80 rounded-lg bg-[#1F2127] border border-[#2F3138] shadow-2xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-[#2A2C34] mb-2">
                <span className="text-xs font-semibold text-white">系统事件通知</span>
                <span className="text-[11px] text-blue-400 cursor-pointer hover:underline">全部已读</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 rounded bg-[#272931] border border-[#34363F]">
                  <div className="font-medium text-emerald-400 flex items-center justify-between">
                    <span>3dgs-20260923 重建完成</span>
                    <span className="text-[10px] text-neutral-400">10分钟前</span>
                  </div>
                  <div className="text-neutral-300 text-[11px] mt-0.5">
                    3DGS 点数: 4,821,902 · 倾斜模型 B3DM 已生成
                  </div>
                </div>
                <div className="p-2 rounded bg-[#272931] border border-[#34363F]">
                  <div className="font-medium text-blue-400 flex items-center justify-between">
                    <span>空三平差精度良好</span>
                    <span className="text-[10px] text-neutral-400">1小时前</span>
                  </div>
                  <div className="text-neutral-300 text-[11px] mt-0.5">
                    重投影中误差 0.34px · 4 个像控点均已检核
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User profile avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#2B2D33]">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-[11px] font-bold text-white shadow-sm ring-1 ring-white/20">
            D
          </div>
          <span className="hidden xl:inline-block text-xs text-neutral-300 max-w-[100px] truncate">
            405325080@qq.com
          </span>
        </div>
      </div>
    </header>
  );
};
