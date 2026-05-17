"""OpenCrab Connector helpers for WebUI MVP.

This module is intentionally conservative:
- It never returns a raw OpenCrab MCP endpoint/key.
- It builds LocalCrab ingest packages as draft artifacts only.
- It does not write to Neo4j and does not sync to OpenCrab cloud.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import time
import uuid
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

_OPENCRAB_MCP_RE = re.compile(r"https://opencrab\.sh/api/mcp/[^\s\"'<>]+")


def redact_opencrab_endpoint(value: Any) -> Any:
    """Redact OpenCrab MCP endpoint secrets from strings or JSON-like objects."""
    if isinstance(value, str):
        return _OPENCRAB_MCP_RE.sub("https://opencrab.sh/api/mcp/[REDACTED]", value)
    if isinstance(value, dict):
        return {k: redact_opencrab_endpoint(v) for k, v in value.items()}
    if isinstance(value, list):
        return [redact_opencrab_endpoint(v) for v in value]
    return value


def _load_config(config_path: Optional[Path]) -> Dict[str, Any]:
    if not config_path:
        config_path = Path(os.getenv("HERMES_CONFIG_PATH", str(Path.home() / ".hermes" / "config.yaml"))).expanduser()
    if not config_path.exists():
        return {}
    text = config_path.read_text(encoding="utf-8", errors="replace")
    try:
        import yaml  # type: ignore
        data = yaml.safe_load(text)
        return data if isinstance(data, dict) else {}
    except Exception:
        # Small fallback for the one field we need in minimal Python environments.
        match = re.search(r"(?ms)^mcp_servers:\s*\n(?:^[ \t]+.*\n)*?^[ \t]+opencrab:\s*\n(?:^[ \t]+.*\n)*?^[ \t]+url:\s*([^\n#]+)", text)
        if match:
            return {"mcp_servers": {"opencrab": {"url": match.group(1).strip().strip('"\'')}}}
        return {}


def _extract_opencrab_endpoint(config: Dict[str, Any]) -> Optional[str]:
    server = (config.get("mcp_servers") or {}).get("opencrab") or {}
    if not isinstance(server, dict):
        return None
    for key in ("url", "endpoint", "server_url"):
        value = server.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _paperclip_probe(base_url: str) -> Dict[str, Any]:
    base_url = (base_url or "http://127.0.0.1:3100").rstrip("/")
    result: Dict[str, Any] = {"url": base_url, "reachable": False, "plugin_ready": False, "tools_registered": 0}
    try:
        with urllib.request.urlopen(f"{base_url}/api/health", timeout=1.5) as resp:
            result["reachable"] = 200 <= resp.status < 400
    except Exception as exc:
        result["error"] = str(exc)
        return redact_opencrab_endpoint(result)
    try:
        with urllib.request.urlopen(f"{base_url}/api/plugins", timeout=2) as resp:
            plugins = json.loads(resp.read().decode("utf-8", "replace") or "[]")
        if isinstance(plugins, dict):
            plugins = plugins.get("plugins") or plugins.get("items") or []
        for plugin in plugins or []:
            key = plugin.get("key") or plugin.get("pluginKey") or plugin.get("id")
            if key == "fmg.opencrab-ontology":
                result["plugin_ready"] = plugin.get("status") in ("ready", "enabled") or bool(plugin.get("enabled"))
                result["plugin_status"] = plugin.get("status")
                break
    except Exception as exc:
        result["plugin_error"] = str(exc)
    try:
        with urllib.request.urlopen(f"{base_url}/api/plugins/tools", timeout=2) as resp:
            payload = json.loads(resp.read().decode("utf-8", "replace") or "{}")
        tools = payload.get("tools") if isinstance(payload, dict) else payload
        result["tools_registered"] = len([t for t in (tools or []) if str(t.get("name", "")).startswith("fmg.opencrab-ontology:")])
    except Exception as exc:
        result["tools_error"] = str(exc)
    return redact_opencrab_endpoint(result)


def build_opencrab_status(config_path: Optional[Path] = None, paperclip_base_url: Optional[str] = None) -> Dict[str, Any]:
    """Build a secret-safe OpenCrab Connector status payload."""
    config = _load_config(config_path)
    endpoint = _extract_opencrab_endpoint(config)
    localcrab_path = Path(os.getenv("LOCALCRAB_HOME", str(Path.home() / ".hermes" / "localcrab"))).expanduser()
    state_dir = Path(os.getenv("HERMES_WEBUI_STATE_DIR", str(Path.home() / ".hermes" / "webui"))).expanduser()
    package_roots = {
        "opencrab-ingest-packages": str((state_dir / "opencrab-ingest-packages").resolve()),
        "research-intake-packages": str((state_dir / "research-intake-packages").resolve()),
    }
    draft_package_builder_ready = True
    return redact_opencrab_endpoint({
        "ok": True,
        "account": {
            "logged_in": False,
            "session_valid": False,
            "mode": "mcp_endpoint",
            "note": "OAuth/session login is planned; MVP uses configured MCP endpoint only.",
        },
        "hermes_mcp": {
            "configured": bool(endpoint),
            "endpoint": endpoint or None,
            "toolset": "opencrab",
        },
        "paperclip_plugin": _paperclip_probe(paperclip_base_url or os.getenv("PAPERCLIP_WEB_URL", "http://127.0.0.1:3100")),
        "localcrab": {
            "installed": localcrab_path.exists(),
            "path": str(localcrab_path),
            "runtime": "draft_package_builder_ready",
            "draft_package_builder_ready": draft_package_builder_ready,
            "package_roots": package_roots,
            "note": "LocalCrab runtime is represented by draft package builders; graph/cloud apply remains approval-gated.",
        },
        "guards": {
            "raw_key_exposed": False,
            "neo4j_write_enabled": False,
            "opencrab_sync_enabled": False,
            "ingest_apply_requires_approval": True,
        },
    })


def _iter_chunks(text: str, chunk_size: int = 1800) -> Iterable[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()] if text.strip() else []
    current = ""
    for para in paragraphs:
        if current and len(current) + len(para) + 2 > chunk_size:
            yield current
            current = para
        else:
            current = f"{current}\n\n{para}".strip() if current else para
    if current:
        yield current


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(redact_opencrab_endpoint(payload), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def create_ingest_package(source_path: Path | str, output_root: Path | str, workspace: Optional[Path | str] = None) -> Dict[str, Any]:
    """Create a draft LocalCrab ingest package for a single local source file.

    This function only creates reviewable files. It never applies to Neo4j or syncs to OpenCrab.
    """
    source = Path(source_path).expanduser().resolve()
    if workspace is not None:
        ws = Path(workspace).expanduser().resolve()
        try:
            source.relative_to(ws)
        except ValueError:
            raise ValueError("source_path must be inside the selected workspace")
    if not source.exists() or not source.is_file():
        raise FileNotFoundError(f"source file not found: {source}")
    if source.stat().st_size > 10 * 1024 * 1024:
        raise ValueError("source file is too large for MVP ingest package builder")

    output_root = Path(output_root).expanduser().resolve()
    package_id = f"localcrab-{time.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}"
    package_dir = output_root / package_id
    package_dir.mkdir(parents=True, exist_ok=False)

    source_copy = package_dir / "source" / source.name
    source_copy.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, source_copy)

    text = source.read_text(encoding="utf-8", errors="replace")
    chunks = list(_iter_chunks(text))
    chunk_rows = []
    for idx, chunk in enumerate(chunks, start=1):
        chunk_id = f"chunk-{idx:04d}"
        chunk_rows.append({
            "id": chunk_id,
            "source": source.name,
            "text": redact_opencrab_endpoint(chunk),
            "char_count": len(chunk),
            "sha256": hashlib.sha256(chunk.encode("utf-8")).hexdigest(),
        })

    def write_jsonl(path: Path, rows: Iterable[Dict[str, Any]]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("".join(json.dumps(redact_opencrab_endpoint(r), ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")

    write_jsonl(package_dir / "extracted" / "chunks.jsonl", chunk_rows)
    write_jsonl(package_dir / "ontology" / "nodes.jsonl", [])
    write_jsonl(package_dir / "ontology" / "edges.jsonl", [])
    write_jsonl(package_dir / "ontology" / "claims.jsonl", [])
    evidence_rows = [{"id": f"evidence-{i:04d}", "chunk_id": row["id"], "source": source.name} for i, row in enumerate(chunk_rows, start=1)]
    write_jsonl(package_dir / "ontology" / "evidence.jsonl", evidence_rows)

    manifest = {
        "package_id": package_id,
        "status": "draft",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": {"name": source.name, "size": source.stat().st_size, "sha256": _sha256(source)},
        "counts": {"chunks": len(chunk_rows), "nodes": 0, "edges": 0, "claims": 0, "evidence": len(evidence_rows)},
        "guards": {"approval_required": True, "neo4j_write": False, "opencrab_sync": False},
    }
    _write_json(package_dir / "manifest.json", manifest)
    _write_json(package_dir / "extracted" / "metadata.json", {"source": manifest["source"], "chunks": len(chunk_rows)})
    _write_json(package_dir / "validation" / "schema_report.json", {"ok": True, "errors": [], "warnings": ["MVP draft package: ontology extraction not yet applied."]})
    _write_json(package_dir / "validation" / "quality_report.json", {"ok": True, "chunk_count": len(chunk_rows), "empty_source": len(chunk_rows) == 0})
    _write_json(package_dir / "promotion" / "approval_request.json", {
        "package_id": package_id,
        "requires_explicit_approval": True,
        "blocked_actions": ["neo4j_write", "opencrab_sync"],
        "recommended_next_step": "Review package files, then explicitly approve apply/sync if desired.",
    })

    return redact_opencrab_endpoint({
        "ok": True,
        "package_id": package_id,
        "package_dir": str(package_dir),
        "status": "draft",
        "approval_required": True,
        "neo4j_write": False,
        "opencrab_sync": False,
        "counts": manifest["counts"],
    })
