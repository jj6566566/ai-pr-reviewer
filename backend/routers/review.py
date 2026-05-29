import json
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_db
from backend.schemas.review import AnalyzeRequest, AnalyzeResponse, FileInfo, PRInfoResponse
from backend.services.github import github_service
from backend.services.reviewer import reviewer_service
from backend.store import get_analysis_by_id, get_recent_analyses, save_analysis

router = APIRouter(prefix="/api/review", tags=["review"])

logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_pr(request: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    try:
        response = reviewer_service.analyze(request)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail="GitHub API \u9519\u8bef: {}".format(e.response.text))
    except Exception as e:
        raise HTTPException(status_code=500, detail="\u5206\u6790\u5931\u8d25: {}".format(str(e)))

    try:
        await save_analysis(db, response)
    except Exception as e:
        logger.error("\u4fdd\u5b58\u5206\u6790\u7ed3\u679c\u5931\u8d25: %s", e)

    try:
        comment_body = reviewer_service._format_review_comment(response)
        github_service.post_pr_review(
            owner=request.owner,
            repo=request.repo,
            pr_number=request.pr_number,
            body=comment_body,
        )
    except Exception as e:
        logger.error("\u53d1\u5e03 PR \u8bc4\u8bba\u5931\u8d25: %s", e)

    return response


@router.get("/fetch")
async def fetch_pr(owner: str, repo: str, pr_number: int):
    try:
        pr_info = github_service.get_pr_info(
            owner=owner,
            repo=repo,
            pr_number=pr_number,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail="GitHub API \u9519\u8bef: {}".format(e.response.text))
    except Exception as e:
        raise HTTPException(status_code=500, detail="\u83b7\u53d6 PR \u4fe1\u606f\u5931\u8d25: {}".format(str(e)))

    files_response = [
        FileInfo(
            filename=f.filename,
            status=f.status,
            additions=f.additions,
            deletions=f.deletions,
            patch=f.patch,
        )
        for f in pr_info.files
    ]

    return AnalyzeResponse(
        pr_info=PRInfoResponse(
            owner=pr_info.owner,
            repo=pr_info.repo,
            number=pr_info.number,
            title=pr_info.title,
            description=pr_info.description,
            author=pr_info.author,
            base_branch=pr_info.base_branch,
            head_branch=pr_info.head_branch,
            files_changed=pr_info.files_changed,
            additions=pr_info.additions,
            deletions=pr_info.deletions,
            files=files_response,
            diff_content=pr_info.diff_content,
        ),
    )


@router.get("/history")
async def list_history(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    analyses = await get_recent_analyses(db, limit=limit)
    results = []
    for a in analyses:
        results.append({
            "id": a.id,
            "repo_owner": a.repo_owner,
            "repo_name": a.repo_name,
            "pr_number": a.pr_number,
            "pr_title": a.pr_title,
            "author": a.author,
            "risk_score": a.risk_score,
            "risk_level": a.risk_level,
            "files_changed": a.files_changed,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return results


@router.get("/history/{analysis_id}")
async def get_history_detail(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
):
    a = await get_analysis_by_id(db, analysis_id)
    if a is None:
        raise HTTPException(status_code=404, detail="\u8bb0\u5f55\u4e0d\u5b58\u5728")

    risk_items = []
    if a.risk_items:
        try:
            risk_items = json.loads(a.risk_items)
        except (json.JSONDecodeError, TypeError):
            pass

    suggestions = []
    if a.suggestions:
        try:
            suggestions = json.loads(a.suggestions)
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "id": a.id,
        "repo_owner": a.repo_owner,
        "repo_name": a.repo_name,
        "pr_number": a.pr_number,
        "pr_title": a.pr_title,
        "pr_description": a.pr_description,
        "author": a.author,
        "base_branch": a.base_branch,
        "head_branch": a.head_branch,
        "files_changed": a.files_changed,
        "additions": a.additions,
        "deletions": a.deletions,
        "summary": a.summary,
        "risk_items": risk_items,
        "suggestions": suggestions,
        "risk_score": a.risk_score,
        "risk_level": a.risk_level,
        "estimated_review_minutes": a.estimated_review_minutes,
        "status": a.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }
