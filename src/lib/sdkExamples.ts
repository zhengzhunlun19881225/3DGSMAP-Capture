export type SdkLanguage = 'python' | 'javascript' | 'curl';
export type ApiOperation = 'health' | 'status' | 'cameras' | 'artifact' | 'submit';
export const API_OPERATIONS: { id: ApiOperation; label: string; method: string; description: string }[] = [
  { id: 'health', label: '服务状态', method: 'GET', description: '查询 API 版本、Brush 可用性和并发限制' },
  { id: 'status', label: '当前任务进度', method: 'GET', description: '查询实际阶段、训练步数、日志和成果文件名' },
  { id: 'cameras', label: '相机解算结果', method: 'GET', description: '查询已注册相机的内参、位姿和照片名称' },
  { id: 'artifact', label: '下载最终 PLY', method: 'GET', description: '使用任务响应中的 artifact 文件名下载成果' },
  { id: 'submit', label: '提交照片重建', method: 'POST', description: 'multipart 上传原始照片，返回新的 job_id' },
];
export function apiPath(operation: ApiOperation, jobId?: string, artifact?: string) {
  if (operation === 'health') return '/api/health';
  if (operation === 'submit') return '/api/reconstruct';
  const root = `/api/jobs/${jobId || '{job_id}'}`;
  return operation === 'cameras' ? `${root}/view` : operation === 'artifact' ? `${root}/artifact/${artifact ? encodeURIComponent(artifact) : '{artifact}'}` : root;
}
const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;
export function sdkExample(language: SdkLanguage, operation: ApiOperation, base: string, jobId: string | undefined,
  artifact: string | undefined, metadata: Record<string, unknown>, photoNames: string[]) {
  const url = `${base || 'http://127.0.0.1:8787'}${apiPath(operation, jobId, artifact)}`;
  if (operation === 'submit') {
    const names = photoNames.length ? photoNames : ['photo-1.jpg', 'photo-2.jpg'];
    const metadataJson = JSON.stringify(metadata);
    if (language === 'curl') return `# 执行会创建新的训练任务。先进入原始照片目录；至少 2 张，文件名不能重复。\n# ${photoNames.length ? '以下文件名来自当前任务；请确认本地文件存在。' : '请将占位文件名替换为实际照片名。'}\ncurl --fail-with-body ${shellQuote(url)} \\\n  -F ${shellQuote(`metadata=${metadataJson}`)} \\\n${names.map(name => `  -F ${shellQuote(`images=@"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)}`).join(' \\\n')}`;
    if (language === 'python') return `# Python 3；需要 requests（pip install requests）。执行会创建新任务。\nfrom pathlib import Path\nfrom contextlib import ExitStack\nimport json\nimport requests\n\nphoto_dir = Path("/path/to/photos")  # 改为原始照片目录\nphoto_names = ${JSON.stringify(names, null, 2)}\nmetadata = json.loads(${JSON.stringify(metadataJson)})\nwith ExitStack() as stack:\n    files = [("images", (name, stack.enter_context((photo_dir / name).open("rb"))))\n             for name in photo_names]\n    response = requests.post(${JSON.stringify(url)},\n                             data={"metadata": json.dumps(metadata)}, files=files, timeout=600)\n    response.raise_for_status()\n    print(response.json())  # {"job_id": "..."}，随后查询该 ID 的状态\n`;
    return `// 浏览器 JavaScript。执行后选择原始照片，会创建一个新的训练任务。\nconst input = document.createElement('input');\ninput.type = 'file'; input.multiple = true; input.accept = 'image/*';\ninput.onchange = async () => {\n  if (input.files.length < 2) throw new Error('至少选择两张照片');\n  const form = new FormData();\n  form.append('metadata', ${JSON.stringify(metadataJson)});\n  for (const file of input.files) form.append('images', file, file.name);\n  const response = await fetch(${JSON.stringify(url)}, { method: 'POST', body: form });\n  if (!response.ok) throw new Error(await response.text());\n  console.log(await response.json()); // 用返回的 job_id 查询任务进度\n};\ninput.click();`;
  }
  if (language === 'curl') return `curl --fail-with-body ${shellQuote(url)}${operation === 'artifact' ? ` --output ${shellQuote(artifact || 'result.ply')}` : ''}`;
  if (language === 'python') return operation === 'artifact'
    ? `import urllib.request\n\nurllib.request.urlretrieve(${JSON.stringify(url)}, ${JSON.stringify(artifact || 'result.ply')})`
    : `import json\nimport urllib.request\n\nwith urllib.request.urlopen(${JSON.stringify(url)}, timeout=30) as response:\n    print(json.dumps(json.load(response), ensure_ascii=False, indent=2))`;
  return `const response = await fetch(${JSON.stringify(url)});\nif (!response.ok) throw new Error(await response.text());\n${operation === 'artifact' ? `const blob = await response.blob();\nconst url = URL.createObjectURL(blob);\nconst link = document.createElement('a');\nlink.href = url; link.download = ${JSON.stringify(artifact || 'result.ply')};\nlink.click();\nsetTimeout(() => URL.revokeObjectURL(url), 1000);` : 'console.log(await response.json());'}`;
}
