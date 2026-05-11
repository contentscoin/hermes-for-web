# last30days Research Pack

최근 30일간 X/Reddit 기반 공개 반응을 빠르게 조사하기 위한 Hermes WebUI Setup Pack입니다.

## 목적

사용자가 긴 도구 설명을 외우지 않아도 아래 네 가지만 정하면 바로 리서치를 시작할 수 있게 합니다.

1. 조사 주제 또는 키워드
2. 기간: 기본 최근 30일
3. 소스: `x`, `reddit`, `both`
4. 결과 형태: executive brief, source table, posting insight, product/market memo 등

## 빠른 시작 프롬프트

```text
last30days로 조사해줘.
주제: [제품/브랜드/인물/이슈/키워드]
소스: both
기간: 최근 30일
목표: 반응 패턴, 반복 불만, 호의적 포인트, 대표 인용 후보, 다음 액션을 정리
출력: 한국어 executive brief + source table
```

## 소스 선택법

### `x`

X/Twitter 중심 반응을 봅니다.

적합한 경우:
- 빠른 여론 변화, 밈, 인플루언서 반응을 보고 싶을 때
- 출시/공지/논란 직후 반응 속도를 보고 싶을 때
- 짧은 문장, quote/repost 맥락, 해시태그를 보고 싶을 때

주의:
- X API 또는 `xurl` 같은 접근 도구가 필요할 수 있습니다.
- 공개 검색 결과는 로그인/권한/요금제/레이트리밋에 따라 달라질 수 있습니다.
- viral post 하나가 전체 여론처럼 보이지 않도록 표본 편향을 표시해야 합니다.

### `reddit`

Reddit 커뮤니티 중심 반응을 봅니다.

적합한 경우:
- 긴 토론, 사용 경험, 대안 비교, 커뮤니티별 맥락을 보고 싶을 때
- 특정 서브레딧의 반복 질문/불만/추천 패턴을 보고 싶을 때
- 제품·시장·게임·개발자·AI 도구처럼 커뮤니티 논의가 중요한 주제일 때

주의:
- Reddit API credential 또는 공개 검색/웹 검색 접근이 필요할 수 있습니다.
- 서브레딧마다 문화가 다르므로 일반화 전에 커뮤니티 맥락을 적어야 합니다.
- 삭제/비공개/NSFW/지역 제한 게시물은 누락될 수 있습니다.

### `both`

X와 Reddit을 비교합니다. 기본 추천값입니다.

적합한 경우:
- 빠른 반응(X)과 깊은 토론(Reddit)을 함께 보고 싶을 때
- PR/마케팅/제품 의사결정 전에 반응의 폭과 깊이를 둘 다 확인할 때
- 소스별 톤 차이, 관심사 차이, 반복 이슈를 비교하고 싶을 때

출력에서는 반드시 `공통 패턴`, `X에서 강한 신호`, `Reddit에서 강한 신호`, `소스별 편향`을 분리합니다.

## 대표 예시

### 예시 1: 제품 출시 반응

```text
last30days로 조사해줘.
주제: OpenAI Codex CLI gpt-5.5 image generation
소스: both
기간: 최근 30일
목표: 사용자 반응, 실패 사례, 좋아하는 포인트, 설치/모델 관련 불만 정리
출력: 실행 요약 5줄 + X/Reddit source table + 다음 개선 액션
```

### 예시 2: 캠페인/브랜드 반응

```text
last30days로 조사해줘.
주제: [브랜드명] 신규 캠페인
소스: x
기간: 최근 30일
목표: 긍정/부정 반응, 많이 공유된 표현, 논란 가능성, 활용 가능한 카피 후보
출력: 마케팅 팀용 brief
```

### 예시 3: 커뮤니티 pain point

```text
last30days로 조사해줘.
주제: AI presentation generator pain points
소스: reddit
기간: 최근 30일
목표: 사용자가 반복해서 불평하는 문제, 구매/전환 장벽, 대안 도구 언급 정리
출력: product discovery memo
```

## 필수 전제 조건

최소:
- Hermes Agent 또는 WebUI에서 웹/검색 도구 사용 가능
- 날짜 기준을 계산할 수 있는 로컬 Python 또는 shell
- 조사 결과를 저장할 workspace

X 조사에 필요할 수 있음:
- `xurl` CLI 또는 X API credential
- X 로그인/권한/요금제에 따른 검색 접근
- 관련 skill: `xurl` 또는 웹 검색 계열 도구

Reddit 조사에 필요할 수 있음:
- Reddit API credential, PRAW, 또는 공개 웹 검색 접근
- `jq`, `curl`, Python 3 중 하나 이상
- 서브레딧 후보 또는 키워드 후보

권장:
- `jq`: JSON 결과 정리
- `git`: pack 버전 관리
- `node`/`npm`: WebUI 정적 JS 검증
- 브라우저 접근: Setup Pack 버튼/상세 패널 확인

## 운영 원칙

- 최근 30일 기준 날짜 범위를 명시합니다.
- source-backed facts와 해석을 분리합니다.
- 인용은 공개 문맥과 링크/출처를 함께 기록합니다.
- 샘플 수가 적거나 편향이 있으면 명시합니다.
- Paperclip 반영, Telegram 전송, 외부 게시 등은 자동 실행하지 않고 명시적 승인 후 진행합니다.

## Canonical output paths

- `last30days-pack/README.md`
- `last30days-pack/templates/query-template.md`
- `last30days-pack/templates/output-template.md`
- `last30days-pack/workflows/default-last30days-loop.md`
- `last30days-pack/checklists/source-selection-checklist.md`
- `last30days-pack/scripts/check_last30days_env.py`
