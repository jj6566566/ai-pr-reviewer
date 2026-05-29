from typing import Optional

from pydantic import BaseModel


class UserResponse(BaseModel):
    """当前登录用户的公开信息。"""

    id: int
    github_id: int
    login: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class LoginResponse(BaseModel):
    """GitHub OAuth 登录入口 URL。"""

    url: str
