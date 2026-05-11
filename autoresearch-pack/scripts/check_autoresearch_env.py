#!/usr/bin/env python3
"""Credential-safe environment check for AutoResearch pack."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

COMMANDS = [
    "hermes",
    "python3",
    "git",
    "curl",
    "jq",
    "node",
    "npm",
    "xurl",
]

REQUIRED_FILES = [
    "autoresearch-pack/README.md",
    "autoresearch-pack/templates/research-question-template.md",
    "autoresearch-pack/templates/research-output-template.md",
    "autoresearch-pack/workflows/default-research-loop.md",
    "autoresearch-pack/checklists/deepening-checklist.md",
]

OPTIONAL_PACKS = [
    "last30days-pack/README.md",
    "sharenote-telegram-pack/README.md",
    "paperclip-ops-pack/README.md",
]

ENV_FLAGS = [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "TAVILY_API_KEY",
    "BRAVE_API_KEY",
    "SERPAPI_API_KEY",
    "X_BEARER_TOKEN",
    "TWITTER_BEARER_TOKEN",
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
]

RESEARCH_SKILL_NAMES = [
    "insane-search-hermes",
    "arxiv",
    "blogwatcher",
    "polymarket",
    "youtube-content",
    "xurl",
]


def run(cmd: list[str], timeout: int = 8) -> tuple[bool, str]:
    try:
        p = subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)
        out = (p.stdout or p.stderr or "").strip().splitlines()
        return p.returncode == 0, (out[0][:300] if out else "")
    except Exception as exc:  # noqa: BLE001
        return False, type(exc).__name__


def skill_hint(name: str) -> str:
    skills_root = Path.home() / ".hermes" / "skills"
    if not skills_root.exists():
        return "unknown"
    for p in skills_root.rglob("SKILL.md"):
        if p.parent.name == name:
            return "available"
    return "not_found_in_local_skill_dir"


def main() -> int:
    commands = {cmd: bool(shutil.which(cmd)) for cmd in COMMANDS}
    files = {path: (ROOT / path).exists() for path in REQUIRED_FILES}
    optional_packs = {path: (ROOT / path).exists() for path in OPTIONAL_PACKS}
    env = {name: ("present" if os.environ.get(name) else "missing") for name in ENV_FLAGS}

    hermes_ok, hermes_info = run(["hermes", "--version"]) if commands.get("hermes") else (False, "not found")
    webui_ok, webui_info = run(["curl", "-fsS", "http://127.0.0.1:8788/health"]) if commands.get("curl") else (False, "curl not found")
    models_ok, models_info = run(["curl", "-fsS", "http://127.0.0.1:8788/api/models"]) if commands.get("curl") else (False, "curl not found")
    mcp_ok, mcp_info = run(["hermes", "mcp", "list"], timeout=12) if commands.get("hermes") else (False, "hermes not found")

    skill_status = {name: skill_hint(name) for name in RESEARCH_SKILL_NAMES}

    result = {
        "pack": "autoresearch",
        "root": str(ROOT),
        "commands": commands,
        "credentials_present_redacted": env,
        "files": files,
        "optional_related_packs": optional_packs,
        "research_skill_hints": skill_status,
        "checks": {
            "hermes_version": {"ok": hermes_ok, "info": hermes_info},
            "webui_8788_health": {"ok": webui_ok, "info": webui_info[:120]},
            "webui_models": {"ok": models_ok, "info": models_info[:120]},
            "hermes_mcp_list": {"ok": mcp_ok, "info": mcp_info},
        },
        "readiness": {
            "pack_files_ready": all(files.values()),
            "webui_available": webui_ok,
            "basic_research_runtime": commands.get("python3") and commands.get("curl"),
            "x_reaction_path": "available_or_fallback" if commands.get("xurl") or env.get("X_BEARER_TOKEN") == "present" or env.get("TWITTER_BEARER_TOKEN") == "present" else "needs xurl/X credential or web-search fallback",
            "reddit_reaction_path": "available_or_fallback" if env.get("REDDIT_CLIENT_ID") == "present" and env.get("REDDIT_CLIENT_SECRET") == "present" else "needs Reddit credential or web-search fallback",
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
