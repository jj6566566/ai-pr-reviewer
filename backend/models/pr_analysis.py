from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class PRAnalysis(Base):
    __tablename__ = "pr_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    repo_owner: Mapped[str] = mapped_column(String(255), nullable=False)
    repo_name: Mapped[str] = mapped_column(String(255), nullable=False)
    pr_number: Mapped[int] = mapped_column(Integer, nullable=False)
    pr_title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    pr_description: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    base_branch: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    head_branch: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    files_changed: Mapped[int] = mapped_column(Integer, default=0)
    additions: Mapped[int] = mapped_column(Integer, default=0)
    deletions: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_items: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    suggestions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[str] = mapped_column(String(50), default="low")
    estimated_review_minutes: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomRule(Base):
    __tablename__ = "custom_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    match_type: Mapped[str] = mapped_column(
        Enum("text", "regex", "glob", name="match_type_enum"), nullable=False
    )
    match_pattern: Mapped[str] = mapped_column(Text, nullable=False)
    match_scope: Mapped[str] = mapped_column(
        Enum("added_lines", "context_lines", "full_file", name="match_scope_enum"),
        default="added_lines",
        nullable=False,
    )
    file_filter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(
        Enum("critical", "high", "medium", "low", name="severity_enum"),
        default="medium",
        nullable=False,
    )
    suggestion: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_preset: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
