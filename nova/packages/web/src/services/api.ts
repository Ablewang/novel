/**
 * API 服务层 - 通过 Vite proxy 转发到 Midway 后端 (7001)
 */
const API_BASE = '/api';

export interface ProjectData {
  id: string;
  metadata: {
    title: string;
    genre: string;
    tags: string[];
    targetAudience: string;
    logline: string;
  };
  currentProgress: {
    volumeIndex: number;
    chapterIndex: number;
    sceneIndex: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSnapshot {
  project: ProjectData;
  world: unknown;
  characters: unknown[];
  outline: unknown;
}

export interface ChatThread {
  threadId: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  node?: string;
  timestamp: number;
}

export async function createProject(title: string, genre: string, logline: string) {
  const res = await fetch(`${API_BASE}/project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, genre, logline }),
  });
  return res.json();
}

export async function listProjects(): Promise<{ projects: ProjectData[] }> {
  const res = await fetch(`${API_BASE}/projects`);
  return res.json();
}

export async function getProject(id: string): Promise<ProjectSnapshot> {
  const res = await fetch(`${API_BASE}/project/${id}`);
  return res.json();
}

export async function listThreads(projectId: string): Promise<{ threads: ChatThread[] }> {
  const res = await fetch(`${API_BASE}/project/${projectId}/threads`);
  return res.json();
}

export async function getMessages(
  threadId: string,
  projectId: string,
  offset = 0,
  limit = 50,
): Promise<{ messages: ChatMessage[] }> {
  const params = new URLSearchParams({ projectId, offset: String(offset), limit: String(limit) });
  const res = await fetch(`${API_BASE}/thread/${threadId}/messages?${params}`);
  return res.json();
}

export interface SSEEvent {
  type: 'thread' | 'node' | 'token' | 'done' | 'interrupt' | 'error';
  threadId?: string;
  node?: string;
  content?: string;        // token 流式内容片段
  agentOutput?: string;
  routeTarget?: string;
  state?: {
    agentOutput?: string;
    draft?: string;
    routeTarget?: string;
  };
  pendingNode?: string;
  instruction?: string;
  message?: string;
}

/**
 * 让出主线程一帧，使 React 有机会渲染中间状态。
 * 仅在重要事件（node/done/interrupt/error）后调用，token 事件不让出（高频无需逐次渲染）。
 */
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * 通用 SSE 流式读取器
 */
async function readSSEStream(
  res: Response,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
) {
  const reader = res.body?.getReader();
  if (!reader) { onDone(); return; }
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        onDone();
        return;
      }
      try {
        const event: SSEEvent = JSON.parse(data);
        onEvent(event);
        // 关键事件后让出主线程，让 React 渲染中间结果
        if (event.type === 'node' || event.type === 'done' || event.type === 'interrupt' || event.type === 'error') {
          await yieldToMain();
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  onDone();
}

export function sendChat(
  projectId: string,
  message: string,
  threadId: string | null,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
  fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, message, threadId }),
    signal: controller.signal,
  }).then(async (res) => {
    clearTimeout(timeoutId);
    await readSSEStream(res, onEvent, onDone);
  });
}

export function resumeChat(
  projectId: string,
  threadId: string,
  feedback: string,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
  fetch(`${API_BASE}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, threadId, feedback }),
    signal: controller.signal,
  }).then(async (res) => {
    clearTimeout(timeoutId);
    await readSSEStream(res, onEvent, onDone);
  });
}
