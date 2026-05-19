#!/usr/bin/env python3
"""Credential-safe environment check for last30days research pack."""
from __future__ import annotations

import datetime as _dt
import json
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMMANDS = ["hermes", "python3", "git", "curl", "jq", "node", "npm", "xurl"]
EXTRA_COMMAND_DIRS = [
    Path.home() / ".local" / "bin",
    Path.home() / ".hermes" / "bin",
    Path.home() / ".hermes" / "hermes-agent" / "venv" / "bin",
]
ENV_FLAGS = [
    "X_BEARER_TOKEN",
    "TWITTER_BEARER_TOKEN",
    "X_API_KEY",
    "TWITTER_API_KEY",
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
    "REDDIT_USER_AGENT",
    "REDDIT_USERNAME",
    "SERPAPI_API_KEY",
    "BRAVE_API_KEY",
    "TAVILY_API_KEY",
]
REQUIRED_FILES = [
    "last30days-pack/README.md",
    "last30days-pack/templates/query-template.md",
    "last30days-pack/templates/output-template.md",
    "last30days-pack/workflows/default-last30days-loop.md",
    "last30days-pack/checklists/source-selection-checklist.md",
    "last30days-pack/scripts/check_last30days_env.py",
]
RELATED_PACKS = ["autoresearch-pack", "sharenote-telegram-pack", "paperclip-ops-pack"]


def resolve_command(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    for directory in EXTRA_COMMAND_DIRS:
        candidate = directory / name
        if candidate.exists() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


def run(cmd: list[str], timeout: int = 8) -> dict:
    safe_cmd = [cmd[0], *cmd[1:]]
    try:
        proc = subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)
        output = (proc.stdout or proc.stderr or "").strip()
        return {
            "ok": proc.returncode == 0,
            "cmd": safe_cmd,
            "returncode": proc.returncode,
            "summary": output.splitlines()[0][:240] if output else "",
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "cmd": safe_cmd, "error": type(exc).__name__}


def get_json(url: str, timeout: int = 4) -> dict:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            raw = response.read(5000).decode("utf-8", "replace")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"raw_preview": raw[:300]}
        return {"ok": True, "status": getattr(response, "status", None), "data": parsed}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": type(exc).__name__}


def redact_env() -> dict:
    return {name: ("present" if os.environ.get(name) else "missing") for name in ENV_FLAGS}


def source_readiness(command_status: dict, env: dict) -> dict:
    x_direct = bool(command_status.get("xurl", {}).get("available")) or any(
        env.get(name) == "present"
        for name in ["X_BEARER_TOKEN", "TWITTER_BEARER_TOKEN", "X_API_KEY", "TWITTER_API_KEY"]
    )
    reddit_direct = all(env.get(name) == "present" for name in ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"])
    web_fallback = any(env.get(name) == "present" for name in ["SERPAPI_API_KEY", "BRAVE_API_KEY", "TAVILY_API_KEY"])
    return {
        "x": {
            "status": "direct_or_cli_ready" if x_direct else ("fallback_possible" if web_fallback else "needs_xurl_or_x_api_or_search_fallback"),
            "recommended_when": "fast public reactions, viral phrasing, launch/campaign response, influencer or hashtag movement",
        },
        "reddit": {
            "status": "api_ready" if reddit_direct else ("fallback_possible" if web_fallback else "needs_reddit_api_or_search_fallback"),
            "recommended_when": "deeper community discussion, product pain points, alternatives, subreddit-specific context",
        },
        "both": {
            "status": "ready" if (x_direct or web_fallback) and (reddit_direct or web_fallback) else "partial_needs_clear_limitations",
            "recommended_when": "default comparison mode: fast X signal plus deeper Reddit discussion",
        },
    }


def main() -> int:
    today = _dt.date.today()
    start = today - _dt.timedelta(days=30)
    commands = {name: {"path": resolve_command(name), "available": bool(resolve_command(name))} for name in COMMANDS}
    env = redact_env()
    files = {path: (ROOT / path).exists() for path in REQUIRED_FILES}
    related_packs = {name: (ROOT / name).exists() for name in RELATED_PACKS}
    hermes_cmd = commands["hermes"]["path"]
    checks = {
        "hermes_version": run([hermes_cmd, "--version"], 8) if hermes_cmd else {"ok": False, "message": "hermes missing"},
        "webui_8788_health": get_json("http://127.0.0.1:8788/health"),
        "webui_8788_models": get_json("http://127.0.0.1:8788/api/models"),
        "hermes_mcp_list": run([hermes_cmd, "mcp", "list"], 12) if hermes_cmd else {"ok": False, "message": "hermes missing"},
    }
    report = {
        "pack": "last30days",
        "root": str(ROOT),
        "checked_at": _dt.datetime.now().isoformat(timespec="seconds"),
        "date_window": {"start": start.isoformat(), "end": today.isoformat(), "days": 30},
        "canonical_files": files,
        "commands": commands,
        "credentials_present_redacted": env,
        "related_packs": related_packs,
        "source_readiness": source_readiness(commands, env),
        "checks": checks,
        "usage_contract": {
            "source_flags": ["x", "reddit", "both"],
            "default_source": "both",
            "must_disclose_sampling_bias": True,
            "must_separate_facts_from_interpretation": True,
            "no_raw_credentials_in_output": True,
        },
        "security": {
            "raw_credentials_printed": False,
            "external_research_performed": False,
            "paperclip_reflection_performed": False,
            "telegram_delivery_performed": False,
            "publishing_performed": False,
            "external_actions_require_explicit_approval": True,
        },
        "readiness": "ready" if all(files.values()) and commands["python3"]["available"] else "needs_attention",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
