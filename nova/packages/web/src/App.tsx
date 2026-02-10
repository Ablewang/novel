import { useState, useCallback } from 'react';
import {
  Layout,
  Button,
  Modal,
  Input,
  Form,
  Select,
  Space,
  Typography,
  theme,
} from 'antd';
import { PlusOutlined, BookOutlined } from '@ant-design/icons';
import ChatPanel from './components/ChatPanel';
import ProjectSidebar from './components/ProjectSidebar';
import { createProject, listProjects, type ProjectData } from './services/api';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export default function App() {
  const [projectId, setProjectId] = useState<string>('');
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [threadListRefreshKey, setThreadListRefreshKey] = useState(0);
  const [form] = Form.useForm();
  const { token } = theme.useToken();

  const handleProjectChange = useCallback((id: string) => {
    setProjectId(id);
    setCurrentThreadId(null);
  }, []);

  const loadProjects = useCallback(async () => {
    const data = await listProjects();
    setProjects(data.projects || []);
  }, []);

  const handleCreate = async () => {
    const values = await form.validateFields();
    const result = await createProject(values.title, values.genre, values.logline || '');
    if (result.project) {
      setProjectId(result.project.id);
      setIsModalOpen(false);
      form.resetFields();
      loadProjects();
      setSidebarRefreshKey((k) => k + 1);
    }
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Space>
          <BookOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
          <Title level={4} style={{ margin: 0 }}>
            Nōva
          </Title>
        </Space>
        <Space>
          <Select
            placeholder="选择项目"
            value={projectId || undefined}
            onChange={handleProjectChange}
            onDropdownVisibleChange={(open: boolean) => open && loadProjects()}
            style={{ width: 200 }}
            options={projects.map((p) => ({
              label: p.metadata.title,
              value: p.id,
            }))}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
            新建项目
          </Button>
        </Space>
      </Header>

      <Layout>
        <Sider
          width={300}
          style={{
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'auto',
          }}
        >
          <ProjectSidebar
            projectId={projectId}
            refreshKey={sidebarRefreshKey}
            threadListRefreshKey={threadListRefreshKey}
            currentThreadId={currentThreadId}
            onThreadSelect={setCurrentThreadId}
          />
        </Sider>

        <Content style={{ background: token.colorBgLayout }}>
          {projectId ? (
            <ChatPanel
              projectId={projectId}
              threadId={currentThreadId}
              onThreadCreated={(id) => {
                setCurrentThreadId(id);
                setThreadListRefreshKey((k) => k + 1);
              }}
            />
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <BookOutlined style={{ fontSize: 64, color: token.colorTextQuaternary }} />
              <Text type="secondary" style={{ fontSize: 16 }}>
                请选择一个项目或新建项目开始创作
              </Text>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                新建项目
              </Button>
            </div>
          )}
        </Content>
      </Layout>

      <Modal
        title="新建小说项目"
        open={isModalOpen}
        onOk={handleCreate}
        onCancel={() => setIsModalOpen(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="书名"
            rules={[{ required: true, message: '请输入书名' }]}
          >
            <Input placeholder="例如：万古第一神" />
          </Form.Item>
          <Form.Item name="genre" label="类型">
            <Select
              placeholder="选择类型"
              options={[
                { label: '玄幻', value: '玄幻' },
                { label: '都市', value: '都市' },
                { label: '悬疑', value: '悬疑' },
                { label: '科幻', value: '科幻' },
                { label: '种田', value: '种田' },
                { label: '历史', value: '历史' },
                { label: '其他', value: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item name="logline" label="一句话简介">
            <Input.TextArea rows={2} placeholder="例如：一个普通少年意外获得上古神器，从此踏上逆天之路" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
