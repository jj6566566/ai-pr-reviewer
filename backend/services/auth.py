from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.core.database import get_db
from backend.models.user import User

# Bearer token scheme（前端通过 Authorization: Bearer <jwt> 传递令牌）
_bearer_scheme = HTTPBearer(auto_error=False)


def _get_fernet() -> Fernet:
    """获取 Fernet 加密器实例。

    Raises
    ------
    ValueError
        当 FERNET_KEY 未配置时抛出。
    """
    if not settings.FERNET_KEY:
        raise ValueError("FERNET_KEY is not configured")
    return Fernet(settings.FERNET_KEY.encode())


def encrypt_token(plain: str) -> str:
    """使用 Fernet 对称加密 GitHub access_token。

    Parameters
    ----------
    plain : str
        明文 GitHub access_token。

    Returns
    -------
    str
        Fernet 加密后的密文字符串。
    """
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_token(cipher: str) -> str:
    """解密 Fernet 密文，还原 GitHub access_token。

    Parameters
    ----------
    cipher : str
        Fernet 加密的密文。

    Returns
    -------
    str
        明文 access_token。
    """
    return _get_fernet().decrypt(cipher.encode()).decode()


def create_jwt(user: User) -> str:
    """为指定用户签发 JWT。

    Parameters
    ----------
    user : User
        已持久化的用户模型实例。

    Returns
    -------
    str
        签发的 JWT 字符串。
    """
    payload = {
        "sub": str(user.id),
        "github_id": user.github_id,
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def verify_jwt(token: str) -> dict:
    """验证 JWT 并返回 payload。

    Parameters
    ----------
    token : str
        JWT 字符串。

    Returns
    -------
    dict
        解码后的 payload。

    Raises
    ------
    jwt.PyJWTError
        令牌无效或过期。
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """从请求中解析当前登录用户。

    优先从 Authorization: Bearer <token> 头中提取 JWT；
    其次尝试从 Cookie pr_review_token 中提取。

    Parameters
    ----------
    request : Request
        FastAPI 请求对象。
    credentials : HTTPAuthorizationCredentials | None
        Bearer 认证凭证。
    db : AsyncSession
        数据库会话。

    Returns
    -------
    User | None
        当前用户实例；未认证时返回 None。
    """
    token: str | None = None

    # 优先从 Bearer header 读取
    if credentials is not None:
        token = credentials.credentials
    else:
        # 回退到 Cookie
        token = request.cookies.get("pr_review_token")

    if not token:
        return None

    try:
        payload = verify_jwt(token)
        user = await db.get(User, int(payload["sub"]))
        return user
    except (jwt.PyJWTError, ValueError, KeyError):
        return None


async def require_user(
    user: User | None = Depends(get_current_user),
) -> User:
    """强制要求登录态，未认证时抛出 401。

    Parameters
    ----------
    user : User | None
        由 get_current_user 解析的用户。

    Returns
    -------
    User
        当前已认证用户。

    Raises
    ------
    HTTPException
        401 未认证。
    """
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
