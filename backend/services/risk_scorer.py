import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# 严重度权重
# ---------------------------------------------------------------------------
SEVERITY_WEIGHTS: Dict[str, int] = {
    "critical": 25,
    "high": 15,
    "medium": 8,
    "low": 3,
}

# 风险等级阈值
LEVEL_THRESHOLDS: List[Tuple[int, int, str]] = [
    (0, 20, "low"),
    (21, 45, "medium"),
    (46, 70, "high"),
    (71, 100, "critical"),
]

# 变更规模加成参数
FILES_CHANGED_THRESHOLD = 20          # 文件数超过此值加 10 分
FILES_CHANGED_BONUS = 10
DIFF_SIZE_THRESHOLD = 500            # additions + deletions 超过此值加 5 分
DIFF_SIZE_BONUS = 5
MAX_SCORE = 100                      # 封顶

# 审查时间估算参数（分钟）
BASE_MINUTES = 5                      # 基础审查时间
MINUTES_PER_FILE = 0.5               # 每个文件增加 0.5 分钟
MINUTES_PER_RISK = 1.5               # 每个风险项增加 1.5 分钟
MINUTES_PER_CRITICAL = 3.0           # 每个 critical 风险项额外增时


@dataclass
class RiskResult:
    """风险评分引擎输出结果。"""

    score: int
    """综合风险分 0-100。"""

    level: str
    """风险等级：low / medium / high / critical。"""

    estimated_minutes: int
    """估算审查时间（分钟），向上取整。"""


class RiskScorer:
    """风险评分引擎。

    在 LLM 返回 risk_items 后，综合计算 PR 的风险评分。
    评分来源：
    - 风险项严重度加权求和
    - 变更规模加成（文件数、行数）
    - 封顶 100 分
    - 映射到四级风险等级
    - 估算审查所需时间
    """

    # ---- 公共方法 ----------------------------------------------------------

    def score(
        self,
        risk_items: List[dict],
        files_changed: int,
        additions: int = 0,
        deletions: int = 0,
    ) -> RiskResult:
        """计算综合风险评分。

        Parameters
        ----------
        risk_items : list[dict]
            LLM 返回的风险项列表，每个元素需包含 severity 字段。
        files_changed : int
            PR 变更的文件总数。
        additions : int
            新增行数（默认 0）。
        deletions : int
            删除行数（默认 0）。

        Returns
        -------
        RiskResult
        """
        # 1. 严重度加权求和
        risk_score = self._compute_weighted_score(risk_items)

        # 2. 变更规模加成
        scale_bonus = self._compute_scale_bonus(files_changed, additions + deletions)

        # 3. 综合并封顶
        final_score = min(risk_score + scale_bonus, MAX_SCORE)

        # 4. 确定风险等级
        level = self._score_to_level(final_score)

        # 5. 估算审查时间
        estimated_minutes = self._estimate_minutes(
            files_changed, risk_items
        )

        return RiskResult(
            score=final_score,
            level=level,
            estimated_minutes=estimated_minutes,
        )

    # ---- 内部方法 ----------------------------------------------------------

    def _compute_weighted_score(self, risk_items: List[dict]) -> int:
        """风险项严重度加权求和。

        每个风险项按其 severity 对应的权重累加。未知 severity 按 medium(8) 处理。
        权重表：
          critical = 25
          high     = 15
          medium   = 8
          low      = 3
        """
        total = 0
        for item in risk_items:
            severity = item.get("severity", "medium").lower()
            weight = SEVERITY_WEIGHTS.get(severity, 8)
            total += weight
        return total

    def _compute_scale_bonus(
        self, files_changed: int, total_lines: int
    ) -> int:
        """根据变更规模计算加成。

        - 文件数 > 20 加 10 分
        - additions + deletions > 500 加 5 分
        - 两者可叠加
        """
        bonus = 0
        if files_changed > FILES_CHANGED_THRESHOLD:
            bonus += FILES_CHANGED_BONUS
        if total_lines > DIFF_SIZE_THRESHOLD:
            bonus += DIFF_SIZE_BONUS
        return bonus

    def _score_to_level(self, score: int) -> str:
        """将 0-100 的分数映射到四级风险等级。

        0-20    -> low
        21-45   -> medium
        46-70   -> high
        71-100  -> critical
        """
        for low, high, level in LEVEL_THRESHOLDS:
            if low <= score <= high:
                return level
        return "low"  # fallback

    def _estimate_minutes(
        self, files_changed: int, risk_items: List[dict]
    ) -> int:
        """估算审查时间。

        公式：
          base + files * 0.5 + risks * 1.5 + criticals * 3.0
        结果向上取整。
        """
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
