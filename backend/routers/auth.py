from __future__ import annotations

import logging
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.core.database import get_db
from backend.models.user import User
from backend.schemas.auth import LoginResponse, UserResponse
from backend.services.auth import (
    create_jwt,
    decrypt_token,
    encrypt_token,
    get_current_user,
    require_user,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# 内存 OAuth state 存储（生产环境应使用 Redis）
# ---------------------------------------------------------------------------
_OAUTH_STATES: dict[str, str] = {}


# ---------------------------------------------------------------------------
# 登录入口
# ---------------------------------------------------------------------------
@router.get("/login", response_model=LoginResponse)
async def login() -> LoginResponse:
    """返回 GitHub OAuth 授权页 URL。

    客户端拿到 url 后应将浏览器重定向到该地址。
    """
    state = secrets.token_urlsafe(32)
    _OAUTH_STATES[state] = state

    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "state": state,
        "scope": "repo",
    }
    url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return LoginResponse(url=url)


# ---------------------------------------------------------------------------
# OAuth 回调
# ---------------------------------------------------------------------------
@router.get("/callback")
async def callback(
    code: str = Query(..., description="GitHub 返回的授权码"),
    state: str = Query(..., description="防 CSRF 的 state 参数"),
    db: AsyncSession = Depends(get_db),
):
    """处理 GitHub OAuth 回调。

    1. 校验 state 防 CSRF
    2. 用 code 换取 access_token
    3. 调用 /user API 获取 GitHub 用户信息
    4. 创建或更新本地 User 记录，加密存储 access_token
    5. 签发 JWT，302 重定向到前端回调页并附带 token

    无论成功与否，均重定向到前端 /auth/callback 页面，
    失败时附带 ?error= 参数。
    """
    # --- CSRF 校验 ----------------------------------------------------------
    if state not in _OAUTH_STATES:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    del _OAUTH_STATES[state]

    frontend_base = "http://localhost:5173"

    # --- 换取 access_token --------------------------------------------------
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                json={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                },
                headers={"Accept": "application/json"},
            )
            token_resp.raise_for_status()
            token_data = token_resp.json()
    except Exception as exc:
        logger.error("GitHub token exchange failed: %s", exc)
        return RedirectResponse(
            url=f"{frontend_base}/auth/callback?error=token_exchange_failed"
        )

    access_token = token_data.get("access_token")
    if not access_token:
        error_desc = token_data.get("error_description", "unknown")
        logger.error("GitHub returned no access_token: %s", error_desc)
        return RedirectResponse(
            url=f"{frontend_base}/auth/callback?error=no_access_token"
        )

    # --- 获取 GitHub 用户信息 ------------------------------------------------
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            user_resp = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            user_resp.raise_for_status()
            github_user = user_resp.json()
    except Exception as exc:
        logger.error("GitHub user fetch failed: %s", exc)
        return RedirectResponse(
            url=f"{frontend_base}/auth/callback?error=user_fetch_failed"
        )

    # --- 持久化用户 ----------------------------------------------------------
    try:
        result = await db.execute(
            select(User).where(User.github_id == github_user["id"])
        )
        user = result.scalar_one_or_none()

        if user:
            # 已有用户：更新最新信息
            user.login = github_user["login"]
            user.name = github_user.get("name")
            user.email = github_user.get("email")
            user.avatar_url = github_user.get("avatar_url")
            user.access_token = encrypt_token(access_token)
        else:
            # 新用户：创建记录
            user = User(
                github_id=github_user["id"],
                login=github_user["login"],
                name=github_user.get("name"),
                email=github_user.get("email"),
                avatar_url=github_user.get("avatar_url"),
                access_token=encrypt_token(access_token),
            )
            db.add(user)

        await db.commit()
        await db.refresh(user)
    except Exception as exc:
        logger.error("User persistence failed: %s", exc)
        return RedirectResponse(
            url=f"{frontend_base}/auth/callback?error=persistence_failed"
        )

    # --- 签发 JWT，重定向前端 ------------------------------------------------
    jwt_token = create_jwt(user)
    return RedirectResponse(
        url=f"{frontend_base}/auth/callback?token={jwt_token}"
    )


# ---------------------------------------------------------------------------
# 当前用户信息
# ---------------------------------------------------------------------------
@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(require_user)) -> UserResponse:
    """返回当前登录用户的信息。

    需要在请求头中携带 Authorization: Bearer <jwt>。
    """
    return UserResponse(
        id=user.id,
        github_id=user.github_id,
        login=user.login,
        name=user.name,
        avatar_url=user.avatar_url,
    )
