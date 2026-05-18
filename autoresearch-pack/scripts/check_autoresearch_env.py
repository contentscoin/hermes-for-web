#!/usr/bin/env python3
"""Credential-safe AutoResearch Pack environment check."""
from __future__ import annotations

import datetime as _dt
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "autoresearch-pack"
CANONICAL_FILES = [
    "README.md",
    "templates/research-question-template.md",
    "templates/research-output-template.md",
    "workflows/default-research-loop.md",
    "checklists/deepening-checklist.md",
    "scripts/check_autoresearch_env.py",
]
COMMANDS = ["hermes", "python3", "git", "curl", "jq", "node", "npm", "xurl"]
EXTRA_COMMAND_DIRS = [
    Path.home() / ".local" / "bin",
    Path.home() / ".hermes" / "bin",
    Path.home() / ".hermes" / "hermes-agent" / "venv" / "bin",
]
OPTIONAL_PACKS = ["last30days-pack", "sharenote-telegram-pack", "paperclip-ops-pack"]
RESEARCH_SKILL_HINTS = [
    "insane-search-hermes",
    "arxiv",
    "blogwatcher",
    "polymarket",
    "youtube-content",
    "xurl",
]
CREDENTIAL_ENV_HINTS = [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "TAVILY_API_KEY",
    "BRAVE_API_KEY",
    "SERPAPI_API_KEY",
    "X_BEARER_TOKEN",
    "TWITTER_BEARER_TOKEN",
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
]


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
    try:
        p = subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)
        out = (p.stdout or p.stderr or "").strip()
        return {"ok": p.returncode == 0, "returncode": p.returncode, "output": out[:2000]}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": type(e).__name__, "message": str(e)}


def get_json(url: str, timeout: int = 3) -> dict:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:  # noqa: S310 local/default URLs only here
            raw = r.read(12000).decode("utf-8", "replace")
            try:
                body = json.loads(raw)
            except Exception:
                body = raw[:800]
            return {"ok": 200 <= r.status < 300, "status": r.status, "body": body}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": type(e).__name__, "message": str(e)}


def scrub_mcp_output(text: str) -> str:
    # MCP list normally has no secrets, but keep only compact lines and avoid URLs with query strings.
    lines = []
    for line in (text or "").splitlines()[:80]:
        if "key=" in line.lower() or "token=" in line.lower() or "secret" in line.lower():
            lines.append("[REDACTED credential-like MCP line]")
        else:
            lines.append(line[:220])
    return "\n".join(lines)


def main() -> int:
    now = _dt.datetime.now().astimezone()
    window_start = now - _dt.timedelta(days=30)
    command_status = {c: {"path": resolve_command(c), "available": bool(resolve_command(c))} for c in COMMANDS}
    file_status = {rel: (PACK / rel).exists() for rel in CANONICAL_FILES}
    related_packs = {name: (ROOT / name).exists() for name in OPTIONAL_PACKS}
    docs = {
        "docs/setup-packs.md": (ROOT / "docs/setup-packs.md").exists(),
        "docs/research-packs.md": (ROOT / "docs/research-packs.md").exists(),
    }

    hermes_cmd = command_status["hermes"]["path"]
    hermes_version = run([hermes_cmd, "--version"], 8) if hermes_cmd else {"ok": False, "message": "hermes missing"}
    webui_health = get_json("http://127.0.0.1:8788/health")
    webui_models = get_json("http://127.0.0.1:8788/api/models") if webui_health.get("ok") else {"ok": False, "message": "WebUI health unavailable"}
    mcp_list = run([hermes_cmd, "mcp", "list"], 12) if hermes_cmd else {"ok": False, "message": "hermes missing"}

    env_presence = {name: ("present" if os.environ.get(name) else "missing") for name in CREDENTIAL_ENV_HINTS}
    available_skill_hints = []
    skills_dir = Path.home() / ".hermes" / "skills"
    if skills_dir.exists():
        for hint in RESEARCH_SKILL_HINTS:
            if list(skills_dir.rglob(f"*{hint}*")):
                available_skill_hints.append(hint)

    missing_required_files = [rel for rel, ok in file_status.items() if not ok]
    missing_core_commands = [c for c in ["python3", "git", "curl"] if not command_status[c]["available"]]
    readiness = "ready" if not missing_required_files and not missing_core_commands else "needs_attention"

    report = {
        "pack": "autoresearch",
        "root": str(ROOT),
        "pack_dir": str(PACK),
        "checked_at": now.isoformat(),
        "recent_30_day_window": {"start": window_start.date().isoformat(), "end": now.date().isoformat()},
        "readiness": readiness,
        "canonical_files": file_status,
        "missing_required_files": missing_required_files,
        "docs": docs,
        "commands": command_status,
        "hermes_version": hermes_version,
        "webui": {"health": webui_health, "models": webui_models},
        "mcp_list": {**mcp_list, "output": scrub_mcp_output(mcp_list.get("output", ""))},
        "related_packs": related_packs,
        "research_skill_hints_found": available_skill_hints,
        "credential_presence_redacted": env_presence,
        "notes": [
            "Missing X/Reddit credentials are not AutoResearch setup failures; use web-search fallback or last30days when needed.",
            "Actual web/social research was not executed by this environment check.",
            "Raw credentials are not printed.",
            "Paperclip reflection, Telegram delivery, and publishing require explicit approval.",
        ],
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if readiness == "ready" else 2


if __name__ == "__main__":
    sys.exit(main())
