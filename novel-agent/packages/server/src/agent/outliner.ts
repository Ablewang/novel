/**
 * Outliner Agent - 剧情结构师
 */
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createLLM } from './llm.js';
import { loadSkillPrompt } from '../prompt/loader.js';
import type { NovelState } from '../graph/graph-state.js';

const llm = createLLM(0.7);
const skill = loadSkillPrompt('outliner');

const OUTPUT_INSTRUCTION = `
请根据用户的要求，生成或修改大纲结构。
你必须输出一个 JSON 对象，结构如下：
{
  "outline": {
    "id": "outline_1",
    "volumes": [
      {
        "id": "vol_1",
        "title": "卷标题",
        "summary": "卷摘要",
        "chapters": [
          {
            "id": "ch_1",
            "title": "章标题",
            "summary": "章摘要",
            "povCharacterId": "char_001",
            "beats": [
              {
                "id": "beat_1",
                "type": "Hook",
                "activeCharacterIds": ["char_001"],
                "summary": "发生了什么",
                "purpose": "这个场景的功能",
                "emotionalTone": "情感基调"
              }
            ],
            "status": "PLANNED"
          }
        ]
      }
    ]
  },
  "agentOutput": "向用户展示的大纲概要说明（Markdown格式，用中文）"
}

注意：
- 如果已有大纲，在其基础上修改/扩展，而不是从零重建。
- 每个 beat 的 type 建议使用：Hook, Conflict, Turning, Climax, Resolution, Transition。
- beats 的 emotionalTone 使用中文情绪词（如：紧张、愤怒、温馨、悲伤）。
只输出 JSON，不要输出其他任何文字。
`;

export async function outlinerNode(state: NovelState): Promise<Partial<NovelState>> {
  const existingOutline = state.outline
    ? `\n\n已有大纲:\n${JSON.stringify(state.outline, null, 2)}`
    : '';
  const worldContext = state.worldSetting
    ? `\n\n世界观背景:\n${state.worldSetting.background}\n核心冲突: ${state.worldSetting.coreConflict}`
    : '';
  const charContext = state.characters.length > 0
    ? `\n\n角色列表:\n${state.characters.map((c) => `- ${c.name}(${c.role}): ${c.personality.coreDrive}`).join('\n')}`
    : '';

  const response = await llm.invoke([
    new SystemMessage(skill.content + '\n\n' + OUTPUT_INSTRUCTION + existingOutline + worldContext + charContext),
    new HumanMessage(state.userMessage),
  ]);

  try {
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || text);
    return {
      outline: parsed.outline,
      agentOutput: parsed.agentOutput || '大纲已生成/更新。',
    };
  } catch {
    return {
      agentOutput: typeof response.content === 'string' ? response.content : '大纲生成时遇到了问题。',
    };
  }
}
