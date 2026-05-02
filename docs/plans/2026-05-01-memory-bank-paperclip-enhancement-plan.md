# Memory Bank-Inspired Hermes/Paperclip Enhancement Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task after CEO approval.

**Goal:** Use the ideas from `jung-wan-kim/memory-bank` to improve Hermes WebUI recall, project-scoped memory, and Paperclip execution governance without automatically writing to Paperclip or polluting durable memory.

**Architecture:** Keep Hermes as the source-of-truth interface. Add a lightweight `facts` layer inside Hermes WebUI first, backed by local JSON/SQLite and explicit approval flows. Do not import Memory Bank wholesale. Instead, adopt its strongest primitives: candidate fact extraction, scope isolation, provenance, consolidation, cross-project insights, and graph-like relation metadata.

**Tech Stack:** Python WebUI API, existing Hermes `state.db` bridge, WebUI static JS panels, existing memory/session_search tools, optional future SQLite FTS/vector layer. No mandatory Node/TypeScript/Claude plugin dependency in Phase 1.

---

## Executive Direction

Memory Bank's useful model is:

1. conversations become searchable knowledge;
2. extracted facts are typed;
3. facts have scope;
4. facts can evolve, supersede, contradict, or support each other;
5. facts cite the source conversation;
6. cross-project recall is possible but should be controlled.

For FMG/Hermes, the safer operating model is:

1. extract candidates, not automatic durable memories;
2. require approval before durable memory, Telegram send, or Paperclip reflection;
3. preserve Telegram group/project scope;
4. convert approved decisions into Paperclip execution structure;
5. keep raw discussion out of Paperclip unless explicitly requested.

---

## Current Grounding

Observed Hermes WebUI structure:

- `api/state_sync.py` mirrors WebUI session metadata into Hermes Agent `state.db` when `sync_to_insights` is enabled.
- `api/models.py` already has a CLI session bridge via `get_cli_sessions()` and `get_cli_session_messages()`.
- `api/routes.py::_handle_sessions_search()` currently does title/content substring search over WebUI sessions only; it is not semantic and does not return rich snippets/provenance.
- `static/messages.js` already supports command approval cards.
- `static/boot.js` already has Paperclip Decision Report prompt wiring.
- `paperclip-ops-pack/` exists conceptually in setup packs and should remain the approval hard gate for Paperclip reflection.

Memory Bank reference features:

- `search`, `read`, `search_facts`, `search_ontology`, `ask_avatar`, `trace_fact`, `graph_stats`, `cross_project_insights`, `explore_graph` MCP tools.
- fact categories: `decision`, `preference`, `pattern`, `knowledge`, `constraint`.
- relation classes: `DUPLICATE`, `CONTRADICTION`, `EVOLUTION`, `INDEPENDENT`; graph relations such as `INFLUENCES`, `SUPPORTS`, `SUPERSEDES`, `CONTRADICTS`.
- SessionStart / SessionEnd / UserPromptSubmit hooks for sync, injection, extraction, consolidation.

---

## Recommended Product Shape

### New Concept 1: Memory Candidate Inbox

Purpose:
- At the end of an important discussion, Hermes proposes candidate facts.
- Nothing is saved to durable memory automatically.
- User approves, edits, rejects, or scopes each fact.

Candidate fields:

```json
{
  "id": "cand_...",
  "category": "decision | preference | pattern | knowledge | constraint",
  "scope": "global | company | project | telegram_group | workspace | profile",
  "scope_ref": "FMG | FMGmembers | 조계종 | /path/to/workspace | default",
  "statement": "User prefers ...",
  "source_session_id": "...",
  "source_message_ids": ["..."],
  "confidence": 0.0,
  "sensitivity": "public | internal | confidential",
  "recommended_action": "approve | edit | reject | paperclip_draft_only",
  "reason": "Why this is durable enough"
}
```

Key rule:
- The user decides what becomes long-term memory.

### New Concept 2: Scoped Fact Store

Purpose:
- Keep durable operational knowledge separate from raw memory injection.
- Store scope, provenance, and relation metadata.

