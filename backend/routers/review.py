import json
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_db
from backend.models.pr_analysis import PRAnalysis
from backend.services.auth import require_user, decrypt_token
from backend.models.user import User
from backend.schemas.review import (
    AnalyzeRequest,
    AnalyzeResponse,
    BatchAnalyzeRequest,
    BatchAnalyzeResponse,
    BatchOverview,
    BatchRiskCard,
    CrossPRDuplicateResult,
    CustomRuleCreate,
    CustomRuleResponse,
    CustomRuleUpdate,
    DuplicateRiskPatternItem,
    FeedbackRequest,
    FileInfo,
    FileOverlapItem,
    PRInfoResponse,
    RuleMatch,
    SimilarCodeBlockItem,
    TrendDataPoint,
    TrendResponse,
    TrendSummary,
)
from backend.services.duplicate_detector import detect_cross_pr_duplicates
from backend.services.github import github_service
from backend.services.reviewer import reviewer_service
from backend.services.rule_engine import DiffFile, run_rules
from backend.store import (
    create_rule,
    delete_rule,
    get_analysis_by_id,
    get_enabled_rules,
    get_recent_analyses,
    get_rule_by_id,
    get_trends,
    list_rules,
    save_analysis,
    save_analysis_sync,
    update_rule,
)

router = APIRouter(prefix="/api/review", tags=["review"])

logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_pr(request: AnalyzeRequest, user: User = Depends(require_user), db: AsyncSession = Depends(get_db)):
    token = decrypt_token(user.access_token)
    try:
        response = reviewer_service.analyze(request, token=token)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail="GitHub API \u9519\u8bef: {}".format(e.response.text))
    except Exception as e:
        raise HTTPException(status_code=500, detail="\u5206\u6790\u5931\u8d25: {}".format(str(e)))

    try:
        rules = await get_enabled_rules(db)
        if rules:
            diff_files = [
                DiffFile(filename=f.filename, patch=f.patch)
                for f in response.pr_info.files
            ]
            matches = run_rules(rules, diff_files)
            response.rule_matches = [
                RuleMatch(
                    rule_id=m.rule_id,
                    rule_name=m.rule_name,
                    severity=m.severity,
                    file=m.file,
                    line=m.line,
                    matched_text=m.matched_text,
                    suggestion=m.suggestion,
                )
                for m in matches
            ]
    except Exception as e:
        logger.error("\u89c4\u5219\u5f15\u64ce\u6267\u884c\u5931\u8d25: %s", e)

    try:
        saved = await save_analysis(db, response)
        response.analysis_id = saved.id
    except Exception as e:
        logger.error("\u4fdd\u5b58\u5206\u6790\u7ed3\u679c\u5931\u8d25: %s", e)

    try:
        comment_body = reviewer_service._format_review_comment(response)
        github_service.post_pr_review(
            owner=request.owner,
            repo=request.repo,
            pr_number=request.pr_number,
            body=comment_body,
            token=token,
        )
    except Exception as e:
        logger.error("\u53d1\u5e03 PR \u8bc4\u8bba\u5931\u8d25: %s", e)

    return response


import asyncio

@router.post("/analyze-stream")
async def analyze_pr_stream(request: AnalyzeRequest, user: User = Depends(require_user)):
    """Single-PR streaming analysis via SSE.

    Uses a *sync* generator so that every ``yield`` is flushed immediately
    to the client -- no async-generator buffering.
    """
    token = decrypt_token(user.access_token)

    def generate():
        response_obj = None
        try:
            for event in reviewer_service.analyze_stream(request, token=token):
                if event["event"] == "complete":
                    response_obj = AnalyzeResponse(**event["data"])
                    try:
                        saved = save_analysis_sync(response_obj)
                        response_obj.analysis_id = saved.id
                    except Exception as e:
                        logger.error("保存分析结果失败: %s", e)
                    event["data"]["analysis_id"] = response_obj.analysis_id
                yield f"event: {event['event']}\ndata: {json.dumps(event['data'], ensure_ascii=False)}\n\n"
        except httpx.HTTPStatusError as e:
            yield f"event: error\ndata: {json.dumps({'error': f'GitHub API 错误: {e.response.text}'})}\n\n"
        except Exception as e:
            logger.error("流式分析失败: %s", e)
            yield f"event: error\ndata: {json.dumps({'error': f'分析失败: {str(e)}'})}\n\n"

        if response_obj and request.post_comment:
            try:
                comment_body = reviewer_service._format_review_comment(response_obj)
                github_service.post_pr_review(
                    owner=request.owner,
                    repo=request.repo,
                    pr_number=request.pr_number,
                    body=comment_body,
                    token=token,
                )
            except Exception as e:
                logger.error("发布 PR 评论失败: %s", e)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
            "Content-Type": "text/event-stream; charset=utf-8",
        },
    )


