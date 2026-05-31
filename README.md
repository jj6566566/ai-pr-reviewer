# AI PR Review 助手

基于 AI 的 GitHub Pull Request 代码评审工具。输入 PR 链接，系统自动拉取代码变更，调用大语言模型进行深度分析，实时流式输出风险代码、改进建议和规则命中结果。支持单 PR / 批量分析、历史趋势洞察、评审报告导出等完整工作流。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS v3 | SPA 单页应用 |
| 状态管理 | Zustand | 轻量状态管理 |
| 图标 | Lucide React | SVG 图标库 |
| 后端 | Python FastAPI | 异步 Web 框架 |
| ORM | SQLAlchemy 2.0 (async) + asyncpg | 异步数据库操作 |
| 迁移 | Alembic | 数据库 Schema 版本管理 |
| 数据库 | PostgreSQL 16 | 关系型数据库 |
| AI 模型 | DeepSeek (`deepseek-chat`) / OpenAI (`gpt-4o`) | 可切换 |
| 容器化 | Docker Compose | 数据库 + pgAdmin |

---

## 快速开始

### 1. 环境要求

- Node.js 18+
- Python 3.9+
- Docker（用于 PostgreSQL）

### 2. 启动数据库

```bash
docker compose up -d
```

这会在 `localhost:5433` 启动 PostgreSQL 16，在 `localhost:5050` 启动 pgAdmin 管理界面。

### 3. 数据库迁移

```bash
cd backend
alembic upgrade head
```

### 4. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入关键配置：

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（默认模型） |
| `OPENAI_API_KEY` | OpenAI API 密钥（可选，切换到 GPT-4o） |
| `GITHUB_TOKEN` | GitHub 个人访问令牌（需 `repo` 权限） |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App 凭证 |
| `FERNET_KEY` | 加密用户 Token 的密钥（见 `.env.example` 生成方式） |

### 5. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
pip install -r requirements.txt
```

### 6. 启动服务

```bash
# 前端
npm run dev          # → http://localhost:5174

