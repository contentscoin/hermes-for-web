# AutoResearch Pack

AutoResearch Pack은 사용자의 조사 질문을 반복 가능한 리서치 루프로 바꾸기 위한 Hermes WebUI setup pack입니다.

## 목적

사용자가 하나의 질문을 입력하면 다음 흐름으로 확장합니다.

1. 질문 정제
2. 조사 범위와 제외 범위 정의
3. 1차 넓은 탐색
4. 출처/근거 정리
5. 쟁점과 빈칸 식별
6. 심화 탐색 각도 선택
7. 2차 심화 탐색
8. 결과물을 note, research brief, posting draft, decision memo 중 하나로 정리

## 권장 사용 상황

- 시장/제품/경쟁사/기술 동향 조사
- 콘텐츠 작성 전 근거 수집
- 의사결정 전 빠른 desk research
- 같은 질문을 여러 관점으로 반복 탐색
- X, Reddit, arXiv, 웹 문서, 블로그, GitHub 등 여러 출처를 비교해야 하는 경우

## 기본 원칙

- 사실과 해석을 분리합니다.
- 출처별 신뢰도와 한계를 함께 적습니다.
- “아직 모르는 것”을 명시합니다.
- 1차 탐색 후 바로 결론내리지 않고 심화 각도를 제안합니다.
- 최종 결과는 다음 액션으로 이어지게 작성합니다.

## 추천 도구

Hermes 환경에서 사용 가능한 도구/스킬 기준:

- 일반 웹 탐색: 기본 검색/브라우저 도구
- 차단·로그인·봇 방어 사이트 우회 탐색: `insane-search-hermes`
- 학술 논문: `arxiv`
- 블로그/RSS 모니터링: `blogwatcher`
- 예측시장 참고: `polymarket`
- YouTube/미디어 원문 활용: `youtube-content`
- 결과물 저장: Workspace markdown artifact 또는 Obsidian note

## 기본 실행 프롬프트

```text
AutoResearch를 시작해줘.
질문: <사용자 질문>
목표 산출물: research brief
범위: 최근 12개월, 한국어/영어 자료 우선
제외: 광고성 자료, 근거 없는 주장
깊이: 1차 broad scan 후 심화각도 3개 제안
결과 형식: 핵심 요약 → 근거 표 → 쟁점 → 심화 질문 → 다음 액션
```

## 반복 루프

1. Broad Scan
   - 질문을 검색 가능한 하위 질문으로 나눕니다.
   - 대표 출처 5~10개를 수집합니다.
   - 공통 패턴과 충돌점을 표시합니다.

2. Synthesis
   - 사실 / 해석 / 가설 / 모르는 점을 분리합니다.
   - 신뢰도와 출처 편향을 적습니다.

3. Deepening
   - 심화 각도 2~4개를 제안합니다.
   - 사용자가 선택하거나, 기본값으로 가장 의사결정 가치가 큰 각도를 선택합니다.

4. Output
   - 결과를 research brief 또는 note로 정리합니다.
   - 다음 질문과 실행 항목을 남깁니다.

## 산출물 위치

이 pack의 정본 파일은 `autoresearch-pack/` 아래에 둡니다.

- `templates/research-question-template.md`
- `templates/research-output-template.md`
- `workflows/default-research-loop.md`
- `checklists/deepening-checklist.md`
