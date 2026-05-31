import base64
from dataclasses import dataclass, field
from typing import List

import httpx

GITHUB_API = "https://api.github.com"

BINARY_EXTENSIONS: List[str] = [
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".bmp", ".webp",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
    ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".exe", ".dll", ".so", ".dylib", ".bin",
    ".pyc", ".pyo", ".class", ".o", ".a",
]


@dataclass
class PRInfo:
    owner: str
    repo: str
    number: int
    title: str
    description: str
    author: str
    base_branch: str
    head_branch: str
    files_changed: int
    additions: int
    deletions: int
    files: list["PRFile"] = field(default_factory=list)
    diff_content: str = ""


@dataclass
class PRFile:
    filename: str
    status: str
    additions: int
    deletions: int
    patch: str


class GitHubService:
    def _headers(self, token: str) -> dict:
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def get_pr_info(self, owner: str, repo: str, pr_number: int, token: str) -> PRInfo:
        headers = self._headers(token)
        with httpx.Client(
            base_url=GITHUB_API,
            headers=headers,
            verify=False,
            follow_redirects=True,
            timeout=30.0,
        ) as client:
            pr_resp = client.get(f"/repos/{owner}/{repo}/pulls/{pr_number}")
            pr_resp.raise_for_status()
            pr = pr_resp.json()

            files_resp = client.get(
                f"/repos/{owner}/{repo}/pulls/{pr_number}/files",
                params={"per_page": 100},
            )
            files_resp.raise_for_status()
            files_data = files_resp.json()

            files = []
            for f in files_data:
                files.append(
                    PRFile(
                        filename=f["filename"],
                        status=f["status"],
                        additions=f["additions"],
                        deletions=f["deletions"],
                        patch=f.get("patch", ""),
                    )
                )

            return PRInfo(
                owner=owner,
                repo=repo,
                number=pr_number,
                title=pr["title"],
                description=pr.get("body") or "",
                author=pr["user"]["login"] if pr.get("user") else "unknown",
                base_branch=pr["base"]["ref"],
                head_branch=pr["head"]["ref"],
                files_changed=pr.get("changed_files", 0),
                additions=pr.get("additions", 0),
                deletions=pr.get("deletions", 0),
                files=files,
                diff_content=self._build_diff(files),
            )

    def _build_diff(self, files: list[PRFile]) -> str:
        parts = []
        for f in files:
            parts.append(f"--- a/{f.filename}")
            parts.append(f"+++ b/{f.filename}")
            parts.append(f.patch)
            parts.append("")
        return "\n".join(parts)

    def get_file_contents(self, owner: str, repo: str, path: str, ref: str, token: str) -> str:
        if self._is_binary_filename(path):
            return ""

        headers = self._headers(token)
        try:
            with httpx.Client(
                base_url=GITHUB_API,
                headers=headers,
                verify=False,
                timeout=15.0,
            ) as client:
                resp = client.get(
                    "/repos/{}/{}/contents/{}".format(owner, repo, path),
                    params={"ref": ref},
                )
                resp.raise_for_status()
                data = resp.json()

                if isinstance(data, list):
                    return ""

                content_b64 = data.get("content", "")
                if not content_b64:
                    return ""

                decoded = base64.b64decode(content_b64).decode("utf-8", errors="replace")

                lines = decoded.split("\n")
                if len(lines) > 5000:
                    decoded = (
                        "\n".join(lines[:200])
                        + "\n... 文件过长已截断（总计 {} 行，仅展示前 200 行）".format(len(lines))
                    )

                return decoded
        except Exception:
            return ""

    @staticmethod
    def _is_binary_filename(path: str) -> bool:
        lowered = path.lower()
        return any(lowered.endswith(ext) for ext in BINARY_EXTENSIONS)

    def post_pr_review(self, owner: str, repo: str, pr_number: int, body: str, token: str) -> dict:
        headers = self._headers(token)
        with httpx.Client(
            base_url=GITHUB_API,
            headers=headers,
            verify=False,
            timeout=15.0,
        ) as client:
            resp = client.post(
                f"/repos/{owner}/{repo}/issues/{pr_number}/comments",
                json={"body": body},
            )
            resp.raise_for_status()
            return resp.json()

    def get_pr_count(self, owner: str, repo: str, token: str) -> int:
        import re

        headers = self._headers(token)
        with httpx.Client(
            base_url=GITHUB_API,
            headers=headers,
            verify=False,
            timeout=15.0,
        ) as client:
            resp = client.get(
                f"/repos/{owner}/{repo}/pulls",
                params={"state": "all", "per_page": 1},
            )
            resp.raise_for_status()
            link = resp.headers.get("Link", "")
            match = re.search(r'page=(\d+)>; rel="last"', link)
            if match:
                return int(match.group(1))
            return len(resp.json())


github_service = GitHubService()
