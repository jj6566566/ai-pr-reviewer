import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.pr_analysis import CustomRule, PRAnalysis
from backend.schemas.review import (
    AnalyzeResponse,
    CustomRuleCreate,
    CustomRuleUpdate,
)


async def save_analysis(db: AsyncSession, response: AnalyzeResponse) -> PRAnalysis:
    pr_info = response.pr_info

    risk_items_json = json.dumps(
        [r.model_dump() for r in response.risk_items],
        ensure_ascii=False,
    )
    suggestions_json = json.dumps(
        [s.model_dump() for s in response.suggestions],
        ensure_ascii=False,
    )

    analysis = PRAnalysis(
        repo_owner=pr_info.owner,
        repo_name=pr_info.repo,
        pr_number=pr_info.number,
        pr_title=pr_info.title,
        pr_description=pr_info.description,
        author=pr_info.author,
        base_branch=pr_info.base_branch,
        head_branch=pr_info.head_branch,
        files_changed=pr_info.files_changed,
        additions=pr_info.additions,
        deletions=pr_info.deletions,
        summary=response.summary,
        risk_items=risk_items_json,
        suggestions=suggestions_json,
        risk_score=response.risk_score,
        risk_level=response.risk_level,
        estimated_review_minutes=response.estimated_review_minutes,
        status="completed",
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return analysis


async def get_recent_analyses(db: AsyncSession, limit: int = 20) -> list[PRAnalysis]:
    stmt = (
        select(PRAnalysis)
        .order_by(PRAnalysis.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_analysis_by_id(db: AsyncSession, analysis_id: int) -> Optional[PRAnalysis]:
    stmt = select(PRAnalysis).where(PRAnalysis.id == analysis_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_rules(db: AsyncSession) -> List[CustomRule]:
    stmt = select(CustomRule).order_by(CustomRule.id.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_enabled_rules(db: AsyncSession) -> List[CustomRule]:
    stmt = select(CustomRule).where(CustomRule.is_enabled == True).order_by(CustomRule.id.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_rule_by_id(db: AsyncSession, rule_id: int) -> Optional[CustomRule]:
    stmt = select(CustomRule).where(CustomRule.id == rule_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_rule(db: AsyncSession, data: CustomRuleCreate) -> CustomRule:
    rule = CustomRule(
        name=data.name,
        description=data.description,
        match_type=data.match_type,
        match_pattern=data.match_pattern,
        match_scope=data.match_scope,
        file_filter=data.file_filter,
        severity=data.severity,
        suggestion=data.suggestion,
        is_enabled=data.is_enabled,
        is_preset=False,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


async def update_rule(db: AsyncSession, rule_id: int, data: CustomRuleUpdate) -> Optional[CustomRule]:
    rule = await get_rule_by_id(db, rule_id)
    if rule is None:
        return None
    update_data = {}
    if rule.is_preset:
        allowed = {"is_enabled"}
    else:
        allowed = {"name", "description", "match_type", "match_pattern", "match_scope", "file_filter", "severity", "suggestion", "is_enabled"}
    for field in allowed:
        val = getattr(data, field, None)
        if val is not None:
            update_data[field] = val
    if update_data:
        stmt = update(CustomRule).where(CustomRule.id == rule_id).values(**update_data)
        await db.execute(stmt)
        await db.commit()
        await db.refresh(rule)
    return rule


async def delete_rule(db: AsyncSession, rule_id: int) -> bool:
    rule = await get_rule_by_id(db, rule_id)
    if rule is None or rule.is_preset:
        return False
    await db.delete(rule)
    await db.commit()
    return True


async def get_trends(db: AsyncSession, days: int, repo_owner: Optional[str] = None, repo_name: Optional[str] = None) -> List[dict]:
    params: dict = {"days_param": str(days)}
    clauses: list[str] = ["created_at >= NOW() - (:days_param || ' days')::INTERVAL"]
    if repo_owner:
        clauses.append("repo_owner = :owner")
        params["owner"] = repo_owner
    if repo_name:
        clauses.append("repo_name = :repo")
        params["repo"] = repo_name
    where_sql = " AND ".join(clauses)

    sql = text("""
        SELECT
            DATE_TRUNC('day', created_at) AS day,
            COUNT(*) AS pr_count,
            COALESCE(AVG(risk_score), 0) AS avg_risk_score,
            COALESCE(SUM(files_changed), 0) AS total_files_changed,
            COALESCE(SUM(additions), 0) AS total_additions,
            COALESCE(SUM(deletions), 0) AS total_deletions,
            COALESCE(SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END), 0) AS critical_count,
            COALESCE(SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END), 0) AS high_count,
            COALESCE(SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END), 0) AS medium_count,
            COALESCE(SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END), 0) AS low_count
        FROM pr_analyses
        WHERE """ + where_sql + """
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY day ASC
    """)

    result = await db.execute(sql, params)
    rows = result.all()

    return [
        {
            "day": row.day.isoformat() if hasattr(row, 'day') and row.day else None,
            "pr_count": row.pr_count,
            "avg_risk_score": round(float(row.avg_risk_score), 1),
            "total_files_changed": row.total_files_changed,
            "total_additions": row.total_additions,
            "total_deletions": row.total_deletions,
            "critical_count": row.critical_count,
            "high_count": row.high_count,
            "medium_count": row.medium_count,
            "low_count": row.low_count,
        }
        for row in rows
    ]
