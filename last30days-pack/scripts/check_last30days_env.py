#!/usr/bin/env python3
"""Credential-safe environment check for last30days research pack."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from datetime import date, timedelta

ROOT = Path(__file__).resolve().parents[2]

COMMANDS = ["hermes", "python3", "git", "curl", "jq", "node", "npm", "xurl"]
ENV_FLAGS = [
    "X_BEARER_TOKEN",
    "TWITTER_BEARER_TOKEN",
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
    "REDDIT_USER_AGENT",
]
REQUIRED_FILES = [
    "last30days-pack/README.md",
    "last30days-pack/templates/query-template.md",
    "last30days-pack/templates/output-template.md",
    "last30days-pack/workflows/default-last30days-loop.md",
    "last30days-pack/checklists/source-selection-checklist.md",
]


def run(cmd: list[str], timeout: int = 5) -> tuple[bool, str]:
    try:
        p = subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)
        out = (p.stdout or p.stderr or "").strip().splitlines()
        return p.returncode == 0, (out[0][:200] if out else "")
    except Exception as exc:  # noqa: BLE001
        return False, type(exc).__name__


def main() -> int:
    today = date.today()
    start = today - timedelta(days=30)
    commands = {cmd: bool(shutil.which(cmd)) for cmd in COMMANDS}
    env = {name: ("present" if os.environ.get(name) else "missing") for name in ENV_FLAGS}
    files = {path: (ROOT / path).exists() for path in REQUIRED_FILES}

    hermes_ok, hermes_info = run(["hermes", "--version"]) if commands.get("hermes") else (False, "not found")
    webui_ok, webui_info = run(["curl", "-fsS", "http://127.0.0.1:8788/health"]) if commands.get("curl") else (False, "curl not found")
    mcp_ok, mcp_info = run(["hermes", "mcp", "list"], timeout=10) if commands.get("hermes") else (False, "hermes not found")

    result = {
        "pack": "last30days",
        "root": str(ROOT),
        "date_window": {"end": today.isoformat(), "start": start.isoformat(), "days": 30},
        "commands": commands,
        "credentials_present_redacted": env,
        "files": files,
        "checks": {
            "hermes_version": {"ok": hermes_ok, "info": hermes_info},
            "webui_8788_health": {"ok": webui_ok, "info": webui_info},
            "hermes_mcp_list": {"ok": mcp_ok, "info": mcp_info},
        },
        "source_readiness": {
            "x": "ready-ish" if commands.get("xurl") or env.get("X_BEARER_TOKEN") == "present" or env.get("TWITTER_BEARER_TOKEN") == "present" else "needs xurl, X API credential, or web-search fallback",
            "reddit": "ready-ish" if env.get("REDDIT_CLIENT_ID") == "present" and env.get("REDDIT_CLIENT_SECRET") == "present" else "needs Reddit API credential or web-search fallback",
            "both": "requires both source paths or clear fallback limitations",
        },
        "security": {
            "raw_credentials_printed": False,
            "external_actions_performed": False,
            "paperclip_or_telegram_requires_explicit_approval": True,
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
