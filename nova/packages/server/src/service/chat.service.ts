/**
 * 对话持久化服务 — JSONL 存储
 *
 * 目录结构:
 *   data/projects/{projectId}/chats/
 *     ├── threads.json          # ChatThread[]
 *     └── {threadId}.jsonl      # 每行一条 ChatMessage (JSON)
 */
import { Provide } from '@midwayjs/core';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { ChatThread, ChatMessage } from '@nova/shared';

@Provide()
export class ChatService {
  private get dataDir(): string {
    return path.resolve(process.cwd(), '..', '..', 'data', 'projects');
  }

  private chatsDir(projectId: string): string {
    return path.join(this.dataDir, projectId, 'chats');
  }

  private threadsFile(projectId: string): string {
    return path.join(this.chatsDir(projectId), 'threads.json');
  }

  private messagesFile(projectId: string, threadId: string): string {
    return path.join(this.chatsDir(projectId), `${threadId}.jsonl`);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // ─── Thread 管理 ───

  private readThreads(projectId: string): ChatThread[] {
    const file = this.threadsFile(projectId);
    if (!fs.existsSync(file)) return [];
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as ChatThread[];
    } catch {
      return [];
    }
  }

  private writeThreads(projectId: string, threads: ChatThread[]): void {
    this.ensureDir(this.chatsDir(projectId));
    fs.writeFileSync(this.threadsFile(projectId), JSON.stringify(threads, null, 2), 'utf-8');
  }

  createThread(projectId: string, threadId?: string, title?: string): ChatThread {
    const threads = this.readThreads(projectId);
    const now = new Date().toISOString();
    const thread: ChatThread = {
      threadId: threadId || uuidv4(),
      projectId,
      title: title || `对话 ${threads.length + 1}`,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };
    threads.push(thread);
    this.writeThreads(projectId, threads);
    return thread;
  }

  getThread(projectId: string, threadId: string): ChatThread | null {
    const threads = this.readThreads(projectId);
    return threads.find((t) => t.threadId === threadId) || null;
  }

  listThreads(projectId: string): ChatThread[] {
    return this.readThreads(projectId).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  // ─── Message 管理（JSONL 追加写入） ───

  appendMessage(projectId: string, threadId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    this.ensureDir(this.chatsDir(projectId));
    const full: ChatMessage = {
      id: uuidv4(),
      ...msg,
      timestamp: Date.now(),
    };

    // 追加写入 JSONL（高性能，不需要读取/解析整个文件）
    const file = this.messagesFile(projectId, threadId);
    fs.appendFileSync(file, JSON.stringify(full) + '\n', 'utf-8');

    // 更新 thread 的 updatedAt 和 messageCount
    const threads = this.readThreads(projectId);
    const thread = threads.find((t) => t.threadId === threadId);
    if (thread) {
      thread.updatedAt = new Date().toISOString();
      thread.messageCount += 1;
      this.writeThreads(projectId, threads);
    }

    return full;
  }

  /**
   * 分页读取消息（从最新到最旧）
   * offset=0, limit=50 → 最近 50 条
   */
  getMessages(projectId: string, threadId: string, offset = 0, limit = 50): ChatMessage[] {
    const file = this.messagesFile(projectId, threadId);
    if (!fs.existsSync(file)) return [];

    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    // 反转后分页（最新的在前）
    const reversed = lines.reverse();
    const page = reversed.slice(offset, offset + limit);

    return page.map((line) => {
      try { return JSON.parse(line) as ChatMessage; }
      catch { return null; }
    }).filter(Boolean) as ChatMessage[];
  }

  /**
   * 获取最近 N 条消息（按时间正序，供 LLM 上下文用）
   */
  getLatestMessages(projectId: string, threadId: string, count = 10): ChatMessage[] {
    const file = this.messagesFile(projectId, threadId);
    if (!fs.existsSync(file)) return [];

    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    const latest = lines.slice(-count);

    return latest.map((line) => {
      try { return JSON.parse(line) as ChatMessage; }
      catch { return null; }
    }).filter(Boolean) as ChatMessage[];
  }

  /**
   * 获取全部消息数量
   */
  getMessageCount(projectId: string, threadId: string): number {
    const file = this.messagesFile(projectId, threadId);
    if (!fs.existsSync(file)) return 0;
    return fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean).length;
  }
}
