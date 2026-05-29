from fastapi import APIRouter

router = APIRouter(prefix="/api/review", tags=["review"])


@router.post("/analyze")
async def analyze_pr(repo_owner: str, repo_name: str, pr_number: int):
    return {
        "status": "ok",
        "message": f"分析 PR {repo_owner}/{repo_name}#{pr_number} 中...",
    }
