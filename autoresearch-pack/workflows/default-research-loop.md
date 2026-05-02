# Default AutoResearch Loop

## Trigger

사용자가 다음과 같이 요청하면 이 루프를 사용합니다.

- “조사해줘”
- “AutoResearch 돌려줘”
- “이 주제 심화 탐색해줘”
- “최근 자료 기반으로 브리프 만들어줘”
- “출처 포함해서 정리해줘”

## Loop 0. Intake

입력값:
- 원문 질문
- 목표 산출물
- 범위/기간/지역
- 제외할 자료
- 깊이: quick / standard / deep

명확하지 않으면 기본값:
- 깊이: standard
- 산출물: research brief
- 출처: 공식 문서, 뉴스/블로그, 커뮤니티, 논문/데이터 순
- 결과: 한국어 요약 + 출처 링크

## Loop 1. Question Refinement

1. 원문 질문을 한 문장으로 재정의합니다.
2. 하위 질문 3~7개로 나눕니다.
3. 조사 범위와 제외 범위를 명시합니다.
4. 성공 기준을 정의합니다.

Output:
- refined_question
- sub_questions
- scope
- exclusions
- expected_output

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
3. 핵심 주장과 증거를 1줄씩 적습니다.
4. 중복/광고성/근거 약한 출처를 제외합니다.

Output:
- source table
- early findings
- contradictions
- missing evidence

## Loop 3. Synthesis

다음 네 칸으로 분리합니다.

| 구분 | 내용 |
|---|---|
| Facts | 출처로 확인된 사실 |
| Interpretations | 사실에서 도출한 해석 |
| Hypotheses | 아직 검증이 필요한 가설 |
| Unknowns | 더 확인해야 할 질문 |

## Loop 4. Deepening Plan

심화 각도 2~4개를 제안합니다.

예:
- 경쟁사 관점
- 고객/사용자 반응 관점
- 기술 구현 가능성 관점
- 규제/리스크 관점
- 가격/사업모델 관점
- 최근 30일 반응 관점

사용자가 선택하지 않으면 “의사결정 영향도가 가장 큰 각도”를 기본 선택합니다.

## Loop 5. Deep Dive

선택한 심화 각도에 대해 추가 탐색합니다.

- 추가 출처 수집
- 반대 근거 확인
- 정량/정성 데이터 분리
- 신뢰도와 한계 평가

## Loop 6. Final Output

최종 결과는 아래 형식 중 하나로 저장/전달합니다.

- Research Brief
- Decision Memo
- Posting Draft
- Obsidian Note
- Paperclip issue draft, 단 Paperclip 반영은 명시 승인 후만 가능

## Stop Conditions

다음 중 하나면 루프를 멈추고 보고합니다.

- 충분한 근거가 모임
- 추가 탐색의 한계 효용이 낮음
- 핵심 출처 접근이 막힘
- 사용자의 의사결정에 필요한 다음 액션이 명확함
- Paperclip 반영 등 외부 시스템 변경이 필요해 승인 대기가 필요함