# 后端（另开终端）
uvicorn backend.main:app --reload    # → http://localhost:8002
```

---

## 功能特性

### 仪表盘
评审趋势折线图、仓库健康度卡片、最近评审历史列表，团队代码质量一目了然。

### 单 PR 分析
粘贴 GitHub PR 链接或选择仓库 → PR，AI 实时 **SSE 流式输出**评审结果，包含：

- **PR 变更总结** — 自动提取变更意图、影响范围、复杂度评估
- **风险代码识别** — 按严重度（严重 / 高 / 中 / 低）分级，标注置信度
- **改进建议** — 分类（安全 / 性能 / 可维护性 / 代码风格），附带代码片段
- **规则命中** — 匹配自定义规则引擎的结果
- **意图一致性检查** — 对比 PR 描述与实际代码变更是否一致
- **AI 对话** — 评审完成后可在结果页与 AI 继续讨论具体问题

### 批量 PR 分析
一次性选择 2~10 个 PR 并发分析，聚合展示：

- 风险分布条（各 PR 的风险占比）
- 跨 PR 文件重叠检测
- 每个 PR 的折叠详情面板

### 评审队列
历史评审记录搜索筛选，按风险等级过滤。可对每条风险项提交"采纳"或"误报"反馈。

### 代码洞察
基于全部历史数据聚合分析：

- **目录风险热力图** — 可视化各目录的风险累积分布
- **高频问题 Top 榜** — 按出现次数排序，自动分类（安全 / 性能 / 健壮性 / 可维护性）
- **编码规范建议** — 从高频问题中自动提炼规则建议

### 报告导出
支持 **Markdown / Word / PDF** 三种格式一键下载完整评审报告，内容包括 PR 信息、风险评分、所有风险项（按严重度分组）、改进建议及意图检查结果。

### 系统设置
- DeepSeek / OpenAI API 密钥配置
- GitHub Token 配置及有效性检查
- 自定义评审规则管理（文本 / 正则 / Glob 匹配）

### GitHub OAuth
支持 GitHub 账号登录，用户 Token 经 Fernet 加密存储，JWT 鉴权。

---

## 设计思路

### 模型选择

默认使用 **DeepSeek (`deepseek-chat`)**，可通过设置切换到 **OpenAI (`gpt-4o`)**。

| 维度 | DeepSeek | OpenAI |
|------|----------|--------|
| 成本 | 极低（约 GPT-4 的 1/50） | 较高 |
| 代码理解 | 优秀，对中文友好 | 顶级 |
| 响应速度 | 快 | 中等 |
| 上下文窗口 | 128K tokens | 128K tokens |

选择 DeepSeek 作为默认模型的核心考量：
1. 成本优势使其适合频繁的自动化批量评审
2. 中文项目描述和注释的理解能力出色
3. 通过 `openai` 兼容 SDK 调用，切换模型零代码改动

### 上下文获取方式

在调用 AI 模型评审前，系统通过以下步骤构建充分的上下文：

1. **GitHub API 拉取** — 获取 PR 元信息（标题、描述、分支）、文件变更列表和完整 `diff`
2. **Diff 预处理** — 提取变更文件路径、增删行数，识别前后端分离、配置变更等模式
3. **结构化 Prompt** — 将 PR 信息 + diff 内容 + 自定义规则组合为结构化 System Prompt + User Prompt，确保模型理解评审目标和评分标准
4. **风险聚类** — 后处理阶段按严重度、文件路径和语义相似度对风险项进行聚类归并，减少重复输出

### 未来扩展方向

1. **多模型协同** — 同一份 diff 由多个模型并行评审，加权投票提升准确率
2. **CI/CD 集成** — 作为 GitHub Action / GitLab CI 组件，PR 创建时自动触发
3. **代码库级上下文** — 不仅看 diff，还拉取关联文件完整源码，增强上下文理解
4. **知识库积累** — 将"采纳"反馈的评审结果入库，微调专用模型或构建 RAG 检索增强
5. **团队级度量** — 评审通过率、风险修复周期、代码质量趋势等团队效能指标
6. **多语言支持** — 扩展至 Java、Go、Rust 等语言的特定规则引擎

---

## 依赖清单

### 前端

| 包名 | 版本 | 用途 |
|------|------|------|
| react | ^18.3.1 | UI 框架 |
| react-dom | ^18.3.1 | DOM 渲染 |
| react-router-dom | ^7.3.0 | 前端路由 |
| zustand | ^5.0.3 | 轻量状态管理 |
| lucide-react | ^0.511.0 | SVG 图标库 |
| tailwindcss | ^3.4.17 | 原子化 CSS 框架 |
| clsx | ^2.1.1 | 条件类名拼接 |
| tailwind-merge | ^3.0.2 | Tailwind 类名去重合并 |
| vite | ^6.3.5 | 构建工具 |
| typescript | ~5.8.3 | 类型系统 |

### 后端

| 包名 | 版本 | 用途 |
|------|------|------|
| fastapi | 0.128.8 | 异步 Web 框架 |
| uvicorn | 0.39.0 | ASGI 服务器 |
| sqlalchemy | 2.0.50 | 异步 ORM |
| asyncpg | 0.31.0 | PostgreSQL 异步驱动 |
| alembic | 1.16.5 | 数据库迁移工具 |
| pydantic | 2.12.5 | 数据校验与序列化 |
| httpx | 0.28.1 | 异步 HTTP 客户端（GitHub API / LLM API） |
| openai | 2.38.0 | OpenAI / DeepSeek 兼容 SDK |
| cryptography | 48.0.0 | Fernet 对称加密（用户 Token） |
| python-dotenv | 1.1.1 | `.env` 环境变量加载 |
| certifi | 2026.5.20 | SSL 证书验证 |
| PyJWT | 2.13.0 | JWT 签发与验证 |
| PyGithub | 2.9.1 | GitHub REST API 客户端（Webhook 签名验证） |
| python-multipart | 0.0.20 | 表单数据解析 |
| python-docx | 1.2.0 | Word 报告生成 |
| fpdf2 | 2.8.4 | PDF 报告生成 |

### 基础设施

| 组件 | 用途 |
|------|------|
| PostgreSQL 16 | 主数据库 |
| pgAdmin 4 | 数据库管理界面（可选） |
| Docker Compose | 数据库容器编排 |

---

## 项目结构

```
├── src/                          # React 前端（主力应用）
│   ├── api/                      # API 调用层
│   │   ├── auth.ts               #   认证接口
│   │   ├── github.ts             #   GitHub API 代理
│   │   └── review.ts             #   评审 & 设置接口
│   ├── components/               # 可复用 UI 组件
│   │   ├── DiffViewer.tsx        #   Diff 对比视图
│   │   ├── IntentCheckCard.tsx   #   意图一致性检查卡片
│   │   ├── LoginButton.tsx       #   GitHub 登录按钮
│   │   ├── NotificationBell.tsx  #   通知铃铛
│   │   ├── PageTransition.tsx    #   路由过渡动画
│   │   ├── PRList.tsx            #   PR 列表选择器
│   │   ├── ProtectedRoute.tsx    #   登录保护路由
│   │   ├── RepoHealthCards.tsx   #   仓库健康度卡片
│   │   ├── RepoSelector.tsx      #   仓库选择器
│   │   ├── ReviewChat.tsx        #   AI 对话面板
│   │   ├── SideNav.tsx           #   侧边导航（含移动端适配）
│   │   ├── StatCard.tsx          #   统计卡片
│   │   ├── TeamTrendChart.tsx    #   团队趋势图
│   │   └── TopNavbar.tsx         #   顶部导航栏
│   ├── contexts/                 # React Context
│   │   └── AuthContext.tsx       #   认证上下文
│   ├── pages/                    # 页面组件
│   │   ├── AnalyzePage.tsx       #   PR 分析页（单 / 批量）
│   │   ├── AuthCallback.tsx      #   OAuth 回调页
│   │   ├── Dashboard.tsx         #   仪表盘
│   │   ├── InsightsPage.tsx      #   代码洞察
│   │   ├── LoginPage.tsx         #   登录页
│   │   ├── PRReview.tsx          #   评审队列
│   │   └── SettingsPage.tsx      #   系统设置
│   ├── store/                    # Zustand 状态管理
│   │   └── useStore.ts
│   └── types/                    # TypeScript 类型定义
│       ├── auth.ts
│       └── review.ts
├── backend/                      # Python FastAPI 后端
│   ├── core/                     # 核心模块
│   │   └── database.py           #   数据库连接管理
│   ├── models/                   # SQLAlchemy 数据模型
│   │   ├── pr_analysis.py        #   PR 分析记录
│   │   ├── rule.py               #   自定义规则
│   │   ├── setting.py            #   用户设置
│   │   └── user.py               #   用户表
│   ├── routers/                  # API 路由
│   │   ├── auth.py               #   认证接口
│   │   ├── github.py             #   GitHub API 代理
│   │   ├── review.py             #   评审 & 洞察 & 导出
│   │   └── webhook.py            #   GitHub Webhook
│   ├── schemas/                  # Pydantic 数据模型
│   │   ├── auth.py
│   │   ├── review.py
│   │   └── insights.py
│   ├── services/                 # 业务逻辑
│   │   ├── auth.py               #   JWT / 鉴权
│   │   ├── diff_processor.py     #   Diff 预处理
│   │   ├── duplicate_detector.py #   跨 PR 重复检测
│   │   ├── github.py             #   GitHub REST API 客户端
│   │   ├── report.py             #   报告生成（MD / DOCX / PDF）
│   │   ├── reviewer.py           #   AI 评审引擎
│   │   ├── risk_scorer.py        #   风险评分与分类
│   │   └── rule_engine.py        #   自定义规则引擎
│   ├── config.py                 # 配置管理
│   ├── main.py                   # 应用入口
│   └── store.py                  # 数据库操作层
├── docker-compose.yml            # 数据库容器编排
├── package.json                  # 前端依赖
├── requirements.txt              # 后端依赖
├── tailwind.config.js            # Tailwind 配置（含 Design Token 扩展）
├── .env.example                  # 环境变量模板
└── .trae/documents/              # 产品需求 & 技术架构文档
```

---

## Demo 视频

[待补充链接]

---

## 开发说明

- 本仓库为 AI PR Review 助手的前后端代码
- 前端采用 Tailwind CSS v3 原子化样式，已建立 Design Token 体系（CSS 自定义属性）和响应式布局
- 后端基于 FastAPI 异步框架，支持 SSE 流式输出和数据库连接池
- 主分支 `main` 始终保持可运行状态
- 所有第三方依赖已在上方"依赖清单"中列明
