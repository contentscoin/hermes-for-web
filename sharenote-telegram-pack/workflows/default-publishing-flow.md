# Default ShareNote + Telegram Publishing Flow

1. Intake
   - Confirm title, intended audience, target Telegram channel, and whether the content is public-share safe.

2. Draft note
   - Create a markdown note in the configured Obsidian vault.
   - Keep `share: ""` empty until Share Note publishes the URL.

3. Operator review
   - Open the note via Advanced URI.
   - User reviews content in Obsidian.

4. ShareNote publish/update
   - Use Obsidian Share Note plugin to publish or update the current note.
   - Confirm the generated URL from either the `share` frontmatter field or clipboard.

5. Telegram draft
   - Create a concise Telegram message draft.
   - Include the title, one-paragraph context, and ShareNote URL.

6. Approval gate
   - Ask explicitly: "이 Telegram 메시지를 `<target>` 으로 전송 승인할까요?"
   - Do not send unless the user approves.

7. Delivery
   - Send using Hermes `send_message` only after explicit approval.
   - Report target, timestamp, note path, and ShareNote URL.

8. Optional Paperclip
   - Only if separately requested and approved; prepare result report first.
