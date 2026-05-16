"""OpenCrab Connector MVP tests: status redaction and LocalCrab ingest package output."""
import json
from pathlib import Path


def test_redact_opencrab_endpoint_masks_api_mcp_key():
    from api.opencrab_connector import redact_opencrab_endpoint

    secret_suffix = "unit-test-secret"
    raw = "https://opencrab.sh/api/mcp/" + secret_suffix

    assert redact_opencrab_endpoint(raw) == "https://opencrab.sh/api/mcp/[REDACTED]"
    assert secret_suffix not in redact_opencrab_endpoint(raw)


def test_build_status_from_config_never_exposes_raw_mcp_endpoint(tmp_path):
    from api.opencrab_connector import build_opencrab_status

    config_path = tmp_path / "config.yaml"
    endpoint = "https://opencrab.sh/api/mcp/" + "test-secret-token"
    config_path.write_text(
        "mcp_servers:\n"
        "  opencrab:\n"
        f"    url: {endpoint}\n",
        encoding="utf-8",
    )

    status = build_opencrab_status(config_path=config_path, paperclip_base_url="http://127.0.0.1:9")
    rendered = json.dumps(status, ensure_ascii=False)

    assert status["hermes_mcp"]["configured"] is True
    assert status["hermes_mcp"]["endpoint"] == "https://opencrab.sh/api/mcp/[REDACTED]"
    assert "test-secret-token" not in rendered
    assert "https://opencrab.sh/api/mcp/" + "test-secret-token" not in rendered


def test_create_ingest_package_from_local_markdown_file(tmp_path):
    from api.opencrab_connector import create_ingest_package

    source = tmp_path / "source.md"
    source.write_text("# LocalCrab\n\nOpenCrab Connector creates ingest packages.\n", encoding="utf-8")
    out_root = tmp_path / "packages"

    package = create_ingest_package(source_path=source, output_root=out_root, workspace=tmp_path)

    package_dir = Path(package["package_dir"])
    assert package["ok"] is True
    assert package["status"] == "draft"
    assert package["approval_required"] is True
    assert package["neo4j_write"] is False
    assert package["opencrab_sync"] is False
    assert package_dir.exists()

    expected = [
        "manifest.json",
        "source/source.md",
        "extracted/chunks.jsonl",
        "extracted/metadata.json",
        "ontology/nodes.jsonl",
        "ontology/edges.jsonl",
        "ontology/claims.jsonl",
        "ontology/evidence.jsonl",
        "validation/schema_report.json",
        "validation/quality_report.json",
        "promotion/approval_request.json",
    ]
    for rel in expected:
        assert (package_dir / rel).exists(), rel

    manifest = json.loads((package_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["source"]["name"] == "source.md"
    assert manifest["status"] == "draft"

    approval = json.loads((package_dir / "promotion/approval_request.json").read_text(encoding="utf-8"))
    assert approval["requires_explicit_approval"] is True
    assert approval["blocked_actions"] == ["neo4j_write", "opencrab_sync"]
