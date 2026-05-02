# Setup Packs for Hermes WebUI

This document describes one-click setup pack concepts surfaced inside the WebUI so general users can bootstrap common workflows quickly.

## 1. Obsidian Starter Pack

Goal:
Install and configure the core Obsidian workflow helpers needed for note-centric Hermes usage.

Typical scope:
- verify Obsidian vault path
- install or verify Obsidian CLI availability
- prepare Obsidian-friendly markdown workflow
- verify note creation / search / save flow

## 2. ShareNote + Telegram Publishing Pack

Goal:
Set up the common "note -> ShareNote link -> deliver back to Telegram" workflow.

Typical scope:
- verify ShareNote plugin availability
- verify Obsidian Advanced URI support
- verify local automation helper script
- create or validate share-link generation flow
- ensure final response includes saved path + share URL

Expected outputs:
- `sharenote-telegram-pack/README.md`
- `sharenote-telegram-pack/templates/publishing-note-template.md`
- `sharenote-telegram-pack/templates/telegram-message-template.md`
- `sharenote-telegram-pack/workflows/default-publishing-flow.md`
- `sharenote-telegram-pack/checklists/prepublish-checklist.md`
- `sharenote-telegram-pack/scripts/check_sharenote_env.py`
- `sharenote-telegram-pack/scripts/create_sharenote_telegram_draft.py`

Operator promise:
- The pack must not send Telegram messages automatically.
- It must prepare a note, ShareNote link confirmation path, and Telegram draft first.
- It must require explicit approval for the exact Telegram target and message before delivery.
- It must not expose ShareNote credentials, Telegram tokens, or private API keys.

## 3. Obsidian Power Workflow Pack

Goal:
Combine note creation, posting, ShareNote, and Telegram handoff into a reusable publishing workflow.

Typical scope:
- note templates
- posting workflow defaults
- share-link generation
- Telegram-friendly result handoff
- optional memory / skill setup

## 4. Paperclip Ops Pack

Goal:
Lock the real operating workflow between Telegram discussion and Paperclip execution so the agent always prepares a structured decision report, waits for explicit approval, and records the final execution cleanly.

Typical scope:
- create or upgrade a reusable Decision Report template
- define approval phrase rules (what counts / what does not count)
- define pre-reflection checklist
- define post-reflection logging format
- separate templates for comment / issue create / issue update
- align role-routing rules with hela-as-hub operations
- keep "approval before reflection" as a hard gate

Expected outputs:
- `paperclip-ops-pack/README.md`
- `paperclip-ops-pack/templates/decision-report-template.md`
- `paperclip-ops-pack/templates/paperclip-comment-template.md`
- `paperclip-ops-pack/templates/executable-issue-template.md`
- `paperclip-ops-pack/templates/issue-update-template.md`
- `paperclip-ops-pack/rules/approval-phrase-rules.md`
- `paperclip-ops-pack/checklists/reflection-lifecycle.md`
- legacy shortcut docs updated at workspace root

Operator promise:
- The pack must not write to Paperclip automatically.
- It must produce a result report first.
- It must require explicit execution approval before any Paperclip reflection.
- It must keep the canonical source under `paperclip-ops-pack/`.
- After execution, it must record identifiers and final state cleanly.

## 5. AutoResearch Pack

Goal:
Turn an open-ended research question into a repeatable broad-scan → synthesis → deep-dive workflow.

Typical scope:
- refine the user's raw question into a scoped research question
- define included/excluded sources, time range, and target output
- guide a first broad scan across web, social/community, academic, and source-specific tools
- separate facts, interpretations, hypotheses, and unknowns
- propose deepening angles and run follow-up passes
- produce a reusable research brief, decision memo, note, or posting draft

Expected outputs:
- `autoresearch-pack/README.md`
- `autoresearch-pack/templates/research-question-template.md`
- `autoresearch-pack/templates/research-output-template.md`
- `autoresearch-pack/workflows/default-research-loop.md`
- `autoresearch-pack/checklists/deepening-checklist.md`

Operator promise:
- The pack must not claim certainty beyond the available evidence.
- It must separate source-backed facts from interpretation.
- It must state unknowns and recommended next questions.
- If a result needs Paperclip reflection, it must stop for explicit execution approval first.

## UI expectation

The WebUI setup packs should not silently mutate the system. Instead, one-click setup buttons should launch a structured Hermes task that:
1. inspects the environment
2. explains what will be installed or configured
3. performs the setup through the normal toolchain
4. reports what succeeded, what failed, and what needs approval

This keeps the feature broadly usable across different user machines and safer for GitHub distribution.


## Memory Bank Adoption Pack

Goal: Memory Bank의 후보 추출, scope, provenance, approval gate 개념을 Hermes WebUI/Paperclip 운영에 안전하게 적용합니다.

Expected outputs:
- `memory-bank-adoption-pack/README.md`
- `memory-bank-adoption-pack/design/fact-lifecycle.md`
- `memory-bank-adoption-pack/design/scoped-facts.md`
- `memory-bank-adoption-pack/design/paperclip-decision-intelligence.md`
- `memory-bank-adoption-pack/templates/memory-candidate-review.md`
- `memory-bank-adoption-pack/templates/paperclip-decision-intelligence-report.md`

Operator promise:
- 자동 durable memory 저장 없음.
- 자동 Paperclip 반영 없음.
- 자동 Telegram 전송 없음.
- 후보 검토와 실행승인 후에만 다음 단계로 이동.
