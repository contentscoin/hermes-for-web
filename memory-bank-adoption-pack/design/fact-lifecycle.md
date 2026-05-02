# Fact Lifecycle

1. Discussion
2. Candidate extraction
3. Candidate Inbox
4. CEO approval/edit/reject
5. Scoped Fact Store
6. Optional later bridge to durable memory or Paperclip

Approval gate
- 승인 전: candidate 상태이며 로컬 저장만 가능
- 승인 후: fact 상태가 되지만 Paperclip/Telegram/durable memory write는 여전히 별도 승인 필요
