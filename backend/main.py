from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.routers import auth, review, webhook

app = FastAPI(
    title="AI PR Review",
    description="AI 驱动的 PR 代码评审助手",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(review.router)
app.include_router(webhook.router)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