@router.post("/batch-stream")
async def batch_analyze_stream(request: BatchAnalyzeRequest, user: User = Depends(require_user), db: AsyncSession = Depends(get_db)):
    token = decrypt_token(user.access_token)
    prs = request.prs
    if len(prs) < 2 or len(prs) > 10:
        raise HTTPException(status_code=400, detail="批量分析需要 2-10 个 PR")

    async def batch_background_task(results: list[AnalyzeResponse], db_session):
        # 保存所有分析结果
        for r in results:
            try:
                await save_analysis(db_session, r)
            except Exception as e:
                logger.error("保存分析结果失败 (PR #%s): %s", r.pr_info.number, e)

        # 为每个 PR 单独发布评论（相互独立，一个失败不影响其他）
        for r in results:
            try:
                comment_body = reviewer_service._format_review_comment(r)
                github_service.post_pr_review(
                    owner=r.pr_info.owner,
                    repo=r.pr_info.repo,
                    pr_number=r.pr_info.number,
                    body=comment_body,
                    token=token,
                )
                logger.info("成功发布 PR 评论 (PR #%s)", r.pr_info.number)
            except Exception as e:
                logger.error("发布 PR 评论失败 (PR #%s): %s", r.pr_info.number, e)

    async def generate():
        total = len(prs)
        results: list[AnalyzeResponse] = []
        for idx, item in enumerate(prs):
            pr_label = "#{}".format(item.pr_number)
            yield "event: batch_progress\ndata: {}\n\n".format(
                json.dumps({"current": idx + 1, "total": total, "pr_number": item.pr_number, "stage": "fetching"})
            )
            try:
                analyze_req = AnalyzeRequest(owner=item.owner, repo=item.repo, pr_number=item.pr_number)
                for event in reviewer_service.analyze_stream(analyze_req, token=token):
                    if event["event"] == "progress":
                        yield "event: batch_progress\ndata: {}\n\n".format(
                            json.dumps({"current": idx + 1, "total": total, "pr_number": item.pr_number, "stage": "fetching"})
                        )
                    elif event["event"] == "token":
                        yield "event: batch_token\ndata: {}\n\n".format(
                            json.dumps({"pr_number": item.pr_number, "pr_index": idx, "token": event["data"]})
                        )
                    elif event["event"] == "complete":
                        response_data = event["data"]
                        response = AnalyzeResponse(**response_data)
                        try:
                            saved = await save_analysis(db, response)
                            response.analysis_id = saved.id
                            response_data["analysis_id"] = saved.id
                        except Exception as e:
                            logger.error("保存分析结果失败 (PR #%s): %s", item.pr_number, e)
                        results.append(response)
                        yield "event: batch_pr_complete\ndata: {}\n\n".format(
                            json.dumps({"current": idx + 1, "total": total, "pr_number": item.pr_number, "result": response_data})
                        )
                    elif event["event"] == "error":
                        yield "event: batch_error\ndata: {}\n\n".format(
                            json.dumps({"pr_number": item.pr_number, "error": event["data"]})
                        )
            except Exception as e:
                yield "event: batch_error\ndata: {}\n\n".format(
                    json.dumps({"pr_number": item.pr_number, "error": str(e)})
                )

        overview = _compute_batch_overview(results)
        dup_result = None
        try:
            dup = detect_cross_pr_duplicates(results)
            dup_result = dup.model_dump(mode="json")
        except Exception as e:
            logger.error("跨PR重复检测失败: %s", e)

        batch_response = BatchAnalyzeResponse(
            results=results, overview=overview,
            duplicate_analysis=CrossPRDuplicateResult(**dup_result) if dup_result else None,
        )
        yield "event: batch_complete\ndata: {}\n\n".format(
            json.dumps(batch_response.model_dump(mode="json"), ensure_ascii=False)
        )

        asyncio.create_task(batch_background_task(results, db))

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/fetch")
async def fetch_pr(owner: str, repo: str, pr_number: int, user: User = Depends(require_user)):
    token = decrypt_token(user.access_token)
    try:
        pr_info = github_service.get_pr_info(
            owner=owner,
            repo=repo,
            pr_number=pr_number,
            token=token,
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


@router.post("/batch", response_model=BatchAnalyzeResponse)
async def batch_analyze(request: BatchAnalyzeRequest, user: User = Depends(require_user), db: AsyncSession = Depends(get_db)):
    token = decrypt_token(user.access_token)
    prs = request.prs
    if len(prs) < 2 or len(prs) > 10:
        raise HTTPException(status_code=400, detail="\u6279\u91cf\u5206\u6790\u9700\u8981 2-10 \u4e2a PR")

    results: list[AnalyzeResponse] = []
    for item in prs:
        analyze_req = AnalyzeRequest(
            owner=item.owner,
            repo=item.repo,
            pr_number=item.pr_number,
        )
        try:
            response = reviewer_service.analyze(analyze_req, token=token)
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=400,
                detail="GitHub API \u9519\u8bef ({}): {}".format(item.owner, e.response.text),
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail="\u5206\u6790\u5931\u8d25 ({}): {}".format(item.owner, str(e)),
            )

        try:
            saved = await save_analysis(db, response)
            response.analysis_id = saved.id
        except Exception as e:
            logger.error("\u4fdd\u5b58\u5206\u6790\u7ed3\u679c\u5931\u8d25: %s", e)

        results.append(response)

    overview = _compute_batch_overview(results)

    duplicate_analysis = None
    try:
        dup_result = detect_cross_pr_duplicates(results)
        duplicate_analysis = CrossPRDuplicateResult(
            file_overlaps=[
                FileOverlapItem(
                    filename=fo.filename,
                    pr_numbers=fo.pr_numbers,
                    changes_detail=fo.changes_detail,
                )
                for fo in dup_result.file_overlaps
            ],
            similar_code_blocks=[
                SimilarCodeBlockItem(
                    block_hash=sc.block_hash,
                    pr_numbers=sc.pr_numbers,
                    files=sc.files,
                    similarity_score=sc.similarity_score,
                    snippet_preview=sc.snippet_preview,
                )
                for sc in dup_result.similar_code_blocks
            ],
            duplicate_risk_patterns=[
                DuplicateRiskPatternItem(
                    description=dp.description,
                    affected_prs=dp.affected_prs,
                    severity=dp.severity,
                    occurrence_count=dp.occurrence_count,
                )
                for dp in dup_result.duplicate_risk_patterns
            ],
            summary=dup_result.summary,
        )
    except Exception as e:
        logger.error("\u8de8PR\u91cd\u590d\u68c0\u6d4b\u5931\u8d25: %s", e)

    return BatchAnalyzeResponse(results=results, overview=overview, duplicate_analysis=duplicate_analysis)


