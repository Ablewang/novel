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

export interface SSEEvent {
  type: 'thread' | 'node' | 'done' | 'interrupt' | 'error';
  threadId?: string;
  node?: string;
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

export function sendChat(
  projectId: string,
  message: string,
  threadId: string | null,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
) {
  fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, message, threadId }),
  }).then(async (res) => {
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            onDone();
            return;
          }
          try {
            onEvent(JSON.parse(data));
          } catch {
            // ignore
          }
        }
      }
    }
    onDone();
  });
}

export function resumeChat(
  threadId: string,
  feedback: string,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
) {
  fetch(`${API_BASE}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, feedback }),
  }).then(async (res) => {
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            onDone();
            return;
          }
          try {
            onEvent(JSON.parse(data));
          } catch {
            // ignore
          }
        }
      }
    }
    onDone();
  });
}
