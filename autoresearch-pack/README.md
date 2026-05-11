# AutoResearch Pack

AutoResearch Pack은 사용자의 조사 질문을 반복 가능한 리서치 루프로 바꾸기 위한 Hermes WebUI setup pack입니다.

## 목적

사용자가 하나의 질문을 입력하면 아래 흐름으로 확장합니다.

1. 질문 정제
2. 조사 범위와 제외 범위 정의
3. 1차 broad scan
4. 출처/근거 정리
5. 사실, 해석, 가설, unknown 분리
6. 심화 탐색 각도 제안
7. 2차 deep dive
8. 결과물을 research brief, decision memo, Obsidian note, posting draft 중 하나로 정리
9. 필요하면 다음 AutoResearch loop로 이어가기

## 권장 사용 상황

- 시장/제품/경쟁사/기술 동향 조사
- 콘텐츠 작성 전 근거 수집
- 의사결정 전 빠른 desk research
- 같은 질문을 여러 관점으로 반복 탐색
- X, Reddit, arXiv, 웹 문서, 블로그, GitHub, YouTube 등 여러 출처를 비교해야 하는 경우
- “한 번 검색하고 끝”이 아니라 broad scan → synthesis → deepening → output을 반복하고 싶은 경우

## 기본 구조

### 1. Intake

사용자 질문을 그대로 받되, 바로 결론으로 가지 않고 아래를 채웁니다.

- 원문 질문
- 의사결정 맥락
- 조사 범위: 기간, 지역, 언어, 포함/제외 출처
- 목표 산출물
- 깊이: quick / standard / deep
- 증거 기준: 필수 출처 수, 1차 자료 필요 여부, 불확실성 표기 방식

### 2. Broad Scan

하위 질문을 만들고 다양한 출처에서 1차 탐색을 합니다.

권장 출처 유형:
- official: 공식 문서, 회사 발표, 제품 문서
- academic: 논문, arXiv, 연구기관 자료
- industry: 시장 보고서, 분석 글, 업계 블로그
- media: 뉴스, 인터뷰, 해설 기사
- community/social: X, Reddit, Hacker News, 포럼
- code/data: GitHub, public dataset, changelog, benchmark
- video/audio: YouTube transcript, podcast transcript

### 3. Synthesis

결과를 네 칸으로 나눕니다.

| 구분 | 의미 |
|---|---|
| Facts | 출처로 확인된 사실 |
| Interpretations | 사실에서 도출한 해석 |
| Hypotheses | 아직 검증이 필요한 가설 |
| Unknowns | 더 확인해야 할 질문 |

### 4. Deepening

1차 결과에서 심화 각도를 2~4개 제안합니다.

대표 심화 각도:
- 시장/고객 관점
- 경쟁사 관점
- 기술 구현 가능성 관점
- 가격/사업모델 관점
- 규제/법무/리스크 관점
- 최근 30일 X/Reddit 반응 관점
- 학술/논문 관점
- GitHub/오픈소스 생태계 관점

사용자가 고르지 않으면 “의사결정 영향도가 가장 큰 각도”를 기본 선택합니다.

### 5. Output

최종 결과는 사용 목적에 맞게 포맷을 선택합니다.

- Research Brief
- Decision Memo
- Product/Market Memo
- Posting Draft
- Obsidian Note
- Paperclip issue/comment draft, 단 실제 반영은 명시 승인 후만 가능

## 기본 실행 프롬프트

```text
AutoResearch를 시작해줘.
질문: <사용자 질문>
목표 산출물: research brief
범위: 최근 12개월, 한국어/영어 자료 우선
제외: 광고성 자료, 근거 없는 주장
깊이: standard
흐름: 1차 broad scan 후 심화각도 3개 제안, 가장 의사결정 가치가 큰 각도로 deep dive
결과 형식: 핵심 요약 → 근거 표 → facts/interpretations/hypotheses/unknowns → 심화 질문 → 다음 액션
```

## 반복 실행 방식

1. Loop A: broad scan으로 질문 전체 지도 만들기
2. Loop B: 가장 중요한 unknown 또는 decision blocker를 deep dive
3. Loop C: 반대 근거와 대안 해석 검증
4. Loop D: 산출물 변환, 예: decision memo, posting draft, Paperclip draft

각 loop 끝에는 다음 중 하나를 결정합니다.

- stop: 충분한 근거가 있고 다음 액션이 명확함
- deepen: 특정 각도로 추가 조사
- broaden: 출처/지역/기간/관점을 넓힘
- convert: note, brief, post, decision memo로 변환
- approval wait: Paperclip/Telegram/publishing 등 외부 반영 승인 대기

## 필요한 도구/전제 조건

최소:
- Hermes Agent 또는 WebUI 실행 환경
- 검색/웹 탐색 도구 또는 브라우저 접근
- workspace 파일 저장 가능
- Python 3 또는 shell 기반 날짜/파일 점검 가능

권장 도구/스킬:
- 일반 웹 탐색: Web/search/browser 도구
- 차단·로그인·봇 방어 사이트 우회 탐색: `insane-search-hermes`
- 학술 논문: `arxiv`
- 블로그/RSS 모니터링: `blogwatcher`
- 예측시장 참고: `polymarket`
- YouTube/미디어 원문 활용: `youtube-content`
- X/Reddit 최근 반응: `last30days-pack` 또는 `xurl`/웹 검색 fallback
- 결과 저장: Workspace markdown artifact, Obsidian note, 또는 Paperclip draft

## 운영 원칙

- 사실과 해석을 분리합니다.
- 출처별 신뢰도와 한계를 함께 적습니다.
- “아직 모르는 것”을 명시합니다.
- 1차 탐색 후 바로 결론내리지 않고 심화 각도를 제안합니다.
- 최종 결과는 다음 액션으로 이어지게 작성합니다.
- Paperclip 반영, Telegram 전송, 외부 게시 등은 자동 실행하지 않고 명시적 승인 후 진행합니다.

## Canonical output paths

- `autoresearch-pack/README.md`
- `autoresearch-pack/templates/research-question-template.md`
- `autoresearch-pack/templates/research-output-template.md`
- `autoresearch-pack/workflows/default-research-loop.md`
- `autoresearch-pack/checklists/deepening-checklist.md`
- `autoresearch-pack/scripts/check_autoresearch_env.py`
