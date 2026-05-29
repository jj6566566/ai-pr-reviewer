import json
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.pr_analysis import PRAnalysis
from backend.schemas.review import AnalyzeResponse


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
