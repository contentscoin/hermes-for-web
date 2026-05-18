# AutoResearch Pack

AutoResearch Pack은 사용자가 하나의 조사 질문을 넣었을 때 Hermes가 같은 리서치 흐름을 반복 실행하거나 심화 탐색할 수 있도록 만드는 기본 운영 구조입니다.

목적은 “검색 한 번”이 아니라 아래 루프를 재사용하는 것입니다.

```text
intake → question refinement → broad scan → synthesis → deepening → final output → next loop decision
```

## 언제 쓰나

- 시장/경쟁/제품/정책/기술 주제를 빠르게 구조화해야 할 때
- 첫 조사 후 더 깊게 파고들 각도를 고르고 싶을 때
- 출처 기반 facts와 해석/가설/미확인을 분리해야 할 때
- 조사 결과를 executive brief, decision memo, note, post draft로 바꿔야 할 때
- 같은 질문을 `deepen`, `broaden`, `verify` 루프로 반복하고 싶을 때

## 기본 원칙

1. 먼저 질문을 정제한다.
2. 조사 범위와 제외 범위를 명시한다.
3. 출처 기반 사실과 해석을 분리한다.
4. 작은 표본으로 전체 여론/시장 확신을 과장하지 않는다.
5. 출처 한계, 검색 한계, 샘플링 편향을 밝힌다.
6. Paperclip reflection, Telegram 전달, 외부 publishing은 명시 승인 전에는 하지 않는다.

## 추천 도구

- 기본 web/search: 일반 웹, 공식 문서, 뉴스, 블로그, 보고서
- browser: 동적 페이지 확인, WebUI Setup Pack 확인
- workspace/file tools: 조사 질문, source table, 결과 memo 저장
- arxiv: 학술/기술 논문 탐색
- blogwatcher: 특정 블로그/RSS 모니터링
- youtube-content: 영상 transcript 기반 요약
- xurl / last30days-pack: 최근 X/Reddit 반응 또는 공개 커뮤니티 신호
- polymarket: 예측시장/확률형 시장 데이터가 관련될 때
- Paperclip: 승인된 의사결정 기록/실행 항목 반영만

## 기본 실행 프롬프트

```text
AutoResearch로 조사해줘.
원 질문: [조사 질문]
목표: [의사결정/전략/콘텐츠/시장파악 등]
범위: [지역/기간/소스/대상]
깊이: broad scan 후 deepening angle 3개 제안
출력: 한국어 executive brief + source table + next loop decision
승인 경계: Paperclip/Telegram/publishing은 내 승인 전 금지
```

## 표준 루프

1. Intake
   - 원 질문, 배경, 의사결정 맥락, 원하는 출력물을 받는다.
2. Question refinement
   - 질문을 조사 가능한 형태로 바꾸고 scope/exclusion을 쓴다.
3. Broad scan
   - 여러 출처군을 얕게 훑고 source table을 만든다.
4. Synthesis
   - facts, interpretation, hypotheses, unknowns를 분리한다.
5. Deepening plan
   - 심화 후보 3~5개와 우선순위를 제안한다.
6. Deep dive
   - 사용자가 고르거나 기본 추천한 각도 하나를 깊게 탐색한다.
7. Final output
   - executive summary, 핵심 근거, 해석, 다음 액션을 정리한다.
8. Next loop decision
   - `stop`, `deepen`, `broaden`, `verify`, `convert`, `approval wait` 중 하나를 제안한다.

## canonical files

- `autoresearch-pack/README.md`
- `autoresearch-pack/templates/research-question-template.md`
- `autoresearch-pack/templates/research-output-template.md`
- `autoresearch-pack/workflows/default-research-loop.md`
- `autoresearch-pack/checklists/deepening-checklist.md`
- `autoresearch-pack/scripts/check_autoresearch_env.py`

## 결과 저장 추천 경로

```text
workspace/research/<topic-slug>/question.md
workspace/research/<topic-slug>/source-table.md
workspace/research/<topic-slug>/brief.md
workspace/research/<topic-slug>/deep-dive.md
workspace/research/<topic-slug>/next-loop.md
```

## 승인 경계

- 자동 Paperclip 반영 없음
- 자동 Telegram 전송 없음
- 자동 publishing 없음
- 외부 mutation이 필요한 경우 먼저 결과 보고서와 실행 항목을 만들고 명시 승인을 받는다.
