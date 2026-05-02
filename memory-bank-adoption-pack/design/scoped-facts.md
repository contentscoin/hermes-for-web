# Scoped Facts

Scope values
- global
- company
- project
- telegram_group
- workspace
- profile

Scope guard
- Telegram group이 특정 company/project에 묶여 있으면 해당 범위 밖 fact는 기본적으로 사용하지 않는다.
- cross-project insight는 명시 요청이 있을 때만 사용한다.

Storage
- `~/.hermes/webui/facts/candidates.jsonl`
- `~/.hermes/webui/facts/facts.jsonl`
