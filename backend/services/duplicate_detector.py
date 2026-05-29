from __future__ import annotations

import hashlib
from collections import defaultdict
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class FileOverlap:
    filename: str
    pr_numbers: List[int]
    changes_detail: List[dict]


@dataclass
class SimilarCodeBlock:
    block_hash: str
    pr_numbers: List[int]
    files: List[str]
    similarity_score: float
    snippet_preview: str


@dataclass
class DuplicateRiskPattern:
    description: str
    affected_prs: List[int]
    severity: str
    occurrence_count: int


@dataclass
class CrossPRDuplicateResult:
    file_overlaps: List[FileOverlap]
    similar_code_blocks: List[SimilarCodeBlock]
    duplicate_risk_patterns: List[DuplicateRiskPattern]
    summary: str


def _normalize_code(text: str) -> str:
    lines = [line.strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line)


def _extract_added_lines(patch: str) -> str:
    added: List[str] = []
    for line in patch.split("\n"):
        if line.startswith("+") and not line.startswith("+++"):
            added.append(line[1:])
    return "\n".join(added)


def _compute_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _stable_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def detect_cross_pr_duplicates(
    results: list,
) -> CrossPRDuplicateResult:
    pr_info_list: List[dict] = []
    for r in results:
        pr_num = r.pr_info.number
        pr_title = r.pr_info.title
        files: List[dict] = []
        for f in r.pr_info.files:
            files.append({
                "filename": f.filename,
                "status": f.status,
                "additions": f.additions,
                "deletions": f.deletions,
                "patch": f.patch,
            })
        risk_items = []
        for ri in r.risk_items:
            risk_items.append({
                "severity": ri.severity,
                "description": ri.description,
                "file": ri.file,
            })
        pr_info_list.append({
            "pr_number": pr_num,
            "pr_title": pr_title,
            "files": files,
            "risk_items": risk_items,
        })

    file_overlaps = _detect_file_overlaps(pr_info_list)
    similar_code_blocks = _detect_similar_code_blocks(pr_info_list)
    duplicate_risk_patterns = _detect_duplicate_risk_patterns(pr_info_list)

    summary_parts = []
    if file_overlaps:
        summary_parts.append(
            "{} 个文件被多个 PR 同时修改".format(len(file_overlaps))
        )
    if similar_code_blocks:
        summary_parts.append(
            "发现 {} 组相似代码片段".format(len(similar_code_blocks))
        )
    if duplicate_risk_patterns:
        summary_parts.append(
            "{} 个风险模式跨 PR 重复出现".format(len(duplicate_risk_patterns))
        )

    summary = (
        "；".join(summary_parts)
        if summary_parts
        else "未发现跨 PR 重复/冲突"
    )

    return CrossPRDuplicateResult(
        file_overlaps=file_overlaps,
        similar_code_blocks=similar_code_blocks,
        duplicate_risk_patterns=duplicate_risk_patterns,
        summary=summary,
    )


def _detect_file_overlaps(pr_info_list: List[dict]) -> List[FileOverlap]:
    file_to_prs: Dict[str, List[dict]] = defaultdict(list)

    for pr in pr_info_list:
        for f in pr["files"]:
            file_to_prs[f["filename"]].append({
                "pr_number": pr["pr_number"],
                "status": f["status"],
                "additions": f["additions"],
                "deletions": f["deletions"],
            })

    overlaps: List[FileOverlap] = []
    for filename, changes in file_to_prs.items():
        if len(changes) >= 2:
            pr_numbers = sorted([c["pr_number"] for c in changes])
            overlaps.append(FileOverlap(
                filename=filename,
                pr_numbers=pr_numbers,
                changes_detail=[
                    {
                        "pr_number": c["pr_number"],
                        "status": c["status"],
                        "additions": c["additions"],
                        "deletions": c["deletions"],
                    }
                    for c in changes
                ],
            ))

    overlaps.sort(key=lambda o: -len(o.pr_numbers))
    return overlaps[:20]


def _detect_similar_code_blocks(pr_info_list: List[dict]) -> List[SimilarCodeBlock]:
    block_list: List[dict] = []
    for pr in pr_info_list:
        for f in pr["files"]:
            patch = f.get("patch", "")
            if not patch:
                continue
            added = _extract_added_lines(patch)
            normalized = _normalize_code(added)
            if len(normalized) < 30:
                continue
            block_hash = _stable_hash(normalized)
            block_list.append({
                "hash": block_hash,
                "pr_number": pr["pr_number"],
                "filename": f["filename"],
                "normalized_code": normalized,
            })

    groups: Dict[str, List[dict]] = defaultdict(list)
    for b in block_list:
        groups[b["hash"]].append(b)

    similar: List[SimilarCodeBlock] = []
    seen_pairs: Set[Tuple[int, int]] = set()

    pr_ids = sorted(set(b["pr_number"] for b in block_list))

    for i_a in range(len(pr_ids)):
        for i_b in range(i_a + 1, len(pr_ids)):
            pa = pr_ids[i_a]
            pb = pr_ids[i_b]
            pair = (pa, pb)

            blocks_a = [b for b in block_list if b["pr_number"] == pa]
            blocks_b = [b for b in block_list if b["pr_number"] == pb]

            for ba in blocks_a:
                for bb in blocks_b:
                    sim = _compute_similarity(
                        ba["normalized_code"], bb["normalized_code"]
                    )
                    if sim >= 0.75:
                        combined_hash = _stable_hash(
                            ba["hash"] + bb["hash"] + "{:.4f}".format(sim)
                        )
                        snippet = ba["normalized_code"]
                        if len(snippet) > 120:
                            snippet = snippet[:120] + "..."

                        similar.append(SimilarCodeBlock(
                            block_hash=combined_hash,
                            pr_numbers=sorted([pa, pb]),
                            files=[ba["filename"], bb["filename"]],
                            similarity_score=round(sim, 2),
                            snippet_preview=snippet,
                        ))

    similar.sort(key=lambda s: -s.similarity_score)
    return similar[:15]


def _detect_duplicate_risk_patterns(
    pr_info_list: List[dict],
) -> List[DuplicateRiskPattern]:
    pattern_groups: Dict[str, dict] = {}

    for pr in pr_info_list:
        seen_in_pr: Set[str] = set()
        for ri in pr["risk_items"]:
            desc = ri["description"].strip().lower()
            norm = _normalize_code(desc)
            key = _stable_hash(norm)

            if key not in seen_in_pr:
                seen_in_pr.add(key)
                if key not in pattern_groups:
                    pattern_groups[key] = {
                        "description": desc,
                        "severity": ri["severity"],
                        "pr_numbers": set(),
                        "occurrence_count": 0,
                    }
                pattern_groups[key]["pr_numbers"].add(pr["pr_number"])
                pattern_groups[key]["occurrence_count"] += 1

    patterns: List[DuplicateRiskPattern] = []
    for key, data in pattern_groups.items():
        if data["occurrence_count"] >= 2:
            patterns.append(DuplicateRiskPattern(
                description=data["description"],
                affected_prs=sorted(data["pr_numbers"]),
                severity=data["severity"],
                occurrence_count=data["occurrence_count"],
            ))

    patterns.sort(key=lambda p: -p.occurrence_count)
    return patterns[:15]
