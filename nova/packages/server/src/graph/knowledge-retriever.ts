/**
 * 知识检索节点：用向量检索找到与当前意图/章节相关的历史剧情概要
 *
 * 流程：
 * 1. 若 embedding 服务不可用 → 降级返回空
 * 2. 确保索引存在（懒构建）
 * 3. 用 userMessage（或 currentChapter.summary）作为 query 文本做 embed
 * 4. 余弦相似度 topK=5
 * 5. 将结果拼成 knowledgeRetrieved 字符串
 */
import type { NovelState } from './graph-state.js';
import type { VectorStoreService } from '../service/vector-store.service.js';
import { embed, isEmbeddingAvailable } from '../agent/embedding.js';

const TOP_K = 5;

export function createKnowledgeRetrieverNode(vectorStore: VectorStoreService) {
  return async function knowledgeRetrieverNode(state: NovelState): Promise<Partial<NovelState>> {
    const { projectId } = state;

    // 若无项目或 embedding 不可用，降级返回空
    if (!projectId || !isEmbeddingAvailable()) {
      return { knowledgeRetrieved: '' };
    }

    try {
      // 确保索引存在
      await vectorStore.ensureIndex(projectId);

      // 构造查询文本：优先用当前章摘要，否则用 userMessage
      const queryText = state.currentChapter?.summary || state.userMessage || '';
      if (!queryText) {
        return { knowledgeRetrieved: '' };
      }

      // 嵌入查询文本
      const queryEmbedding = await embed(queryText);

      // 检索
      const results = vectorStore.query(projectId, queryEmbedding, TOP_K);
      if (results.length === 0) {
        return { knowledgeRetrieved: '' };
      }

      // 拼成可读文本
      const lines = results.map((r, i) =>
        `${i + 1}. [${r.volumeTitle} / ${r.chapterTitle}] (相关度: ${(r.score * 100).toFixed(0)}%)\n   ${r.text}`
      );
      const retrieved = `以下是与当前意图最相关的剧情概要（共 ${results.length} 条）:\n\n${lines.join('\n\n')}`;

      return { knowledgeRetrieved: retrieved };
    } catch (err) {
      // embedding 调用失败时静默降级
      console.warn('[knowledgeRetriever] 向量检索失败，降级为空:', err);
      return { knowledgeRetrieved: '' };
    }
  };
}
