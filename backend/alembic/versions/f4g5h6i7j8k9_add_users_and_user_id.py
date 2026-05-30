"""Add users table and user_id FK to pr_analyses

Revision ID: f4g5h6i7j8k9
Revises: e3f4a5b6c7d8
Create Date: 2026-05-29 20:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4g5h6i7j8k9"
down_revision: Union[str, None] = "e3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("github_id", sa.Integer(), nullable=False),
        sa.Column("login", sa.String(100), nullable=False),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("github_id"),
        sa.UniqueConstraint("login"),
    )
    op.create_index("ix_users_github_id", "users", ["github_id"])

    op.add_column(
        "pr_analyses",
        sa.Column("user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_pr_analyses_user_id",
        "pr_analyses",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_pr_analyses_user_id", "pr_analyses", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_pr_analyses_user_id")
    op.drop_constraint("fk_pr_analyses_user_id", "pr_analyses", type_="foreignkey")
    op.drop_column("pr_analyses", "user_id")
    op.drop_index("ix_users_github_id")
    op.drop_table("users")