Minimum viable fields:

```json
{
  "id": "fact_...",
  "category": "decision",
  "scope": "project",
  "scope_ref": "venturepass-ai-patent",
  "statement": "VenturePass AI Patent uses Supabase project ...",
  "source_session_id": "...",
  "created_at": 0,
  "updated_at": 0,
  "status": "active | superseded | rejected",
  "relations": [
    {"type": "SUPPORTS", "target_fact_id": "fact_..."}
  ]
}
```

Initial storage option:
- `~/.hermes/webui/facts/facts.jsonl`
- `~/.hermes/webui/facts/candidates.jsonl`

Future storage option:
- SQLite table in WebUI state DB or Hermes Agent `state.db` extension.

### New Concept 3: Paperclip Decision Intelligence

Purpose:
- Upgrade Paperclip workflow from "write an issue" to "decision lineage + execution clarity".

Decision Report should include:

1. Discussion summary
2. Confirmed decision
3. Candidate facts extracted
4. Facts that support the decision
5. Facts that contradict or supersede prior direction
6. Execution issues to create/update
7. Acceptance criteria
8. Exclusions
9. Approval state

Paperclip write remains gated:
- No issue/comment/status update without explicit approval.

### New Concept 4: Cross-Project Insight, Explicit Only

Purpose:
- Use previous projects as examples without breaking scope boundaries.

Default behavior:
- Do not use cross-project context in Telegram group with assigned project scope.

Explicit behavior:
- If user asks "다른 프로젝트 사례도 봐줘", run cross-project insight.

Output format:

```markdown
Cross-project references:
1. Source project:
   - relevant decision:
   - why it may apply:
   - why it may not apply:
   - source:
```

---

## Implementation Plan

## Phase 0: No-Risk Planning Pack

### Task 0.1: Create adoption pack document set

**Objective:** Add canonical docs for Memory Bank-inspired Hermes/Paperclip enhancement.

**Files:**
- Create: `memory-bank-adoption-pack/README.md`
- Create: `memory-bank-adoption-pack/design/fact-lifecycle.md`
- Create: `memory-bank-adoption-pack/design/scoped-facts.md`
- Create: `memory-bank-adoption-pack/design/paperclip-decision-intelligence.md`
- Create: `memory-bank-adoption-pack/templates/memory-candidate-review.md`
- Create: `memory-bank-adoption-pack/templates/paperclip-decision-intelligence-report.md`
- Modify: `docs/setup-packs.md`

**Verification:**

```bash
find memory-bank-adoption-pack -type f | sort
python3 - <<'PY'
from pathlib import Path
for p in Path('memory-bank-adoption-pack').rglob('*'):
    if p.is_file():
        txt=p.read_text()
        assert 'approval' in txt.lower() or '승인' in txt
print('ok')
PY
```

**Expected result:**
- A safe, non-executing adoption pack exists.
- Team can review direction before code changes.

---

## Phase 1: Memory Candidate Inbox MVP

### Task 1.1: Add data model helpers

**Objective:** Create additive Python helpers for candidate/fact JSONL storage.

**Files:**
- Create: `api/facts.py`
- Test: `tests/test_facts_store.py`

**Core functions:**

```python
def create_candidate(category, scope, scope_ref, statement, source_session_id=None, source_message_ids=None, confidence=None, reason=None): ...
def list_candidates(status='pending', scope=None, scope_ref=None): ...
def approve_candidate(candidate_id, edited_statement=None): ...
def reject_candidate(candidate_id, reason=None): ...
def list_facts(scope=None, scope_ref=None, category=None, query=None): ...
```

**Storage paths:**
- `~/.hermes/webui/facts/candidates.jsonl`
- `~/.hermes/webui/facts/facts.jsonl`

**Test cases:**
- candidate is created with status `pending`
- approval creates active fact with provenance
- rejection does not create fact
- scope filter works
- malformed JSONL lines are skipped, not fatal

**Expected result:**
- No UI yet.
- No memory tool write yet.
- Safe local fact candidate storage works.

### Task 1.2: Add API endpoints

