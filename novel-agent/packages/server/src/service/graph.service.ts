/**
 * LangGraph 图服务 - 单例编译图，供 Controller 调用
 */
import { Provide, Inject } from '@midwayjs/core';
import { StorageService } from './storage.service.js';
import { buildNovelGraph } from '../graph/novel-graph.js';

@Provide()
export class GraphService {
  @Inject()
  storageService!: StorageService;

  private app: ReturnType<typeof buildNovelGraph> | null = null;

  getApp(): ReturnType<typeof buildNovelGraph> {
    if (!this.app) {
      this.app = buildNovelGraph(this.storageService);
    }
    return this.app;
  }
}
