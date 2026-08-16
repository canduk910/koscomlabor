---
name: union-page-orchestrator
description: "코스콤지부 노조 공식페이지 에이전트 팀(정밀검증·디자이너·프론트/백엔드 개발자·QA)을 조율하는 오케스트레이터. 공지/소식/콘텐츠 게시, 페이지·기능 추가, 디자인 변경, 버그 수정, 백엔드/API/NCP/방명록 서버 작업 등 노조 페이지 관련 작업 요청 시 반드시 사용할 것. 후속 작업(다시 실행, 재실행, 업데이트, 수정, 보완, 개선, '공지만 다시', '디자인만 바꿔줘', 이전 결과 기반 작업)에도 반드시 이 스킬을 사용. 단순 질문/조회는 직접 응답 가능."
---

# Union Page Orchestrator

전국금융산업노동조합 코스콤지부 공식페이지의 에이전트 팀을 조율하는 통합 워크플로우. **제1원칙: 검증되지 않은 정보는 조합원에게 게시되지 않는다** — 콘텐츠는 구현 전(1차)과 게시 직전(2차) 두 번의 검증 게이트를 통과해야 한다.

## 실행 모드: 감독자(Supervisor) — 오케스트레이터가 리더

메인 세션이 팀리더다. `Agent` 도구로 팀원을 스폰하고(`run_in_background: true`로 병렬 가능), 후속 조율은 스폰된 에이전트에게 `SendMessage`로 이어간다(컨텍스트 유지). 진행 상황은 `TaskCreate`/`TaskUpdate`로 추적한다.

> `TeamCreate` 도구가 있는 환경이라면 동일 구성을 에이전트 팀 모드로 운영해도 된다. 없는 환경(현재 기본)에서는 위 감독자 방식이 표준이다.

## 에이전트 구성

| 팀원 | subagent_type | 역할 | 스킬 | 출력 |
|------|--------------|------|------|------|
| fact-verifier | `fact-verifier` | 콘텐츠 정밀검증 (1차·2차 게이트) | union-fact-check | `_workspace/01_verifier_factcheck.md`, `05_verifier_final.md` |
| frontend-designer | `frontend-designer` | 디자인 토큰·스펙 설계 | union-design-system | `_workspace/02_designer_spec.md` |
| web-developer | `web-developer` | Next.js 구현 | union-webapp-dev | 소스 코드 + `_workspace/03_developer_impl.md` |
| qa-tester | `qa-tester` | 통합 정합성·접근성 검증 | union-qa-testing | `_workspace/04_qa_report.md` |
| backend-developer | `backend-developer` | NCP 백엔드 설계·구현 | union-backend-dev | `_workspace/06_backend_api_spec.md`, `07_backend_impl.md` |

모든 Agent 호출에 `model: "opus"`를 명시한다 (세션 모델이 더 상위 티어면 생략하여 상속해도 된다).

## 워크플로우

### Phase 0: 컨텍스트 확인 (후속 작업 지원)

1. `_workspace/` 존재 여부 확인
2. 실행 모드 결정:
   - **미존재** → 초기 실행, Phase 1로
   - **존재 + 부분 수정 요청** (예: "디자인만 바꿔줘", "그 공지 문구 수정") → **부분 재실행**: 해당 에이전트만 재호출. 이전 산출물 경로를 프롬프트에 포함해 기존 결과를 읽고 피드백을 반영하게 한다. 콘텐츠 문구가 바뀌면 fact-verifier 재검증도 포함
   - **존재 + 새 입력** → **새 실행**: 기존 `_workspace/`를 `_workspace_prev_{YYYYMMDD_HHMMSS}/`로 이동 후 Phase 1로

### Phase 1: 요청 분류 및 준비

1. 요청 유형을 분류하고 필요한 에이전트만 활성화한다 (전문가 풀 라우팅):

| 요청 유형 | 활성 에이전트 | 경로 |
|----------|-------------|------|
| 콘텐츠 게시 (공지/소식) | verifier → developer → qa → verifier(2차) | 검증 게이트 필수 |
| 신규 기능/페이지 | (콘텐츠 있으면 verifier) → designer → developer → qa | 전체 파이프라인 |
| 디자인 변경 | designer → developer → qa | 검증 게이트 생략 가능 |
| 버그 수정 | developer → qa | 콘텐츠 무관 시 |
| 백엔드/API 작업 | backend-developer → (프론트 연동 시 web-developer) → qa | 아키텍처 미확정 사항은 사용자 확인 후 진행. QA는 API 명세 ↔ 프론트 타입 교차 검증 필수 |

2. `_workspace/` 생성, 사용자 입력(콘텐츠 원문, 요구사항)을 `_workspace/00_input/`에 저장
3. `TaskCreate`로 이번 실행의 작업 목록을 등록한다 (의존 관계 포함)

### Phase 2: 정밀검증 게이트 (1차) — 콘텐츠 포함 시 필수

1. `fact-verifier` 스폰: 입력 콘텐츠 검증 → `_workspace/01_verifier_factcheck.md`
2. 판정 분기:
   - **승인** → Phase 3 진행
   - **조건부 승인** → 수정 요구 사항을 콘텐츠에 반영(리더가 직접 또는 사용자 확인 후) → 진행
   - **반려** → **워크플로우 중단.** 반려 사유와 게시 가능 조건을 사용자에게 보고한다. 반려된 콘텐츠로 다음 Phase를 진행하지 않는다