**Objective:** Expose candidate/fact operations to WebUI.

**Files:**
- Modify: `api/routes.py`
- Test: `tests/test_fact_routes.py`

**Endpoints:**

```text
GET  /api/facts
GET  /api/memory-candidates
POST /api/memory-candidates
POST /api/memory-candidates/approve
POST /api/memory-candidates/reject
```

**Safety:**
- Endpoints only write local candidate/fact store.
- No Paperclip write.
- No Telegram send.
- No durable Hermes memory write until later explicit bridge.

**Expected result:**
- Browser can load and approve/reject candidate facts.

### Task 1.3: Add WebUI panel

**Objective:** Add a "Memory Inbox" panel to the CEO console.

**Files:**
- Modify: `static/index.html`
- Modify: `static/panels.js`
- Create: `static/facts.js`
- Modify: `static/style.css`

**UI behaviors:**
- Show pending candidates.
- Allow edit/approve/reject.
- Show source session id and scope.
- Show "Paperclip draft only" marker if candidate is not durable memory.

**Expected result:**
- CEO can review extracted decisions before memory persistence.

### Task 1.4: Add manual extraction prompt button

**Objective:** Add a quick action that asks Hermes to produce candidate facts from the current conversation.

**Files:**
- Modify: `static/boot.js`
- Modify: `static/index.html`

**Prompt behavior:**
- The agent returns JSON candidate facts.
- The agent is instructed not to call memory or Paperclip.
- User can then paste/save candidates via API or future structured action.

**Expected result:**
- Low-risk candidate extraction without background automation.

---

## Phase 2: Session Search and Provenance Upgrade

### Task 2.1: Improve `/api/sessions/search`

**Objective:** Add better recall before semantic search.

**Files:**
- Modify: `api/routes.py::_handle_sessions_search`
- Test: `tests/test_sessions_search.py`

**New query params:**

```text
q=...
content=1
source=webui|cli|all
profile=...
workspace=...
project_id=...
limit=50
snippet=1
```

**Expected result:**
- Search returns matched snippets and source metadata.
- CLI sessions are searchable if `show_cli_sessions=true`.

### Task 2.2: Add source-session reader for facts

**Objective:** Make each fact traceable to original session/message.

**Files:**
- Modify: `api/facts.py`
- Modify: `api/routes.py`
- Modify: `static/facts.js`

**New endpoint:**

```text
GET /api/facts/trace?id=fact_...
```

**Expected result:**
- User can inspect why a fact exists.

---

## Phase 3: Paperclip Decision Intelligence

### Task 3.1: Add Decision Intelligence report template

**Objective:** Extend Paperclip Ops Pack with memory/provenance-aware decision reporting.

**Files:**
- Create: `paperclip-ops-pack/templates/decision-intelligence-report-template.md`
- Modify: `paperclip-ops-pack/README.md`
- Modify: `docs/setup-packs.md`

**Template sections:**

```markdown
# Decision Intelligence Report

## 1. Executive Summary
## 2. Final Decision
## 3. Source Discussion
## 4. Supporting Facts
## 5. Conflicting / Superseded Facts
## 6. Execution Scope
## 7. Paperclip Reflection Plan
## 8. Exclusions
## 9. Approval Gate
```

**Expected result:**
- Paperclip decisions can cite source and prior context.

### Task 3.2: Add Paperclip preview/dry-run object

**Objective:** Before writing to Paperclip, generate a machine-readable dry-run plan.

**Files:**
- Create: `api/paperclip_preview.py`
- Test: `tests/test_paperclip_preview.py`

**Dry-run schema:**

```json
{
  "target_company": "FMG",
  "target_project": "...",
  "reflection_type": "comment | new_issue | issue_update | epic_with_children",
  "source_session_id": "...",
  "decision_summary": "...",
  "issues": [
    {"title": "...", "body": "...", "done_criteria": ["..."]}
  ],
  "excluded": ["raw transcript", "unapproved ideas"],
  "approval_required": true
}
```

**Expected result:**
- User sees exactly what would be written.
- No Paperclip write happens yet.

