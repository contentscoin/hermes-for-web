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
    assert "/api/research-intake/execution-plan" in routes
    assert "/api/research-intake/execution-report" in routes
    assert "/api/research-intake/approval-prompt" in routes
    assert "/api/research-intake/execute-opencrab" in routes
    assert "/api/research-intake/run-opencrab-connector" in routes
    assert "/api/research-intake/approve-opencrab-runner" in routes
    assert "/api/research-intake/preflight-opencrab-runner" in routes
    assert "/api/research-intake/run-opencrab-live-stub" in routes
    assert "/api/research-intake/opencrab-live-final-approval-prompt" in routes
    assert "/api/research-intake/opencrab-live-execution-gate" in routes
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


def test_research_intake_execution_plan_requires_promotion_approval(tmp_path, monkeypatch):
    import api.routes as routes

    package_root = tmp_path / "research-intake-packages"
    package_dir = package_root / "research-intake-test-package"
    (package_dir / "review").mkdir(parents=True)
    (package_dir / "review" / "visual_evidence_review.md").write_text("# Visual Evidence Review\n", encoding="utf-8")
    (package_dir / "manifest.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "draft",
    }), encoding="utf-8")

    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_execution_plan(handler, {
        "package_id": "research-intake-test-package",
        "actions": ["opencrab_sync"],
        "execution_approval": "EXECUTE_RESEARCH_INTAKE_PROMOTION",
    })

    payload = handler.json_payload()
    assert handler.status == 409
    assert "approved_for_promotion" in payload["error"]


def test_research_intake_execution_plan_records_explicit_plan_without_mutation(tmp_path, monkeypatch):
    import api.routes as routes

    package_root = tmp_path / "research-intake-packages"
    package_dir = package_root / "research-intake-test-package"
    (package_dir / "review").mkdir(parents=True)
    (package_dir / "promotion").mkdir(parents=True)
    (package_dir / "review" / "visual_evidence_review.md").write_text("# Visual Evidence Review\n", encoding="utf-8")
    (package_dir / "promotion" / "approval_decision.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "approved": True,
        "status": "approved_for_promotion",
        "approved_actions": ["opencrab_sync", "neo4j_write"],
        "external_mutations_performed": [],
    }), encoding="utf-8")
    (package_dir / "manifest.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approved_for_promotion",
        "counts": {"claims": 2, "nodes": 2, "evidence": 3},
    }), encoding="utf-8")

    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_execution_plan(handler, {
        "package_id": "research-intake-test-package",
        "actions": ["opencrab_sync", "neo4j_write", "paperclip_reflection"],
        "execution_approval": "EXECUTE_RESEARCH_INTAKE_PROMOTION",
        "approver": "test-user",
    })

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["ok"] is True
    assert payload["status"] == "execution_plan_ready"
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    assert payload["requires_final_tool_execution"] is True
    assert payload["approved_actions"] == ["opencrab_sync", "neo4j_write"]
    assert payload["blocked_actions"] == ["paperclip_reflection"]
    plan = json.loads((package_dir / "promotion" / "execution_plan.json").read_text(encoding="utf-8"))
    assert plan["status"] == "execution_plan_ready"
    assert plan["external_mutations_performed"] == []
    assert plan["requires_final_tool_execution"] is True
    assert "OpenCrab" in (package_dir / "promotion" / "execution_report.md").read_text(encoding="utf-8")


def test_research_intake_execution_plan_ui_controls_exist():
    html = read("static/index.html")
    boot = read("static/boot.js")
    assert "researchIntakeExecutionPlan" in html
    assert "function createResearchIntakeExecutionPlan" in boot
    assert "/api/research-intake/execution-plan" in boot
    assert "EXECUTE_RESEARCH_INTAKE_PROMOTION" in boot


