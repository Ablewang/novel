import { useEffect, useState } from 'react';
import { Card, Typography, Tree, Tag, Empty, Collapse, Descriptions, Space } from 'antd';
import { GlobalOutlined, TeamOutlined, OrderedListOutlined } from '@ant-design/icons';
import { getProject, type ProjectSnapshot } from '../services/api';

const { Text } = Typography;

interface ProjectSidebarProps {
  projectId: string;
  refreshKey: number;
}

export default function ProjectSidebar({ projectId, refreshKey }: ProjectSidebarProps) {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);

  useEffect(() => {
    if (!projectId) return;
    getProject(projectId).then(setSnapshot).catch(() => {});
  }, [projectId, refreshKey]);

  if (!snapshot) {
    return (
      <div style={{ padding: 16 }}>
        <Empty description="选择或创建一个项目" />
      </div>
    );
  }

  const { project, world, characters, outline } = snapshot;
  const worldData = world as Record<string, unknown> | null;
  const charData = characters as Array<Record<string, unknown>>;
  const outlineData = outline as Record<string, unknown> | null;

  const buildOutlineTree = () => {
    if (!outlineData || !Array.isArray((outlineData as { volumes?: unknown[] }).volumes)) return [];
    const volumes = (outlineData as { volumes: Array<{ id: string; title: string; chapters: Array<{ id: string; title: string; status: string }> }> }).volumes;
    return volumes.map((vol) => ({
      title: vol.title,
      key: vol.id,
      children: vol.chapters?.map((ch) => ({
        title: (
          <Space size={4}>
            <Text>{ch.title}</Text>
            <Tag color={ch.status === 'DONE' ? 'green' : ch.status === 'DRAFTING' ? 'blue' : 'default'} style={{ fontSize: 10 }}>
              {ch.status}
            </Tag>
          </Space>
        ),
        key: ch.id,
        isLeaf: true,
      })),
    }));
  };

  const collapseItems = [
    {
      key: 'info',
      label: (
        <Space>
          <Text strong>{project.metadata.title}</Text>
          <Tag>{project.metadata.genre || '未分类'}</Tag>
        </Space>
      ),
      children: (
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Logline">{project.metadata.logline || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(project.createdAt).toLocaleDateString('zh-CN')}
          </Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'world',
      label: (
        <Space>
          <GlobalOutlined />
          <Text>世界观设定</Text>
        </Space>
      ),
      children: worldData ? (
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {(worldData as { background?: string }).background || '暂无设定'}
          </Text>
        </div>
      ) : (
        <Empty description="暂无世界观" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ),
    },
    {
      key: 'characters',
      label: (
        <Space>
          <TeamOutlined />
          <Text>角色列表 ({charData.length})</Text>
        </Space>
      ),
      children:
        charData.length > 0 ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            {charData.map((c) => (
              <Card key={c.id as string} size="small">
                <Space>
                  <Text strong>{c.name as string}</Text>
                  <Tag color={c.role === 'PROTAGONIST' ? 'red' : c.role === 'ANTAGONIST' ? 'volcano' : 'default'}>
                    {c.role as string}
                  </Tag>
                </Space>
              </Card>
            ))}
          </Space>
        ) : (
          <Empty description="暂无角色" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ),
    },
    {
      key: 'outline',
      label: (
        <Space>
          <OrderedListOutlined />
          <Text>大纲结构</Text>
        </Space>
      ),
      children: outlineData ? (
        <Tree treeData={buildOutlineTree()} defaultExpandAll showLine />
      ) : (
        <Empty description="暂无大纲" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ),
    },
  ];

  return (
    <div style={{ padding: '12px 0', height: '100%', overflow: 'auto' }}>
      <Collapse
        items={collapseItems}
        defaultActiveKey={['info', 'world', 'characters', 'outline']}
        ghost
        size="small"
      />
    </div>
  );
}
