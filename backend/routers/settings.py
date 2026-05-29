from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.core.database import get_db
from backend.services.settings_store import get_all_settings, set_setting

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    deepseek_api_key: Optional[str] = None
    github_token: Optional[str] = None
    deepseek_base_url: Optional[str] = None


@router.get("/status")
async def get_status(db: AsyncSession = Depends(get_db)):
    stored = await get_all_settings(db)
    return {
        "deepseek_api_key": stored.get("deepseek_api_key", settings.DEEPSEEK_API_KEY),
        "github_token": stored.get("github_token", settings.GITHUB_TOKEN),
        "deepseek_base_url": stored.get("deepseek_base_url", settings.DEEPSEEK_BASE_URL),
    }


@router.put("")
async def update_settings(body: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    if body.deepseek_api_key is not None:
        await set_setting(db, "deepseek_api_key", body.deepseek_api_key)
        settings.DEEPSEEK_API_KEY = body.deepseek_api_key
    if body.github_token is not None:
        await set_setting(db, "github_token", body.github_token)
        settings.GITHUB_TOKEN = body.github_token
    if body.deepseek_base_url is not None:
        await set_setting(db, "deepseek_base_url", body.deepseek_base_url)
        settings.DEEPSEEK_BASE_URL = body.deepseek_base_url
    return {"status": "ok"}
