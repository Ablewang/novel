/**
 * KnowledgeService - 结构化知识检索
 *
 * 从 StorageService 读取世界观、角色、大纲，组装为完整的 Markdown 上下文文本，
 * 供 Agent 注入到 system prompt 中。
 */
import { Provide, Inject } from '@midwayjs/core';
import { StorageService } from './storage.service.js';
import type { WorldSetting, Character, OutlineTree } from '@nova/shared';

@Provide()
export class KnowledgeService {
  @Inject()
  storageService!: StorageService;

  /**
   * 获取项目的完整结构化上下文（世界观 + 角色 + 大纲）
   * 返回 Markdown 格式文本，可直接拼入 system prompt
   */
  getStructuredContext(projectId: string): string {
    const snapshot = this.storageService.getProjectSnapshot(projectId);
    if (!snapshot) return '';

    const parts: string[] = [];

    // 世界观
    if (snapshot.world) {
      parts.push(this.formatWorld(snapshot.world));
    }

    // 角色
    if (snapshot.characters.length > 0) {
      parts.push(this.formatCharacters(snapshot.characters));
    }

    // 大纲
    if (snapshot.outline) {
      parts.push(this.formatOutline(snapshot.outline));
    }

    return parts.join('\n\n---\n\n');
  }

  private formatWorld(world: WorldSetting): string {
    const lines: string[] = ['## 世界观设定'];
    lines.push(`**背景**: ${world.background}`);

    if (world.coreConflict) {
      lines.push(`**核心冲突**: ${world.coreConflict}`);
    }

    if (world.powerSystems.length > 0) {
      lines.push('**力量体系**:');
      for (const ps of world.powerSystems) {
        lines.push(`- ${ps.name}: ${ps.levels.join(' → ')}`);
        if (ps.rules.length > 0) {
          lines.push(`  规则: ${ps.rules.join('; ')}`);
        }
      }
    }

    if (world.geography.length > 0) {
      lines.push('**地理**:');
      for (const loc of world.geography) {
        lines.push(`- ${loc.name}: ${loc.description}`);
      }
    }

    if (world.concepts.length > 0) {
      lines.push('**核心概念**:');
      for (const c of world.concepts) {
        lines.push(`- ${c.term}: ${c.definition}`);
      }
    }

    return lines.join('\n');
  }

  private formatCharacters(characters: Character[]): string {
    const lines: string[] = ['## 角色档案'];
    for (const c of characters) {
      const traits = c.personality.traits.join('/');
      const fears = c.personality.fears.join('/');
      lines.push(`### ${c.name} (${c.role})`);
      lines.push(`- 年龄: ${c.age}, 性别: ${c.gender}`);
      lines.push(`- 性格特征: ${traits}`);
      lines.push(`- 核心驱动: ${c.personality.coreDrive}`);
      lines.push(`- 恐惧: ${fears}`);
      lines.push(`- 说话风格: ${c.personality.speakingStyle}`);
      if (c.gapMoe) lines.push(`- 反差萌: ${c.gapMoe}`);
      lines.push(`- 背景: ${c.background}`);
      if (c.arc) {
        lines.push(`- 成长弧: ${c.arc.startState} → ${c.arc.endState}`);
      }
    }
    return lines.join('\n');
  }

  private formatOutline(outline: OutlineTree): string {
    const lines: string[] = ['## 大纲结构'];
    for (const vol of outline.volumes) {
      lines.push(`### ${vol.title}`);
      if (vol.summary) lines.push(`> ${vol.summary}`);
      for (const ch of vol.chapters) {
        const statusTag = ch.status !== 'PLANNED' ? ` [${ch.status}]` : '';
        lines.push(`#### ${ch.title}${statusTag}`);
        lines.push(`摘要: ${ch.summary}`);
        if (ch.beats.length > 0) {
          for (const beat of ch.beats) {
            lines.push(`  - [${beat.type}] ${beat.summary} (${beat.emotionalTone})`);
          }
        }
      }
    }
    return lines.join('\n');
  }
}
