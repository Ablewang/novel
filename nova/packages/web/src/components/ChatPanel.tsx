import { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { List, type RowComponentProps } from 'react-window';
import { Sender } from '@ant-design/x';
import { Flex, Typography, Tag, Space, message, Spin } from 'antd';
import {
  UserOutlined,
  RobotOutlined,
  CopyOutlined,
  LikeOutlined,
  DislikeOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { XMarkdown } from '@ant-design/x-markdown';
import { sendChat, resumeChat, getMessages, type SSEEvent, type ChatMessage as ApiMessage } from '../services/api';

const { Text } = Typography;

const PAGE_SIZE = 50;
const ESTIMATED_ROW_HEIGHT = 120;
const SCROLL_LOAD_MORE_THRESHOLD = 80;

/* ─── 类型 ─── */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'streaming' | 'done';
}

function getNodeLabel(node: string): string {
  const map: Record<string, string> = {
    director: '总导演',
    directorConfirm: '等待确认',
    worldBuilder: '设定架构师',
    castingDirector: '角色总监',
    outliner: '剧情结构师',
    writer: '执行主笔',
    editor: '审校编辑',
    humanReview: '等待审核',
    saveToStore: '保存',
    directResponse: '直接回复',
  };
  return map[node] || node;
}

/* ─── 消息操作栏 ─── */

const actionIconStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontSize: 14,
  color: '#bbb',
  padding: 4,
  borderRadius: 4,
  transition: 'color 0.2s',
};

