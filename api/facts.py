"""
Lightweight scoped fact and memory-candidate store for Hermes WebUI.

Safety rules for Batch 1:
- local JSONL only under ~/.hermes/webui/facts by default;
- no Paperclip writes;
- no Telegram sends;
- no durable Hermes memory writes.
"""
from __future__ import annotations

import json
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Iterable

try:
    from api.config import STATE_DIR
except Exception:  # pragma: no cover - import fallback for isolated tests
    STATE_DIR = Path.home() / '.hermes' / 'webui'

FACTS_DIR = Path(os.getenv('HERMES_WEBUI_FACTS_DIR', str(STATE_DIR / 'facts'))).expanduser().resolve()
CANDIDATES_FILE = 'candidates.jsonl'
FACTS_FILE = 'facts.jsonl'
_LOCK = threading.Lock()

_ALLOWED_CATEGORIES = {'decision', 'preference', 'pattern', 'knowledge', 'constraint'}
_ALLOWED_SCOPES = {'global', 'company', 'project', 'telegram_group', 'workspace', 'profile'}
_ALLOWED_SENSITIVITY = {'public', 'internal', 'confidential'}
_ALLOWED_ACTIONS = {'approve', 'edit', 'reject', 'paperclip_draft_only'}


def _now() -> float:
    return time.time()


def _store_dir(store_dir: str | Path | None = None) -> Path:
    return Path(store_dir).expanduser().resolve() if store_dir else FACTS_DIR


def _path(name: str, store_dir: str | Path | None = None) -> Path:
    base = _store_dir(store_dir)
    base.mkdir(parents=True, exist_ok=True)
    return base / name


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding='utf-8').splitlines():
        raw = line.strip()
        if not raw:
            continue
        try:
            obj = json.loads(raw)
        except Exception:
            continue
        if isinstance(obj, dict):
            rows.append(obj)
    return rows


def _write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = ''.join(json.dumps(row, ensure_ascii=False, sort_keys=True) + '\n' for row in rows)
    path.write_text(text, encoding='utf-8')


def _append_jsonl(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as fh:
        fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + '\n')


def _clean_category(value: str | None) -> str:
    value = (value or 'knowledge').strip()
    return value if value in _ALLOWED_CATEGORIES else 'knowledge'


def _clean_scope(value: str | None) -> str:
    value = (value or 'global').strip()
    return value if value in _ALLOWED_SCOPES else 'global'


def create_candidate(
    category: str,
    scope: str,
    scope_ref: str,
    statement: str,
    source_session_id: str | None = None,
    source_message_ids: list[str] | None = None,
    confidence: float | None = None,
    reason: str | None = None,
    sensitivity: str = 'internal',
    recommended_action: str = 'approve',
    metadata: dict[str, Any] | None = None,
    store_dir: str | Path | None = None,
) -> dict[str, Any]:
    statement = str(statement or '').strip()
    if not statement:
        raise ValueError('statement is required')
    if confidence is None:
        confidence = 0.5
    confidence = max(0.0, min(1.0, float(confidence)))
    sensitivity = sensitivity if sensitivity in _ALLOWED_SENSITIVITY else 'internal'
    recommended_action = recommended_action if recommended_action in _ALLOWED_ACTIONS else 'approve'
    now = _now()
    row = {
        'id': 'cand_' + uuid.uuid4().hex[:16],
        'category': _clean_category(category),
        'scope': _clean_scope(scope),
        'scope_ref': str(scope_ref or 'default').strip() or 'default',
        'statement': statement,
        'source_session_id': source_session_id,
        'source_message_ids': source_message_ids or [],
        'confidence': confidence,
        'sensitivity': sensitivity,
        'recommended_action': recommended_action,
        'reason': str(reason or '').strip(),
        'status': 'pending',
        'created_at': now,
        'updated_at': now,
        'metadata': metadata or {},
        'safety': {
            'paperclip_write': False,
            'telegram_send': False,
            'durable_memory_write': False,
        },
    }
    with _LOCK:
        _append_jsonl(_path(CANDIDATES_FILE, store_dir), row)
    return row


