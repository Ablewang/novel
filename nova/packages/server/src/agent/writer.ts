/**
 * Writer Agent - 执行主笔
 */
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createLLM } from './llm.js';
import { loadSkillPrompt } from '../prompt/loader.js';
import type { NovelState } from '../graph/graph-state.js';

const llm = createLLM(0.9);
const skill = loadSkillPrompt('writer');

export async function writerNode(state: NovelState): Promise<Partial<NovelState>> {
  const contextParts: string[] = [];
  if (state.worldSetting) {
    contextParts.push(`【世界观】\n${state.worldSetting.background}`);
    if (state.worldSetting.powerSystems.length > 0) {
      const ps = state.worldSetting.powerSystems[0];
      contextParts.push(`【力量体系】${ps.name}: ${ps.levels.join(' -> ')}`);
    }
  }
  if (state.characters.length > 0) {
    const charDesc = state.characters.map((c) =>
      `- ${c.name}(${c.role}): ${c.personality.traits.join('/')}，说话风格: ${c.personality.speakingStyle}`
    ).join('\n');
    contextParts.push(`【登场角色】\n${charDesc}`);
  }
  if (state.currentChapter) {
    contextParts.push(`【本章信息】\n标题: ${state.currentChapter.title}\n摘要: ${state.currentChapter.summary}`);
    if (state.currentChapter.beats.length > 0) {
      const beatDesc = state.currentChapter.beats.map((b, i) =>
        `  ${i + 1}. [${b.type}] ${b.summary} (情感: ${b.emotionalTone})`
      ).join('\n');
      contextParts.push(`【场景节拍】\n${beatDesc}`);
    }
  }
  const critiqueContext = state.critique
    ? `\n\n【审校反馈 - 请根据以下意见修改】\n${state.critique}\n\n【上一版草稿】\n${state.draft}`
    : '';
  const memoryBlock = state.memorySummary
    ? `\n\n【近期对话摘要】\n${state.memorySummary}`
    : '';
  const knowledgeBlock = state.knowledgeContext
    ? `\n\n【项目知识库】\n${state.knowledgeContext}`
    : '';
  const retrievedBlock = state.knowledgeRetrieved
    ? `\n\n【剧情知识检索】\n${state.knowledgeRetrieved}`
    : '';

  const systemPrompt = [
    skill.content,
    "\n\n请根据以下上下文和用户指令，撰写小说正文。",
    "输出格式：纯中文小说正文（Markdown），不要输出 JSON。",
    "要求：2000-3000字，遵循 Show Don't Tell 原则。",
    "\n\n",
    contextParts.join("\n\n"),
    knowledgeBlock,
    retrievedBlock,
    memoryBlock,
    critiqueContext,
  ].join("");

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(state.userMessage),
  ]);

  const draft = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);

  return {
    draft,
    revisionCount: state.revisionCount + 1,
    agentOutput: `正文草稿已生成（第 ${state.revisionCount + 1} 版，约 ${draft.length} 字）。`,
  };
}
