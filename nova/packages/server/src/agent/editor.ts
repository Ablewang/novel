/**
 * Editor Agent - 审校编辑
 */
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createJsonLLM } from './llm.js';
import { loadSkillPrompt } from '../prompt/loader.js';
import type { NovelState } from '../graph/graph-state.js';

const llm = createJsonLLM();
const skill = loadSkillPrompt('editor');

const OUTPUT_INSTRUCTION = `
请审查以下小说草稿。

你必须输出一个 JSON 对象：
{
  "status": "PASS" | "REVISE",
  "score": 0-100,
  "summary": "整体评价（一句话）",
  "issues": [
    {
      "type": "Character | Pacing | Logic | Style | WeakVerb",
      "severity": "High | Medium | Low",
      "location": "问题位置描述",
      "comment": "问题说明",
      "suggestion": "具体修改建议"
    }
  ],
  "agentOutput": "向用户展示的审查报告（Markdown格式，用中文）"
}

评分标准：
- 80 分以上：PASS（可以接受）
- 80 分以下：REVISE（需要修改）

检查项：
1. 情绪密度：每 500 字是否有至少一个情绪刺激点？
2. 弱动词：是否存在 "觉得/开始/进行" 等废词？
3. Show vs Tell：是否有直接讲述而非展示的描写？
4. 角色一致性：角色行为是否符合其人设？
5. 钩子：章节结尾是否有悬念/钩子？

只输出 JSON，不要输出其他任何文字。
`;

export async function editorNode(state: NovelState): Promise<Partial<NovelState>> {
  const charContext = state.characters.length > 0
    ? `\n\n角色设定（用于 OOC 检查）:\n${state.characters.map((c) => `- ${c.name}: ${c.personality.traits.join('/')}, 恐惧: ${c.personality.fears.join('/')}`).join('\n')}`
    : '';
  const chapterContext = state.currentChapter
    ? `\n\n本章大纲:\n${state.currentChapter.summary}`
    : '';
  const memoryBlock = state.memorySummary
    ? `\n\n近期对话摘要:\n${state.memorySummary}`
    : '';
  const knowledgeBlock = state.knowledgeContext
    ? `\n\n项目知识库:\n${state.knowledgeContext}`
    : '';

  const response = await llm.invoke([
    new SystemMessage(skill.content + '\n\n' + OUTPUT_INSTRUCTION + charContext + chapterContext + knowledgeBlock + memoryBlock),
    new HumanMessage(`请审查以下草稿:\n\n${state.draft}`),
  ]);

  try {
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || text);
    return {
      critique: parsed.status === 'PASS' ? '' : JSON.stringify(parsed.issues || [], null, 2),
      agentOutput: parsed.agentOutput || `审查完成：${parsed.status}（${parsed.score}分）`,
    };
  } catch {
    return {
      critique: '',
      agentOutput: '审查完成，草稿质量达标。',
    };
  }
}
