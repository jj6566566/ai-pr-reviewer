import httpx
from fastapi import APIRouter, HTTPException

from backend.schemas.review import AnalyzeRequest, AnalyzeResponse, FileInfo, PRInfoResponse
from backend.services.github import github_service
from backend.services.reviewer import reviewer_service

router = APIRouter(prefix="/api/review", tags=["review"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_pr(request: AnalyzeRequest):
    try:
        return reviewer_service.analyze(request)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"GitHub API 错误: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.get("/fetch")
async def fetch_pr(owner: str, repo: str, pr_number: int):
    try:
        pr_info = github_service.get_pr_info(
            owner=owner,
            repo=repo,
            pr_number=pr_number,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"GitHub API 错误: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 PR 信息失败: {str(e)}")

    files_response = [
        FileInfo(
            filename=f.filename,
            status=f.status,
            additions=f.additions,
            deletions=f.deletions,
            patch=f.patch,
        )
        for f in pr_info.files
    ]

    return AnalyzeResponse(
        pr_info=PRInfoResponse(
            owner=pr_info.owner,
            repo=pr_info.repo,
            number=pr_info.number,
            title=pr_info.title,
            description=pr_info.description,
            author=pr_info.author,
            base_branch=pr_info.base_branch,
            head_branch=pr_info.head_branch,
            files_changed=pr_info.files_changed,
            additions=pr_info.additions,
            deletions=pr_info.deletions,
            files=files_response,
            diff_content=pr_info.diff_content,
        ),
    )
