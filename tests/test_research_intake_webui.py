from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def test_research_intake_routes_are_registered():
    routes = read("api/routes.py")
    assert "/api/research-intake/image-draft" in routes
    assert "/api/research-intake/review" in routes
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
