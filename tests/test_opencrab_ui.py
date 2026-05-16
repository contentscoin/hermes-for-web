"""OpenCrab Connector UI smoke tests."""
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def test_opencrab_nav_and_panel_are_present():
    html = (REPO_ROOT / "static" / "index.html").read_text(encoding="utf-8")

    assert "data-panel=\"opencrab\"" in html
    assert "id=\"panelOpencrab\"" in html
    assert "opencrabStatusPanel" in html
    assert "opencrabIngestSource" in html


def test_opencrab_panel_loader_is_wired():
    js = (REPO_ROOT / "static" / "panels.js").read_text(encoding="utf-8")

    assert "loadOpenCrabPanel" in js
    assert "/api/opencrab/status" in js
    assert "/api/opencrab/ingest-package" in js
