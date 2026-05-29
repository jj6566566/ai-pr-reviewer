import json
from typing import Optional

from sqlalchemy import select
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
    if rule is None or rule.is_preset:
        return None
    update_data = {}
    for field in ("name", "description", "match_type", "match_pattern", "match_scope", "file_filter", "severity", "suggestion", "is_enabled"):
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
