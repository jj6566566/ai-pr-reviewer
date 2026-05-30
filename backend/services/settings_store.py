from typing import Optional, Dict

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.settings import AppSetting


async def get_setting(db: AsyncSession, key: str) -> Optional[str]:
    stmt = select(AppSetting.value).where(AppSetting.key == key)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    return row


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    stmt = (
        pg_insert(AppSetting)
        .values(key=key, value=value)
        .on_conflict_do_update(
            index_elements=["key"],
            set_={"value": value, "updated_at": func.now()},
        )
    )
    await db.execute(stmt)
    await db.commit()


async def get_all_settings(db: AsyncSession) -> Dict[str, str]:
    stmt = select(AppSetting)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return {row.key: row.value for row in rows if row.value is not None}
