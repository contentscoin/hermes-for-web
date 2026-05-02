# Memory Bank Adoption Pack

Hermes WebUI에 Memory Bank의 핵심 개념만 안전하게 적용하기 위한 실행팩입니다.

핵심 원칙
- 대화에서 바로 durable memory를 쓰지 않고 후보를 만든다.
- 후보는 사용자가 approve/edit/reject 한 뒤에만 scoped fact가 된다.
- Paperclip 반영은 별도 Decision Report와 실행승인 후에만 진행한다.
- Telegram 전송, Paperclip write, memory tool write는 자동 실행하지 않는다.

Batch 1 산출물
- Memory Candidate Inbox
- Local JSONL fact store
- 후보 승인/거절 API
- 최소 WebUI 패널