def test_research_intake_execution_report_returns_decision_report_without_mutation(tmp_path, monkeypatch):
    import api.routes as routes

    package_root = tmp_path / "research-intake-packages"
    package_dir = package_root / "research-intake-test-package"
    (package_dir / "promotion").mkdir(parents=True)
    report = "# Research Intake Execution Plan\n\nFinal tool execution approval is still required before any external mutation.\n"
    (package_dir / "promotion" / "execution_report.md").write_text(report, encoding="utf-8")
    (package_dir / "promotion" / "execution_plan.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "execution_plan_ready",
        "approved_actions": ["opencrab_sync"],
        "blocked_actions": ["paperclip_reflection"],
        "requires_final_tool_execution": True,
        "external_mutations_performed": [],
        "external_mutations": {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False},
    }), encoding="utf-8")
    (package_dir / "manifest.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approved_for_promotion",
        "execution": {"status": "execution_plan_ready"},
    }), encoding="utf-8")

    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_execution_report(handler, SimpleNamespace(query="package_id=research-intake-test-package"))

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["ok"] is True
    assert payload["status"] == "execution_plan_ready"
    assert payload["content"] == report
    assert payload["requires_final_tool_execution"] is True
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    assert payload["execution_plan"]["external_mutations_performed"] == []


def test_research_intake_review_returns_execution_report_when_present(tmp_path, monkeypatch):
    import api.routes as routes

    package_root = tmp_path / "research-intake-packages"
    package_dir = package_root / "research-intake-test-package"
    (package_dir / "review").mkdir(parents=True)
    (package_dir / "promotion").mkdir(parents=True)
    (package_dir / "review" / "visual_evidence_review.md").write_text("# Visual Evidence Review\n", encoding="utf-8")
    report = "# Research Intake Execution Plan\n\nOpenCrab sync: not executed\n"
    (package_dir / "promotion" / "execution_report.md").write_text(report, encoding="utf-8")
    (package_dir / "promotion" / "execution_plan.json").write_text(json.dumps({"status": "execution_plan_ready"}), encoding="utf-8")
    (package_dir / "manifest.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approved_for_promotion",
    }), encoding="utf-8")

    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_review(handler, SimpleNamespace(query="package_id=research-intake-test-package"))

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["execution_report"]["status"] == "execution_plan_ready"
    assert payload["execution_report"]["content"] == report


def test_research_intake_final_execution_report_ui_controls_exist():
    html = read("static/index.html")
    boot = read("static/boot.js")
    assert "researchIntakeFinalExecutionReport" in html
    assert "function loadResearchIntakeExecutionReport" in boot
    assert "/api/research-intake/execution-report" in boot
    assert "최종 실행 decision report" in html + boot


def test_research_intake_approval_prompt_requires_execution_report(tmp_path, monkeypatch):
    import api.routes as routes

    package_root = tmp_path / "research-intake-packages"
    package_dir = package_root / "research-intake-test-package"
    package_dir.mkdir(parents=True)
    (package_dir / "manifest.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approved_for_promotion",
    }), encoding="utf-8")

    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_approval_prompt(handler, {
        "package_id": "research-intake-test-package",
    })

    payload = handler.json_payload()
    assert handler.status == 409
    assert "execution_report" in payload["error"]


def test_research_intake_approval_prompt_writes_read_only_prompt_without_mutation(tmp_path, monkeypatch):
    import api.routes as routes

    package_root = tmp_path / "research-intake-packages"
    package_dir = package_root / "research-intake-test-package"
    (package_dir / "promotion").mkdir(parents=True)
    report = "# Research Intake Execution Plan\n\nFinal tool execution approval is still required before any external mutation.\n"
    (package_dir / "promotion" / "execution_report.md").write_text(report, encoding="utf-8")
    (package_dir / "promotion" / "execution_plan.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "execution_plan_ready",
        "approved_actions": ["opencrab_sync", "neo4j_write", "paperclip_reflection"],
        "blocked_actions": [],
        "requires_final_tool_execution": True,
        "external_mutations_performed": [],
        "external_mutations": {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False},
    }), encoding="utf-8")
    (package_dir / "manifest.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approved_for_promotion",
    }), encoding="utf-8")

    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_approval_prompt(handler, {
        "package_id": "research-intake-test-package",
        "actions": ["opencrab_sync", "paperclip_reflection"],
        "approver": "test-user",
    })

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["ok"] is True
    assert payload["status"] == "approval_prompt_ready"
    assert payload["approval_phrase"] == "FINAL_EXECUTE_RESEARCH_INTAKE"
    assert payload["requested_actions"] == ["opencrab_sync", "paperclip_reflection"]
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    assert payload["requires_final_tool_execution"] is True
    assert payload["requires_paperclip_reflection_approval"] is True
    prompt = (package_dir / "promotion" / "final_execution_approval_prompt.md").read_text(encoding="utf-8")
    assert "FINAL_EXECUTE_RESEARCH_INTAKE" in prompt
    assert "Paperclip reflection requires separate explicit approval" in prompt
    decision = json.loads((package_dir / "promotion" / "final_execution_approval_prompt.json").read_text(encoding="utf-8"))
    assert decision["external_mutations_performed"] == []


