import math
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

SEVERITY_WEIGHTS: Dict[str, int] = {
    "critical": 25,
    "high": 15,
    "medium": 8,
    "low": 3,
}

SEVERITY_ORDER: Dict[str, int] = {"critical": 0, "high": 1, "medium": 2, "low": 3}

LEVEL_THRESHOLDS: List[Tuple[int, int, str]] = [
    (0, 20, "low"),
    (21, 45, "medium"),
    (46, 70, "high"),
    (71, 100, "critical"),
]

SENSITIVE_FILE_KEYWORDS = [
    "auth", "login", "signup", "password", "token", "credential",
    "security", "permission", "rbac", "oauth", "jwt", "session",
    "payment", "billing", "wallet", "transaction",
    "config", "secret", "env", "setting", "deploy",
    "api", "gateway", "middleware", "interceptor",
    "database", "migration", "schema", "encrypt", "decrypt",
]
SENSITIVE_FILE_BOOST = 1.20

FILES_CHANGED_THRESHOLD = 20
FILES_CHANGED_BONUS = 10
DIFF_SIZE_THRESHOLD = 500
DIFF_SIZE_BONUS = 5
MAX_SCORE = 100

BASE_MINUTES = 5
MINUTES_PER_FILE = 0.5
MINUTES_PER_RISK = 1.5
MINUTES_PER_CRITICAL = 3.0

CRITICAL_FLOOR = 50
DIMINISHING_RATE = 0.75


@dataclass
class RiskResult:
    score: int
    level: str
    estimated_minutes: int
    has_critical: bool = False
    confidence_penalty: float = 0.0
    sensitivity_boost: float = 0.0
    cluster_count: int = 0


@dataclass
class RiskCluster:
    category: str
    label: str
    risk_indices: List[int] = field(default_factory=list)
    dominant_severity: str = "medium"
    count: int = 0


