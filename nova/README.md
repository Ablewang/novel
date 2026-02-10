# Nōva

基于 LangGraph.js 的多智能体小说创作系统。

## 技术栈

- **后端**: Node.js + TypeScript + Midway.js (Koa) + LangGraph.js
- **前端**: React + Vite + Ant Design X（位于 `packages/web`）
- **LLM**: OpenAI GPT-4o
- **存储**: JSON 文件（`data/projects`）

## 快速开始

### 1. 配置环境变量

在项目根目录创建 `.env`，填入 `OPENAI_API_KEY` 等。

### 2. 安装依赖并启动

```bash
cd novel_writing_guide/nova
pnpm install --no-frozen-lockfile   # 首次或 lockfile 变更时
pnpm dev                            # 并行启动后端 + 前端
```

或分别启动：

```bash
pnpm dev:server   # 后端 http://localhost:7001
pnpm dev:web      # 前端 http://localhost:5173（Vite 代理 /api、/health 到 7001）
```

后端默认端口 `7001`，前端 `5173`。

## 系统架构

```
用户 → Director(路由) → WorldBuilder / CastingDirector / Outliner / Writer
                                          ↓
                                    Editor(审查) ←→ Writer(重写循环)
                                          ↓
                                    HumanReview(中断等待确认)
                                          ↓
                                    SaveToStore(持久化)
```

## Agent 角色

| 角色 | 职责 |
|------|------|
| Director | 总导演：解析意图、路由任务、状态管理 |
| WorldBuilder | 设定架构师：世界观、力量体系、地理 |
| CastingDirector | 角色总监：角色档案、人物弧光、关系 |
| Outliner | 剧情结构师：大纲、节拍、伏笔管理 |
| Writer | 执行主笔：正文撰写、五感描写 |
| Editor | 审校编辑：质量审查、修改建议 |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/project | 创建项目 |
| GET | /api/projects | 项目列表 |
| GET | /api/project/:id | 项目详情 |
| POST | /api/chat | 发送消息（SSE 流式） |
| POST | /api/resume | 恢复中断的执行 |