### Phase 3: 디자인 설계 — 기능/디자인 작업 시

1. `frontend-designer` 스폰: 요구사항 + 승인 콘텐츠 기반 스펙 작성 → `_workspace/02_designer_spec.md`
2. 리더는 스펙에 대비 검증 결과표가 포함됐는지 확인한다. 누락 시 SendMessage로 보완 요청

### Phase 4: 구현 + Incremental QA 루프

1. `web-developer` 스폰: 스펙·승인 콘텐츠 기반 구현. 모듈 완성 시마다 리더에게 보고하도록 지시
2. 모듈 보고를 받으면 `qa-tester` 스폰(또는 기존 인스턴스에 SendMessage): 해당 모듈 + 인접 경계면 검증 → `_workspace/04_qa_report.md`
3. 실패 항목 발생 시: 리더가 `web-developer`에게 SendMessage로 리포트 전달 → 수정 → `qa-tester`에 회귀 검증 요청
4. **수정↔재검증 루프는 모듈당 최대 2회.** 3회째 실패하면 루프를 멈추고 리더가 원인을 직접 분석해 사용자에게 보고한다 (스펙 모순, 요구사항 문제 가능성)

### Phase 5: 최종 게이트

1. `qa-tester`: 전체 통합 검증 (라우팅 전수, 빌드, 접근성)
2. `fact-verifier`(2차): 구현물에 실제 렌더링되는 콘텐츠를 승인 원문과 최종 대조 → `_workspace/05_verifier_final.md`
3. 두 게이트 모두 통과해야 완료다. 하나라도 실패하면 Phase 4의 수정 루프로 돌아간다 (최대 1회, 이후 사용자 보고)

### Phase 6: 보고 및 정리

1. `_workspace/`는 보존한다 (검증 이력·감사 추적용 — 노조 페이지 특성상 "언제 무엇을 근거로 게시했나"가 중요하다)
2. 사용자에게 결과 요약: 게시/구현된 것, 검증 판정 이력, 미해결 항목, QA 미검증 항목
3. 피드백 기회 제공: "결과나 팀 워크플로우에서 개선할 부분이 있나요?" — 피드백은 하네스 진화(에이전트/스킬 수정 + CLAUDE.md 변경 이력)에 반영한다

## 데이터 흐름

```
사용자 입력 → _workspace/00_input/
   ↓
[fact-verifier] → 01_verifier_factcheck.md ──(반려 시 중단)──→ 사용자 보고
   ↓ 승인
[frontend-designer] → 02_designer_spec.md
   ↓
[web-developer] → 소스 코드 + 03_developer_impl.md
   ↕ (모듈마다)                       ← SendMessage 수정 루프 (최대 2회)
[qa-tester] → 04_qa_report.md
   ↓ 전체 통과
[fact-verifier 2차] → 05_verifier_final.md → 완료 보고
```

전달 방식: 파일 기반(`_workspace/`, 산출물) + 반환값(판정 요약) + SendMessage(수정 루프·질의).

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| 에이전트 1명 실패/무응답 | 1회 재스폰. 재실패 시 해당 산출물 누락을 명시하고 사용자에게 보고 (검증 게이트 실패는 예외 — 검증 없이 진행 금지) |
| fact-verifier 실행 불가 | **콘텐츠 게시 작업 전체 중단.** 검증 없는 게시는 이 하네스의 제1원칙 위반 |
| QA↔개발 루프 3회 초과 | 루프 중단, 리더가 직접 원인 분석 후 사용자 보고 |
| 산출물 간 상충 (스펙 vs QA 기준 등) | 삭제하지 않고 양쪽 병기, 리더가 판단하거나 사용자에게 질의 |
| 검증 중 출처 상충 발견 | 양쪽 출처 병기 후 사용자 판단 요청. 임의 채택 금지 |

## 테스트 시나리오

### 정상 흐름: 공지 게시
1. 사용자: "임금협약 잠정합의 공지 올려줘" + 원문 제공
2. Phase 1: 콘텐츠 게시 유형 분류, `_workspace/00_input/`에 원문 저장
3. Phase 2: fact-verifier가 수치·날짜·출처 검증 → 승인
4. Phase 4: web-developer가 `content/notices/`에 verified frontmatter로 게시 구현, qa-tester가 라우팅·렌더링 검증
5. Phase 5: fact-verifier 2차 대조 통과
6. 결과: 공지 페이지 게시 + 검증 이력 보존

### 에러 흐름: 검증 반려
1. 사용자: "게시판에서 본 '조합비 인하 결정' 소식 올려줘"
2. Phase 2: fact-verifier가 출처 확인 → 4급(커뮤니티) 출처만 존재 → **반려**
3. 리더: 워크플로우 중단, "1~2급 출처(지부 결정문 등) 확보 시 게시 가능"을 사용자에게 보고
4. designer/developer는 스폰되지 않음 — 미검증 정보는 코드에 닿지도 않는다
