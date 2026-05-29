"""add-risk-fields-to-pr-analyses

Revision ID: c1e2f3a4b5c6
Revises:
Create Date: 2026-05-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1e2f3a4b5c6"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pr_analyses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("repo_owner", sa.String(255), nullable=False),
        sa.Column("repo_name", sa.String(255), nullable=False),
        sa.Column("pr_number", sa.Integer(), nullable=False),
        sa.Column("pr_title", sa.String(500), nullable=True),
        sa.Column("pr_description", sa.String(2000), nullable=True),
        sa.Column("author", sa.String(255), nullable=True),
        sa.Column("base_branch", sa.String(255), nullable=True),
        sa.Column("head_branch", sa.String(255), nullable=True),
        sa.Column("files_changed", sa.Integer(), default=0),
        sa.Column("additions", sa.Integer(), default=0),
        sa.Column("deletions", sa.Integer(), default=0),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("risk_items", sa.Text(), nullable=True),
        sa.Column("suggestions", sa.Text(), nullable=True),
        sa.Column("risk_score", sa.Integer(), default=0),
        sa.Column("risk_level", sa.String(50), default="low"),
        sa.Column("estimated_review_minutes", sa.Integer(), default=0),
        sa.Column("status", sa.String(50), default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("pr_analyses")
