import logging

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Async engine (default for FastAPI endpoints)
# ---------------------------------------------------------------------------
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20,
    connect_args={
        "timeout": 10,
        "command_timeout": 30,
    },
)

async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Sync engine (used ONLY for blocking operations inside sync generators,
# e.g. SSE streaming endpoints that cannot await).
# ---------------------------------------------------------------------------
_sync_db_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")

sync_engine = create_engine(
    _sync_db_url,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=5,
    max_overflow=10,
)

SyncSession = sessionmaker(sync_engine, class_=Session, expire_on_commit=False)


async def check_db_connection() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("Database connection check failed: %s", e)
        return False