def list_candidates(status: str | None = 'pending', scope: str | None = None, scope_ref: str | None = None, store_dir: str | Path | None = None) -> list[dict[str, Any]]:
    rows = _read_jsonl(_path(CANDIDATES_FILE, store_dir))
    if status and status != 'all':
        rows = [r for r in rows if r.get('status') == status]
    if scope:
        rows = [r for r in rows if r.get('scope') == scope]
    if scope_ref:
        rows = [r for r in rows if r.get('scope_ref') == scope_ref]
    return sorted(rows, key=lambda r: r.get('created_at', 0), reverse=True)


def _replace_candidate(candidate_id: str, updater, store_dir: str | Path | None = None) -> dict[str, Any]:
    path = _path(CANDIDATES_FILE, store_dir)
    rows = _read_jsonl(path)
    for idx, row in enumerate(rows):
        if row.get('id') == candidate_id:
            rows[idx] = updater(dict(row))
            _write_jsonl(path, rows)
            return rows[idx]
    raise KeyError('candidate not found')


def approve_candidate(candidate_id: str, edited_statement: str | None = None, store_dir: str | Path | None = None) -> dict[str, Any]:
    with _LOCK:
        def mark(row):
            if row.get('status') != 'pending':
                raise ValueError('candidate is not pending')
            row['status'] = 'approved'
            if edited_statement is not None and str(edited_statement).strip():
                row['statement'] = str(edited_statement).strip()
                row['edited'] = True
            row['updated_at'] = _now()
            return row
        candidate = _replace_candidate(candidate_id, mark, store_dir)
        now = _now()
        fact = {
            'id': 'fact_' + uuid.uuid4().hex[:16],
            'category': candidate.get('category', 'knowledge'),
            'scope': candidate.get('scope', 'global'),
            'scope_ref': candidate.get('scope_ref', 'default'),
            'statement': candidate.get('statement', ''),
            'source_candidate_id': candidate.get('id'),
            'source_session_id': candidate.get('source_session_id'),
            'source_message_ids': candidate.get('source_message_ids', []),
            'confidence': candidate.get('confidence'),
            'sensitivity': candidate.get('sensitivity', 'internal'),
            'status': 'active',
            'relations': [],
            'created_at': now,
            'updated_at': now,
            'metadata': candidate.get('metadata', {}),
            'safety': {
                'paperclip_write': False,
                'telegram_send': False,
                'durable_memory_write': False,
            },
        }
        _append_jsonl(_path(FACTS_FILE, store_dir), fact)
    return {'candidate': candidate, 'fact': fact}


def reject_candidate(candidate_id: str, reason: str | None = None, store_dir: str | Path | None = None) -> dict[str, Any]:
    with _LOCK:
        def mark(row):
            if row.get('status') != 'pending':
                raise ValueError('candidate is not pending')
            row['status'] = 'rejected'
            row['rejection_reason'] = str(reason or '').strip()
            row['updated_at'] = _now()
            return row
        return _replace_candidate(candidate_id, mark, store_dir)


def list_facts(scope: str | None = None, scope_ref: str | None = None, category: str | None = None, query: str | None = None, status: str = 'active', store_dir: str | Path | None = None) -> list[dict[str, Any]]:
    rows = _read_jsonl(_path(FACTS_FILE, store_dir))
    if status and status != 'all':
        rows = [r for r in rows if r.get('status') == status]
    if scope:
        rows = [r for r in rows if r.get('scope') == scope]
    if scope_ref:
        rows = [r for r in rows if r.get('scope_ref') == scope_ref]
    if category:
        rows = [r for r in rows if r.get('category') == category]
    if query:
        q = query.casefold()
        rows = [r for r in rows if q in str(r.get('statement', '')).casefold() or q in str(r.get('scope_ref', '')).casefold()]
    return sorted(rows, key=lambda r: r.get('created_at', 0), reverse=True)


def store_summary(store_dir: str | Path | None = None) -> dict[str, Any]:
    candidates = _read_jsonl(_path(CANDIDATES_FILE, store_dir))
    facts = _read_jsonl(_path(FACTS_FILE, store_dir))
    pending = sum(1 for c in candidates if c.get('status') == 'pending')
    return {
        'store_dir': str(_store_dir(store_dir)),
        'candidates': len(candidates),
        'pending_candidates': pending,
        'facts': len(facts),
        'safety': 'local-only; no Paperclip/Telegram/durable-memory writes',
    }
