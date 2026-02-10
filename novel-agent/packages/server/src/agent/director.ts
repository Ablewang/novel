/**
 * Director Agent - 总导演
 */
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createJsonLLM } from './llm.js';
import { loadSkillPrompt } from '../prompt/loader.js';
import type { NovelState } from '../graph/graph-state.js';
import type { RouteTarget } from '@novel-agent/shared';

const llm = createJsonLLM();
const skill = loadSkillPrompt('director');

const ROUTE_INSTRUCTION = `
根据用户的消息，分析意图并决定路由目标。
你必须输出一个 JSON 对象，包含以下字段：
{
  "routeTarget": "world_builder" | "casting_director" | "outliner" | "write_chapter" | "direct_response",
  "reasoning": "你的判断理由（简短一句话）",
  "agentOutput": "回复给用户的简短说明，告知你接下来要做什么"
}

路由规则：
- "world_builder": 用户想创建/修改世界观设定、魔法系统、地理、力量体系
- "casting_director": 用户想创建/修改角色、人物关系、角色弧光
- "outliner": 用户想规划大纲、章节结构、场景节拍
- "write_chapter": 用户想让 AI 写正文、续写、扩写
- "direct_response": 用户只是在聊天、问问题，不需要调用其他 Agent

只输出 JSON，不要输出其他任何文字。
`;

export async function directorNode(state: NovelState): Promise<Partial<NovelState>> {
  const contextParts: string[] = [];
  if (state.worldSetting) {
    contextParts.push(`[当前世界观]: ${state.worldSetting.background}`);
  }
  if (state.characters.length > 0) {
    const names = state.characters.map((c) => `${c.name}(${c.role})`).join(', ');
    contextParts.push(`[已有角色]: ${names}`);
  }
  if (state.outline) {
    const chapterCount = state.outline.volumes.reduce((sum, v) => sum + v.chapters.length, 0);
    contextParts.push(`[大纲状态]: ${state.outline.volumes.length}卷, ${chapterCount}章`);
  }

  const contextSummary = contextParts.length > 0
    ? `\n\n当前项目上下文:\n${contextParts.join('\n')}`
    : '\n\n当前项目为空，尚未创建任何设定。';

  const response = await llm.invoke([
    new SystemMessage(skill.content + '\n\n' + ROUTE_INSTRUCTION + contextSummary),
    new HumanMessage(state.userMessage),
  ]);

  try {
    const text = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || text);
    return {
      routeTarget: parsed.routeTarget as RouteTarget,
      agentOutput: parsed.agentOutput || parsed.reasoning || '',
    };
  } catch {
    return {
      routeTarget: 'direct_response' as RouteTarget,
      agentOutput: typeof response.content === 'string' ? response.content : '我来帮你分析一下...',
    };
  }
}
