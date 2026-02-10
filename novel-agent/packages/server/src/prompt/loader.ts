/**
 * Prompt 加载器 - 读取 Architecture/Skills/{AgentName}/SKILL.md
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface SkillPrompt {
  name: string;
  description: string;
  content: string;
}

/** Skills 目录：从 monorepo 根 (novel-agent) 的上级 novel_writing_guide 取 Architecture/Skills */
const SKILLS_DIR = path.resolve(
  process.cwd(),
  '..',
  '..',
  '..',
  'Architecture',
  'Skills',
);

const AGENT_SKILL_MAP: Record<string, string> = {
  director: 'Director',
  world_builder: 'WorldBuilder',
  casting_director: 'CastingDirector',
  outliner: 'Outliner',
  writer: 'Writer',
  editor: 'Editor',
};

export function loadSkillPrompt(agentName: string): SkillPrompt {
  const dirName = AGENT_SKILL_MAP[agentName];
  if (!dirName) throw new Error(`Unknown agent: ${agentName}`);

  const filePath = path.join(SKILLS_DIR, dirName, 'SKILL.md');
  if (!fs.existsSync(filePath)) throw new Error(`SKILL.md not found: ${filePath}`);

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    name: (data.name as string) || agentName,
    description: (data.description as string) || '',
    content: content.trim(),
  };
}

export function loadAllSkillPrompts(): Record<string, SkillPrompt> {
  const result: Record<string, SkillPrompt> = {};
  for (const agentName of Object.keys(AGENT_SKILL_MAP)) {
    result[agentName] = loadSkillPrompt(agentName);
  }
  return result;
}
