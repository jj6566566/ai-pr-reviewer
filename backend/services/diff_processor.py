import re
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

# ---------------------------------------------------------------------------
# 文件过滤规则 —— 自动跳过无关文件
# ---------------------------------------------------------------------------
IGNORE_PATTERNS: List[re.Pattern] = [
    re.compile(r"\.lock$"),
    re.compile(r"\.min\.js$"),
    re.compile(r"\.generated\."),
    re.compile(r"package-lock\.json$"),
    re.compile(r"__pycache__"),
    re.compile(r"\.pb\.go$"),
    re.compile(r"\.sum$"),
    re.compile(r"\.png$"),
    re.compile(r"\.jpg$"),
    re.compile(r"\.gif$"),
    re.compile(r"\.ico$"),
    re.compile(r"\.svg$"),
    re.compile(r"\.woff2?$"),
    re.compile(r"\.ttf$"),
    re.compile(r"\.eot$"),
    re.compile(r"\.zip$"),
    re.compile(r"\.tar\.gz$"),
    re.compile(r"Thumbs\.db$"),
    re.compile(r"\.DS_Store$"),
    re.compile(r"\.env\.local$"),
    re.compile(r"\.env\.production$"),
]

# ---------------------------------------------------------------------------
# 文件优先级排序 —— 按目录/关键词权重
# ---------------------------------------------------------------------------
PRIORITY_ORDER: Dict[str, int] = {
    "migrations": 100,
    "config": 90,
    "auth": 85,
    "security": 85,
    "permission": 82,
    "api": 80,
    "handler": 75,
    "controller": 75,
    "service": 70,
    "middleware": 68,
    "repository": 65,
    "schema": 62,
    "model": 60,
    "utils": 40,
    "test": 10,
    "doc": 5,
}

# ---------------------------------------------------------------------------
# 变更类型检测规则
# ---------------------------------------------------------------------------
# 函数签名变更特征（Go, Python, TypeScript, Java 等）
FUNC_SIG_PATTERNS: List[re.Pattern] = [
    re.compile(r"^[-]\s*(func|def|function|async function|public|private|protected)\s+\w+\s*\("),
    re.compile(r"^[+]\s*(func|def|function|async function|public|private|protected)\s+\w+\s*\("),
]
# SQL migration 特征
MIGRATION_PATTERNS: List[re.Pattern] = [
    re.compile(r"CREATE\s+TABLE", re.IGNORECASE),
    re.compile(r"ALTER\s+TABLE", re.IGNORECASE),
    re.compile(r"DROP\s+TABLE", re.IGNORECASE),
    re.compile(r"ADD\s+COLUMN", re.IGNORECASE),
    re.compile(r"CREATE\s+INDEX", re.IGNORECASE),
    re.compile(r"CREATE\s+UNIQUE\s+INDEX", re.IGNORECASE),
]
CONFIG_PATTERNS: List[re.Pattern] = [
    re.compile(r"(config|settings|\.env|\.yaml|\.yml|\.toml|\.json|\.ini)"),
    re.compile(r"DATABASE_URL|SECRET_KEY|API_KEY|PASSWORD|TOKEN", re.IGNORECASE),
]
AUTH_PATTERNS: List[re.Pattern] = [
    re.compile(r"(auth|login|logout|register|permission|rbac|role|token|jwt|session)", re.IGNORECASE),
]

# 核心 diff 最大字符数（充分利用 DeepSeek 64K 上下文）
MAX_DIFF_CHARS = 30000


@dataclass
class DiffContext:
    """结构化 Diff 上下文，供 reviewer.py 拼装 LLM 提示词使用。"""

    summary_text: str = ""
    """文件变更统计摘要（纯文本）。"""

    priority_files: List[dict] = field(default_factory=list)
    """高优文件列表，每个元素包含 filename / status / additions / deletions / patch。"""

    low_priority_files: List[dict] = field(default_factory=list)
    """低优文件列表（截断版 patch），LLM 仍能看到关键内容。"""

    filtered_files: List[dict] = field(default_factory=list)
    """被跳过的文件列表，每个元素包含 filename / reason。"""

    change_types: List[str] = field(default_factory=list)
    """变更类型标注列表，如 ['api_breaking', 'db_schema', 'config', 'auth']。"""