SEVERITY_WEIGHT = {"critical": 4, "high": 3, "medium": 2, "low": 1}


def _compute_batch_overview(results: list) -> BatchOverview:
    total_prs = len(results)

    avg_risk_score = sum(r.risk_score for r in results) / total_prs if total_prs > 0 else 0.0
    avg_risk_score = round(avg_risk_score, 2)

    highest = max(results, key=lambda r: r.risk_score)
    highest_risk_pr = BatchRiskCard(
        pr_number=highest.pr_info.number,
        title=highest.pr_info.title,
        risk_score=highest.risk_score,
        risk_level=highest.risk_level,
    )

    risk_distribution: dict = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for r in results:
        for item in r.risk_items:
            sev = item.severity
            if sev in risk_distribution:
                risk_distribution[sev] += 1

    all_risks: list[tuple] = []
    for r in results:
        for item in r.risk_items:
            all_risks.append((item.description, SEVERITY_WEIGHT.get(item.severity, 0)))

    all_risks.sort(key=lambda x: x[1], reverse=True)

    seen: set = set()
    top_risks: list[str] = []
    for desc, _ in all_risks:
        if desc not in seen:
            seen.add(desc)
            top_risks.append(desc)
        if len(top_risks) >= 5:
            break

    return BatchOverview(
        total_prs=total_prs,
        avg_risk_score=avg_risk_score,
        highest_risk_pr=highest_risk_pr,
        risk_distribution=risk_distribution,
        top_risks=top_risks,
    )


