import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.models.user import User
from backend.services.auth import decrypt_token, require_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/github", tags=["github_proxy"])


class RepoResponse(BaseModel):
    id: int
    full_name: str
    name: str
    owner: dict[str, Any]
    description: Optional[str] = None
    private: bool


class PullRequestResponse(BaseModel):
    number: int
    title: str
    state: str
    user: dict[str, Any]
    created_at: str
    html_url: str


class NotificationResponse(BaseModel):
    repo_full_name: str
    repo_name: str
    repo_owner: str
    pr_number: int
    title: str
    author: str
    author_avatar: Optional[str] = None
    created_at: str
    html_url: str


@router.get("/repos", response_model=list[RepoResponse])
async def list_repos(
    q: Optional[str] = Query(None, description="搜索关键词"),
    user: User = Depends(require_user),
) -> list[dict[str, Any]]:
    token = decrypt_token(user.access_token)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    if q:
        url = f"https://api.github.com/search/repositories?q={q}+fork:true&sort=updated&per_page=100"
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return [
                {
                    "id": item["id"],
                    "full_name": item["full_name"],
                    "name": item["name"],
                    "owner": item["owner"],
                    "description": item.get("description"),
                    "private": item["private"],
                }
                for item in data.get("items", [])[:100]
            ]

    url = "https://api.github.com/user/repos?sort=updated&per_page=100&type=all"
    async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 401:
            raise HTTPException(status_code=401, detail="GitHub token 已失效，请重新登录")
        resp.raise_for_status()
        return resp.json()


@router.get("/repos/{owner}/{repo}/pulls", response_model=list[PullRequestResponse])
async def list_pulls(
    owner: str,
    repo: str,
    user: User = Depends(require_user),
) -> list[dict[str, Any]]:
    token = decrypt_token(user.access_token)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=all&sort=updated&per_page=100"
    async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 401:
            raise HTTPException(status_code=401, detail="GitHub token 已失效，请重新登录")
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        return resp.json()


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    user: User = Depends(require_user),
) -> list[dict[str, Any]]:
    token = decrypt_token(user.access_token)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    since = (datetime.utcnow() - timedelta(days=7)).isoformat() + "Z"

    async with httpx.AsyncClient(timeout=20.0, verify=False) as client:
        repos_resp = await client.get(
            "https://api.github.com/user/repos?sort=updated&per_page=50&type=all",
            headers=headers,
        )
        if repos_resp.status_code == 401:
            raise HTTPException(status_code=401, detail="GitHub token 已失效，请重新登录")
        repos_resp.raise_for_status()
        repos = repos_resp.json()

        notifications: list[dict[str, Any]] = []
        semaphore = asyncio.Semaphore(5)

        async def fetch_repo_prs(repo: dict[str, Any]) -> None:
            async with semaphore:
                owner_name = repo["owner"]["login"]
                repo_name_val = repo["name"]
                full_name = repo["full_name"]
                url = (
                    f"https://api.github.com/repos/{owner_name}/{repo_name_val}/pulls"
                    f"?state=open&sort=created&direction=desc&per_page=10"
                )
                try:
                    async with httpx.AsyncClient(timeout=15.0, verify=False) as inner_client:
                        prs_resp = await inner_client.get(url, headers=headers)
                        if prs_resp.status_code != 200:
                            return
                        prs = prs_resp.json()
                        for pr in prs:
                            pr_created = pr.get("created_at", "")
                            if pr_created < since:
                                continue
                            notifications.append(
                                {
                                    "repo_full_name": full_name,
                                    "repo_name": repo_name_val,
                                    "repo_owner": owner_name,
                                    "pr_number": pr["number"],
                                    "title": pr.get("title", ""),
                                    "author": pr.get("user", {}).get("login", "unknown"),
                                    "author_avatar": pr.get("user", {}).get("avatar_url"),
                                    "created_at": pr_created,
                                    "html_url": pr.get("html_url", ""),
                                }
                            )
                except Exception as exc:
                    logger.warning("Failed to fetch PRs for %s: %s", full_name, exc)

        tasks = [fetch_repo_prs(repo) for repo in repos[:30]]
        await asyncio.gather(*tasks)

        notifications.sort(key=lambda x: x["created_at"], reverse=True)
        return notifications[:50]