def test_research_intake_final_execution_approval_prompt_ui_controls_exist():
    html = read("static/index.html")
    boot = read("static/boot.js")
    assert "researchIntakeFinalApprovalPrompt" in html
    assert "function createResearchIntakeFinalApprovalPrompt" in boot
    assert "/api/research-intake/approval-prompt" in boot
    assert "최종 실행 승인 요청 문구" in html + boot


def test_research_intake_opencrab_execution_requires_final_prompt_and_phrase(tmp_path, monkeypatch):
    import api.routes as routes

    package_root = tmp_path / "research-intake-packages"
    package_dir = package_root / "research-intake-test-package"
    (package_dir / "promotion").mkdir(parents=True)
    (package_dir / "manifest.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approved_for_promotion",
    }), encoding="utf-8")

    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_execute_opencrab(handler, {
        "package_id": "research-intake-test-package",
        "final_execution_approval": "FINAL_EXECUTE_RESEARCH_INTAKE",
    })

    payload = handler.json_payload()
    assert handler.status == 409
    assert "final_execution_approval_prompt" in payload["error"]

    (package_dir / "promotion" / "final_execution_approval_prompt.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approval_prompt_ready",
        "requested_actions": ["opencrab_sync"],
        "approval_phrase": "FINAL_EXECUTE_RESEARCH_INTAKE",
    }), encoding="utf-8")
    handler = DummyHandler()
    routes._handle_research_intake_execute_opencrab(handler, {
        "package_id": "research-intake-test-package",
        "final_execution_approval": "WRONG",
    })
    payload = handler.json_payload()
    assert handler.status == 400
    assert "FINAL_EXECUTE_RESEARCH_INTAKE" in payload["error"]


def test_research_intake_opencrab_execution_records_guarded_request_without_mutation(tmp_path, monkeypatch):
    import api.routes as routes

    package_root = tmp_path / "research-intake-packages"
    package_dir = package_root / "research-intake-test-package"
    (package_dir / "promotion").mkdir(parents=True)
    (package_dir / "ontology").mkdir(parents=True)
    (package_dir / "ontology" / "claims.jsonl").write_text('{"id":"claim-1","text":"FMG claim"}\n', encoding="utf-8")
    (package_dir / "ontology" / "nodes.jsonl").write_text('{"id":"node-1","label":"FMG"}\n', encoding="utf-8")
    (package_dir / "manifest.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approved_for_promotion",
        "counts": {"claims": 1, "nodes": 1, "evidence": 0},
    }), encoding="utf-8")
    (package_dir / "promotion" / "final_execution_approval_prompt.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approval_prompt_ready",
        "requested_actions": ["opencrab_sync"],
        "approval_phrase": "FINAL_EXECUTE_RESEARCH_INTAKE",
        "external_mutations_performed": [],
    }), encoding="utf-8")

    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_execute_opencrab(handler, {
        "package_id": "research-intake-test-package",
        "final_execution_approval": "FINAL_EXECUTE_RESEARCH_INTAKE",
        "dry_run": True,
        "operator": "test-user",
    })

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["ok"] is True
    assert payload["status"] == "opencrab_execution_ready"
    assert payload["dry_run"] is True
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    assert payload["requires_live_execution_approval"] is True
    record = json.loads((package_dir / "promotion" / "opencrab_execution_request.json").read_text(encoding="utf-8"))
    assert record["external_mutations_performed"] == []
    assert record["source_counts"] == {"claims": 1, "nodes": 1, "evidence": 0}
    assert "opencrab_sync" in record["approved_actions"]


