/**
 * World Builder Agent - 设定架构师
 */
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createLLM } from './llm.js';
import { loadSkillPrompt } from '../prompt/loader.js';
import type { NovelState } from '../graph/graph-state.js';

const llm = createLLM(0.8);
const skill = loadSkillPrompt('world_builder');

const OUTPUT_INSTRUCTION = `
请根据用户的要求，生成或修改世界观设定。
你必须输出一个 JSON 对象，结构如下：
{
  "worldSetting": {
    "id": "world_1",
    "background": "宏观背景描述",
    "powerSystems": [{ "name": "体系名称", "levels": ["Lv1名", "Lv2名"], "rules": ["规则1"] }],
    "geography": [{ "id": "loc_1", "name": "地名", "description": "描述", "atmosphere": "氛围" }],
    "items": [{ "id": "item_1", "name": "物品名", "description": "描述", "significance": "意义" }],
    "concepts": [{ "term": "术语", "definition": "解释" }],
    "coreConflict": "核心冲突描述"
  },
  "agentOutput": "向用户展示的设定概要说明（Markdown格式，用中文）"
}

只输出 JSON，不要输出其他任何文字。
`;

export async function worldBuilderNode(state: NovelState): Promise<Partial<NovelState>> {
  const existingContext = state.worldSetting
    ? `\n\n已有世界观:\n${JSON.stringify(state.worldSetting, null, 2)}`
    : '';

  const response = await llm.invoke([
    new SystemMessage(skill.content + '\n\n' + OUTPUT_INSTRUCTION + existingContext),
    new HumanMessage(state.userMessage),
  ]);

  try {
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || text);
    return {
      worldSetting: parsed.worldSetting,
      agentOutput: parsed.agentOutput || '世界观设定已生成。',
    };
  } catch {
    return {
      agentOutput: typeof response.content === 'string' ? response.content : '世界观生成时遇到了问题。',
    };
  }
}
