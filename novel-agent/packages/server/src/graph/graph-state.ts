/**
 * LangGraph State 定义
 */
import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import type {
  ExecutionMode,
  RouteTarget,
  WorldSetting,
  Character,
  OutlineTree,
  ChapterNode,
} from '@novel-agent/shared';

export const NovelGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  userMessage: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  routeTarget: Annotation<RouteTarget>({
    reducer: (_prev, next) => next,
    default: () => 'direct_response',
  }),
  executionMode: Annotation<ExecutionMode>({
    reducer: (_prev, next) => next,
    default: () => 'CO_PILOT',
  }),
  projectId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  worldSetting: Annotation<WorldSetting | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  characters: Annotation<Character[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  outline: Annotation<OutlineTree | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  currentChapter: Annotation<ChapterNode | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  draft: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  critique: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  revisionCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  agentOutput: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
});

export type NovelState = typeof NovelGraphState.State;
