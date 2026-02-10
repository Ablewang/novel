/**
 * LangGraph 图服务 - 单例编译图，供 Controller 调用
 */
import { Provide, Inject } from '@midwayjs/core';
import { StorageService } from './storage.service.js';
import { ChatService } from './chat.service.js';
import { KnowledgeService } from './knowledge.service.js';
import { VectorStoreService } from './vector-store.service.js';
import { buildNovelGraph } from '../graph/novel-graph.js';

@Provide()
export class GraphService {
  @Inject()
  storageService!: StorageService;

  @Inject()
  chatService!: ChatService;

  @Inject()
  knowledgeService!: KnowledgeService;

  @Inject()
  vectorStoreService!: VectorStoreService;

  private app: ReturnType<typeof buildNovelGraph> | null = null;

  getApp(): ReturnType<typeof buildNovelGraph> {
    if (!this.app) {
      this.app = buildNovelGraph(
        this.storageService,
        this.chatService,
        this.knowledgeService,
        this.vectorStoreService,
      );
    }
    return this.app;
  }
}
