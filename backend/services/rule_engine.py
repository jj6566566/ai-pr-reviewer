from __future__ import annotations

import fnmatch
import re
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class RuleMatch:
    rule_id: int
    rule_name: str
    severity: str
    file: str
    line: int
    matched_text: str
    suggestion: Optional[str] = None


@dataclass
class DiffFile:
    filename: str
    patch: str


def _iter_added_lines(patch: str):
    lines = patch.split("\n")
    line_no = 0
    for raw in lines:
        if raw.startswith("@@"):
            parts = raw.split(" ")
            if len(parts) >= 3:
                try:
                    line_no = int(parts[2].split(",")[0].replace("+", "")) - 1
                except (ValueError, IndexError):
                    pass
            continue
        if raw.startswith("+") and not raw.startswith("+++"):
            line_no += 1
            yield line_no, raw[1:]
        elif raw.startswith(" ") or raw.startswith("-"):
            if raw.startswith(" "):
                line_no += 1
        elif raw.startswith("-"):
            pass


def _iter_context_lines(patch: str):
    lines = patch.split("\n")
    line_no = 0
    for raw in lines:
        if raw.startswith("@@"):
            parts = raw.split(" ")
            if len(parts) >= 3:
                try:
                    line_no = int(parts[2].split(",")[0].replace("+", "")) - 1
                except (ValueError, IndexError):
                    pass
            continue
        if raw.startswith("+") and not raw.startswith("+++"):
            line_no += 1
            yield line_no, raw[1:]
        elif raw.startswith(" ") or raw.startswith("-"):
            if raw.startswith(" ") or raw.startswith("-"):
                line_no += 1


def _iter_full_file(patch: str):
    lines = patch.split("\n")
    line_no = 0
    for raw in lines:
        if raw.startswith("@@"):
            parts = raw.split(" ")
            if len(parts) >= 3:
                try:
                    line_no = int(parts[2].split(",")[0].replace("+", "")) - 1
                except (ValueError, IndexError):
                    pass
            continue
        if raw.startswith("+") and not raw.startswith("+++"):
            line_no += 1
            yield line_no, raw[1:]
        elif raw.startswith(" ") or raw.startswith("-"):
            line_no += 1
            continue


def _file_matches_filter(filename: str, file_filter: Optional[str]) -> bool:
    if not file_filter:
        return True
    patterns = [p.strip() for p in file_filter.split(",") if p.strip()]
    if not patterns:
        return True
    return any(fnmatch.fnmatch(filename, p) for p in patterns)


def _match_text(text: str, pattern: str, match_type: str) -> bool:
    if match_type == "text":
        return pattern in text
    if match_type == "regex":
        try:
            return bool(re.search(pattern, text))
        except re.error:
            return False
    if match_type == "glob":
        return fnmatch.fnmatch(text, pattern)
    return False


def run_rules(
    rules: list,
    diff_files: List[DiffFile],
) -> List[RuleMatch]:
    matches: List[RuleMatch] = []

    for rule in rules:
        if not rule.is_enabled:
            continue

        file_filter = getattr(rule, "file_filter", None)

        for diff_file in diff_files:
            if not _file_matches_filter(diff_file.filename, file_filter):
                continue

            scope = rule.match_scope
            if scope == "added_lines":
                lines_iter = _iter_added_lines(diff_file.patch)
            elif scope == "context_lines":
                lines_iter = _iter_context_lines(diff_file.patch)
            else:
                lines_iter = _iter_full_file(diff_file.patch)

            for line_no, content in lines_iter:
                if _match_text(content, rule.match_pattern, rule.match_type):
                    snippet = content.strip()
                    if len(snippet) > 200:
                        snippet = snippet[:200] + "..."
                    matches.append(RuleMatch(
                        rule_id=rule.id,
                        rule_name=rule.name,
                        severity=rule.severity,
                        file=diff_file.filename,
                        line=line_no,
                        matched_text=snippet,
                        suggestion=getattr(rule, "suggestion", None),
                    ))

    matches.sort(
        key=lambda m: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(m.severity, 4)
    )
    return matches


rule_engine = None
