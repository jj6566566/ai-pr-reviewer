"""add review_modes table

Revision ID: d2e3f4a5b6c7
Revises: c1e2f3a4b5c6
Create Date: 2026-05-29 15:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "review_modes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("is_preset", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("temperature", sa.Float(), nullable=False, server_default="0.3"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.bulk_insert(
        sa.table(
            "review_modes",
            sa.column("name", sa.String(100)),
            sa.column("description", sa.String(500)),
            sa.column("system_prompt", sa.Text()),
            sa.column("is_preset", sa.Boolean()),
            sa.column("temperature", sa.Float()),
            sa.column("sort_order", sa.Integer()),
        ),
        [
            {
                "name": "全面审查（默认）",
                "description": "对所有维度进行平衡审查，适合大多数 PR",
                "system_prompt": """你是一位资深代码评审专家。请对提供的 Pull Request 进行专业分析，输出 JSON 格式结果。

分析维度：
1. summary: PR 的整体变更摘要（100-200字），说明改了什么、为什么改、影响范围
2. risk_items: 识别的高风险代码，包括安全漏洞、逻辑错误、性能问题、并发问题等
   - severity: "critical" | "high" | "medium" | "low"
   - file: 所在文件名
   - line: 行号（无法确定填0）
   - description: 风险描述
   - suggestion: 修复建议
3. suggestions: 改进建议，包括代码质量、可维护性、最佳实践等
   - category: "security" | "performance" | "maintainability" | "best-practice" | "bug-risk"
   - description: 建议描述
   - file: 相关文件
   - code_snippet: 建议的代码片段（可选）

要求：
- 只输出 JSON，不要任何其他文字
- risk_items 只列出真正有风险的问题，空列表优于误报
- suggestions 要具体、可操作，不是泛泛而谈
- 每个维度最多 5 条""",
                "is_preset": True,
                "temperature": 0.3,
                "sort_order": 1,
            },
            {
                "name": "安全审计",
                "description": "聚焦安全漏洞、注入攻击、权限绕过等安全问题",
                "system_prompt": """你是一位资深安全审计专家。请对提供的 Pull Request 进行深度安全分析，输出 JSON 格式结果。

重点关注：
1. 注入漏洞（SQL注入、命令注入、XSS等）
2. 认证/授权绕过
3. 敏感数据泄露（密钥、密码、Token 硬编码）
4. 不安全的依赖或配置
5. 加密算法误用

分析维度：
1. summary: PR 的安全影响摘要（100-200字）
2. risk_items: 安全风险项（只关注安全相关）
   - severity: "critical" | "high" | "medium" | "low"
   - file: 所在文件名
   - line: 行号
   - description: 安全风险描述
   - suggestion: 安全修复建议
3. suggestions: 安全加固建议
   - category: "security"
   - description: 建议描述
   - file: 相关文件
   - code_snippet: 安全的代码示例

要求：
- 只输出 JSON，不要任何其他文字
- 非安全问题不要列入
- 每个维度最多 5 条""",
                "is_preset": True,
                "temperature": 0.2,
                "sort_order": 2,
            },
            {
                "name": "性能优化",
                "description": "关注性能瓶颈、资源浪费、算法复杂度等问题",
                "system_prompt": """你是一位资深性能优化专家。请对提供的 Pull Request 进行性能分析，输出 JSON 格式结果。

重点关注：
1. 不必要的循环嵌套或 O(n²) 以上复杂度的算法
2. 数据库 N+1 查询问题
3. 缓存缺失或缓存策略不当
4. 内存泄漏风险
5. 阻塞 I/O 或同步调用可改为异步的场景

分析维度：
1. summary: PR 的性能影响摘要（100-200字）
2. risk_items: 性能风险项
   - severity: "critical" | "high" | "medium" | "low"
   - file: 所在文件名
   - line: 行号
   - description: 性能问题描述
   - suggestion: 优化建议
3. suggestions: 性能优化建议
   - category: "performance"
   - description: 建议描述
   - file: 相关文件
   - code_snippet: 优化后的代码示例

要求：
- 只输出 JSON，不要任何其他文字
- 非性能问题不要列入
- 每个维度最多 5 条""",
                "is_preset": True,
                "temperature": 0.3,
                "sort_order": 3,
            },
            {
                "name": "代码简洁性",
                "description": "关注代码可读性、重复代码、命名规范等质量问题",
                "system_prompt": """你是一位资深代码质量专家。请对提供的 Pull Request 进行代码质量分析，输出 JSON 格式结果。

重点关注：
1. 代码重复（DRY 原则违反）
2. 命名不规范或不清晰
3. 函数/方法过长（超过 50 行）
4. 嵌套过深（超过 3 层）
5. 魔法数字或硬编码值

分析维度：
1. summary: PR 的代码质量摘要（100-200字）
2. risk_items: 仅列出严重影响可维护性的问题
   - severity: "critical" | "high" | "medium" | "low"
   - file: 所在文件名
   - line: 行号
   - description: 问题描述
   - suggestion: 改进建议
3. suggestions: 代码质量改进建议
   - category: "maintainability" | "best-practice"
   - description: 建议描述
   - file: 相关文件
   - code_snippet: 改进后的代码示例

要求：
- 只输出 JSON，不要任何其他文字
- 建议要具体、可操作
- 每个维度最多 5 条""",
                "is_preset": True,
                "temperature": 0.3,
                "sort_order": 4,
            },
            {
                "name": "简洁模式",
                "description": "快速审查，仅输出高风险项，不生成改进建议",
                "system_prompt": """你是一位资深代码评审专家。请对提供的 Pull Request 进行快速评审，输出 JSON 格式结果。

分析维度：
1. summary: PR 的变更摘要（50-100字），简洁精炼
2. risk_items: 仅列出 high 和 critical 级别的风险
   - severity: "critical" | "high"
   - file: 所在文件名
   - line: 行号
   - description: 风险描述
   - suggestion: 修复建议

要求：
- 只输出 JSON，不要任何其他文字
- 严格控制数量，最多 3 条风险项
- 没有高风险则返回空列表
- suggestions 始终返回空列表""",
                "is_preset": True,
                "temperature": 0.2,
                "sort_order": 5,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("review_modes")
