import io
import json
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def test_research_intake_routes_are_registered():
    routes = read("api/routes.py")
    assert "/api/research-intake/image-draft" in routes
    assert "/api/research-intake/review" in routes
    assert "/api/research-intake/approve-promotion" in routes
    assert "_handle_research_intake_image_draft" in routes
    assert "_handle_research_intake_review" in routes


def test_research_intake_ui_controls_exist_in_opencrab_panel():
    html = read("static/index.html")
    assert "researchIntakeImageSource" in html
    assert "createResearchIntakeImageDraft" in html
    assert "researchIntakeReviewPanel" in html
    assert "이미지 draft package 생성" in html


def test_research_intake_frontend_functions_and_guards_exist():
    boot = read("static/boot.js")
    assert "function createResearchIntakeImageDraft" in boot
    assert "function loadResearchIntakeReview" in boot
    assert "/api/research-intake/image-draft" in boot
    assert "/api/research-intake/review" in boot
    assert "OpenCrab sync: disabled" in boot
    assert "Neo4j write: disabled" in boot
    assert "Paperclip reflection: disabled" in boot


def test_research_intake_css_review_viewer_exists():
    css = read("static/style.css")
    assert "Research Intake image draft UI" in css
    assert ".research-intake-review" in css
    assert ".research-intake-review pre" in css
    assert ".research-intake-promotion-state" in css



class DummyHandler:
    def __init__(self):
        self.status = None
        self.headers = []
        self.wfile = io.BytesIO()

    def send_response(self, status):
        self.status = status

    def send_header(self, key, value):
        self.headers.append((key, value))

    def end_headers(self):
        pass

    def json_payload(self):
        return json.loads(self.wfile.getvalue().decode("utf-8"))


def test_research_intake_promotion_approval_writes_review_only_decision(tmp_path, monkeypatch):
    import api.routes as routes

    package_root = tmp_path / "research-intake-packages"
    package_dir = package_root / "research-intake-test-package"
    (package_dir / "review").mkdir(parents=True)
    (package_dir / "promotion").mkdir(parents=True)
    (package_dir / "review" / "visual_evidence_review.md").write_text("# Visual Evidence Review\n", encoding="utf-8")
    (package_dir / "manifest.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "draft",
        "counts": {"claims": 1, "nodes": 1, "evidence": 1},
        "guards": {"approval_required": True, "opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False},
    }), encoding="utf-8")

    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_approve_promotion(handler, {
        "package_id": "research-intake-test-package",
        "approved": True,
        "approved_actions": ["opencrab_sync", "neo4j_write", "paperclip_reflection"],
        "approver": "test-user",
    })

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["ok"] is True
    assert payload["status"] == "approved_for_promotion"
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    assert payload["requires_separate_execution_approval"] is True
    decision = json.loads((package_dir / "promotion" / "approval_decision.json").read_text(encoding="utf-8"))
    assert decision["approved"] is True
    assert decision["approved_actions"] == ["opencrab_sync", "neo4j_write", "paperclip_reflection"]
    assert decision["external_mutations_performed"] == []


def test_localcrab_status_is_not_pending_when_draft_builder_available(tmp_path):
    from api.opencrab_connector import build_opencrab_status

    localcrab_home = tmp_path / "localcrab"
    localcrab_home.mkdir()
    payload = build_opencrab_status(config_path=tmp_path / "missing.yaml", paperclip_base_url="http://127.0.0.1:9")
    localcrab = payload["localcrab"]
    assert localcrab["runtime"] != "pending"
    assert localcrab["draft_package_builder_ready"] is True
    assert "opencrab-ingest-packages" in localcrab["package_roots"]
    assert "research-intake-packages" in localcrab["package_roots"]


def test_research_intake_review_returns_existing_promotion_decision(tmp_path, monkeypatch):
    import api.routes as routes

    package_root = tmp_path / "research-intake-packages"
    package_dir = package_root / "research-intake-test-package"
    (package_dir / "review").mkdir(parents=True)
    (package_dir / "promotion").mkdir(parents=True)
    (package_dir / "review" / "visual_evidence_review.md").write_text("# Visual Evidence Review\n", encoding="utf-8")
    decision = {
        "package_id": "research-intake-test-package",
        "approved": True,
        "status": "approved_for_promotion",
        "external_mutations_performed": [],
    }
    (package_dir / "promotion" / "approval_decision.json").write_text(json.dumps(decision), encoding="utf-8")
    (package_dir / "manifest.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approved_for_promotion",
        "promotion": {"approval_decision_path": str(package_dir / "promotion" / "approval_decision.json")},
    }), encoding="utf-8")

    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_review(handler, SimpleNamespace(query="package_id=research-intake-test-package"))

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["promotion_decision"]["status"] == "approved_for_promotion"
    assert payload["promotion_decision"]["external_mutations_performed"] == []


def test_research_intake_promotion_ui_controls_exist():
    html = read("static/index.html")
    boot = read("static/boot.js")
    assert "researchIntakeApprovePromotion" in html
    assert "function approveResearchIntakePromotion" in boot
    assert "/api/research-intake/approve-promotion" in boot
    assert "승인 기록" in html + boot
    assert "promotion_decision" in boot
