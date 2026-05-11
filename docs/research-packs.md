# Research Packs

## last30days Pack
Use this pack when you want to inspect recent public reactions over the last 30 days, especially across X/Twitter and Reddit.

Typical use cases:
- X reaction scan for fast public sentiment, viral phrasing, campaign response, or influencer-driven discussion
- Reddit reaction scan for deeper community discussion, user pain points, alternatives, and objections
- compare recent sentiment or discussion patterns across `x`, `reddit`, or `both`
- gather examples before writing a note, marketing brief, product memo, risk scan, or post

Source flags:
- X source flag is `x`
- Reddit source flag is `reddit`
- both sources is `both` and is the default recommendation when the user has not specified a source

Canonical pack files:
- `last30days-pack/README.md`
- `last30days-pack/templates/query-template.md`
- `last30days-pack/templates/output-template.md`
- `last30days-pack/workflows/default-last30days-loop.md`
- `last30days-pack/checklists/source-selection-checklist.md`
- `last30days-pack/scripts/check_last30days_env.py`

Minimum prompt:

```text
last30days로 조사해줘.
주제: [조사 주제]
소스: both
기간: 최근 30일
출력: 한국어 executive brief + source table
```

Required prerequisites:
- Hermes/WebUI research tools or web-search access
- X access path for `x`: `xurl`, X API credential, or a documented web-search fallback
- Reddit access path for `reddit`: Reddit API credential, public web search, or a documented fallback
- explicit source limitations and sampling bias disclosure in the final output
- explicit approval before Paperclip reflection, Telegram delivery, or publishing

## AutoResearch Pack
Use this pack when you want to turn a question into a repeatable research workflow.

Typical goals:
- refine the question
- gather sources
- summarize findings
- suggest next angles
- prepare a note, brief, or posting draft from the research
- run the same question through multiple passes (broad scan → deep dive → structured output)

Recommended workflow:
1. rewrite the user question into a scoped research question
2. define scope / exclusions / target output
3. run a first-pass source gathering step
4. summarize facts, patterns, and open questions
5. choose one or more deepening angles
6. run a second-pass deep dive
7. output as note / brief / posting-ready draft

Helpful expectations:
- this pack should explain what tools are useful before starting
- it should separate facts from interpretation
- it should always leave the user with next questions or next actions

Expected outputs:
- `autoresearch-pack/README.md`
- `autoresearch-pack/templates/research-question-template.md`
- `autoresearch-pack/workflows/default-research-loop.md`
- `autoresearch-pack/checklists/deepening-checklist.md`
- `autoresearch-pack/templates/research-output-template.md`
- `autoresearch-pack/scripts/check_autoresearch_env.py`

Loop decision vocabulary:
- `stop`, `deepen`, `broaden`, `verify`, `convert`, `approval wait`

## Why these are packs
These are not just tools.
They are guided starting points for users who do not want to remember all flags, prompts, or supporting steps.
