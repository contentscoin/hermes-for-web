# ShareNote + Telegram Publishing Pack

Purpose:
Create a safe, repeatable publishing flow from an Obsidian note to a ShareNote URL and then to Telegram.

This pack is approval-gated. It can prepare notes, check plugin readiness, and draft Telegram messages, but it must not publish to Telegram or mutate Paperclip without explicit user approval.

## Verified local assumptions on this machine

- Obsidian app exists at `/Applications/Obsidian.app`.
- Active Obsidian vault discovered from Obsidian desktop config:
  `/Users/jakeshin/antigravity/devanl 복사본/obsidian-vault`
- Enabled community plugins in that vault include:
  - `share-note` / Share Note
  - `obsidian-advanced-uri` / Advanced URI
  - `obsidian-git`
- Share Note is configured with yaml field `share`, server `https://api.note.sx`, clipboard enabled, and credentials redacted.
- Telegram delivery targets available through Hermes include:
  - `telegram:홈원` dm
  - `telegram:Pax Team Group` group
  - `telegram:조계종` group
  - bare `telegram` home target

## Canonical flow

1. Create or select an Obsidian note.
2. Use Advanced URI to open the note in Obsidian when operator review is needed.
3. Use the Share Note plugin inside Obsidian to publish/update the note.
4. Confirm the generated ShareNote URL from the note frontmatter field `share` or from the clipboard.
5. Prepare a Telegram message draft with title, short context, and the ShareNote URL.
6. Ask for explicit approval before sending the message to Telegram.

## What can be automated safely

- Detect vault path and plugin presence.
- Create a markdown note draft under the vault.
- Generate an Advanced URI open link for the note.
- Extract an existing ShareNote URL from frontmatter if present.
- Create a Telegram message draft file.

## What needs manual approval or app-level action

- Installing community plugins if missing: Obsidian community plugin installation normally requires user interaction in Obsidian.
- Running the Share Note publish command: Obsidian plugin commands may need local app UI permission, login state, and clipboard access.
- Sending to Telegram: requires explicit approval with target/channel because it posts externally.
- Posting to `조계종`: only when hela / @Paxclawbot is directly mentioned in that group context; otherwise do not proactively send.
- Paperclip reflection: not part of this pack unless separately approved.

## Files in this pack

- `templates/publishing-note-template.md` — note frontmatter/body template.
- `templates/telegram-message-template.md` — Telegram delivery draft template.
- `workflows/default-publishing-flow.md` — operator workflow.
- `checklists/prepublish-checklist.md` — approval and quality gate.
- `scripts/create_sharenote_telegram_draft.py` — local helper to create note + Telegram draft and print Advanced URI.
- `scripts/check_sharenote_env.py` — local helper to verify vault/plugins without exposing secrets.

## Fast usage

```bash
cd /Users/jakeshin/.hermes/webui/workspace/hermes-for-web
python3 sharenote-telegram-pack/scripts/check_sharenote_env.py
python3 sharenote-telegram-pack/scripts/create_sharenote_telegram_draft.py \
  --title "발행할 제목" \
  --summary "텔레그램에 붙일 짧은 요약" \
  --target "telegram:Pax Team Group"
```

The helper writes files only. It does not send Telegram messages.
