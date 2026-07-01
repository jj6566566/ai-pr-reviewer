import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp.server.fastmcp import FastMCP
from backend.schemas.review import AnalyzeRequest
from backend.services.reviewer import reviewer_service
from backend.services.github import github_service
from backend.services.auth import decrypt_token
from backend.config import settings
from backend.core.database import async_session
from backend.models.user import User
from sqlalchemy import select

app = FastMCP(name="ReviewAI", instructions="""
AI 代码评审 MCP Server，支持完整的 GitHub PR 分析流程：
1. 获取当前用户的仓库列表
2. 获取指定仓库的 PR 列表
3. 分析 PR 代码变更，识别风险项与改进建议

使用流程：
1. 先调用 get_repos 获取仓库列表
2. 调用 get_prs 获取指定仓库的 PR 列表
3. 调用 analyze_pr 分析具体的 PR

支持的参数：
- token: GitHub 访问令牌，用于访问私有仓库和提高 API 限额（可选，会自动从数据库获取）
""")


async def get_github_token(token: str = "") -> str:
    """获取 GitHub access_token，优先级：传入的 token > 数据库 > 环境变量"""
    if token:
        return token

    try:
        async with async_session() as session:
            result = await session.execute(select(User).limit(1))
            user = result.scalar_one_or_none()
            if user and user.access_token:
                return decrypt_token(user.access_token)
    except Exception:
        pass

    return os.environ.get("GITHUB_TOKEN", "")


@app.tool()
async def get_repos(token: str = "", search: str = ""):
    """
    获取当前用户的 GitHub 仓库列表

    Args:
        token: GitHub 访问令牌（可选）
        search: 搜索关键词，过滤仓库名称（可选）
    """
    github_token = await get_github_token(token)
    if not github_token:
        return {"error": "需要配置 GitHub Token"}

    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    try:
        import httpx
        repos = []
        page = 1
        while page <= 10:
            resp = httpx.get(
                "https://api.github.com/user/repos",
                headers=headers,
                params={"page": page, "per_page": 30, "sort": "updated", "direction": "desc"},
                timeout=15.0,
                verify=False,
            )
            resp.raise_for_status()
            page_data = resp.json()
            if not page_data:
                break

            for repo in page_data:
                name = repo.get("name", "")
                full_name = repo.get("full_name", "")
                owner = full_name.split("/")[0] if "/" in full_name else ""

                if search and search.lower() not in name.lower():
                    continue

                repos.append({
                    "name": name,
                    "full_name": full_name,
                    "owner": owner,
                    "description": repo.get("description", ""),
                    "private": repo.get("private", False),
                    "stars": repo.get("stargazers_count", 0),
                    "forks": repo.get("forks_count", 0),
                    "updated_at": repo.get("updated_at", ""),
                    "html_url": repo.get("html_url", ""),
                })
            page += 1

        return {"repos": repos, "count": len(repos)}

    except Exception as e:
        return {"error": str(e), "count": 0}


@app.tool()
async def get_prs(owner: str, repo: str, token: str = "", state: str = "open"):
    """
    获取指定仓库的 Pull Request 列表

    Args:
        owner: 仓库所有者（用户名或组织名）
        repo: 仓库名称
        token: GitHub 访问令牌（可选）
        state: PR 状态，可选值：open（默认）、closed、all
    """
    if not owner or not repo:
        return {"error": "Missing required parameters: owner, repo"}

    github_token = await get_github_token(token)
    if not github_token:
        return {"error": "需要配置 GitHub Token"}

    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    try:
        import httpx
        prs = []
        page = 1
        while page <= 5:
            resp = httpx.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls",
                headers=headers,
                params={"page": page, "per_page": 30, "state": state},
                timeout=15.0,
                verify=False,
            )
            resp.raise_for_status()
            page_data = resp.json()
            if not page_data:
                break

            for pr in page_data:
                prs.append({
                    "number": pr.get("number", 0),
                    "title": pr.get("title", ""),
                    "body": pr.get("body", ""),
                    "state": pr.get("state", ""),
                    "author": pr.get("user", {}).get("login", "") if pr.get("user") else "",
                    "created_at": pr.get("created_at", ""),
                    "updated_at": pr.get("updated_at", ""),
                    "merged_at": pr.get("merged_at", ""),
                    "additions": pr.get("additions", 0),
                    "deletions": pr.get("deletions", 0),
                    "changed_files": pr.get("changed_files", 0),
                    "html_url": pr.get("html_url", ""),
                    "base_branch": pr.get("base", {}).get("ref", ""),
                    "head_branch": pr.get("head", {}).get("ref", ""),
                })
            page += 1

        return {"prs": prs, "count": len(prs), "owner": owner, "repo": repo}

    except Exception as e:
        return {"error": str(e), "count": 0, "owner": owner, "repo": repo}


@app.tool()
async def analyze_pr(
    owner: str,
    repo: str,
    pr_number: int,
    token: str = "",
):
    """
    分析 GitHub Pull Request 的代码变更，识别风险项与改进建议

    Args:
        owner: 仓库所有者（用户名或组织名）
        repo: 仓库名称
        pr_number: PR 编号
        token: GitHub 访问令牌（可选）
    """
    if not owner or not repo or not pr_number:
        return {"error": "Missing required parameters: owner, repo, pr_number"}

    request = AnalyzeRequest(
        owner=owner,
        repo=repo,
        pr_number=pr_number,
        post_comment=False,
    )

    try:
        github_token = await get_github_token(token)
        response = reviewer_service.analyze(request, token=github_token)
        return response.model_dump(mode="json")
    except Exception as e:
        return {
            "error": str(e),
            "owner": owner,
            "repo": repo,
            "pr_number": pr_number,
        }


@app.tool()
async def analyze_pr_stream(
    owner: str,
    repo: str,
    pr_number: int,
    token: str = "",
):
    """
    流式分析 GitHub Pull Request，实时返回分析进度和结果

    Args:
        owner: 仓库所有者（用户名或组织名）
        repo: 仓库名称
        pr_number: PR 编号
        token: GitHub 访问令牌（可选）
    """
    if not owner or not repo or not pr_number:
        return {"error": "Missing required parameters: owner, repo, pr_number"}

    request = AnalyzeRequest(
        owner=owner,
        repo=repo,
        pr_number=pr_number,
        post_comment=False,
    )

    events = []
    try:
        github_token = await get_github_token(token)
        for event in reviewer_service.analyze_stream(request, token=github_token):
            events.append(event)
        return {"events": events}
    except Exception as e:
        return {
            "error": str(e),
            "owner": owner,
            "repo": repo,
            "pr_number": pr_number,
        }


@app.tool()
async def get_server_info():
    """获取 MCP 服务器信息和当前配置状态"""
    return {
        "server_name": "ReviewAI MCP Server",
        "has_deepseek_key": bool(settings.DEEPSEEK_API_KEY),
        "has_openai_key": bool(settings.OPENAI_API_KEY),
        "deepseek_base_url": settings.DEEPSEEK_BASE_URL,
        "openai_base_url": settings.OPENAI_BASE_URL,
        "version": "1.1.0",
        "tools": ["get_repos", "get_prs", "analyze_pr", "analyze_pr_stream", "get_server_info"],
    }


if __name__ == "__main__":
    import asyncio

    asyncio.run(app.run_stdio_async())