function MessageActions({ text, placement }: { text: string; placement: 'start' | 'end' }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制到剪贴板');
    } catch {
      message.error('复制失败');
    }
  };

  return (
    <Flex
      gap={2}
      justify={placement === 'start' ? 'flex-start' : 'flex-end'}
      style={{ padding: '2px 48px', marginTop: -4 }}
    >
      <CopyOutlined
        onClick={handleCopy}
        style={actionIconStyle}
        title="复制"
        onMouseEnter={(e) => { e.currentTarget.style.color = '#666'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#bbb'; }}
      />
      {placement === 'start' && (
        <>
          <LikeOutlined
            style={actionIconStyle}
            title="有用"
            onMouseEnter={(e) => { e.currentTarget.style.color = '#666'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#bbb'; }}
          />
          <DislikeOutlined
            style={actionIconStyle}
            title="无用"
            onMouseEnter={(e) => { e.currentTarget.style.color = '#666'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#bbb'; }}
          />
        </>
      )}
    </Flex>
  );
}

/* ─── 虚拟列表行（react-window 2 List rowComponent）─── */

type MessageRowData = { messages: ChatMessage[] };

function MessageRow({ index, style, messages }: RowComponentProps<MessageRowData>) {
  const msg = messages[index];
  if (!msg) return null;
  return (
    <div style={style}>
      <div style={{ padding: '0 24px 12px' }}>
        <ChatBubble msg={msg} />
      </div>
    </div>
  );
}

/* ─── 单条消息气泡（自绘，不依赖 Bubble 组件）─── */

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  const placement = isUser ? 'end' : 'start';

  return (
    <div>
      <Flex
        align="flex-start"
        gap={10}
        justify={isUser ? 'flex-end' : 'flex-start'}
        style={{ width: '100%' }}
      >
        {/* 左侧头像 */}
        {!isUser && (
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#e6f4ff', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <RobotOutlined style={{ color: '#1677ff', fontSize: 16 }} />
          </div>
        )}

        {/* 气泡体 */}
        <div style={{
          maxWidth: '75%',
          padding: '10px 14px',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser ? '#1677ff' : '#f5f5f5',
          color: isUser ? '#fff' : '#333',
          fontSize: 14,
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}>
          {msg.status === 'pending' ? (
            <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
          ) : msg.content ? (
            <XMarkdown>{msg.status === 'streaming' ? msg.content + ' ▍' : msg.content}</XMarkdown>
          ) : null}
        </div>

        {/* 右侧头像 */}
        {isUser && (
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#f6ffed', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <UserOutlined style={{ color: '#87d068', fontSize: 16 }} />
          </div>
        )}
      </Flex>

      {/* 操作栏 */}
      {msg.status === 'done' && msg.content && (
        <MessageActions text={msg.content} placement={placement} />
      )}
    </div>
  );
}

/* ─── 主组件 ─── */

interface ChatPanelProps {
  projectId: string;
  threadId?: string | null;
  onThreadCreated?: (threadId: string) => void;
}

let msgIdCounter = 0;

function apiMessageToLocal(m: ApiMessage): ChatMessage {
  return {
    id: m.id,
    role: m.role === 'system' ? 'assistant' : m.role,
    content: m.content,
    status: 'done',
  };
}

export default function ChatPanel({ projectId, threadId = null, onThreadCreated }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [listHeight, setListHeight] = useState(400);
  const [inputValue, setInputValue] = useState('');
  const [interruptHint, setInterruptHint] = useState(false); // 仅用于 UI 提示

  const listRef = useRef<{ element: HTMLDivElement | null; scrollToRow: (config: { index: number; align?: string }) => void } | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // 关键流程状态用 ref 而非 state，避免 React batching 导致读到过期值
  const threadIdRef = useRef<string | null>(null);
  const isInterruptedRef = useRef(false);
  const contentRef = useRef('');
  const msgIdRef = useRef('');
  const messageCountRef = useRef(0);
  messageCountRef.current = messages.length;

  // 列表容器高度
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setListHeight(el.clientHeight));
    ro.observe(el);
    setListHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // 切换对话时：有 threadId 则加载历史，无则清空并视为新对话
  useEffect(() => {
    if (!projectId) return;
    if (threadId) {
      threadIdRef.current = threadId;
      setLoadingHistory(true);
      setHasMore(false);
      getMessages(threadId, projectId, 0, PAGE_SIZE)
        .then((data) => {
          const list = (data.messages || []).map(apiMessageToLocal).reverse(); // API 新→旧，展示旧→新
          setMessages(list);
          setHasMore((data.messages?.length ?? 0) >= PAGE_SIZE);
          if (list.length > 0) {
            setTimeout(() => listRef.current?.scrollToRow({ index: list.length - 1, align: 'end' }), 0);
          }
        })
        .catch(() => setMessages([]))
        .finally(() => setLoadingHistory(false));
    } else {
      threadIdRef.current = null;
      setMessages([]);
      setHasMore(false);
    }
  }, [projectId, threadId]);

  const loadMore = useCallback(() => {
    if (!threadId || !projectId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const prevLen = messages.length;
    const scrollEl = listRef.current?.element?.querySelector('[style*="overflow"]') ?? listRef.current?.element;
    const prevScrollOffset = (scrollEl as HTMLElement)?.scrollTop ?? 0;
    getMessages(threadId, projectId, prevLen, PAGE_SIZE)
      .then((data) => {
        const batch = (data.messages || []).map(apiMessageToLocal).reverse();
        if (batch.length === 0) {
          setHasMore(false);
          return;
        }
        setMessages((prev) => [...batch, ...prev]);
        setHasMore(batch.length >= PAGE_SIZE);
        const estimatedPrepend = batch.length * ESTIMATED_ROW_HEIGHT;
        requestAnimationFrame(() => {
          const el = listRef.current?.element?.querySelector('[style*="overflow"]') ?? listRef.current?.element;
          if (el) (el as HTMLElement).scrollTop = prevScrollOffset + estimatedPrepend;
        });
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [threadId, projectId, loadingMore, hasMore, messages.length]);

  const handleListScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const scrollOffset = (e.target as HTMLDivElement).scrollTop;
      if (scrollOffset <= SCROLL_LOAD_MORE_THRESHOLD && hasMore && !loadingMore && threadId) {
        loadMore();
      }
    },
    [hasMore, loadingMore, threadId, loadMore],
  );

  const flushContent = useCallback((status: ChatMessage['status'] = 'streaming') => {
    const id = msgIdRef.current;
    const content = contentRef.current;
    // flushSync 阻止 React 18 batching，确保 DOM 立即更新
    flushSync(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content, status } : m)),
      );
    });
  }, []);

  const handleSubmit = (text: string) => {
    if (!text.trim() || sending) return;
    setInputValue('');

    const userMsg: ChatMessage = {
      id: `msg-${++msgIdCounter}`,
      role: 'user',
      content: text,
      status: 'done',
    };
    const asstId = `msg-${++msgIdCounter}`;
    const assistantMsg: ChatMessage = {
      id: asstId,
      role: 'assistant',
      content: '',
      status: 'pending',
    };

    msgIdRef.current = asstId;
    contentRef.current = '';
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setTimeout(() => listRef.current?.scrollToRow({ index: messages.length + 1, align: 'end' }), 0);
    setSending(true);

    const sections: string[] = [];
    let activeNode = '';

    const rebuildContent = (suffix?: string): string => {
      const parts = [...sections];
      if (suffix) parts.push(suffix);
      return parts.join('\n\n');
    };

    const handleEvent = (event: SSEEvent) => {
      if (event.type === 'thread' && event.threadId) {
        threadIdRef.current = event.threadId;
        onThreadCreated?.(event.threadId);
      }

      if (event.type === 'token' && event.node) {
        if (event.node !== activeNode) {
          activeNode = event.node;
          const label = getNodeLabel(event.node);
          contentRef.current = rebuildContent(`**[${label}]** 正在生成中...`);
          flushContent('streaming');
        }
      }

      if (event.type === 'node') {
        activeNode = '';
        if (event.agentOutput) {
          const label = getNodeLabel(event.node || '');
          sections.push(`**[${label}]** ${event.agentOutput}`);
          contentRef.current = rebuildContent();
          flushContent('streaming');
        }
      }

      if (event.type === 'done') {
        if (event.state?.agentOutput) {
          if (!sections.some((s) => s.includes(event.state!.agentOutput!))) {
            sections.push(event.state.agentOutput);
          }
        }
        if (event.state?.draft) {
          sections.push(`---\n\n${event.state.draft}`);
        }
        contentRef.current = rebuildContent();
        flushContent('streaming');
      }

      if (event.type === 'interrupt') {
        // 用 ref 立即生效，不依赖 React 异步 state
        isInterruptedRef.current = true;
        setInterruptHint(true); // 仅驱动 UI 提示
        sections.push(`> ⏸ ${event.instruction}`);
        contentRef.current = rebuildContent();
        flushContent('streaming');
      }

      if (event.type === 'error') {
        sections.push(`❌ 错误: ${event.message}`);
        contentRef.current = rebuildContent();
        flushContent('streaming');
      }
    };

    const handleDone = () => {
      setSending(false);
      contentRef.current = rebuildContent() || '完成。';
      flushContent('done');
      setTimeout(() => listRef.current?.scrollToRow({ index: messageCountRef.current - 1, align: 'end' }), 0);
    };

    // 用 ref 判断是 resume 还是新消息，避免 React state 延迟
    if (isInterruptedRef.current && threadIdRef.current) {
      isInterruptedRef.current = false;
      setInterruptHint(false);
      resumeChat(projectId, threadIdRef.current, text, handleEvent, handleDone);
    } else {
      sendChat(projectId, text, threadIdRef.current, handleEvent, handleDone);
    }
  };

  return (
    <Flex vertical style={{ height: '100%' }}>
      <div ref={listContainerRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {loadingHistory && (
          <Flex vertical align="center" justify="center" style={{ height: '100%' }}>
            <Spin size="large" tip="加载对话历史..." />
          </Flex>
        )}
        {!loadingHistory && messages.length === 0 && (
          <Flex vertical align="center" justify="center" style={{ height: '100%', opacity: 0.5 }}>
            <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <Text type="secondary">开始你的小说创作之旅</Text>
            <Space style={{ marginTop: 8 }}>
              <Tag color="blue">创建世界观</Tag>
              <Tag color="purple">设计角色</Tag>
              <Tag color="orange">规划大纲</Tag>
              <Tag color="red">撰写正文</Tag>
            </Space>
          </Flex>
        )}
        {!loadingHistory && messages.length > 0 && (
          <>
            {loadingMore && (
              <Flex justify="center" style={{ padding: 8, flexShrink: 0 }}>
                <Spin size="small" tip="加载更早的消息..." />
              </Flex>
            )}
            <List
              listRef={listRef}
              rowComponent={MessageRow}
              rowCount={messages.length}
              rowHeight={ESTIMATED_ROW_HEIGHT}
              rowProps={{ messages }}
              onScroll={handleListScroll}
              style={{ height: listHeight - (loadingMore ? 40 : 0), flex: 1 }}
            />
          </>
        )}
      </div>
      <div style={{ padding: '12px 24px', borderTop: '1px solid #f0f0f0' }}>
        {interruptHint && (
          <Tag color="gold" style={{ marginBottom: 8 }}>
            ⏸ 等待你的审核反馈（输入修改意见或"确认"）
          </Tag>
        )}
        <Sender
          value={inputValue}
          onChange={setInputValue}
          loading={sending}
          placeholder={
            interruptHint
              ? '输入修改意见，或回复"确认"以继续...'
              : '输入你的创作指令，例如：帮我构建一个修仙世界观...'
          }
          onSubmit={handleSubmit}
        />
      </div>
    </Flex>
  );
}