def test_research_intake_opencrab_execution_ui_controls_exist():
    html = read("static/index.html")
    boot = read("static/boot.js")
    assert "researchIntakeExecuteOpenCrab" in html
    assert "function createResearchIntakeOpenCrabExecutionRequest" in boot
    assert "/api/research-intake/execute-opencrab" in boot
    assert "OpenCrab 실행 준비" in html + boot


def _prepare_opencrab_execution_package(tmp_path):
    package_root = tmp_path / "research-intake-packages"
    package_dir = package_root / "research-intake-test-package"
    (package_dir / "promotion").mkdir(parents=True)
    (package_dir / "ontology").mkdir(parents=True)
    (package_dir / "ontology" / "claims.jsonl").write_text('{"id":"claim-1","text":"FMG claim"}\n', encoding="utf-8")
    (package_dir / "ontology" / "nodes.jsonl").write_text('{"id":"node-1","label":"FMG"}\n', encoding="utf-8")
    (package_dir / "ontology" / "evidence.jsonl").write_text('{"id":"evidence-1","claim_id":"claim-1"}\n', encoding="utf-8")
    (package_dir / "manifest.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approved_for_promotion",
        "counts": {"claims": 1, "nodes": 1, "evidence": 1},
    }), encoding="utf-8")
    (package_dir / "promotion" / "final_execution_approval_prompt.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "approval_prompt_ready",
        "requested_actions": ["opencrab_sync"],
        "approval_phrase": "FINAL_EXECUTE_RESEARCH_INTAKE",
        "external_mutations_performed": [],
    }), encoding="utf-8")
    return package_dir


def test_research_intake_opencrab_live_contract_blocks_without_connector_config(tmp_path, monkeypatch):
    import api.routes as routes

    _prepare_opencrab_execution_package(tmp_path)
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    monkeypatch.delenv("HERMES_OPENCRAB_LIVE_SYNC_CONNECTOR", raising=False)
    handler = DummyHandler()
    routes._handle_research_intake_execute_opencrab(handler, {
        "package_id": "research-intake-test-package",
        "final_execution_approval": "FINAL_EXECUTE_RESEARCH_INTAKE",
        "dry_run": False,
        "execute_live": True,
    })

    payload = handler.json_payload()
    assert handler.status == 501
    assert payload["status"] == "live_connector_not_configured"
    assert payload["required_connector_env"] == "HERMES_OPENCRAB_LIVE_SYNC_CONNECTOR"
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}


