# AI PR Review 助手

**一款注重评审质量与用户体验的 AI 代码评审工具。**

登录 GitHub 账号后，系统自动拉取你的仓库列表和 PR 列表，点击即可选择要评审的 PR。AI 实时流式输出评审结果，包含风险识别、改进建议、意图一致性检查等。

### 核心特色

🚀 **意图一致性检查** — 首创功能！AI 自动对比 PR 标题/描述与实际代码变更，识别范围漂移、隐含破坏性改动等「名不副实」的问题，给出一致性评分（0-100）。

🎯 **风险置信度评估** — 每条风险项都经过置信度计算，基于关键词匹配、描述长度、文件匹配度等因素综合评估，自动标记疑似误报。

⚡ **智能缓存 + 秒级响应** — 24h 内同一 PR 免重复分析，追加写入支持历史对比，省 Token、秒出结果。

📝 **GitHub 评论发布** — 评审完成后一键将风险摘要发布为 PR 评论，团队成员无需登录即可在 GitHub 查看。

📊 **跨 PR 重复检测** — 批量分析时自动识别：文件重叠、相似代码片段、重复风险模式，避免重复修复。

📄 **报告导出** — 支持 Markdown / Word / PDF 三种格式一键下载完整评审报告。

### 完整功能矩阵

| 模块 | 功能 |
|------|------|
| **PR 分析** | 单 PR 流式分析、批量分析（2-10 个）、AI 对话追问 |
| **风险评估** | 严重度分级（critical/high/medium/low）、置信度评分、误报检测 |
| **意图检查** | PR 描述 vs 代码变更一致性分析、范围漂移识别 |
| **数据洞察** | 目录风险热力图、高频问题 Top 榜、评审趋势折线图 |
| **反馈闭环** | 采纳/误报反馈、一键取消、状态实时显示 |
| **通知监控** | 实时监控仓库 PR 动态、新 PR 推送通知 |
| **报告导出** | Markdown / Word / PDF 三格式 |
| **系统设置** | DeepSeek/OpenAI 切换、自定义规则引擎（文本/正则/Glob） |

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
团队代码质量总览：评审趋势折线图、仓库健康度卡片、最近评审历史列表。

### 单 PR 分析
登录后自动拉取仓库和 PR 列表，点击选择。AI **实时 SSE 流式输出**评审结果：
- 变更摘要（意图、影响范围）
- 风险代码（严重度分级 + 置信度 + 误报标注）
- 改进建议（安全/性能/可维护性分类 + 代码片段）
- 自定义规则命中
- 意图一致性检查（评分 + 不一致详情）
- 一键发布评论到 GitHub
- AI 对话追问

### 批量 PR 分析
一次性选择 2~10 个 PR 并发分析，聚合展示：
- 风险分布条（各 PR 风险占比）
- **跨 PR 重复检测**：文件重叠、相似代码片段、重复风险模式
- 每个 PR 折叠详情

### 评审队列
历史记录搜索筛选 + 风险等级过滤。反馈功能升级：
- 即时高亮（点击立即响应）
- 右侧状态标签（处理中/已采纳/已标记/已取消）
- 一键取消反馈

### 代码洞察
全量历史聚合分析：目录风险热力图、高频问题 Top 榜、编码规范建议。

### 报告导出
一键下载 Markdown / Word / PDF 完整报告，含风险评分、意图检查结果。

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

### 智能缓存策略

每次 PR 分析结果完整写入 `pr_analyses` 表。单 PR / 批量 / 流式 SSE 所有入口统一查缓存：

- **缓存 Key**：`owner` + `repo` + `pr_number`
- **TTL**：24 小时内有已完成记录则直接返回，不消耗 LLM Token
- **追加写入**：每次分析 INSERT 新行，不覆盖旧记录，支持同一 PR 的历史对比
- **命中响应**：缓存命中时流式端点直接推送完整结果，用户体感秒级完成

> 典型场景：一个 PR 被反复查看、同一 PR 在不同时间点重新发起分析，均命中缓存，省 Token、秒出结果。

### 风险置信度评估

每条风险项都经过置信度计算，提升评审准确性：

- **置信度评分**：基于关键词匹配（如 SQL 注入、XSS、race condition 等安全关键词）、描述长度、文件匹配度等因素综合计算
- **误报检测**：自动标记疑似误报的风险项（例如风险提到的文件未在变更列表中）
- **用户反馈闭环**：用户可以对每条风险标记「采纳」或「误报」，为未来的模型优化和规则引擎积累数据

### 实际耗时记录

评审时间采用 wall-clock 真实计时，确保准确性：

- **真实计时**：记录从分析开始到完成的实际耗时，精确到秒
- **合理展示**：转化为分钟取整显示（至少 1 分钟），避免误导
- **独立统计**：批量分析时每个 PR 单独计时，统计更准确

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
