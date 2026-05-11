# Default AutoResearch Loop

## Trigger

사용자가 다음과 같이 요청하면 이 루프를 사용합니다.

- “조사해줘”
- “AutoResearch 돌려줘”
- “이 주제 심화 탐색해줘”
- “최근 자료 기반으로 브리프 만들어줘”
- “출처 포함해서 정리해줘”
- “한 번 더 깊게 봐줘”

## Loop 0. Intake

입력값:
- 원문 질문
- 의사결정 맥락
- 목표 산출물
- 범위/기간/지역/언어
- 포함/제외할 출처
- 깊이: quick / standard / deep
- 외부 반영 여부: Paperclip, Telegram, publishing

명확하지 않으면 기본값:
- 깊이: standard
- 산출물: research brief
- 출처: 공식 문서, 뉴스/블로그, 커뮤니티, 논문/데이터 순
- 결과: 한국어 요약 + 출처 링크 + 다음 액션
- 외부 반영: 하지 않음, 필요 시 승인 대기

## Loop 1. Question Refinement

1. 원문 질문을 한 문장으로 재정의합니다.
2. 하위 질문 3~7개로 나눕니다.
3. 조사 범위와 제외 범위를 명시합니다.
4. 성공 기준을 정의합니다.
5. evidence standard를 정합니다.

Output:
- refined_question
- sub_questions
- scope
- exclusions
- expected_output
- evidence_standard

## Loop 2. Broad Scan

1. 각 하위 질문별 초기 출처 후보를 찾습니다.
2. 출처를 다음 유형으로 태깅합니다.
   - official
   - academic
   - industry
   - media
   - community
   - social
   - code/data
   - video/audio
3. 핵심 주장과 증거를 1줄씩 적습니다.
4. 중복/광고성/근거 약한 출처를 제외합니다.
5. 접근 제한 또는 검색 한계를 기록합니다.

Output:
- source table
- early findings
- contradictions
- missing evidence
- source limitations

## Loop 3. Synthesis

다음 네 칸으로 분리합니다.

| 구분 | 내용 |
|---|---|
| Facts | 출처로 확인된 사실 |
| Interpretations | 사실에서 도출한 해석 |
| Hypotheses | 아직 검증이 필요한 가설 |
| Unknowns | 더 확인해야 할 질문 |

품질 기준:
- facts는 출처와 연결되어야 합니다.
- interpretations는 “해석”이라고 표시해야 합니다.
- hypotheses는 검증 방법을 같이 적습니다.
- unknowns는 다음 loop 후보가 됩니다.

## Loop 4. Deepening Plan

심화 각도 2~4개를 제안합니다.

예:
- 경쟁사 관점
- 고객/사용자 반응 관점
- 기술 구현 가능성 관점
- 규제/리스크 관점
- 가격/사업모델 관점
- 최근 30일 X/Reddit 반응 관점
- 학술/논문 관점
- GitHub/오픈소스 생태계 관점

사용자가 선택하지 않으면 “의사결정 영향도가 가장 큰 각도”를 기본 선택합니다.

Output:
- angle
- reason
- additional sources
- expected value
- priority

## Loop 5. Deep Dive

선택한 심화 각도에 대해 추가 탐색합니다.

- 추가 출처 수집
- 반대 근거 확인
- 정량/정성 데이터 분리
- 신뢰도와 한계 평가
- 첫 해석이 바뀌었는지 확인

Output:
- updated findings
- changed interpretation
- stronger/weaker evidence
- remaining unknowns

## Loop 6. Final Output

최종 결과는 아래 형식 중 하나로 저장/전달합니다.

- Research Brief
- Decision Memo
- Product/Market Memo
- Posting Draft
- Obsidian Note
- Paperclip issue/comment draft, 단 Paperclip 반영은 명시 승인 후만 가능

## Loop 7. Next Loop Decision

다음 중 하나로 끝냅니다.

- stop: 충분한 근거가 있고 다음 액션이 명확함
- deepen: 특정 각도로 추가 조사
- broaden: 출처/지역/기간/관점을 넓힘
- verify: 반대 근거 또는 숫자 검증
- convert: note, brief, post, decision memo로 변환
- approval wait: Paperclip/Telegram/publishing 등 외부 반영 승인 대기

## Stop Conditions

다음 중 하나면 루프를 멈추고 보고합니다.

- 충분한 근거가 모임
- 추가 탐색의 한계 효용이 낮음
- 핵심 출처 접근이 막힘
- 사용자의 의사결정에 필요한 다음 액션이 명확함
- Paperclip 반영 등 외부 시스템 변경이 필요해 승인 대기가 필요함

## Safety / Approval

AutoResearch는 조사와 초안 작성까지 자동화할 수 있지만, 아래는 자동 실행하지 않습니다.

- Paperclip reflection
- Telegram delivery
- public posting
- third-party write/update

외부 반영은 결과 리포트 작성 후 명시적 승인으로만 진행합니다.
