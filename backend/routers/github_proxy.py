from __future__ import annotations

import logging
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
        url = f"https://api.github.com/search/repositories?q={q}+fork:true&sort=updated&per_page=30"
        async with httpx.AsyncClient(timeout=15.0) as client:
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
                for item in data.get("items", [])[:30]
            ]

    url = "https://api.github.com/user/repos?sort=updated&per_page=30&type=all"
    async with httpx.AsyncClient(timeout=15.0) as client:
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

    url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=open&sort=updated&per_page=30"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        return resp.json()