@router.get("/history")
async def list_history(
    limit: int = Query(default=20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    try:
        analyses = await get_recent_analyses(db, limit=limit)
    except Exception as e:
        logger.error("Failed to fetch history: %s", e)
        raise HTTPException(status_code=500, detail="查询历史记录失败")
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
        raise HTTPException(status_code=404, detail="记录不存在")

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

    feedback = None
    if a.feedback:
        try:
            feedback = json.loads(a.feedback)
        except (json.JSONDecodeError, TypeError):
            pass

    confidence_scores = None
    if a.confidence_scores:
        try:
            confidence_scores = json.loads(a.confidence_scores)
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
        "feedback": feedback,
        "confidence_scores": confidence_scores,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.post("/feedback/{analysis_id}")
async def submit_feedback(
    analysis_id: int,
    request: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
):
    a = await get_analysis_by_id(db, analysis_id)
    if a is None:
        raise HTTPException(status_code=404, detail="\u8bb0\u5f55\u4e0d\u5b58\u5728")

    feedback = {}
    if a.feedback:
        try:
            feedback = json.loads(a.feedback)
        except (json.JSONDecodeError, TypeError):
            pass

    for item in request.items:
        key = "{}_{}".format(item.category, item.index)
        feedback[key] = {"verdict": item.verdict, "timestamp": None}

    a.feedback = json.dumps(feedback, ensure_ascii=False)
    await db.commit()

    return {"ok": True, "feedback": feedback}


@router.get("/rules", response_model=list[CustomRuleResponse])
async def get_rules(db: AsyncSession = Depends(get_db)):
    rules = await list_rules(db)
    return [
        CustomRuleResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            match_type=r.match_type,
            match_pattern=r.match_pattern,
            match_scope=r.match_scope,
            file_filter=r.file_filter,
            severity=r.severity,
            suggestion=r.suggestion,
            is_enabled=r.is_enabled,
            is_preset=r.is_preset,
            created_at=r.created_at.isoformat() if r.created_at else None,
            updated_at=r.updated_at.isoformat() if r.updated_at else None,
        )
        for r in rules
    ]


@router.post("/rules", response_model=CustomRuleResponse)
async def add_rule(data: CustomRuleCreate, db: AsyncSession = Depends(get_db)):
    try:
        r = await create_rule(db, data)
    except Exception:
        raise HTTPException(status_code=409, detail="\u89c4\u5219\u540d\u79f0\u5df2\u5b58\u5728")
    return CustomRuleResponse(
        id=r.id,
        name=r.name,
        description=r.description,
        match_type=r.match_type,
        match_pattern=r.match_pattern,
        match_scope=r.match_scope,
        file_filter=r.file_filter,
        severity=r.severity,
        suggestion=r.suggestion,
        is_enabled=r.is_enabled,
        is_preset=r.is_preset,
        created_at=r.created_at.isoformat() if r.created_at else None,
        updated_at=r.updated_at.isoformat() if r.updated_at else None,
    )


@router.put("/rules/{rule_id}", response_model=CustomRuleResponse)
async def edit_rule(rule_id: int, data: CustomRuleUpdate, db: AsyncSession = Depends(get_db)):
    r = await update_rule(db, rule_id, data)
    if r is None:
        raise HTTPException(status_code=404, detail="\u89c4\u5219\u4e0d\u5b58\u5728\u6216\u4e3a\u9884\u8bbe\u89c4\u5219\u4e0d\u53ef\u4fee\u6539")
    return CustomRuleResponse(
        id=r.id,
        name=r.name,
        description=r.description,
        match_type=r.match_type,
        match_pattern=r.match_pattern,
        match_scope=r.match_scope,
        file_filter=r.file_filter,
        severity=r.severity,
        suggestion=r.suggestion,
        is_enabled=r.is_enabled,
        is_preset=r.is_preset,
        created_at=r.created_at.isoformat() if r.created_at else None,
        updated_at=r.updated_at.isoformat() if r.updated_at else None,
    )


@router.delete("/rules/{rule_id}")
async def remove_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    ok = await delete_rule(db, rule_id)
    if not ok:
        raise HTTPException(status_code=404, detail="\u89c4\u5219\u4e0d\u5b58\u5728\u6216\u4e3a\u9884\u8bbe\u89c4\u5219\u4e0d\u53ef\u5220\u9664")
    return {"ok": True}


@router.get("/trends", response_model=TrendResponse)
async def get_trend(
    days: int = Query(default=30, ge=1, le=365),
    repo_owner: Optional[str] = Query(None),
    repo_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        rows = await get_trends(db, days=days, repo_owner=repo_owner, repo_name=repo_name)
    except Exception as e:
        logger.error("Failed to fetch trends: %s", e)
        raise HTTPException(status_code=500, detail="查询趋势数据失败")

    data_points = [
        TrendDataPoint(
            day=row["day"],
            pr_count=row["pr_count"],
            avg_risk_score=row["avg_risk_score"],
            total_files_changed=row["total_files_changed"],
            total_additions=row["total_additions"],
            total_deletions=row["total_deletions"],
            critical_count=row["critical_count"],
            high_count=row["high_count"],
            medium_count=row["medium_count"],
            low_count=row["low_count"],
        )
        for row in rows
    ]

    total_prs = sum(dp.pr_count for dp in data_points)
    avg_score = (
        sum(dp.avg_risk_score * dp.pr_count for dp in data_points) / total_prs
        if total_prs > 0
        else 0.0
    )

    trend_direction = "stable"
    if len(data_points) >= 2:
        first_half = data_points[: len(data_points) // 2]
        second_half = data_points[len(data_points) // 2 :]
        first_avg = sum(d.avg_risk_score for d in first_half) / len(first_half)
        second_avg = sum(d.avg_risk_score for d in second_half) / len(second_half)
        if second_avg > first_avg * 1.1:
            trend_direction = "worsening"
        elif second_avg < first_avg * 0.9:
            trend_direction = "improving"

    severity_totals = {
        "critical": sum(dp.critical_count for dp in data_points),
        "high": sum(dp.high_count for dp in data_points),
        "medium": sum(dp.medium_count for dp in data_points),
        "low": sum(dp.low_count for dp in data_points),
    }
    most_common_severity = max(severity_totals, key=severity_totals.get)

    summary = TrendSummary(
        total_prs=total_prs,
        avg_risk_score=round(avg_score, 1),
        trend_direction=trend_direction,
        most_common_severity=most_common_severity,
    )

    return TrendResponse(data_points=data_points, summary=summary)


# ---- Code Q&A SSE Endpoint ----

from pydantic import BaseModel


class AskRequest(BaseModel):
    question: str




@router.post("/{analysis_id}/ask")
async def ask_question(
    analysis_id: int,
    request: AskRequest,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream AI responses to user questions about a PR analysis via SSE."""
    a = await get_analysis_by_id(db, analysis_id)
    if a is None:
        raise HTTPException(status_code=404, detail="\u5206\u6790\u8bb0\u5f55\u4e0d\u5b58\u5728")

    # Parse stored JSON fields
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

    # Build PR context string for the LLM
    context_parts: list[str] = []
    if a.pr_title:
        context_parts.append("PR\u6807\u9898: {}".format(a.pr_title))
    if a.repo_owner and a.repo_name:
        context_parts.append("\u4ed3\u5e93: {}/{}".format(a.repo_owner, a.repo_name))
    if a.summary:
        context_parts.append("AI\u5206\u6790\u6458\u8981: {}".format(a.summary))
    if risk_items:
        context_parts.append("\u98ce\u9669\u9879: {}".format(json.dumps(risk_items, ensure_ascii=False)))
    if suggestions:
        context_parts.append("\u6539\u8fdb\u5efa\u8bae: {}".format(json.dumps(suggestions, ensure_ascii=False)))

    context_str = "\n".join(context_parts)

    system_prompt = (
        "\u4f60\u662f\u4e00\u4e2a\u4e13\u4e1a\u7684\u4ee3\u7801\u8bc4\u5ba1\u4e13\u5bb6\u3002"
        "\u7528\u6237\u6b63\u5728\u67e5\u770b\u4e00\u4e2a\u5df2\u7ecf\u5b8c\u6210AI\u5206\u6790\u7684Pull Request\uff0c"
        "\u8bf7\u6839\u636e\u5df2\u77e5\u7684PR\u4e0a\u4e0b\u6587\u56de\u7b54\u7528\u6237\u7684\u95ee\u9898\u3002"
        "\u56de\u7b54\u8981\u4e13\u4e1a\u3001\u7b80\u6d01\uff0c\u5fc5\u8981\u65f6\u7ed9\u51fa\u4ee3\u7801\u5c42\u9762\u7684\u5efa\u8bae\u3002"
    )

    user_prompt = (
        "\u4ee5\u4e0b\u662f\u4f60\u9700\u8981\u4e86\u89e3\u7684\u8be5 PR \u7684\u4e0a\u4e0b\u6587\u4fe1\u606f\uff1a\n\n"
        "{}\n\n"
        "\u7528\u6237\u7684\u95ee\u9898\uff1a{}"
    ).format(context_str, request.question)

    from backend.services.llm import LLMClient, LLMModel

    llm = LLMClient(model=LLMModel.DEEPSEEK)

    def generate():
        try:
            for token in llm.chat_stream(system_prompt=system_prompt, user_message=user_prompt):
                yield "data: {}\n\n".format(json.dumps({"token": token}, ensure_ascii=False))
            yield "data: {}\n\n".format(json.dumps({"done": True}))
        except Exception as e:
            logger.error("Code Q&A failed: %s", e)
            yield "data: {}\n\n".format(
                json.dumps({"error": "\u95ee\u7b54\u5931\u8d25: {}".format(str(e))}, ensure_ascii=False)
            )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---- Repo Health Endpoint ----


@router.get("/repo-health")
async def get_repo_health(
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregated health metrics grouped by repository."""
    stmt = (
        select(
            PRAnalysis.repo_owner,
            PRAnalysis.repo_name,
            func.count(PRAnalysis.id).label("total_prs"),
            func.avg(PRAnalysis.risk_score).label("avg_risk_score"),
            func.sum(case((PRAnalysis.risk_level == "critical", 1), else_=0)).label("critical_count"),
            func.sum(case((PRAnalysis.risk_level == "high", 1), else_=0)).label("high_count"),
            func.sum(case((PRAnalysis.risk_level == "medium", 1), else_=0)).label("medium_count"),
            func.sum(case((PRAnalysis.risk_level == "low", 1), else_=0)).label("low_count"),
            func.max(PRAnalysis.created_at).label("last_analysis_at"),
        )
        .group_by(PRAnalysis.repo_owner, PRAnalysis.repo_name)
        .order_by(func.avg(PRAnalysis.risk_score).desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "full_name": "{}/{}".format(row.repo_owner, row.repo_name),
            "total_prs": row.total_prs,
            "avg_risk_score": round(float(row.avg_risk_score), 2) if row.avg_risk_score else 0.0,
            "critical_count": row.critical_count or 0,
            "high_count": row.high_count or 0,
            "medium_count": row.medium_count or 0,
            "low_count": row.low_count or 0,
            "last_analysis_at": row.last_analysis_at.isoformat() if row.last_analysis_at else None,
        }
        for row in rows
    ]
