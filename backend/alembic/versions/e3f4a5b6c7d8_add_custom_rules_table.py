"""add custom_rules table

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-05-29 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "c1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "custom_rules",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column(
            "match_type",
            sa.Enum("text", "regex", "glob", name="match_type_enum"),
            nullable=False,
        ),
        sa.Column("match_pattern", sa.Text(), nullable=False),
        sa.Column(
            "match_scope",
            sa.Enum(
                "added_lines", "context_lines", "full_file", name="match_scope_enum"
            ),
            nullable=False,
            server_default="added_lines",
        ),
        sa.Column("file_filter", sa.Text(), nullable=True),
        sa.Column(
            "severity",
            sa.Enum("critical", "high", "medium", "low", name="severity_enum"),
            nullable=False,
            server_default="medium",
        ),
        sa.Column("suggestion", sa.String(500), nullable=True),
        sa.Column(
            "is_enabled", sa.Boolean(), nullable=False, server_default="true"
        ),
        sa.Column(
            "is_preset", sa.Boolean(), nullable=False, server_default="false"
        ),
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
            "custom_rules",
            sa.column("name", sa.String(100)),
            sa.column("description", sa.String(500)),
            sa.column("match_type", sa.String(10)),
            sa.column("match_pattern", sa.Text()),
            sa.column("match_scope", sa.String(20)),
            sa.column("file_filter", sa.Text()),
            sa.column("severity", sa.String(10)),
            sa.column("suggestion", sa.String(500)),
            sa.column("is_enabled", sa.Boolean()),
            sa.column("is_preset", sa.Boolean()),
        ),
        [
            {
                "name": "禁止 console.log",
                "description": "生产代码中不得包含 console.log 调试语句",
                "match_type": "regex",
                "match_pattern": r"console\.log\(",
                "match_scope": "added_lines",
                "file_filter": "**/*.ts,**/*.tsx,**/*.js,**/*.jsx",
                "severity": "high",
                "suggestion": "请使用统一的 logger 工具替代 console.log",
                "is_enabled": True,
                "is_preset": True,
            },
            {
                "name": "禁止 debugger 语句",
                "description": "断点调试语句不能合入代码库",
                "match_type": "text",
                "match_pattern": "debugger",
                "match_scope": "added_lines",
                "file_filter": None,
                "severity": "critical",
                "suggestion": "请移除 debugger 调试语句",
                "is_enabled": True,
                "is_preset": True,
            },
            {
                "name": "禁止硬编码密钥",
                "description": "API 密钥、密码、Token 等敏感凭证不得硬编码",
                "match_type": "regex",
                "match_pattern": r'(api_key|secret|password|token)\s*=\s*["\'][\w\-.]{8,}["\']',
                "match_scope": "added_lines",
                "file_filter": None,
                "severity": "critical",
                "suggestion": "请将敏感凭证移至环境变量或密钥管理服务",
                "is_enabled": True,
                "is_preset": True,
            },
            {
                "name": "禁止 TODO 标记",
                "description": "提醒处理待办事项，不应合入主干",
                "match_type": "regex",
                "match_pattern": r"//\s*TODO",
                "match_scope": "added_lines",
                "file_filter": None,
                "severity": "low",
                "suggestion": "请在合入前处理 TODO 或将其转为正式工单",
                "is_enabled": True,
                "is_preset": True,
            },
            {
                "name": "禁止使用 eval",
                "description": "eval() 存在代码注入风险",
                "match_type": "text",
                "match_pattern": "eval(",
                "match_scope": "added_lines",
                "file_filter": None,
                "severity": "critical",
                "suggestion": "请使用安全的替代方案，避免动态执行代码",
                "is_enabled": True,
                "is_preset": True,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("custom_rules")
