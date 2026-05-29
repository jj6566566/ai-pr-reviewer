import json
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.pr_analysis import PRAnalysis, ReviewMode
from backend.schemas.review import AnalyzeResponse, ReviewModeCreate, ReviewModeUpdate


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


async def list_review_modes(db: AsyncSession) -> List[ReviewMode]:
    stmt = select(ReviewMode).order_by(ReviewMode.sort_order.asc(), ReviewMode.id.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_review_mode_by_id(db: AsyncSession, mode_id: int) -> Optional[ReviewMode]:
    stmt = select(ReviewMode).where(ReviewMode.id == mode_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_review_mode(db: AsyncSession, data: ReviewModeCreate) -> ReviewMode:
    mode = ReviewMode(
        name=data.name,
        description=data.description,
        system_prompt=data.system_prompt,
        temperature=data.temperature,
        is_preset=False,
    )
    db.add(mode)
    await db.commit()
    await db.refresh(mode)
    return mode


async def update_review_mode(db: AsyncSession, mode_id: int, data: ReviewModeUpdate) -> Optional[ReviewMode]:
    mode = await get_review_mode_by_id(db, mode_id)
    if mode is None:
        return None
    if mode.is_preset:
        return None
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.system_prompt is not None:
        update_data["system_prompt"] = data.system_prompt
    if data.temperature is not None:
        update_data["temperature"] = data.temperature
    if data.sort_order is not None:
        update_data["sort_order"] = data.sort_order
    if update_data:
        stmt = update(ReviewMode).where(ReviewMode.id == mode_id).values(**update_data)
        await db.execute(stmt)
        await db.commit()
        await db.refresh(mode)
    return mode


async def delete_review_mode(db: AsyncSession, mode_id: int) -> bool:
    mode = await get_review_mode_by_id(db, mode_id)
    if mode is None or mode.is_preset:
        return False
    await db.delete(mode)
    await db.commit()
    return True