### Task 3.3: Wire dry-run into WebUI Paperclip console

**Objective:** Show Paperclip reflection preview before execution.

**Files:**
- Modify: `static/index.html`
- Modify: `static/panels.js`
- Modify: `static/style.css`

**Expected result:**
- CEO sees pending reflection plan and must approve.

---

## Phase 4: Optional Semantic Layer

### Task 4.1: Design-only semantic backend choice

**Objective:** Decide whether to use native Hermes `session_search`, SQLite FTS, sqlite-vec, or an external Memory Bank MCP.

**Recommendation:**
- Start with SQLite FTS, not sqlite-vec.
- Add sqlite-vec only after proving user value.
- Do not run a second Memory Bank MCP as default.

**Expected result:**
- Avoid dependency bloat and duplicated memory systems.

---

## Simulated Outcomes

## Simulation A: Telegram discussion to Paperclip execution

### Input conversation

User:
"Pax Team Group 논의 내용을 보면 ShareNote + Telegram Pack은 일단 문서/도우미 중심으로 적용하고, 실제 Telegram 전송은 승인 후만 하자. Paperclip에는 실행 이슈로 정리하고 싶어."

### Memory Candidate Inbox output

```json
[
  {
    "category": "decision",
    "scope": "project",
    "scope_ref": "hermes-for-web",
    "statement": "ShareNote + Telegram Pack should remain documentation/helper driven, while actual Telegram delivery requires explicit approval.",
    "confidence": 0.91,
    "recommended_action": "approve",
    "reason": "This is a durable workflow rule, not temporary progress."
  },
  {
    "category": "constraint",
    "scope": "company",
    "scope_ref": "FMG",
    "statement": "Paperclip execution records must be created only after explicit execution approval.",
    "confidence": 0.97,
    "recommended_action": "approve",
    "reason": "Matches existing operating policy."
  }
]
```

### Decision Intelligence Report preview

```markdown
# Decision Intelligence Report

## Executive Summary
ShareNote + Telegram Pack will be treated as a publishing helper workflow. It can create notes, generate ShareNote links, and draft Telegram messages, but it must not send Telegram messages automatically.

## Final Decision
Proceed with helper-first implementation and approval-gated Telegram/Paperclip execution.

## Supporting Facts
- User prefers Paperclip reflection only after explicit approval.
- Pax Team Group is the default team delivery target unless otherwise specified.

## Execution Scope
1. Add ShareNote helper docs and scripts.
2. Add prepublish checklist.
3. Add Telegram draft step.
4. Add Paperclip dry-run preview.

## Paperclip Reflection Plan
Reflection type: epic_with_children
Target: FMG / Hermes WebUI
Child issues:
- Build Memory Candidate Inbox MVP
- Add Paperclip Decision Intelligence Report template
- Improve session search provenance

## Approval Gate
Status: not approved.
```

### Paperclip result if approved

- Parent epic: "Hermes Memory/Paperclip Decision Intelligence Upgrade"
- Child issue 1: "Add Memory Candidate Inbox MVP"
- Child issue 2: "Add scoped fact store and provenance"
- Child issue 3: "Add Paperclip Decision Intelligence dry-run preview"
- Child issue 4: "Improve session search with snippets and CLI/WebUI coverage"

### Paperclip result before approval

No write.
Only preview is shown.

---

## Simulation B: Conflicting direction detected

### Prior fact

```json
{
  "category": "constraint",
  "scope": "company",
  "scope_ref": "FMG",
  "statement": "Telegram discussions must not automatically update Paperclip."
}
```

### New user request

"앞으로 Telegram에서 결정된 건 바로 Paperclip에 반영되게 해줘."

### System output

```markdown
충돌 감지:
- 기존 운영 원칙: Telegram 논의는 Paperclip 업데이트가 아니며, 명시 승인 후에만 반영.
- 새 요청: Telegram 결정사항을 자동 반영.

추천 처리:
1. 기존 원칙을 유지하고, 자동 반영 대신 자동 draft 생성만 허용.
2. 정말 자동 반영으로 정책을 바꾸려면 `SUPERSEDES` 관계로 기존 원칙을 폐기 처리해야 함.

승인 필요:
- 이 변경은 Paperclip 운영 정책 변경이므로 명시 승인 없이는 적용하지 않음.
```

