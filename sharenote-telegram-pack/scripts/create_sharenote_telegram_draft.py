#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, os, re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

APP_CONFIG = Path.home() / "Library/Application Support/obsidian/obsidian.json"
DEFAULT_TARGET = "telegram:Pax Team Group"

def discover_vault() -> Path:
    env = os.environ.get("OBSIDIAN_VAULT_PATH")
    if env and Path(env).exists():
        return Path(env)
    if APP_CONFIG.exists():
        data = json.loads(APP_CONFIG.read_text(errors="ignore"))
        for value in (data.get("vaults") or {}).values():
            path = Path(value.get("path", "")) if isinstance(value, dict) else None
            if path and path.exists():
                return path
    raise SystemExit("No Obsidian vault found. Set OBSIDIAN_VAULT_PATH first.")

def slugify(title: str) -> str:
    s = re.sub(r'[\\/:*?"<>|]+', "-", title).strip()
    return s or "Untitled"

def read_share_url(note: Path) -> str:
    if not note.exists():
        return ""
    text = note.read_text(errors="ignore")
    m = re.search(r'''(?m)^share:\s*["']?([^"'\n]+)["']?\s*$''', text)
    if m and m.group(1).strip():
        return m.group(1).strip()
    return "PENDING_SHARENOTE_URL"

def main():
    ap = argparse.ArgumentParser(description="Create Obsidian note and Telegram draft for ShareNote publishing. Does not send messages.")
    ap.add_argument("--title", required=True)
    ap.add_argument("--summary", default="")
    ap.add_argument("--body", default="")
    ap.add_argument("--target", default=DEFAULT_TARGET)
    ap.add_argument("--folder", default="Hermes/Publishing")
    ap.add_argument("--open-uri", action="store_true", help="Print and open the Advanced URI in Obsidian")
    args = ap.parse_args()

    vault = discover_vault()
    created = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rel_dir = Path(args.folder)
    note_dir = vault / rel_dir
    note_dir.mkdir(parents=True, exist_ok=True)
    filename = slugify(args.title) + ".md"
    note = note_dir / filename
    rel_file = (rel_dir / filename).as_posix()

    if not note.exists():
        note_text = f"""---
title: "{args.title}"
created: "{created}"
status: draft
share: ""
tags:
  - publishing
  - sharenote
---

# {args.title}

## 요약
{args.summary}

## 본문
{args.body or "TODO: 본문을 작성하세요."}

## 발행 메모
- Telegram target: `{args.target}`
- 승인 상태: 미승인
"""
        note.write_text(note_text, encoding="utf-8")

    share_url = read_share_url(note)
    draft_dir = vault / "Hermes/Publishing/_telegram-drafts"
    draft_dir.mkdir(parents=True, exist_ok=True)
    draft = draft_dir / (slugify(args.title) + ".telegram.md")
    draft_text = f"""{args.title}

{args.summary}

공유 링크:
{share_url}

저장 위치:
{note}

대상:
{args.target}

전송 상태: 미승인 / 미전송
"""
    draft.write_text(draft_text, encoding="utf-8")

    vault_name = vault.name
    uri = "obsidian://open?vault=" + quote(vault_name) + "&file=" + quote(rel_file)
    print("note_path=" + str(note))
    print("telegram_draft_path=" + str(draft))
    print("advanced_uri=" + uri)
    print("share_url=" + share_url)
    print("telegram_target=" + args.target)
    print("send_requires_explicit_approval=true")

    if args.open_uri:
        import subprocess
        subprocess.run(["open", uri], check=False)

if __name__ == "__main__":
    main()