def test_research_intake_opencrab_live_contract_writes_audit_payload_without_secret(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    monkeypatch.setenv("HERMES_OPENCRAB_LIVE_SYNC_CONNECTOR", "paperclip_opencrab_plugin")
    handler = DummyHandler()
    routes._handle_research_intake_execute_opencrab(handler, {
        "package_id": "research-intake-test-package",
        "final_execution_approval": "FINAL_EXECUTE_RESEARCH_INTAKE",
        "dry_run": False,
        "execute_live": True,
        "operator": "test-user",
    })

    payload = handler.json_payload()
    assert handler.status == 202
    assert payload["ok"] is True
    assert payload["status"] == "opencrab_live_sync_contract_ready"
    assert payload["connector"] == "paperclip_opencrab_plugin"
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    assert payload["requires_operator_tool_run"] is True
    audit = json.loads((package_dir / "promotion" / "opencrab_live_sync_contract.json").read_text(encoding="utf-8"))
    assert audit["connector"] == "paperclip_opencrab_plugin"
    assert audit["contract_version"] == "research-intake-opencrab-live-sync/v1"
    assert audit["payload"]["package_id"] == "research-intake-test-package"
    assert audit["payload"]["paths"]["claims"].endswith("claims.jsonl")
    assert audit["external_mutations_performed"] == []
    assert "mcp.opencrab.com" not in json.dumps(audit)


def test_research_intake_connector_runner_dry_run_adapter_validates_contract_without_mutation(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    contract = {
        "package_id": "research-intake-test-package",
        "status": "opencrab_live_sync_contract_ready",
        "contract_version": "research-intake-opencrab-live-sync/v1",
        "connector": "dry_run_adapter",
        "payload": {
            "package_id": "research-intake-test-package",
            "action": "opencrab_sync",
            "paths": {
                "claims": str(package_dir / "ontology" / "claims.jsonl"),
                "nodes": str(package_dir / "ontology" / "nodes.jsonl"),
                "evidence": str(package_dir / "ontology" / "evidence.jsonl"),
            },
            "counts": {"claims": 1, "nodes": 1, "evidence": 1},
            "final_execution_approval": "FINAL_EXECUTE_RESEARCH_INTAKE",
        },
        "external_mutations_performed": [],
    }
    (package_dir / "promotion" / "opencrab_live_sync_contract.json").write_text(json.dumps(contract), encoding="utf-8")
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_run_opencrab_connector(handler, {
        "package_id": "research-intake-test-package",
        "connector": "dry_run_adapter",
        "runner_mode": "dry_run",
        "operator": "test-user",
    })

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["ok"] is True
    assert payload["status"] == "opencrab_connector_dry_run_validated"
    assert payload["connector"] == "dry_run_adapter"
    assert payload["runner_mode"] == "dry_run"
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    result = json.loads((package_dir / "promotion" / "opencrab_connector_run_result.json").read_text(encoding="utf-8"))
    assert result["validated_contract"] is True
    assert result["would_sync"]["claims"] == 1
    assert result["external_mutations_performed"] == []
    assert "mcp.opencrab.com" not in json.dumps(result)


def test_research_intake_connector_runner_rejects_live_mode_for_dry_run_adapter(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    (package_dir / "promotion" / "opencrab_live_sync_contract.json").write_text(json.dumps({
        "package_id": "research-intake-test-package",
        "status": "opencrab_live_sync_contract_ready",
        "contract_version": "research-intake-opencrab-live-sync/v1",
        "connector": "dry_run_adapter",
        "payload": {"package_id": "research-intake-test-package", "action": "opencrab_sync", "paths": {}, "counts": {}},
        "external_mutations_performed": [],
    }), encoding="utf-8")
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_run_opencrab_connector(handler, {
        "package_id": "research-intake-test-package",
        "connector": "dry_run_adapter",
        "runner_mode": "live",
    })

    payload = handler.json_payload()
    assert handler.status == 501
    assert payload["status"] == "live_connector_runner_not_enabled"
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}


def test_research_intake_connector_runner_ui_controls_exist():
    html = read("static/index.html")
    boot = read("static/boot.js")
    assert "researchIntakeRunOpenCrabConnector" in html
    assert "function runResearchIntakeOpenCrabConnector" in boot
    assert "/api/research-intake/run-opencrab-connector" in boot
    assert "dry_run_adapter" in boot


def _write_live_contract_for_runner_gate(package_dir, connector="paperclip_opencrab_plugin"):
    contract = {
        "package_id": "research-intake-test-package",
        "status": "opencrab_live_sync_contract_ready",
        "contract_version": "research-intake-opencrab-live-sync/v1",
        "connector": connector,
        "payload": {
            "package_id": "research-intake-test-package",
            "action": "opencrab_sync",
            "paths": {
                "claims": str(package_dir / "ontology" / "claims.jsonl"),
                "nodes": str(package_dir / "ontology" / "nodes.jsonl"),
                "evidence": str(package_dir / "ontology" / "evidence.jsonl"),
            },
            "counts": {"claims": 1, "nodes": 1, "evidence": 1},
            "final_execution_approval": "FINAL_EXECUTE_RESEARCH_INTAKE",
        },
        "external_mutations_performed": [],
    }
    (package_dir / "promotion" / "opencrab_live_sync_contract.json").write_text(json.dumps(contract), encoding="utf-8")
    return contract


def test_research_intake_opencrab_runner_approval_gate_writes_checksum_artifact_without_mutation(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    _write_live_contract_for_runner_gate(package_dir)
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_approve_opencrab_runner(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "runner_mode": "live",
        "approval_phrase": "APPROVE_OPENCRAB_CONNECTOR_RUNNER",
        "approver": "test-user",
    })

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["ok"] is True
    assert payload["status"] == "opencrab_runner_approval_recorded"
    assert payload["payload_sha256"]
    assert payload["requires_separate_live_runner"] is True
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    approval = json.loads((package_dir / "promotion" / "opencrab_runner_approval.json").read_text(encoding="utf-8"))
    assert approval["connector"] == "paperclip_opencrab_plugin"
    assert approval["runner_mode"] == "live"
    assert approval["approved"] is True
    assert approval["payload_sha256"] == payload["payload_sha256"]
    assert approval["external_mutations_performed"] == []
    assert "mcp.opencrab.com" not in json.dumps(approval)


def test_research_intake_opencrab_runner_approval_gate_rejects_disallowed_connector(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    _write_live_contract_for_runner_gate(package_dir, connector="unknown_connector")
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    handler = DummyHandler()
    routes._handle_research_intake_approve_opencrab_runner(handler, {
        "package_id": "research-intake-test-package",
        "connector": "unknown_connector",
        "runner_mode": "live",
        "approval_phrase": "APPROVE_OPENCRAB_CONNECTOR_RUNNER",
    })

    payload = handler.json_payload()
    assert handler.status == 400
    assert "allowlist" in payload["error"]


def test_research_intake_opencrab_runner_approval_gate_ui_controls_exist():
    html = read("static/index.html")
    boot = read("static/boot.js")
    assert "researchIntakeApproveOpenCrabRunner" in html
    assert "function approveResearchIntakeOpenCrabRunner" in boot
    assert "/api/research-intake/approve-opencrab-runner" in boot
    assert "APPROVE_OPENCRAB_CONNECTOR_RUNNER" in boot


def _record_opencrab_runner_approval_for_preflight(routes, package_dir):
    handler = DummyHandler()
    routes._handle_research_intake_approve_opencrab_runner(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "runner_mode": "live",
        "approval_phrase": "APPROVE_OPENCRAB_CONNECTOR_RUNNER",
        "approver": "test-user",
    })
    assert handler.status == 200
    return handler.json_payload()


def test_research_intake_opencrab_live_runner_preflight_verifies_checksum_sources_without_mutation(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    _write_live_contract_for_runner_gate(package_dir)
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    approval_payload = _record_opencrab_runner_approval_for_preflight(routes, package_dir)
    handler = DummyHandler()
    routes._handle_research_intake_preflight_opencrab_runner(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "runner_mode": "live",
        "expected_payload_sha256": approval_payload["payload_sha256"],
        "operator": "test-user",
    })

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["ok"] is True
    assert payload["status"] == "opencrab_live_runner_preflight_verified"
    assert payload["payload_sha256"] == approval_payload["payload_sha256"]
    assert payload["verified"]["checksum"] is True
    assert payload["verified"]["allowlist"] is True
    assert payload["verified"]["source_counts"] == {"claims": 1, "nodes": 1, "evidence": 1}
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    preflight = json.loads((package_dir / "promotion" / "opencrab_live_runner_preflight.json").read_text(encoding="utf-8"))
    assert preflight["ready_for_live_runner"] is True
    assert preflight["external_mutations_performed"] == []
    assert "mcp.opencrab.com" not in json.dumps(preflight)


def test_research_intake_opencrab_live_runner_preflight_rejects_checksum_mismatch(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    _write_live_contract_for_runner_gate(package_dir)
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    _record_opencrab_runner_approval_for_preflight(routes, package_dir)
    approval_path = package_dir / "promotion" / "opencrab_runner_approval.json"
    approval = json.loads(approval_path.read_text(encoding="utf-8"))
    approval["payload_sha256"] = "0" * 64
    approval_path.write_text(json.dumps(approval), encoding="utf-8")
    handler = DummyHandler()
    routes._handle_research_intake_preflight_opencrab_runner(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "runner_mode": "live",
    })

    payload = handler.json_payload()
    assert handler.status == 409
    assert "checksum" in payload["error"]
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}


def test_research_intake_opencrab_live_runner_preflight_ui_controls_exist():
    html = read("static/index.html")
    boot = read("static/boot.js")
    assert "researchIntakePreflightOpenCrabRunner" in html
    assert "function preflightResearchIntakeOpenCrabRunner" in boot
    assert "/api/research-intake/preflight-opencrab-runner" in boot
    assert "opencrab_live_runner_preflight" in boot


def _prepare_preflight_for_live_stub(routes, package_dir):
    approval_payload = _record_opencrab_runner_approval_for_preflight(routes, package_dir)
    handler = DummyHandler()
    routes._handle_research_intake_preflight_opencrab_runner(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "runner_mode": "live",
        "expected_payload_sha256": approval_payload["payload_sha256"],
        "operator": "test-user",
    })
    assert handler.status == 200
    return handler.json_payload()


