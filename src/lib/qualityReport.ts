import { ReconstructionJob } from '../types/reconstruction';

export interface ReportCamera { name: string; width: number; height: number; intrinsics: number[][] }
export interface ReportSnapshot {
  job: ReconstructionJob & { cache_hit?: boolean; updated_at?: number };
  cameras: ReportCamera[];
  cameraNotice: string;
  fetchedAt: number;
}
export const measured = (value: unknown, digits?: number) => typeof value === 'number' && Number.isFinite(value)
  ? digits === undefined ? value.toLocaleString() : value.toFixed(digits) : '未提供';
export const reportTime = (seconds?: number) => typeof seconds === 'number' && Number.isFinite(seconds)
  ? new Date(seconds * 1000).toLocaleString() : '未记录';
export function duration(seconds?: number) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '未记录';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 3600)} 小时 ${Math.floor(total % 3600 / 60)} 分 ${total % 60} 秒`;
}
export function reportState(job: ReconstructionJob) {
  if (job.phase === 'cancelled') return '已取消';
  return ({ queued: '排队中', processing: '处理中', completed: '已完成', failed: '失败 / 中断' } as Record<string, string>)[job.status] || job.status;
}
export function reportMetrics({ job }: ReportSnapshot) {
  return [
    ['平均重投影误差', `${measured(job.mean_reprojection_error, 3)}${typeof job.mean_reprojection_error === 'number' ? ' px' : ''}`, 'COLMAP 稀疏模型统计；不能据此判定绝对测量精度'],
    ['稀疏三维点', measured(job.sparse_points), 'COLMAP sparse_points；不是训练后的高斯数量'],
    ['已注册影像 / 输入影像', `${measured(job.registered_images)} / ${measured(job.image_count)}`, '注册成功数量，不代表特征匹配成功率或照片重叠度'],
    ['高斯训练步数', `${measured(job.training_step)} / ${measured(job.training_total ?? job.config?.steps)}`, '来自 Brush 训练进度；未完成时不作为最终成果'],
  ];
}
export function reportDetails(snapshot: ReportSnapshot): string[][] {
  const { job, fetchedAt } = snapshot;
  const elapsed = typeof job.started_at === 'number'
    ? typeof job.finished_at === 'number' ? job.finished_at - job.started_at
      : job.status === 'processing' ? fetchedAt / 1000 - job.started_at : undefined
    : undefined;
  const brushTiming = [...job.logs].reverse().find(line => line.includes('Training took '));
  return [
    ['任务状态', reportState(job)], ['执行阶段', job.phase || '未提供'],
    ['创建时间', reportTime(job.created_at)], ['开始时间', reportTime(job.started_at)],
    ['结束时间', reportTime(job.finished_at)], ['任务总历时', duration(elapsed)],
    ['总历时口径', '开始至结束或本次读取时刻的时钟差，包含等待与系统休眠，不代表纯计算时间'],
    ['COLMAP 缓存复用', job.cache_hit === true ? '是，本次复用已有解算' : job.cache_hit === false ? '否' : '未记录'],
    ['特征提取 / 匹配 / 平差耗时', '未单独记录'],
    ['Brush 训练耗时', brushTiming ? brushTiming.slice(brushTiming.indexOf('Training took ')) + '（Brush 原始日志）' : '未提供独立耗时'],
    ['训练档位', job.config?.label || '未提供'], ['训练最长边', job.config ? `${measured(job.config.maxResolution)} px` : '未提供'],
    ['高斯点数上限', measured(job.config?.maxGaussianPoints)], ['实际高斯数量', '当前状态接口未提供'],
    ['最终 PLY', job.status === 'completed' && job.artifact ? job.artifact : '尚未生成最终成果'],
    ['GSD / 航带重叠度 / 覆盖面积', '未计算'],
    ['相机畸变参数 / 检校先验值', '当前接口未提供'],
    ['GCP / 检查点绝对精度', '未接入实测控制点联合平差及独立检查点检核，未计算 RMSE'],
    ['坐标与尺度', 'COLMAP 重建坐标；未验证地理配准、真实尺度或绝对位置精度'],
    ['质量等级与规范达标结论', '未评定：缺少独立检查数据及评定依据'],
  ];
}
export function cameraValues(camera: ReportCamera) {
  return [camera.name, `${measured(camera.width)} × ${measured(camera.height)}`,
    measured(camera.intrinsics?.[0]?.[0], 3), measured(camera.intrinsics?.[1]?.[1], 3),
    measured(camera.intrinsics?.[0]?.[2], 3), measured(camera.intrinsics?.[1]?.[2], 3)];
}
export function reportHtml(projectName: string, taskName: string, snapshot: ReportSnapshot, api: string) {
  const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  const table = (rows: string[][]) => `<table>${rows.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</table>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>项目重建报告</title><style>
    body{font:14px/1.6 system-ui,sans-serif;color:#111;margin:28px}h1{font-size:22px}h2{font-size:17px;margin-top:24px}table{border-collapse:collapse;width:100%;margin:10px 0}td{border:1px solid #ccc;padding:7px;overflow-wrap:anywhere}tr{break-inside:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}@page{size:A4;margin:15mm}
    </style></head><body><h1>项目重建数据报告</h1>
    ${table([['项目',projectName],['任务',taskName],['job_id',snapshot.job.id],['数据来源',`${api}/api/jobs/${snapshot.job.id}`],['报告读取时间',new Date(snapshot.fetchedAt).toLocaleString()],['服务记录更新时间',reportTime(snapshot.job.updated_at)]])}
    <h2>解算与训练统计</h2>${table(reportMetrics(snapshot))}
    <h2>任务信息与测量范围</h2>${table(reportDetails(snapshot))}
    <h2>已解算相机内参</h2><p>宽高及 fx / fy / cx / cy 均以像素为单位；没有换算为毫米或认定检校合格。</p>
    ${snapshot.cameras.length ? table([['照片','尺寸','fx (px)','fy (px)','cx (px)','cy (px)'],...snapshot.cameras.map(cameraValues)]) : `<p>${escape(snapshot.cameraNotice || '未提供')}</p>`}
    <h2>服务日志（接口保留的最近记录）</h2><pre>${escape(snapshot.job.logs.join('\n'))}</pre>
    <p>本报告包含任务记录及可获取的解算数据，不作测绘精度等级认证。</p></body></html>`;
}