### Expected effect

- Prevents accidental policy regression.
- Forces explicit governance change.

---

## Simulation C: Cross-project insight request

### User asks

"이 Paperclip workflow를 VenturePass 때 했던 방식과 비교해줘."

### Output

```markdown
Cross-project insight requested explicitly, so scope expansion is allowed for this answer.

1. VenturePass AI Patent
   - Relevant pattern: GitHub/Supabase/Vercel state was recorded as durable project fact.
   - Applicable: deployment and repo identifiers should be stored as scoped project facts.
   - Not applicable: product-specific Supabase ref should not leak into other projects.

2. Hermes WebUI
   - Recommended transfer: record repo path, live URL, and approval gates as project-scoped facts.
```

### Expected effect

- Cross-project knowledge transfer happens only when requested.
- Scope boundaries remain intact.

---

## Simulation D: Memory candidate rejection

### Candidate

```json
{
  "category": "knowledge",
  "statement": "The user is currently editing sharenote-telegram-pack scripts.",
  "recommended_action": "reject"
}
```

### Reason

This is task progress, not durable knowledge.

### Expected effect

- Prevents memory pollution.
- Keeps durable memory focused.

---

## What This Will Produce

### User-facing results

1. Better recall:
   - "우리가 이걸 왜 결정했지?"에 출처와 함께 답변.
2. Safer memory:
   - 자동 저장이 아니라 후보 승인 구조.
3. Stronger Paperclip execution:
   - decision report, supporting facts, conflict checks, execution issues, approval gate.
4. Reduced repeated steering:
   - project-specific rules and prior decisions become reusable.
5. Better scope safety:
   - Telegram group/project scope remains bounded.

### Internal outputs

1. `memory-bank-adoption-pack/` docs.
2. `api/facts.py` candidate/fact store.
3. `static/facts.js` Memory Inbox panel.
4. Enhanced `/api/sessions/search`.
5. `paperclip-ops-pack/templates/decision-intelligence-report-template.md`.
6. Optional future SQLite FTS/vector search.

---

## Risks and Controls

### Risk 1: Memory pollution

Control:
- Candidate Inbox only.
- Explicit approve/edit/reject.
- Reject task progress by default.

### Risk 2: Paperclip accidental writes

Control:
- Dry-run preview first.
- Explicit approval required.
- Reflection gate remains hard rule.

### Risk 3: Cross-project leakage

Control:
- Scope filter default on.
- Cross-project insights explicit only.
- Telegram group mappings override general memory.

### Risk 4: Dependency bloat

Control:
- Do not import Memory Bank Node stack initially.
- Use JSONL/SQLite FTS before sqlite-vec.

### Risk 5: UI complexity

Control:
- Add Memory Inbox under MORE or Paperclip console, not primary chat.
- Keep CEO summary-first layout.

---

## Recommended First Execution Batch

Batch 1 should be documentation + data model only:

1. Create `memory-bank-adoption-pack/` docs.
2. Create `api/facts.py` JSONL store.
3. Add tests for candidate approval/rejection/scope.
4. Add API endpoints.
5. Add a minimal Memory Inbox UI.

Do not do in Batch 1:
- semantic vector search;
- automatic session-end extraction;
- automatic memory writes;
- automatic Paperclip writes;
- external Memory Bank MCP registration.

---

## Approval Needed Before Execution

This plan does not write to Paperclip.

Before implementation, confirm:

1. Should Batch 1 be implemented in the original repo `hermes-for-web`, or in the independent repo `hermes-for-web-ceo-console`?
2. Should the first implementation include UI, or only backend + docs?
3. Should approved facts write only to local `facts.jsonl` first, or also propose `memory` tool writes after user approval?

Recommended default:
- implement in independent repo first;
- include backend + minimal UI;
- keep approved facts in local fact store first;
- add memory tool bridge only after testing quality.
