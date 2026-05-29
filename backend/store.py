import json
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import func, select, update
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
    cutoff = func.now() - timedelta(days=days)

    stmt = (
        select(
            func.date_trunc("day", PRAnalysis.created_at).label("day"),
            func.count(PRAnalysis.id).label("pr_count"),
            func.avg(PRAnalysis.risk_score).label("avg_risk_score"),
            func.sum(PRAnalysis.files_changed).label("total_files_changed"),
            func.sum(PRAnalysis.additions).label("total_additions"),
            func.sum(PRAnalysis.deletions).label("total_deletions"),
            func.count().filter(PRAnalysis.risk_level == "critical").label("critical_count"),
            func.count().filter(PRAnalysis.risk_level == "high").label("high_count"),
            func.count().filter(PRAnalysis.risk_level == "medium").label("medium_count"),
            func.count().filter(PRAnalysis.risk_level == "low").label("low_count"),
        )
        .where(PRAnalysis.created_at >= cutoff)
        .group_by(func.date_trunc("day", PRAnalysis.created_at))
        .order_by(func.date_trunc("day", PRAnalysis.created_at).asc())
    )

    if repo_owner:
        stmt = stmt.where(PRAnalysis.repo_owner == repo_owner)
    if repo_name:
        stmt = stmt.where(PRAnalysis.repo_name == repo_name)

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "day": row.day.isoformat() if row.day else None,
            "pr_count": row.pr_count,
            "avg_risk_score": round(float(row.avg_risk_score) if row.avg_risk_score else 0, 1),
            "total_files_changed": row.total_files_changed or 0,
            "total_additions": row.total_additions or 0,
            "total_deletions": row.total_deletions or 0,
            "critical_count": row.critical_count or 0,
            "high_count": row.high_count or 0,
            "medium_count": row.medium_count or 0,
            "low_count": row.low_count or 0,
        }
        for row in rows
    ]
