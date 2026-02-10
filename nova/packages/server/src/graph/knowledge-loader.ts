/**
 * 结构化知识加载节点：从 KnowledgeService 读取完整世界观+角色+大纲，写入 state
 */
import type { NovelState } from './graph-state.js';
import type { KnowledgeService } from '../service/knowledge.service.js';

export function createKnowledgeLoaderNode(knowledgeService: KnowledgeService) {
  return function knowledgeLoaderNode(state: NovelState): Partial<NovelState> {
    const { projectId } = state;
    if (!projectId) {
      return { knowledgeContext: '' };
    }

    const context = knowledgeService.getStructuredContext(projectId);
    return { knowledgeContext: context };
  };
}
