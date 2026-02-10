/**
 * VectorStoreService - 轻量级向量存储
 *
 * 以「章概要」为粒度做向量化，持久化到 data/projects/{projectId}/vectors.json。
 * 内存中缓存，支持余弦相似度检索。
 */
import { Provide, Inject } from '@midwayjs/core';
import fs from 'node:fs';
import path from 'node:path';
import { StorageService } from './storage.service.js';
import { embedBatch, isEmbeddingAvailable } from '../agent/embedding.js';

export interface VectorEntry {
  id: string;           // chapterId
  volumeTitle: string;
  chapterTitle: string;
  text: string;         // 用于 embed 的概要文本
  embedding: number[];
}

interface VectorIndex {
  projectId: string;
  updatedAt: string;
  entries: VectorEntry[];
}

@Provide()
export class VectorStoreService {
  @Inject()
  storageService!: StorageService;

  /** 内存缓存：projectId → VectorIndex */
  private cache = new Map<string, VectorIndex>();

  private get dataDir(): string {
    return path.resolve(process.cwd(), '..', '..', 'data', 'projects');
  }

  private vectorFile(projectId: string): string {
    return path.join(this.dataDir, projectId, 'vectors.json');
  }

  /**
   * 从磁盘加载或返回空
   */
  private loadFromDisk(projectId: string): VectorIndex | null {
    const file = this.vectorFile(projectId);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as VectorIndex;
    } catch {
      return null;
    }
  }

  /**
   * 持久化到磁盘
   */
  private saveToDisk(index: VectorIndex): void {
    const dir = path.dirname(this.vectorFile(index.projectId));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.vectorFile(index.projectId), JSON.stringify(index, null, 2), 'utf-8');
  }

  /**
   * 获取索引（优先内存 → 磁盘 → null）
   */
  private getIndex(projectId: string): VectorIndex | null {
    if (this.cache.has(projectId)) return this.cache.get(projectId)!;
    const fromDisk = this.loadFromDisk(projectId);
    if (fromDisk) {
      this.cache.set(projectId, fromDisk);
    }
    return fromDisk;
  }

  /**
   * 从大纲重建向量索引（以章为粒度）
   * 每章概要 = 卷名 + 章 title + chapter.summary + beats 的 summary
   */
  async rebuildIndex(projectId: string): Promise<VectorIndex> {
    const outline = this.storageService.getOutline(projectId);
    if (!outline || outline.volumes.length === 0) {
      const empty: VectorIndex = { projectId, updatedAt: new Date().toISOString(), entries: [] };
      this.cache.set(projectId, empty);
      this.saveToDisk(empty);
      return empty;
    }

    // 收集所有章的概要文本
    const items: { id: string; volumeTitle: string; chapterTitle: string; text: string }[] = [];
    for (const vol of outline.volumes) {
      for (const ch of vol.chapters) {
        const beatsSummary = ch.beats.map((b) => `[${b.type}] ${b.summary}`).join('; ');
        const text = [
          `卷: ${vol.title}`,
          `章: ${ch.title}`,
          `摘要: ${ch.summary}`,
          beatsSummary ? `情节: ${beatsSummary}` : '',
        ].filter(Boolean).join('\n');

        items.push({ id: ch.id, volumeTitle: vol.title, chapterTitle: ch.title, text });
      }
    }

    if (items.length === 0) {
      const empty: VectorIndex = { projectId, updatedAt: new Date().toISOString(), entries: [] };
      this.cache.set(projectId, empty);
      this.saveToDisk(empty);
      return empty;
    }

    // 批量 embedding
    const texts = items.map((i) => i.text);
    const embeddings = await embedBatch(texts);

    const entries: VectorEntry[] = items.map((item, idx) => ({
      id: item.id,
      volumeTitle: item.volumeTitle,
      chapterTitle: item.chapterTitle,
      text: item.text,
      embedding: embeddings[idx],
    }));

    const index: VectorIndex = { projectId, updatedAt: new Date().toISOString(), entries };
    this.cache.set(projectId, index);
    this.saveToDisk(index);
    return index;
  }

  /**
   * 确保索引存在（懒构建）
   */
  async ensureIndex(projectId: string): Promise<VectorIndex> {
    const existing = this.getIndex(projectId);
    if (existing && existing.entries.length > 0) return existing;
    return this.rebuildIndex(projectId);
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * 向量检索：返回与 queryEmbedding 最相似的 topK 条目
   */
  query(
    projectId: string,
    queryEmbedding: number[],
    topK = 5,
  ): { chapterId: string; volumeTitle: string; chapterTitle: string; text: string; score: number }[] {
    const index = this.getIndex(projectId);
    if (!index || index.entries.length === 0) return [];

    const scored = index.entries.map((entry) => ({
      chapterId: entry.id,
      volumeTitle: entry.volumeTitle,
      chapterTitle: entry.chapterTitle,
      text: entry.text,
      score: this.cosineSimilarity(queryEmbedding, entry.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * 检查是否可用（依赖 embedding 服务）
   */
  isAvailable(): boolean {
    return isEmbeddingAvailable();
  }
}