def test_research_intake_paperclip_opencrab_live_runner_stub_requires_preflight_and_records_schema_without_mutation(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    _write_live_contract_for_runner_gate(package_dir)
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    preflight = _prepare_preflight_for_live_stub(routes, package_dir)
    handler = DummyHandler()
    routes._handle_research_intake_run_opencrab_live_stub(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "runner_mode": "stub",
        "expected_payload_sha256": preflight["payload_sha256"],
        "operator": "test-user",
    })

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["ok"] is True
    assert payload["status"] == "opencrab_live_runner_stub_ready"
    assert payload["connector"] == "paperclip_opencrab_plugin"
    assert payload["payload_sha256"] == preflight["payload_sha256"]
    assert payload["request_schema"]["tool"] == "paperclip.opencrab.sync_research_intake"
    assert payload["response_schema"]["expected_status"] == "opencrab_sync_completed"
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    result = json.loads((package_dir / "promotion" / "opencrab_live_runner_stub_result.json").read_text(encoding="utf-8"))
    assert result["would_call"]["connector"] == "paperclip_opencrab_plugin"
    assert result["would_call"]["payload_sha256"] == preflight["payload_sha256"]
    assert result["external_mutations_performed"] == []
    assert "mcp.opencrab.com" not in json.dumps(result)


