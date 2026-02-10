/**
 * Novel Writing Graph - 主状态图
 */
import { StateGraph, END, interrupt } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { NovelGraphState, type NovelState } from './graph-state.js';
import { checkpointer } from './checkpointer.js';

import { directorNode } from '../agent/director.js';
import { worldBuilderNode } from '../agent/world-builder.js';
import { castingDirectorNode } from '../agent/casting-director.js';
import { outlinerNode } from '../agent/outliner.js';
import { writerNode } from '../agent/writer.js';
import { editorNode } from '../agent/editor.js';

import type { StorageService } from '../service/storage.service.js';

function createWritePrepareNode(storage: StorageService) {
  return async function writePrepareNode(state: NovelState): Promise<Partial<NovelState>> {
    if (!state.outline) {
      return {
        agentOutput: '还没有大纲。请先创建大纲再写正文。',
        routeTarget: 'direct_response',
      };
    }
    const { volumeIndex, chapterIndex } = state.projectId
      ? (storage.getProject(state.projectId)?.currentProgress || { volumeIndex: 0, chapterIndex: 0 })
      : { volumeIndex: 0, chapterIndex: 0 };
    const volume = state.outline.volumes[volumeIndex];
    const chapter = volume?.chapters[chapterIndex];
    if (!chapter) {
      return {
        agentOutput: '大纲中没有找到待写的章节。',
        routeTarget: 'direct_response',
      };
    }
    return {
      currentChapter: chapter,
      revisionCount: 0,
      draft: '',
      critique: '',
    };
  };
}

function humanReviewNode(state: NovelState): Partial<NovelState> {
  const userFeedback = interrupt({
    type: 'review',
    data: state.agentOutput,
    instruction: '请审核以上内容。你可以输入修改意见，或回复"确认"以继续。',
  });
  if (typeof userFeedback === 'string' && userFeedback !== '确认') {
    return { userMessage: userFeedback };
  }
  return {};
}

function createSaveToStoreNode(storage: StorageService) {
  return async function saveToStoreNode(state: NovelState): Promise<Partial<NovelState>> {
    if (!state.projectId) return {};
    if (state.worldSetting) {
      storage.saveWorldSetting(state.projectId, state.worldSetting);
    }
    if (state.characters.length > 0) {
      storage.saveCharacters(state.projectId, state.characters);
    }
    if (state.outline) {
      storage.saveOutline(state.projectId, state.outline);
    }
    if (state.draft && state.currentChapter) {
      storage.saveChapterContent(state.projectId, state.currentChapter.id, state.draft);
    }
    return { agentOutput: state.agentOutput + '\n\n[数据已保存]' };
  };
}

async function directResponseNode(_state: NovelState): Promise<Partial<NovelState>> {
  return {};
}

function routeAfterDirector(state: NovelState): string {
  switch (state.routeTarget) {
    case 'world_builder': return 'worldBuilder';
    case 'casting_director': return 'castingDirector';
    case 'outliner': return 'outliner';
    case 'write_chapter': return 'writePrepare';
    case 'direct_response':
    default: return 'directResponse';
  }
}

function routeAfterWritePrepare(state: NovelState): string {
  if (state.routeTarget === 'direct_response') return 'directResponse';
  return 'writer';
}

function routeAfterEditor(state: NovelState): string {
  if (!state.critique) return 'saveToStore';
  if (state.revisionCount >= 3) return 'humanReview';
  return 'writer';
}

export function buildNovelGraph(storage: StorageService) {
  const writePrepareNode = createWritePrepareNode(storage);
  const saveToStoreNode = createSaveToStoreNode(storage);

  const graph = new StateGraph(NovelGraphState)
    .addNode('director', directorNode)
    .addNode('worldBuilder', worldBuilderNode)
    .addNode('castingDirector', castingDirectorNode)
    .addNode('outliner', outlinerNode)
    .addNode('writePrepare', writePrepareNode)
    .addNode('writer', writerNode)
    .addNode('editor', editorNode)
    .addNode('humanReview', humanReviewNode)
    .addNode('saveToStore', saveToStoreNode)
    .addNode('directResponse', directResponseNode)
    .addEdge('__start__', 'director')
    .addConditionalEdges('director', routeAfterDirector, {
      worldBuilder: 'worldBuilder',
      castingDirector: 'castingDirector',
      outliner: 'outliner',
      writePrepare: 'writePrepare',
      directResponse: 'directResponse',
    })
    .addEdge('worldBuilder', 'humanReview')
    .addEdge('castingDirector', 'humanReview')
    .addEdge('outliner', 'humanReview')
    .addEdge('humanReview', 'saveToStore')
    .addConditionalEdges('writePrepare', routeAfterWritePrepare, {
      writer: 'writer',
      directResponse: 'directResponse',
    })
    .addEdge('writer', 'editor')
    .addConditionalEdges('editor', routeAfterEditor, {
      saveToStore: 'saveToStore',
      writer: 'writer',
      humanReview: 'humanReview',
    })
    .addEdge('saveToStore', END)
    .addEdge('directResponse', END);

  return graph.compile({ checkpointer });
}
