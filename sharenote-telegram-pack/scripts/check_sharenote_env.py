#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

APP_CONFIG = Path.home() / "Library/Application Support/obsidian/obsidian.json"

def discover_vaults():
    if not APP_CONFIG.exists():
        return []
    data = json.loads(APP_CONFIG.read_text(errors="ignore"))
    out = []
    for key, value in (data.get("vaults") or {}).items():
        path = Path(value.get("path", "")) if isinstance(value, dict) else None
        if path:
            out.append((key, path, path.exists()))
    return out

def main():
    print("ShareNote + Telegram environment check")
    vaults = discover_vaults()
    print(f"vault_count={len(vaults)}")
    for key, vault, exists in vaults:
        print(f"vault={key[:8]} path={vault} exists={exists}")
        obs = vault / ".obsidian"
        cp = obs / "community-plugins.json"
        plugins = []
        if cp.exists():
            try:
                plugins = json.loads(cp.read_text(errors="ignore"))
            except Exception as exc:
                print(f"community_plugins_error={type(exc).__name__}: {exc}")
        print("enabled_plugins=" + ",".join(plugins))
        for plugin_id in ["share-note", "obsidian-advanced-uri"]:
            pdir = obs / "plugins" / plugin_id
            mf = pdir / "manifest.json"
            status = "missing"
            name = version = ""
            if mf.exists():
                try:
                    meta = json.loads(mf.read_text(errors="ignore"))
                    name = meta.get("name", "")
                    version = meta.get("version", "")
                    status = "enabled" if plugin_id in plugins else "installed_disabled"
                except Exception:
                    status = "manifest_unreadable"
            print(f"plugin={plugin_id} status={status} name={name} version={version}")
        share_cfg = obs / "plugins/share-note/data.json"
        if share_cfg.exists():
            try:
                cfg = json.loads(share_cfg.read_text(errors="ignore"))
                print("sharenote_server=" + str(cfg.get("server", "")))
                print("sharenote_yaml_field=" + str(cfg.get("yamlField", "share")))
                print("sharenote_clipboard=" + str(cfg.get("clipboard", "")))
                print("sharenote_credentials=REDACTED")
            except Exception as exc:
                print(f"sharenote_config_error={type(exc).__name__}: {exc}")

if __name__ == "__main__":
    main()
