import { Controller, Post, Inject, Body } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { v4 as uuidv4 } from 'uuid';
import { HumanMessage, AIMessageChunk } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { GraphService } from '../service/graph.service.js';
import { StorageService } from '../service/storage.service.js';
import { ChatService } from '../service/chat.service.js';
import type { ServerResponse } from 'node:http';

/**
 * 处理 LangGraph 的 [messages, updates] 双模式流
 * messages 模式：逐 token 输出 → SSE type: 'token'
 * updates 模式：节点完成 → SSE type: 'node' + 持久化消息
 */
async function handleGraphStream(
  stream: AsyncIterable<[string, unknown]>,
  res: ServerResponse,
  chatService: ChatService,
  projectId: string,
  threadId: string,
) {
  for await (const tuple of stream) {
    const [mode, data] = tuple;

    if (mode === 'messages') {
      const [chunk, metadata] = data as [AIMessageChunk, Record<string, unknown>];
      const content = typeof chunk.content === 'string' ? chunk.content : '';
      if (content) {
        res.write(`data: ${JSON.stringify({
          type: 'token',
          node: metadata?.langgraph_node ?? '',
          content,
        })}\n\n`);
      }
    } else if (mode === 'updates') {
      const updates = data as Record<string, Record<string, unknown>>;
      for (const [nodeName, nodeUpdate] of Object.entries(updates)) {
        const agentOutput = (nodeUpdate.agentOutput as string) ?? null;

        res.write(`data: ${JSON.stringify({
          type: 'node',
          node: nodeName,
          agentOutput,
          routeTarget: nodeUpdate.routeTarget ?? null,
        })}\n\n`);

        // 持久化有内容的 agent 输出
        if (agentOutput && projectId) {
          chatService.appendMessage(projectId, threadId, {
            role: 'assistant',
            content: agentOutput,
            node: nodeName,
          });
        }
      }
    }
  }
}

@Controller('/api')
export class ChatController {
  @Inject()
  graphService!: GraphService;

  @Inject()
  storageService!: StorageService;

  @Inject()
  chatService!: ChatService;

  @Inject()
  ctx!: Context;

  @Post('/chat')
  async chat(@Body() body: { projectId?: string; message: string; threadId?: string }) {
    const { projectId, message, threadId } = body;
    const ctx = this.ctx;
    if (!message) {
      ctx.status = 400;
      return { error: 'message is required' };
    }

    ctx.set('Content-Type', 'text/event-stream');
    ctx.set('Cache-Control', 'no-cache');
    ctx.set('Connection', 'keep-alive');
    ctx.status = 200;
    const res = ctx.res;

    const currentThreadId = threadId || uuidv4();
    const config = { configurable: { thread_id: currentThreadId } };

    // 确保 thread 存在
    if (projectId) {
      const existing = this.chatService.getThread(projectId, currentThreadId);
      if (!existing) {
        this.chatService.createThread(projectId, currentThreadId, message.slice(0, 30));
      }
      // 持久化用户消息
      this.chatService.appendMessage(projectId, currentThreadId, {
        role: 'user',
        content: message,
      });
    }

    let initialState: Record<string, unknown> = {
      userMessage: message,
      projectId: projectId || '',
      threadId: currentThreadId,
      messages: [new HumanMessage(message)],
    };

    if (projectId) {
      const snapshot = this.storageService.getProjectSnapshot(projectId);
      if (snapshot) {
        initialState = {
          ...initialState,
          worldSetting: snapshot.world,
          characters: snapshot.characters,
          outline: snapshot.outline,
        };
      }
    }

    try {
      res.write(`data: ${JSON.stringify({ type: 'thread', threadId: currentThreadId })}\n\n`);

      const app = this.graphService.getApp();
      const stream = await app.stream(initialState, {
        ...config,
        streamMode: ['messages', 'updates'] as any,
      });

      await handleGraphStream(stream as any, res, this.chatService, projectId || '', currentThreadId);

      const finalState = await app.getState(config);
      res.write(`data: ${JSON.stringify({
        type: 'done',
        state: {
          agentOutput: finalState.values?.agentOutput,
          draft: finalState.values?.draft ?? null,
          routeTarget: finalState.values?.routeTarget,
        },
      })}\n\n`);

      if (finalState.next && finalState.next.length > 0) {
        res.write(`data: ${JSON.stringify({
          type: 'interrupt',
          pendingNode: finalState.next[0],
          instruction: '请审核以上内容，输入修改意见或回复"确认"以继续。',
        })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      // 持久化错误信息
      if (projectId) {
        this.chatService.appendMessage(projectId, currentThreadId, {
          role: 'system',
          content: `错误: ${errMsg}`,
        });
      }
      res.write(`data: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
      res.end();
    }
  }

  @Post('/resume')
  async resume(@Body() body: { projectId?: string; threadId: string; feedback?: string }) {
    const { projectId, threadId, feedback } = body;
    const ctx = this.ctx;
    if (!threadId) {
      ctx.status = 400;
      return { error: 'threadId is required' };
    }

    ctx.set('Content-Type', 'text/event-stream');
    ctx.set('Cache-Control', 'no-cache');
    ctx.set('Connection', 'keep-alive');
    ctx.status = 200;
    const res = ctx.res;

    const config = { configurable: { thread_id: threadId } };
    const feedbackText = feedback || '确认';

    // 持久化用户反馈
    if (projectId) {
      this.chatService.appendMessage(projectId, threadId, {
        role: 'user',
        content: feedbackText,
      });
    }

    try {
      const resumeInput = new Command({ resume: feedbackText });
      const app = this.graphService.getApp();
      const stream = await app.stream(resumeInput, {
        ...config,
        streamMode: ['messages', 'updates'] as any,
      });

      await handleGraphStream(stream as any, res, this.chatService, projectId || '', threadId);

      const finalState = await app.getState(config);
      res.write(`data: ${JSON.stringify({
        type: 'done',
        state: {
          agentOutput: finalState.values?.agentOutput,
          draft: finalState.values?.draft ?? null,
        },
      })}\n\n`);

      if (finalState.next && finalState.next.length > 0) {
        res.write(`data: ${JSON.stringify({
          type: 'interrupt',
          pendingNode: finalState.next[0],
          instruction: '请审核以上内容，输入修改意见或回复"确认"以继续。',
        })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (projectId) {
        this.chatService.appendMessage(projectId, threadId, {
          role: 'system',
          content: `错误: ${errMsg}`,
        });
      }
      res.write(`data: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
      res.end();
    }
  }
}
