/**
 * 记忆加载节点：从当前对话加载近期消息并压缩为摘要，供后续 Agent 使用
 */
import type { NovelState } from './graph-state.js';
import type { ChatService } from '../service/chat.service.js';

const MAX_MESSAGES = 15;
const MAX_SUMMARY_CHARS = 2000;

function formatRole(role: string): string {
  if (role === 'user') return '用户';
  if (role === 'assistant') return '助手';
  return '系统';
}

export function createMemoryLoaderNode(chatService: ChatService) {
  return function memoryLoaderNode(state: NovelState): Partial<NovelState> {
    const { projectId, threadId } = state;
    if (!projectId || !threadId) {
      return { memorySummary: '', memoryLastIndex: 0 };
    }

    const messages = chatService.getLatestMessages(projectId, threadId, MAX_MESSAGES);
    const total = chatService.getMessageCount(projectId, threadId);
    if (messages.length === 0) {
      return { memorySummary: '', memoryLastIndex: 0 };
    }

    const lines = messages.map((m) => `${formatRole(m.role)}: ${m.content}`).join('\n');
    const summary = lines.length > MAX_SUMMARY_CHARS
      ? lines.slice(0, MAX_SUMMARY_CHARS) + '\n...(近期对话已截断)'
      : lines;

    return {
      memorySummary: summary,
      memoryLastIndex: total,
    };
  };
}
