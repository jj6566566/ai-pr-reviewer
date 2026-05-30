# AI PR Review 助手

基于 AI 的 GitHub PR 代码评审工具，支持流式输出、批量分析、风险追踪和团队效率分析。

## 技术栈

**前端**: React 18 + TypeScript + Vite + Tailwind CSS v3 + Zustand + Lucide React
**后端**: Python FastAPI + SQLAlchemy async + Alembic
**数据库**: PostgreSQL 16
**AI 模型**: DeepSeek / OpenAI GPT-4

## 快速开始

### 1. 环境要求

- Node.js 18+
- Python 3.9+
- PostgreSQL 16

### 2. 数据库初始化

```bash
# 启动 PostgreSQL（Docker）
docker run -d --name pr_review_db \
  -e POSTGRES_DB=pr_review \
  -e POSTGRES_USER=pr_review \
  -e POSTGRES_PASSWORD=pr_review_pass \
  -p 5432:5432 \
  postgres:16-alpine

# 运行数据库迁移
cd backend
alembic upgrade head
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入以下配置：
# - DEEPSEEK_API_KEY / OPENAI_API_KEY（AI 模型密钥）
# - GITHUB_TOKEN（GitHub 个人访问令牌）
# - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET（GitHub OAuth App）
# - FERNET_KEY（用于加密用户 token，可通过 python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 生成）
```

### 4. 启动服务

```bash
# 前端
npm install
npm run dev

# 后端（另一个终端）
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

访问 http://localhost:5174

## 功能特性

- **单 PR 分析** — 输入 GitHub PR 地址，AI 实时流式输出评审结果
- **批量 PR 分析** — 一次性分析 2-10 个 PR，汇总风险分布、跨 PR 重复检测
- **SSE 流式输出** — 分析过程实时展示，速度与体验兼得
- **风险追踪** — 置信度评分、误报标记、反馈机制持续优化准确率
- **团队趋势** — 历史评审数据可视化，掌握团队代码健康趋势
- **自定义规则** — 支持正则/文本/glob 匹配的自定义评审规则
- **GitHub OAuth** — 安全登录，评论自动同步到 PR

## 项目结构

```
├── src/                    # React 前端源码
│   ├── api/               # API 调用层
│   ├── components/        # 可复用 UI 组件
│   ├── contexts/         # React Context（认证状态）
│   ├── pages/            # 页面组件
│   ├── store/            # Zustand 状态管理
│   └── types/            # TypeScript 类型定义
├── backend/              # Python FastAPI 后端源码
│   ├── core/             # 核心模块（数据库连接等）
│   ├── models/           # SQLAlchemy 数据模型
│   ├── routers/          # API 路由
│   ├── schemas/          # Pydantic 请求/响应模型
│   └── services/         # 业务逻辑服务
└── .trae/documents/      # 产品需求文档 & 技术架构文档
```