def test_research_intake_paperclip_opencrab_live_runner_stub_rejects_missing_preflight(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    _write_live_contract_for_runner_gate(package_dir)
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    _record_opencrab_runner_approval_for_preflight(routes, package_dir)
    handler = DummyHandler()
    routes._handle_research_intake_run_opencrab_live_stub(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "runner_mode": "stub",
    })

    payload = handler.json_payload()
    assert handler.status == 409
    assert "preflight" in payload["error"]
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}


def test_research_intake_paperclip_opencrab_live_runner_stub_ui_controls_exist():
    html = read("static/index.html")
    boot = read("static/boot.js")
    assert "researchIntakeRunOpenCrabLiveStub" in html
    assert "function runResearchIntakeOpenCrabLiveStub" in boot
    assert "/api/research-intake/run-opencrab-live-stub" in boot
    assert "opencrab_live_runner_stub_result" in boot


def _prepare_live_stub_for_final_approval(routes, package_dir):
    preflight = _prepare_preflight_for_live_stub(routes, package_dir)
    handler = DummyHandler()
    routes._handle_research_intake_run_opencrab_live_stub(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "runner_mode": "stub",
        "expected_payload_sha256": preflight["payload_sha256"],
        "operator": "test-user",
    })
    assert handler.status == 200
    return handler.json_payload()


def test_research_intake_paperclip_opencrab_live_final_approval_prompt_requires_stub_and_records_phrase_without_mutation(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    _write_live_contract_for_runner_gate(package_dir)
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    stub = _prepare_live_stub_for_final_approval(routes, package_dir)
    handler = DummyHandler()
    routes._handle_research_intake_opencrab_live_final_approval_prompt(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "expected_payload_sha256": stub["payload_sha256"],
        "requester": "test-user",
    })

    payload = handler.json_payload()
    assert handler.status == 200
    assert payload["ok"] is True
    assert payload["status"] == "opencrab_live_final_approval_prompt_ready"
    assert payload["approval_phrase"] == "EXECUTE_PAPERCLIP_OPENCRAB_LIVE_SYNC"
    assert payload["connector"] == "paperclip_opencrab_plugin"
    assert payload["payload_sha256"] == stub["payload_sha256"]
    assert payload["mutation_scope"] == {"opencrab_sync": True, "neo4j_write": False, "paperclip_reflection": False}
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    prompt = json.loads((package_dir / "promotion" / "opencrab_live_runner_final_approval_prompt.json").read_text(encoding="utf-8"))
    assert prompt["approval_phrase"] == "EXECUTE_PAPERCLIP_OPENCRAB_LIVE_SYNC"
    assert prompt["stub_result_path"].endswith("opencrab_live_runner_stub_result.json")
    assert prompt["requires_explicit_user_approval"] is True
    assert "mcp.opencrab.com" not in json.dumps(prompt)


