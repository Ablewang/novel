/**
 * Nōva Architecture - Core Data Schemas
 * 
 * 这些接口定义了 Agent 之间协作的基础数据结构（Blackboard Context）。
 */

// ==========================================
// 1. 小说项目根对象 (Root Project)
// ==========================================
export interface NovelProject {
  id: string;
  metadata: {
    title: string;
    genre: string; // 类型：玄幻、都市、悬疑等
    tags: string[];
    targetAudience: string;
    logline: string; // 一句话简介
  };
  worldSettingId: string; // 关联的世界观ID
  characterListId: string; // 关联的角色列表ID
  outlineId: string; // 关联的大纲树ID
  currentProgress: {
    volumeIndex: number;
    chapterIndex: number;
    sceneIndex: number;
  };
}

// ==========================================
// 2. 世界观设定 (World Setting)
// ==========================================
export interface WorldSetting {
  id: string;
  background: string; // 宏观背景
  powerSystem: {
    name: string;
    levels: string[]; // 等级划分，如：练气、筑基...
    rules: string[]; // 核心规则
  }[];
  geography: Location[]; // 地点
  items: Item[]; // 重要物品
  concepts: Concept[]; // 专有名词
}

export interface Location {
  id: string;
  name: string;
  description: string;
  atmosphere: string; // 氛围关键词
  parentLocationId?: string; // 层级关系
}

// ==========================================
// 3. 角色档案 (Character Profile)
// ==========================================
export interface Character {
  id: string;
  baseInfo: {
    name: string;
    age: string;
    gender: string;
    role: 'PROTAGONIST' | 'ANTAGONIST' | 'SUPPORTING' | 'MOB';
  };
  appearance: string; // 外貌描写
  personality: {
    keywords: string[]; // 标签：傲娇、冷酷
    coreDrive: string; // 核心驱动力/欲望
    fears: string[]; // 恐惧之物
    speakingStyle: string; // 说话风格/口癖
  };
  background: string; // 生平经历
  relationships: {
    targetCharId: string;
    type: string; // 朋友、敌人、恋人
    description: string;
  }[];
  arc: { // 人物成长弧光
    startState: string;
    endState: string;
    keyEvents: string[]; // 关键转变事件
  };
}

// ==========================================
// 4. 大纲结构 (Outline Structure)
// ==========================================
export interface OutlineTree {
  id: string;
  volumes: VolumeNode[];
}

export interface VolumeNode {
  id: string;
  title: string;
  summary: string;
  chapters: ChapterNode[];
}

export interface ChapterNode {
  id: string;
  title: string;
  summary: string;
  povCharacterId: string; // 视点人物
  beats: SceneBeat[]; // 场景节拍
  status: 'PLANNED' | 'DRAFTING' | 'REVIEWING' | 'DONE';
  content?: string; // 最终正文（引用或直接存储）
}

export interface SceneBeat {
  id: string;
  locationId: string;
  activeCharacterIds: string[];
  summary: string; // 发生了什么
  purpose: string; // 这个场景的功能（伏笔、冲突、过场）
  emotionalTone: string; // 情感基调
}

// ==========================================
// 5. 任务与上下文 (Task & Context)
// ==========================================

export type ExecutionMode = 'AUTO' | 'CO_PILOT' | 'MANUAL';

export interface AgentTask {
  id: string;
  type: 'GENERATE_WORLD' | 'GENERATE_CHAR' | 'GENERATE_OUTLINE' | 'WRITE_SCENE' | 'REVIEW';
  mode: ExecutionMode;
  payload: any; // 任务具体参数
  status: 'PENDING' | 'RUNNING' | 'WAITING_USER' | 'COMPLETED' | 'FAILED';
  result?: any;
}

/**
 * 传递给 Agent 的上下文快照
 * 包含 Agent 执行任务所需的一切信息，避免全量 Context 导致 Token 溢出
 */
export interface TaskContext {
  projectSummary: string;
  worldRules: string[]; // 相关的世界观规则
  activeCharacters: Character[]; // 登场角色详情
  previousContentSummary: string; // 前情提要
  currentBeat: SceneBeat; // 当前要写的节拍
  styleGuide: string; // 文风要求
}
