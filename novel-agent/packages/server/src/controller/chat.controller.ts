import { Controller, Post, Inject, Body } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { v4 as uuidv4 } from 'uuid';
import { HumanMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { GraphService } from '../service/graph.service.js';
import { StorageService } from '../service/storage.service.js';

@Controller('/api')
export class ChatController {
  @Inject()
  graphService!: GraphService;

  @Inject()
  storageService!: StorageService;

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

    let initialState: Record<string, unknown> = {
      userMessage: message,
      projectId: projectId || '',
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
      const stream = await app.stream(initialState, { ...config, streamMode: 'updates' });

      for await (const event of stream) {
        for (const [nodeName, update] of Object.entries(event)) {
          const nodeUpdate = update as Record<string, unknown>;
          res.write(`data: ${JSON.stringify({
            type: 'node',
            node: nodeName,
            agentOutput: nodeUpdate.agentOutput ?? null,
            routeTarget: nodeUpdate.routeTarget ?? null,
          })}\n\n`);
        }
      }

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
      res.write(`data: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
      res.end();
    }
  }

  @Post('/resume')
  async resume(@Body() body: { threadId: string; feedback?: string }) {
    const { threadId, feedback } = body;
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

    try {
      const resumeInput = new Command({ resume: feedback || '确认' });
      const app = this.graphService.getApp();
      const stream = await app.stream(resumeInput, { ...config, streamMode: 'updates' });

      for await (const event of stream) {
        for (const [nodeName, update] of Object.entries(event)) {
          const nodeUpdate = update as Record<string, unknown>;
          res.write(`data: ${JSON.stringify({
            type: 'node',
            node: nodeName,
            agentOutput: nodeUpdate.agentOutput ?? null,
          })}\n\n`);
        }
      }

      const finalState = await app.getState(config);
      res.write(`data: ${JSON.stringify({
        type: 'done',
        state: {
          agentOutput: finalState.values?.agentOutput,
          draft: finalState.values?.draft ?? null,
        },
      })}\n\n`);

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
      res.end();
    }
  }
}