class DiffProcessor:
    """智能 Diff 上下文引擎。

    解决大 PR diff 一刀切截断导致 LLM 分析不准的问题：
    1. 自动跳过无关文件（lock、min、generated 等）
    2. 按优先级排序文件（migrations > config > auth > api > …）
    3. 核心文件给完整 diff，低优文件给统计摘要
    4. 自动标注变更类型（API breaking、DB schema、配置、权限等）
    """

    # ---- 公共入口 ----------------------------------------------------------

    def process(self, diff_content: str, files: List[dict]) -> DiffContext:
        """对 Diff 内容进行智能预处理，返回结构化上下文。

        Parameters
        ----------
        diff_content : str
            原始 diff 全文（newline 分隔）。
        files : list[dict]
            文件列表，每个元素需包含 filename / status / additions / deletions / patch 字段。
            支持 dataclass 或 dict 两种形式。
        """
        # 1. 规范化输入
        normalized = self._normalize_files(files)

        # 2. 分类：无关文件 vs 有效文件
        filtered, valid = self._classify_files(normalized)

        # 3. 有效文件按优先级排序
        sorted_files = self._sort_by_priority(valid)

        # 4. 智能截断：核心文件完整，低优文件截断
        priority_files, low_priority_summary = self._smart_truncate(sorted_files)

        # 5. 变更类型检测
        change_types = self._detect_change_types(sorted_files)

        # 6. 构建统计摘要
        summary_text = self._build_summary(
            priority_files, filtered, low_priority_summary, change_types
        )

        return DiffContext(
            summary_text=summary_text,
            priority_files=priority_files,
            low_priority_files=low_priority_summary,
            filtered_files=filtered,
            change_types=change_types,
        )

    # ---- 内部方法 ----------------------------------------------------------

    def _normalize_files(self, files: List[dict]) -> List[dict]:
        """将 dataclass 或具名对象统一转为 dict。"""
        result = []
        for f in files:
            if isinstance(f, dict):
                result.append(f)
            elif hasattr(f, "__dataclass_fields__"):
                result.append({k: getattr(f, k) for k in f.__dataclass_fields__})
            else:
                result.append(
                    {
                        "filename": getattr(f, "filename", ""),
                        "status": getattr(f, "status", ""),
                        "additions": getattr(f, "additions", 0),
                        "deletions": getattr(f, "deletions", 0),
                        "patch": getattr(f, "patch", ""),
                    }
                )
        return result

    def _classify_files(
        self, files: List[dict]
    ) -> Tuple[List[dict], List[dict]]:
        """将文件分为「需跳过」和「有效」两类。"""
        filtered = []
        valid = []
        for f in files:
            fname = f.get("filename", "")
            reason = self._should_filter(fname)
            if reason:
                filtered.append({"filename": fname, "reason": reason})
            else:
                valid.append(f)
        return filtered, valid

    def _should_filter(self, filename: str) -> str:
        """检查文件名是否命中忽略规则，命中返回理由字符串，否则返回空串。"""
        for pattern in IGNORE_PATTERNS:
            if pattern.search(filename):
                return "匹配忽略规则: {}".format(pattern.pattern)
        return ""

    def _sort_by_priority(self, files: List[dict]) -> List[dict]:
        """按目录优先级 + 变更量加权从高到低排序，同优先级按文件名字母序。"""

        def _score(f: dict) -> Tuple[int, str]:
            fname = f.get("filename", "").lower()
            priority = 40  # 默认中位优先级
            for keyword, weight in PRIORITY_ORDER.items():
                if keyword in fname:
                    priority = weight
                    break
            # 变更量加分：每 30 行 +1 分，上限 +20
            change_lines = f.get("additions", 0) + f.get("deletions", 0)
            change_bonus = min(20, change_lines // 30)
            final_priority = priority + change_bonus
            # 数值取负，配合 Python 默认升序实现从高到低排序
            return (-final_priority, fname)

        return sorted(files, key=_score)

    def _smart_truncate(
        self, files: List[dict]
    ) -> Tuple[List[dict], List[dict]]:
        """核心文件保留完整 patch，低优文件截断。

        算法：
        1. 按优先级遍历，高优先级文件保留完整 diff
        2. 累计字符数超过 50% 上限后的文件视为低优
        3. 低优文件保留前 2000 字符 patch + 截断提示，LLM 仍能看到关键内容
        """
        priority: List[dict] = []
        low_priority: List[dict] = []

        accumulated = 0
        cutoff = int(MAX_DIFF_CHARS * 0.50)

        for f in files:
            fname = f.get("filename", "")
            is_high_priority = any(k in fname.lower() for k in PRIORITY_ORDER if PRIORITY_ORDER[k] >= 60)

            patch = f.get("patch", "")
            patch_len = len(patch)

            if is_high_priority or accumulated < cutoff:
                priority.append(f)
                accumulated += patch_len
            else:
                truncated_patch = ""
                if patch:
                    truncated_patch = (
                        patch[:2000]
                        + "\n... (低优文件，已截断，完整变更 {} 行)".format(
                            patch.count("\n") + 1
                        )
                    )
                low_priority.append(
                    {
                        "filename": fname,
                        "status": f.get("status", ""),
                        "additions": f.get("additions", 0),
                        "deletions": f.get("deletions", 0),
                        "patch": truncated_patch,
                    }
                )

        return priority, low_priority

    def _detect_change_types(self, files: List[dict]) -> List[str]:
        """根据文件路径和 patch 内容自动标注变更类型。"""
        types: List[str] = []

        for f in files:
            fname = f.get("filename", "").lower()
            patch = f.get("patch", "")

            # DB schema 变更
            if "migration" in fname or any(p.search(patch) for p in MIGRATION_PATTERNS):
                if "db_schema" not in types:
                    types.append("db_schema")

            # 配置变更
            if any(p.search(fname) for p in CONFIG_PATTERNS[:1]) or any(
                p.search(patch) for p in CONFIG_PATTERNS[1:]
            ):
                if "config" not in types:
                    types.append("config")

            # 权限/认证变更
            if any(p.search(fname) for p in AUTH_PATTERNS):
                if "auth" not in types:
                    types.append("auth")
                # 包含关键认证 logic 且 patch 中有函数签名变化的视为 auth_breaking
                if any(p.search(patch) for p in FUNC_SIG_PATTERNS):
                    if "auth_breaking" not in types:
                        types.append("auth_breaking")

            # API breaking: 函数签名变化
            if any(p.search(patch) for p in FUNC_SIG_PATTERNS):
                if "api_breaking" not in types:
                    types.append("api_breaking")

        return types

    def _build_summary(
        self,
        priority_files: List[dict],
        filtered_files: List[dict],
        low_priority_files: List[dict],
        change_types: List[str],
    ) -> str:
        """生成可读性强的文件变更统计摘要。"""
        lines = []

        # 变更类型标注
        if change_types:
            lines.append("## 变更类型标注")
            type_labels = {
                "db_schema": "数据库 Schema 变更",
                "config": "配置变更",
                "auth": "权限/认证变更",
                "auth_breaking": "权限/认证破坏性变更",
                "api_breaking": "API 破坏性变更（函数签名变化）",
            }
            for ct in change_types:
                label = type_labels.get(ct, ct)
                lines.append("  - {}".format(label))
            lines.append("")

        # 高优文件
        lines.append("## 核心文件（完整 diff）: {} 个".format(len(priority_files)))
        for f in priority_files:
            lines.append(
                "  [{status}] {filename} (+{additions}/-{deletions})".format(
                    status=f.get("status", "?"),
                    filename=f.get("filename", "?"),
                    additions=f.get("additions", 0),
                    deletions=f.get("deletions", 0),
                )
            )
        lines.append("")

        # 低优文件
        if low_priority_files:
            lines.append("## 低优文件（统计摘要）: {} 个".format(len(low_priority_files)))
            total_add = sum(f.get("additions", 0) for f in low_priority_files)
            total_del = sum(f.get("deletions", 0) for f in low_priority_files)
            lines.append("  +{}/-{} 行（已略过详细 diff）".format(total_add, total_del))
            for f in low_priority_files:
                lines.append(
                    "  [{status}] {filename} (+{additions}/-{deletions})".format(
                        status=f.get("status", "?"),
                        filename=f.get("filename", "?"),
                        additions=f.get("additions", 0),
                        deletions=f.get("deletions", 0),
                    )
                )
            lines.append("")

        # 被过滤文件
        if filtered_files:
            lines.append("## 已自动跳过的无关文件: {} 个".format(len(filtered_files)))
            for f in filtered_files:
                lines.append("  - {} ({})".format(f["filename"], f["reason"]))
            lines.append("")

        return "\n".join(lines)


# 单例
diff_processor = DiffProcessor()