def test_research_intake_paperclip_opencrab_live_final_approval_prompt_rejects_missing_stub(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    _write_live_contract_for_runner_gate(package_dir)
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    _prepare_preflight_for_live_stub(routes, package_dir)
    handler = DummyHandler()
    routes._handle_research_intake_opencrab_live_final_approval_prompt(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
    })

    payload = handler.json_payload()
    assert handler.status == 409
    assert "stub" in payload["error"]
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}


def test_research_intake_paperclip_opencrab_live_final_approval_prompt_ui_controls_exist():
    html = read("static/index.html")
    boot = read("static/boot.js")
    assert "researchIntakeOpenCrabLiveFinalApprovalPrompt" in html
    assert "function createResearchIntakeOpenCrabLiveFinalApprovalPrompt" in boot
    assert "/api/research-intake/opencrab-live-final-approval-prompt" in boot
    assert "EXECUTE_PAPERCLIP_OPENCRAB_LIVE_SYNC" in boot


def _prepare_final_approval_for_execution_gate(routes, package_dir):
    stub = _prepare_live_stub_for_final_approval(routes, package_dir)
    handler = DummyHandler()
    routes._handle_research_intake_opencrab_live_final_approval_prompt(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "expected_payload_sha256": stub["payload_sha256"],
        "requester": "test-user",
    })
    assert handler.status == 200
    return handler.json_payload()


def test_research_intake_paperclip_opencrab_live_execution_gate_locks_when_feature_flag_off(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    _write_live_contract_for_runner_gate(package_dir)
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    monkeypatch.delenv("HERMES_OPENCRAB_ENABLE_LIVE_RUNNER", raising=False)
    prompt = _prepare_final_approval_for_execution_gate(routes, package_dir)
    handler = DummyHandler()
    routes._handle_research_intake_opencrab_live_execution_gate(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "approval_phrase": "EXECUTE_PAPERCLIP_OPENCRAB_LIVE_SYNC",
        "expected_payload_sha256": prompt["payload_sha256"],
        "operator": "test-user",
    })

    payload = handler.json_payload()
    assert handler.status == 423
    assert payload["status"] == "opencrab_live_runner_locked"
    assert payload["feature_flag"] == "HERMES_OPENCRAB_ENABLE_LIVE_RUNNER"
    assert payload["would_request"]["tool"] == "paperclip.opencrab.sync_research_intake"
    assert payload["payload_sha256"] == prompt["payload_sha256"]
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}
    gate = json.loads((package_dir / "promotion" / "opencrab_live_runner_execution_gate.json").read_text(encoding="utf-8"))
    assert gate["locked"] is True
    assert gate["feature_flag_enabled"] is False
    assert gate["approval_phrase_verified"] is True
    assert "mcp.opencrab.com" not in json.dumps(gate)


def test_research_intake_paperclip_opencrab_live_execution_gate_rejects_wrong_phrase(tmp_path, monkeypatch):
    import api.routes as routes

    package_dir = _prepare_opencrab_execution_package(tmp_path)
    _write_live_contract_for_runner_gate(package_dir)
    monkeypatch.setattr(routes, "STATE_DIR", tmp_path)
    prompt = _prepare_final_approval_for_execution_gate(routes, package_dir)
    handler = DummyHandler()
    routes._handle_research_intake_opencrab_live_execution_gate(handler, {
        "package_id": "research-intake-test-package",
        "connector": "paperclip_opencrab_plugin",
        "approval_phrase": "WRONG",
        "expected_payload_sha256": prompt["payload_sha256"],
    })

    payload = handler.json_payload()
    assert handler.status == 403
    assert "approval phrase" in payload["error"]
    assert payload["external_mutations"] == {"opencrab_sync": False, "neo4j_write": False, "paperclip_reflection": False}


def test_research_intake_paperclip_opencrab_live_execution_gate_ui_controls_exist():
    html = read("static/index.html")
    boot = read("static/boot.js")
    assert "researchIntakeOpenCrabLiveExecutionGate" in html
    assert "function createResearchIntakeOpenCrabLiveExecutionGate" in boot
    assert "/api/research-intake/opencrab-live-execution-gate" in boot
    assert "HERMES_OPENCRAB_ENABLE_LIVE_RUNNER" in boot
