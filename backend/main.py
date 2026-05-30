import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.core.database import check_db_connection
from backend.routers import auth, github_proxy, review, settings as settings_api, webhook

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI PR Review backend...")
    db_ok = await check_db_connection()
    if db_ok:
        logger.info("Database connection OK")
    else:
        logger.warning("Database connection FAILED – some endpoints may return errors")
    yield
    logger.info("Shutting down AI PR Review backend...")


app = FastAPI(
    title="AI PR Review",
    description="AI 驱动的 PR 代码评审助手",
    version="0.1.0",
    lifespan=lifespan,
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error: {}".format(str(exc))},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(github_proxy.router)
app.include_router(review.router)
app.include_router(webhook.router)
app.include_router(settings_api.router)


@app.get("/api/health")
async def health():
    db_ok = await check_db_connection()
    return {"status": "ok" if db_ok else "degraded", "database": db_ok}
