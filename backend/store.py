import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import SyncSession
from backend.models.pr_analysis import CustomRule, PRAnalysis
from backend.schemas.review import (
    AnalyzeResponse,
    CustomRuleCreate,
    CustomRuleUpdate,
    IntentCheck,
    PRInfoResponse,
    RiskItem,
    Suggestion,
)

logger = logging.getLogger(__name__)


async def save_analysis(db: AsyncSession, response: AnalyzeResponse) -> PRAnalysis:
    """Async version – used by regular (non-streaming) endpoints."""
    pr_info = response.pr_info

    risk_items_json = json.dumps(
        [r.model_dump() for r in response.risk_items],
        ensure_ascii=False,
    )
    suggestions_json = json.dumps(
        [s.model_dump() for s in response.suggestions],
        ensure_ascii=False,
    )

    analysis = PRAnalysis(
        repo_owner=pr_info.owner,
        repo_name=pr_info.repo,
        pr_number=pr_info.number,
        pr_title=pr_info.title,
        pr_description=pr_info.description,
        author=pr_info.author,
        base_branch=pr_info.base_branch,
        head_branch=pr_info.head_branch,
        files_changed=pr_info.files_changed,
        additions=pr_info.additions,
        deletions=pr_info.deletions,
        summary=response.summary,
        risk_items=risk_items_json,
        suggestions=suggestions_json,
        risk_score=response.risk_score,
        risk_level=response.risk_level,
        estimated_review_minutes=response.estimated_review_minutes,
        status="completed",
        diff_content=pr_info.diff_content,
        intent_check=json.dumps(response.intent_check.model_dump(mode="json")) if response.intent_check else None,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return analysis


def save_analysis_sync(response: AnalyzeResponse) -> PRAnalysis:
    """Sync version – used inside sync generators (SSE streaming endpoints)
    where ``await`` is not available.

    Opens its own short-lived synchronous DB session so the caller does not
    need to pass one in.
    """
    pr_info = response.pr_info

    risk_items_json = json.dumps(
        [r.model_dump() for r in response.risk_items],
        ensure_ascii=False,
    )
    suggestions_json = json.dumps(
        [s.model_dump() for s in response.suggestions],
        ensure_ascii=False,
    )

    analysis = PRAnalysis(
        repo_owner=pr_info.owner,
        repo_name=pr_info.repo,
        pr_number=pr_info.number,
        pr_title=pr_info.title,
        pr_description=pr_info.description,
        author=pr_info.author,
        base_branch=pr_info.base_branch,
        head_branch=pr_info.head_branch,
        files_changed=pr_info.files_changed,
        additions=pr_info.additions,
        deletions=pr_info.deletions,
        summary=response.summary,
        risk_items=risk_items_json,
        suggestions=suggestions_json,
        risk_score=response.risk_score,
        risk_level=response.risk_level,
        estimated_review_minutes=response.estimated_review_minutes,
        status="completed",
        diff_content=pr_info.diff_content,
        intent_check=json.dumps(response.intent_check.model_dump(mode="json")) if response.intent_check else None,
    )

    with SyncSession() as session:
        try:
            session.add(analysis)
            session.commit()
            session.refresh(analysis)
            return analysis
        except Exception:
            session.rollback()
            raise


async def get_recent_analyses(db: AsyncSession, limit: int = 20) -> list[PRAnalysis]:
    stmt = (
        select(PRAnalysis)
        .order_by(PRAnalysis.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_analysis_by_id(db: AsyncSession, analysis_id: int) -> Optional[PRAnalysis]:
    stmt = select(PRAnalysis).where(PRAnalysis.id == analysis_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def get_recent_analysis_by_pr_sync(owner: str, repo: str, pr_number: int, hours: int = 24) -> Optional[PRAnalysis]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    stmt = (
        select(PRAnalysis)
        .where(
            PRAnalysis.repo_owner == owner,
            PRAnalysis.repo_name == repo,
            PRAnalysis.pr_number == pr_number,
            PRAnalysis.status == "completed",
            PRAnalysis.created_at >= cutoff,
        )
        .order_by(PRAnalysis.created_at.desc())
        .limit(1)
    )
    with SyncSession() as session:
        return session.execute(stmt).scalar_one_or_none()


def analysis_to_response(analysis: PRAnalysis) -> AnalyzeResponse:
    risk_items = []
    if analysis.risk_items:
        try:
            items_raw = json.loads(analysis.risk_items)
            risk_items = [RiskItem(**item) for item in items_raw]
        except (json.JSONDecodeError, TypeError):
            pass

    suggestions = []
    if analysis.suggestions:
        try:
            sugg_raw = json.loads(analysis.suggestions)
            suggestions = [Suggestion(**item) for item in sugg_raw]
        except (json.JSONDecodeError, TypeError):
            pass

    intent_check = None
    if analysis.intent_check:
        try:
            intent_raw = json.loads(analysis.intent_check)
            intent_check = IntentCheck(**intent_raw)
        except (json.JSONDecodeError, TypeError):
            pass

    return AnalyzeResponse(
        pr_info=PRInfoResponse(
            owner=analysis.repo_owner,
            repo=analysis.repo_name,
            number=analysis.pr_number,
            title=analysis.pr_title or "",
            description=analysis.pr_description or "",
            author=analysis.author or "",
            base_branch=analysis.base_branch or "",
            head_branch=analysis.head_branch or "",
            files_changed=analysis.files_changed,
            additions=analysis.additions,
            deletions=analysis.deletions,
            files=[],
            diff_content=analysis.diff_content or "",
        ),
        summary=analysis.summary or "",
        risk_items=risk_items,
        suggestions=suggestions,
        risk_score=analysis.risk_score,
        risk_level=analysis.risk_level,
        estimated_review_minutes=analysis.estimated_review_minutes,
        analysis_id=analysis.id,
        intent_check=intent_check,
    )


async def get_recent_analysis_by_pr(
    db: AsyncSession, owner: str, repo: str, pr_number: int, hours: int = 24
) -> Optional[PRAnalysis]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    stmt = (
        select(PRAnalysis)
        .where(
            PRAnalysis.repo_owner == owner,
            PRAnalysis.repo_name == repo,
            PRAnalysis.pr_number == pr_number,
            PRAnalysis.status == "completed",
            PRAnalysis.created_at >= cutoff,
        )
        .order_by(PRAnalysis.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_rules(db: AsyncSession) -> List[CustomRule]:
    stmt = select(CustomRule).order_by(CustomRule.id.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_enabled_rules(db: AsyncSession) -> List[CustomRule]:
    stmt = select(CustomRule).where(CustomRule.is_enabled == True).order_by(CustomRule.id.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_rule_by_id(db: AsyncSession, rule_id: int) -> Optional[CustomRule]:
    stmt = select(CustomRule).where(CustomRule.id == rule_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_rule(db: AsyncSession, data: CustomRuleCreate) -> CustomRule:
    rule = CustomRule(
        name=data.name,
        description=data.description,
        match_type=data.match_type,
        match_pattern=data.match_pattern,
        match_scope=data.match_scope,
        file_filter=data.file_filter,
        severity=data.severity,
        suggestion=data.suggestion,
        is_enabled=data.is_enabled,
        is_preset=False,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


async def update_rule(db: AsyncSession, rule_id: int, data: CustomRuleUpdate) -> Optional[CustomRule]:
    rule = await get_rule_by_id(db, rule_id)
    if rule is None:
        return None
    update_data = {}
    if rule.is_preset:
        allowed = {"is_enabled"}
    else:
        allowed = {"name", "description", "match_type", "match_pattern", "match_scope", "file_filter", "severity", "suggestion", "is_enabled"}
    for field in allowed:
        val = getattr(data, field, None)
        if val is not None:
            update_data[field] = val
    if update_data:
        stmt = update(CustomRule).where(CustomRule.id == rule_id).values(**update_data)
        await db.execute(stmt)
        await db.commit()
        await db.refresh(rule)
    return rule


async def delete_rule(db: AsyncSession, rule_id: int) -> bool:
    rule = await get_rule_by_id(db, rule_id)
    if rule is None or rule.is_preset:
        return False
    await db.delete(rule)
    await db.commit()
    return True


async def get_trends(db: AsyncSession, days: int, repo_owner: Optional[str] = None, repo_name: Optional[str] = None) -> List[dict]:
    params: dict = {"days_param": str(days)}
    clauses: list[str] = ["created_at >= NOW() - (:days_param || ' days')::INTERVAL"]
    if repo_owner:
        clauses.append("repo_owner = :owner")
        params["owner"] = repo_owner
    if repo_name:
        clauses.append("repo_name = :repo")
        params["repo"] = repo_name
    where_sql = " AND ".join(clauses)

    sql = text("""
        SELECT
            DATE_TRUNC('day', created_at) AS day,
            COUNT(*) AS pr_count,
            COALESCE(AVG(risk_score), 0) AS avg_risk_score,
            COALESCE(SUM(files_changed), 0) AS total_files_changed,
            COALESCE(SUM(additions), 0) AS total_additions,
            COALESCE(SUM(deletions), 0) AS total_deletions,
            COALESCE(SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END), 0) AS critical_count,
            COALESCE(SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END), 0) AS high_count,
            COALESCE(SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END), 0) AS medium_count,
            COALESCE(SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END), 0) AS low_count
        FROM pr_analyses
        WHERE """ + where_sql + """
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY day ASC
    """)

    result = await db.execute(sql, params)
    rows = result.all()

    return [
        {
            "day": row.day.isoformat() if hasattr(row, 'day') and row.day else None,
            "pr_count": row.pr_count,
            "avg_risk_score": round(float(row.avg_risk_score), 1),
            "total_files_changed": row.total_files_changed,
            "total_additions": row.total_additions,
            "total_deletions": row.total_deletions,
            "critical_count": row.critical_count,
            "high_count": row.high_count,
            "medium_count": row.medium_count,
            "low_count": row.low_count,
        }
        for row in rows
    ]


async def get_insights_data(
    db: AsyncSession, owner: Optional[str] = None, repo: Optional[str] = None
) -> dict:
    stmt = select(
        PRAnalysis.risk_items,
        PRAnalysis.repo_owner,
        PRAnalysis.repo_name,
        PRAnalysis.pr_number,
    ).where(PRAnalysis.status == "completed")
    if owner:
        stmt = stmt.where(PRAnalysis.repo_owner == owner)
    if repo:
        stmt = stmt.where(PRAnalysis.repo_name == repo)
    stmt = stmt.order_by(PRAnalysis.created_at.desc()).limit(500)

    result = await db.execute(stmt)
    rows = result.all()

    dir_risks: dict[str, dict] = {}
    desc_counter: dict[str, dict] = {}
    desc_prs: dict[str, set] = {}

    total_analyses = len(rows)
    seen_pr_keys = set()

    for risk_json, r_owner, r_repo, pr_num in rows:
        pr_key = (r_owner, r_repo, pr_num)
        if pr_key in seen_pr_keys:
            continue
        seen_pr_keys.add(pr_key)

        if not risk_json:
            continue
        try:
            items = json.loads(risk_json)
        except (json.JSONDecodeError, TypeError):
            continue

        for item in items:
            sev = item.get("severity", "low")
            desc = (item.get("description", "") or "").strip()
            fname = (item.get("file", "") or "").strip()

            if fname:
                directory = "/".join(fname.split("/")[:-1]) or "root"
                if directory not in dir_risks:
                    dir_risks[directory] = {"risk_count": 0, "critical": 0, "high": 0}
                dir_risks[directory]["risk_count"] += 1
                if sev == "critical":
                    dir_risks[directory]["critical"] += 1
                elif sev == "high":
                    dir_risks[directory]["high"] += 1

            if desc:
                key = desc[:200]
                if key not in desc_counter:
                    desc_counter[key] = {"count": 0, "severity": sev, "description": desc}
                desc_counter[key]["count"] += 1
                if {"critical": 4, "high": 3, "medium": 2, "low": 1}.get(sev, 1) > {"critical": 4, "high": 3, "medium": 2, "low": 1}.get(desc_counter[key]["severity"], 1):
                    desc_counter[key]["severity"] = sev

                if key not in desc_prs:
                    desc_prs[key] = set()
                desc_prs[key].add(pr_key)

    heatmap = sorted(
        [
            {
                "directory": d,
                "risk_count": v["risk_count"],
                "critical_count": v["critical"],
                "high_count": v["high"],
                "avg_severity": "critical" if v["critical"] > 0 else "high" if v["high"] > 0 else "medium" if v["risk_count"] > 3 else "low",
            }
            for d, v in dir_risks.items()
        ],
        key=lambda x: -x["risk_count"],
    )[:20]

    top_issues = sorted(
        [
            {
                "description": _translate_desc(v["description"]),
                "count": v["count"],
                "severity": v["severity"],
                "category": _guess_category(v["description"]),
            }
            for v in desc_counter.values()
        ],
        key=lambda x: -x["count"],
    )[:15]

    cross_pr = sorted(
        [
            {
                "description": _translate_desc(v["description"]),
                "severity": v["severity"],
                "pr_count": len(desc_prs.get(k, set())),
            }
            for k, v in desc_counter.items()
            if len(desc_prs.get(k, set())) >= 2
        ],
        key=lambda x: -x["pr_count"],
    )[:10]

    suggested_rules = _generate_suggested_rules(top_issues)

    return {
        "directory_heatmap": heatmap,
        "top_issues": top_issues,
        "cross_pr_patterns": cross_pr,
        "suggested_rules": suggested_rules,
        "total_analyses": total_analyses,
    }


EN_PATTERNS = {
    "race condition": "竞态条件",
    "xss vulnerability": "XSS 跨站脚本漏洞",
    "memory leak": "内存泄漏",
    "unhandled error": "未处理的异常",
    "missing validation": "缺少输入校验",
    "sql injection": "SQL 注入漏洞",
    "Potential critical issue:": "严重风险:",
    "Potential high issue:": "高风险:",
    "Potential medium issue:": "中风险:",
    "Potential low issue:": "低风险:",
}


def _translate_desc(desc: str) -> str:
    result = desc
    for en, zh in EN_PATTERNS.items():
        idx = result.lower().find(en.lower())
        if idx >= 0:
            result = result[:idx] + zh + result[idx + len(en):]
    return result


def _guess_category(desc: str) -> str:
    lower = desc.lower()
    for kw, cat in {
        "sql": "安全",
        "注入": "安全",
        "xss": "安全",
        "csrf": "安全",
        "密码": "安全",
        "token": "安全",
        "认证": "安全",
        "权限": "安全",
        "加密": "安全",
        "密钥": "安全",
        "n+1": "性能",
        "性能": "性能",
        "慢": "性能",
        "内存": "性能",
        "资源": "性能",
        "空指针": "健壮性",
        "异常": "健壮性",
        "错误处理": "健壮性",
        "校验": "健壮性",
        "null": "健壮性",
        "race": "健壮性",
        "leak": "性能",
        "unhandled": "健壮性",
        "validation": "健壮性",
        "命名": "可维护性",
        "注释": "可维护性",
        "日志": "可维护性",
        "重复": "可维护性",
    }.items():
        if kw in lower:
            return cat
    return "其他"


def _generate_suggested_rules(top_issues: list) -> list[str]:
    rules = []
    templates = {
        "SQL": "所有 SQL 查询必须使用参数化方式，禁止字符串拼接",
        "注入": "对所有用户输入执行严格的输入校验和过滤",
        "XSS": "所有用户输入在渲染前必须经过 HTML 转义",
        "密码": "禁止在日志、代码注释或配置文件中硬编码密码和密钥",
        "token": "Token 必须设置合理的过期时间，不长期有效",
        "认证": "所有涉及认证的逻辑必须有完整的单元测试覆盖",
        "权限": "接口必须进行权限校验，禁止越权访问",
        "加密": "敏感数据传输和存储必须使用加密",
        "密钥": "密钥和凭证统一管理，不得在代码中硬编码",
        "n+1": "数据库查询避免 N+1 问题，使用联表查询或批量查询",
        "性能": "对高频接口进行性能测试，确保响应时间在合理范围内",
        "空指针": "对所有外部输入和可能为空的变量进行判空处理",
        "异常": "异常处理必须具体，禁止使用空的 catch 块",
        "校验": "所有外部输入必须进行类型、长度、范围校验",
        "null": "函数返回值须明确是否可能为 None，调用方必须处理",
        "命名": "变量和函数命名需遵循团队约定的命名规范",
        "注释": "关键业务逻辑必须添加注释说明",
        "日志": "日志输出不得包含敏感信息，生产环境控制日志级别",
        "重复": "抽取重复代码为公共函数或工具类",
    }
    seen = set()
    for issue in top_issues:
        for kw, rule in templates.items():
            if kw.lower() in issue["description"].lower() and rule not in seen:
                rules.append(rule)
                seen.add(rule)
                if len(rules) >= 8:
                    return rules
    return rules