class RiskScorer:

    def score(
        self,
        risk_items: List[dict],
        files_changed: int,
        additions: int = 0,
        deletions: int = 0,
    ) -> RiskResult:
        weighted_score, has_critical, confidence_penalty, sensitivity_boost = \
            self._compute_weighted_score(risk_items)

        scale_bonus = self._compute_scale_bonus(files_changed, additions + deletions)

        final_score = weighted_score + scale_bonus - confidence_penalty + sensitivity_boost

        if has_critical and final_score < CRITICAL_FLOOR:
            final_score = CRITICAL_FLOOR

        final_score = min(round(final_score), MAX_SCORE)

        level = self._score_to_level(final_score)
        estimated_minutes = self._estimate_minutes(files_changed, risk_items)
        clusters = self._cluster_risks(risk_items)

        return RiskResult(
            score=final_score,
            level=level,
            estimated_minutes=estimated_minutes,
            has_critical=has_critical,
            confidence_penalty=round(confidence_penalty, 1),
            sensitivity_boost=round(sensitivity_boost, 1),
            cluster_count=len(clusters),
        )

    @staticmethod
    def cluster_risks(risk_items: List[dict]) -> List[RiskCluster]:
        return RiskScorer._cluster_risks(risk_items)

    def _compute_weighted_score(
        self, risk_items: List[dict]
    ) -> Tuple[float, bool, float, float]:
        grouped: Dict[str, List[dict]] = {"critical": [], "high": [], "medium": [], "low": []}
        for item in risk_items:
            sev = item.get("severity", "medium").lower()
            if sev not in grouped:
                sev = "medium"
            grouped[sev].append(item)

        total = 0.0
        has_critical = len(grouped["critical"]) > 0
        confidence_penalty = 0.0
        sensitivity_boost = 0.0

        for severity, items in grouped.items():
            base_weight = SEVERITY_WEIGHTS.get(severity, 8)
            items_sorted = sorted(items, key=lambda x: x.get("confidence", 0.5), reverse=True)

            for i, item in enumerate(items_sorted):
                conf = item.get("confidence", 0.5)

                dim_factor = DIMINISHING_RATE ** i
                contrib = base_weight * conf * dim_factor

                file_name = item.get("file", "").lower()
                if self._is_sensitive_file(file_name):
                    contrib *= SENSITIVE_FILE_BOOST
                    sensitivity_boost += contrib * (SENSITIVE_FILE_BOOST - 1)

                if conf < 0.5:
                    confidence_penalty += base_weight * (0.5 - conf) * dim_factor * 0.5

                total += contrib

        return total, has_critical, confidence_penalty, sensitivity_boost

    @staticmethod
    def _is_sensitive_file(filename: str) -> bool:
        return any(kw in filename for kw in SENSITIVE_FILE_KEYWORDS)

    @staticmethod
    def _cluster_risks(risk_items: List[dict]) -> List[RiskCluster]:
        import hashlib as _hashlib

        clusters: Dict[str, RiskCluster] = {}
        category_map = {
            "sql": "安全-SQL注入",
            "injection": "安全-注入风险",
            "xss": "安全-XSS",
            "csrf": "安全-CSRF",
            "password": "安全-凭证管理",
            "auth": "安全-认证授权",
            "token": "安全-令牌管理",
            "encrypt": "安全-加密",
            "race": "并发-竞态条件",
            "deadlock": "并发-死锁",
            "null": "健壮性-空值处理",
            "error": "健壮性-错误处理",
            "exception": "健壮性-异常处理",
            "validation": "健壮性-输入校验",
            "input": "健壮性-输入校验",
            "performance": "性能-效率",
            "n+1": "性能-N+1查询",
            "resource": "性能-资源管理",
            "memory": "性能-内存",
            "log": "可维护性-日志",
            "comment": "可维护性-注释",
            "naming": "可维护性-命名",
        }

        for i, item in enumerate(risk_items):
            desc = (item.get("description", "") or "").lower()
            matched = "其他"
            for keyword, label in category_map.items():
                if keyword in desc:
                    matched = label
                    break

            key = _hashlib.md5(f"{matched}:{item.get('file','')}".encode()).hexdigest()[:8]

            if key not in clusters:
                clusters[key] = RiskCluster(
                    category=matched.split("-")[0] if "-" in matched else matched,
                    label=matched,
                    dominant_severity=item.get("severity", "medium"),
                )
            c = clusters[key]
            c.risk_indices.append(i)
            c.count += 1

            curr_order = SEVERITY_ORDER.get(item.get("severity", "medium"), 3)
            dom_order = SEVERITY_ORDER.get(c.dominant_severity, 3)
            if curr_order < dom_order:
                c.dominant_severity = item.get("severity", "medium")

        return sorted(clusters.values(), key=lambda c: -c.count)

    @staticmethod
    def _compute_scale_bonus(files_changed: int, total_lines: int) -> int:
        bonus = 0
        if files_changed > FILES_CHANGED_THRESHOLD:
            bonus += FILES_CHANGED_BONUS
        if total_lines > DIFF_SIZE_THRESHOLD:
            bonus += DIFF_SIZE_BONUS
        return bonus

    @staticmethod
    def _score_to_level(score: int) -> str:
        for low, high, level in LEVEL_THRESHOLDS:
            if low <= score <= high:
                return level
        return "low"

    @staticmethod
    def _estimate_minutes(files_changed: int, risk_items: List[dict]) -> int:
        risk_count = len(risk_items)
        critical_count = sum(
            1 for item in risk_items
            if item.get("severity", "").lower() == "critical"
        )
        raw = (
            BASE_MINUTES
            + files_changed * MINUTES_PER_FILE
            + risk_count * MINUTES_PER_RISK
            + critical_count * MINUTES_PER_CRITICAL
        )
        return math.ceil(raw)


# 单例
risk_scorer = RiskScorer()
