import { useState, useRef, useEffect } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import { Flex, Typography, Tag, Space } from 'antd';
import {
  UserOutlined,
  RobotOutlined,
  GlobalOutlined,
  TeamOutlined,
  OrderedListOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { sendChat, resumeChat, type SSEEvent } from '../services/api';

const { Text } = Typography;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
  node?: string;
}

function getNodeMeta(node: string) {
  const map: Record<string, { label: string; color: string }> = {
    director: { label: '总导演', color: 'blue' },
    worldBuilder: { label: '设定架构师', color: 'green' },
    castingDirector: { label: '角色总监', color: 'purple' },
    outliner: { label: '剧情结构师', color: 'orange' },
    writer: { label: '执行主笔', color: 'red' },
    editor: { label: '审校编辑', color: 'cyan' },
    humanReview: { label: '等待审核', color: 'gold' },
    saveToStore: { label: '保存', color: 'default' },
    directResponse: { label: '直接回复', color: 'blue' },
  };
  return map[node] || { label: node, color: 'default' };
}

interface ChatPanelProps {
  projectId: string;
}

let msgIdCounter = 0;

export default function ChatPanel({ projectId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${++msgIdCounter}`,
      role: 'user',
      content: text,
    };
    const assistantMsg: ChatMessage = {
      id: `msg-${++msgIdCounter}`,
      role: 'assistant',
      content: '',
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);
    const parts: string[] = [];

    const handleEvent = (event: SSEEvent) => {
      if (event.type === 'thread' && event.threadId) setThreadId(event.threadId);
      if (event.type === 'node' && event.agentOutput) {
        const meta = getNodeMeta(event.node || '');
        parts.push(`**[${meta.label}]** ${event.agentOutput}`);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: parts.join('\n\n'), loading: true } : m,
          ),
        );
      }
      if (event.type === 'done' && event.state?.agentOutput) {
        if (!parts.some((p) => p.includes(event.state!.agentOutput!))) parts.push(event.state.agentOutput);
        if (event.state.draft) parts.push(`\n---\n\n${event.state.draft}`);
      }
      if (event.type === 'interrupt') {
        setIsInterrupted(true);
        parts.push(`\n> ⏸ ${event.instruction}`);
      }
      if (event.type === 'error') parts.push(`\n❌ 错误: ${event.message}`);
    };

    const handleDone = () => {
      setLoading(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: parts.join('\n\n') || '完成。', loading: false }
            : m,
        ),
      );
    };

    if (isInterrupted && threadId) {
      setIsInterrupted(false);
      resumeChat(threadId, text, handleEvent, handleDone);
    } else {
      sendChat(projectId, text, threadId, handleEvent, handleDone);
    }
  };

  return (
    <Flex vertical style={{ height: '100%' }}>
      <Flex
        ref={scrollRef}
        vertical
        gap={12}
        style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}
      >
        {messages.length === 0 && (
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
        {messages.map((msg) => (
          <Bubble
            key={msg.id}
            placement={msg.role === 'user' ? 'end' : 'start'}
            content={msg.content}
            loading={msg.loading}
            avatar={
              msg.role === 'user'
                ? <UserOutlined style={{ color: '#87d068' }} />
                : <RobotOutlined style={{ color: '#1677ff' }} />
            }
          />
        ))}
      </Flex>
      <div style={{ padding: '12px 24px', borderTop: '1px solid #f0f0f0' }}>
        {isInterrupted && (
          <Tag color="gold" style={{ marginBottom: 8 }}>
            ⏸ 等待你的审核反馈（输入修改意见或"确认"）
          </Tag>
        )}
        <Sender
          loading={loading}
          placeholder={
            isInterrupted
              ? '输入修改意见，或回复"确认"以继续...'
              : '输入你的创作指令，例如：帮我构建一个修仙世界观...'
          }
          onSubmit={handleSubmit}
        />
      </div>
    </Flex>
  );
}
