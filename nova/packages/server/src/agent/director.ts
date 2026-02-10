/**
 * Director Agent - 总导演
 */
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createJsonLLM } from './llm.js';
import { loadSkillPrompt } from '../prompt/loader.js';
import type { NovelState } from '../graph/graph-state.js';
import type { RouteTarget } from '@nova/shared';

const llm = createJsonLLM();
const skill = loadSkillPrompt('director');

const ROUTE_INSTRUCTION = `
根据用户的消息，分析意图并决定路由目标。
你必须输出一个 JSON 对象，包含以下字段：
{
  "routeTarget": "world_builder" | "casting_director" | "outliner" | "write_chapter" | "direct_response",
  "reasoning": "你的判断理由（简短一句话）",
  "agentOutput": "回复给用户的简短说明"
}

路由规则：
- "world_builder": 用户明确表达要创建/修改世界观设定，且提供了足够信息（如类型、风格、关键设定要素）可以直接开始生成
- "casting_director": 用户明确要创建/修改角色，且提供了足够信息可以直接开始生成
- "outliner": 用户明确要规划大纲/章节，且提供了足够信息可以直接开始生成
- "write_chapter": 用户要写正文/续写/扩写
- "direct_response": 以下任一情况都必须走此路由：
  1. 用户只是在聊天、问问题
  2. 用户的意图虽然明确（比如"创建世界观"），但缺少关键信息（如风格、类型、具体要求），你需要先提问确认
  3. 你需要向用户确认偏好或补充细节

重要：当你需要向用户提问或确认信息时，必须使用 "direct_response"，这样系统会等待用户回复。如果你选择了其他路由（如 "world_builder"），系统会立即开始生成，不会等待用户回答你的问题。

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
  const memoryBlock = state.memorySummary
    ? `\n\n近期对话摘要:\n${state.memorySummary}`
    : '';
  const knowledgeBlock = state.knowledgeContext
    ? `\n\n项目知识库:\n${state.knowledgeContext}`
    : '';

  const response = await llm.invoke([
    new SystemMessage(skill.content + '\n\n' + ROUTE_INSTRUCTION + contextSummary + knowledgeBlock + memoryBlock),
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
