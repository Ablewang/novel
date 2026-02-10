/**
 * Melo Novel Agent - Core Data Schemas (shared)
 *
 * 定义了 Agent 之间协作的基础数据结构（Blackboard Context）。
 */

// ==========================================
// 执行模式
// ==========================================
export type ExecutionMode = 'AUTO' | 'CO_PILOT' | 'MANUAL';

// ==========================================
// 1. 小说项目根对象
// ==========================================
export interface NovelProject {
  id: string;
  metadata: {
    title: string;
    genre: string;
    tags: string[];
    targetAudience: string;
    logline: string;
  };
  currentProgress: {
    volumeIndex: number;
    chapterIndex: number;
    sceneIndex: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 2. 世界观设定
// ==========================================
export interface PowerSystem {
  name: string;
  levels: string[];
  rules: string[];
}

export interface NovelLocation {
  id: string;
  name: string;
  description: string;
  atmosphere: string;
  parentLocationId?: string;
}

export interface NovelItem {
  id: string;
  name: string;
  description: string;
  significance: string;
}

export interface WorldSetting {
  id: string;
  background: string;
  powerSystems: PowerSystem[];
  geography: NovelLocation[];
  items: NovelItem[];
  concepts: { term: string; definition: string }[];
  coreConflict: string;
}

// ==========================================
// 3. 角色档案
// ==========================================
export interface CharacterRelationship {
  targetCharId: string;
  type: string;
  description: string;
}

export interface Character {
  id: string;
  name: string;
  role: 'PROTAGONIST' | 'ANTAGONIST' | 'SUPPORTING' | 'MOB';
  age: string;
  gender: string;
  appearance: string;
  personality: {
    traits: string[];
    coreDrive: string;
    fears: string[];
    moralLine: string;
    speakingStyle: string;
  };
  gapMoe?: string;
  background: string;
  relationships: CharacterRelationship[];
  arc: {
    startState: string;
    endState: string;
    keyEvents: string[];
  };
}

// ==========================================
// 4. 大纲结构
// ==========================================
export interface SceneBeat {
  id: string;
  type: string;
  locationId?: string;
  activeCharacterIds: string[];
  summary: string;
  purpose: string;
  emotionalTone: string;
}

export interface ChapterNode {
  id: string;
  title: string;
  summary: string;
  povCharacterId?: string;
  beats: SceneBeat[];
  status: 'PLANNED' | 'DRAFTING' | 'REVIEWING' | 'DONE';
  content?: string;
}

export interface VolumeNode {
  id: string;
  title: string;
  summary: string;
  chapters: ChapterNode[];
}

export interface OutlineTree {
  id: string;
  volumes: VolumeNode[];
}

// ==========================================
// 5. Director 路由目标
// ==========================================
export type RouteTarget =
  | 'world_builder'
  | 'casting_director'
  | 'outliner'
  | 'write_chapter'
  | 'direct_response';

// ==========================================
// 6. 项目快照 (API 返回)
// ==========================================
export interface ProjectSnapshot {
  project: NovelProject;
  world: WorldSetting | null;
  characters: Character[];
  outline: OutlineTree | null;
}
