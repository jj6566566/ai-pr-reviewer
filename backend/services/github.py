from dataclasses import dataclass, field

import certifi
import httpx

from backend.config import settings

GITHUB_API = "https://api.github.com"


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
    def __init__(self):
        self._client: httpx.Client | None = None

    @property
    def client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(
                base_url=GITHUB_API,
                headers={
                    "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                verify=False,
                follow_redirects=True,
                timeout=30.0,
            )
        return self._client

    def get_pr_info(self, owner: str, repo: str, pr_number: int) -> PRInfo:
        pr_resp = self.client.get(f"/repos/{owner}/{repo}/pulls/{pr_number}")
        pr_resp.raise_for_status()
        pr = pr_resp.json()

        files_resp = self.client.get(
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

    def close(self):
        if self._client:
            self._client.close()
            self._client = None


github_service = GitHubService()
