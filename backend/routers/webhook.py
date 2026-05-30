import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

from backend.config import settings
from backend.core.database import async_session
from backend.schemas.review import AnalyzeRequest
from backend.services.github import github_service
from backend.services.reviewer import reviewer_service
from backend.store import save_analysis

router = APIRouter(prefix="/api/webhook", tags=["webhook"])
logger = logging.getLogger(__name__)

VALID_PR_ACTIONS = {"opened", "reopened", "synchronize"}


def verify_webhook_signature(secret: str, signature_header: str, body: bytes) -> bool:
    if not secret:
        return True
    if not signature_header:
        return False
    sha_name, signature = signature_header.split("=", 1)
    if sha_name != "sha256":
        return False
    mac = hmac.new(secret.encode(), body, hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), signature)


@router.post("/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: str = Header(..., alias="X-GitHub-Event"),
    x_hub_signature_256: str = Header("", alias="X-Hub-Signature-256"),
):
    raw_body = await request.body()

    if not verify_webhook_signature(
        settings.WEBHOOK_SECRET, x_hub_signature_256, raw_body
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    if x_github_event != "pull_request":
        return {"status": "ignored", "event": x_github_event}

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    action = payload.get("action", "")
    if action not in VALID_PR_ACTIONS:
        return {"status": "ignored", "action": action}

    pr = payload.get("pull_request", {})
    repository = payload.get("repository", {})

    owner = repository.get("owner", {}).get("login", "")
    repo_name = repository.get("name", "")
    pr_number = pr.get("number")

    if not owner or not repo_name or pr_number is None:
        logger.warning("Incomplete webhook payload: owner=%s, repo=%s, pr=%s", owner, repo_name, pr_number)
        return {"status": "error", "detail": "Missing required fields in payload"}

    background_tasks.add_task(
        _run_analysis_background,
        owner=owner,
        repo=repo_name,
        pr_number=pr_number,
    )

    logger.info("Webhook accepted for %s/%s #%d, action=%s", owner, repo_name, pr_number, action)
    return {"status": "accepted"}


async def _run_analysis_background(owner: str, repo: str, pr_number: int):
    logger.info("Background analysis started for %s/%s #%d", owner, repo, pr_number)

    # Webhook 回调没有用户 OAuth token，回退使用环境变量 GITHUB_TOKEN
    service_token = settings.GITHUB_TOKEN
    if not service_token:
        logger.warning(
            "GITHUB_TOKEN 未配置，跳过 %s/%s #%d 的后台分析",
            owner, repo, pr_number,
        )
        return

    try:
        request = AnalyzeRequest(owner=owner, repo=repo, pr_number=pr_number)
        result = reviewer_service.analyze(request, token=service_token)

        async with async_session() as db:
            await save_analysis(db, result)

        comment_body = reviewer_service._format_review_comment(result)
        github_service.post_pr_review(
            owner=owner,
            repo=repo,
            pr_number=pr_number,
            body=comment_body,
            token=service_token,
        )

        logger.info(
            "Background analysis completed for %s/%s #%d, risk_score=%d",
            owner, repo, pr_number, result.risk_score,
        )
    except Exception as e:
        logger.error(
            "Background analysis failed for %s/%s #%d: %s",
            owner, repo, pr_number, e,
        )
