/**
 * Casting Director Agent - 角色总监
 */
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createLLM } from './llm.js';
import { loadSkillPrompt } from '../prompt/loader.js';
import type { NovelState } from '../graph/graph-state.js';
import type { Character } from '@novel-agent/shared';

const llm = createLLM(0.8);
const skill = loadSkillPrompt('casting_director');

const OUTPUT_INSTRUCTION = `
请根据用户的要求，创建或修改角色。
你必须输出一个 JSON 对象，结构如下：
{
  "characters": [
    {
      "id": "char_001",
      "name": "角色名",
      "role": "PROTAGONIST",
      "age": "19",
      "gender": "男",
      "appearance": "外貌描写",
      "personality": {
        "traits": ["标签1", "标签2"],
        "coreDrive": "核心欲望",
        "fears": ["恐惧"],
        "moralLine": "道德底线",
        "speakingStyle": "说话风格"
      },
      "gapMoe": "反差萌描述",
      "background": "生平经历",
      "relationships": [],
      "arc": {
        "startState": "初始状态",
        "endState": "终态",
        "keyEvents": ["关键事件"]
      }
    }
  ],
  "agentOutput": "向用户展示的角色概要说明（Markdown格式，用中文）"
}

注意：
- 如果是新建角色，直接返回新角色列表。
- 如果是修改角色，返回修改后的完整角色列表（包含未修改的角色）。
- 角色的 role 只能是 PROTAGONIST, ANTAGONIST, SUPPORTING, MOB 之一。
只输出 JSON，不要输出其他任何文字。
`;

export async function castingDirectorNode(state: NovelState): Promise<Partial<NovelState>> {
  const existingContext = state.characters.length > 0
    ? `\n\n已有角色:\n${JSON.stringify(state.characters, null, 2)}`
    : '';
  const worldContext = state.worldSetting
    ? `\n\n世界观背景:\n${state.worldSetting.background}`
    : '';

  const response = await llm.invoke([
    new SystemMessage(skill.content + '\n\n' + OUTPUT_INSTRUCTION + existingContext + worldContext),
    new HumanMessage(state.userMessage),
  ]);

  try {
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || text);
    const newChars: Character[] = parsed.characters || [];
    const existingIds = new Set(state.characters.map((c) => c.id));
    const merged = [
      ...state.characters.map((existing) => {
        const updated = newChars.find((n) => n.id === existing.id);
        return updated || existing;
      }),
      ...newChars.filter((n) => !existingIds.has(n.id)),
    ];
    return {
      characters: merged,
      agentOutput: parsed.agentOutput || '角色已创建/更新。',
    };
  } catch {
    return {
      agentOutput: typeof response.content === 'string' ? response.content : '角色生成时遇到了问题。',
    };
  }
}
