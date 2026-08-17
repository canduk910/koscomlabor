# 06. 방명록 백엔드 API 명세

작성일: 2026-08-16 | 작성자: backend-developer | 상태: **리더 승인 완료 (8절) · 구현 완료 · 로컬 실측 27/27 PASS (9절)**

계약의 단일 출처: `/Users/canduk/IdeaProjects/koscomlabor/src/lib/api/guestbook.ts`
이 명세의 모든 응답 shape은 위 파일의 타입과 **문자 단위로** 대조했다 (각 절의 대조표 참조).

**개정 이력**

| 날짜 | 개정 | 영향 절 |
|------|------|---------|
| 2026-08-16 | Part 1 방명록 (§1–9) | — |
| 2026-08-16 | Part 2 게시물 DB 전환 + Admin (§10–17) | 신설 |
| 2026-08-17 | 관리자 비밀번호 변경 (`admin_credentials`, `POST /admin/password`) | §10.4, §12.1-a, §12.3, §12.4, §18 |
| 2026-08-17 | **게시물 세 번째 분류 `education`(노동교육) 추가** — 하위 호환(추가만, 기존 동작 불변) | §10.1, §11.1, §11.4, §13.1, **§19 신설** |
| 2026-08-17 | **게시물 수동 정렬(`sort_order`) + YouTube 썸네일 서버 캐싱(`thumbnail_key`)** — 하위 호환(컬럼 2개 nullable 추가, 응답 필드 추가, 기존 필드 불변) | §10.1, §11.1, §11.2, §13.1, **§20 신설** |

---

## 1. 아키텍처 결정 기록

### 1.1 확정 사항 (사용자 확인 완료)

| 항목 | 결정 | 비고 |
|------|------|------|
| 컴퓨팅 | 기존 NCP Server(VM) 1대에 배포 | onnuri.koscomlabor.cloud 운영 중인 서버로 추정. 서버 사양·접속 정보는 배포 단계에서 사용자 확인 |
| DB | VM 내 PostgreSQL 직접 설치 | 관리형 아님 → 백업 계획 필수 (1.4절) |
| 런타임 | Node.js + TypeScript (strict) | 프론트와 언어 통일, 타입 공유 가능성 |
| API 도메인 | `https://api.koscomlabor.cloud` (기본 가정) | HTTPS 필수. 최종 도메인은 배포 단계에서 확정 |

### 1.2 프레임워크 선택: Fastify (Express 대비)

**Fastify를 선택한다.** 사유:

1. **JSON Schema 기반 요청/응답 검증 내장** — 이 프로젝트 최다 버그 유형이 "응답 shape ↔ 프론트 타입 불일치"다. Fastify는 라우트에 응답 스키마를 선언하면 명세에 없는 필드를 직렬화 단계에서 제거하고, 요청 검증도 스키마로 강제한다. 계약 우선 원칙을 코드 레벨에서 집행할 수 있다.
2. **공식 플러그인으로 보안 요구 충족** — `@fastify/rate-limit`, `@fastify/cors`, `@fastify/helmet`이 1st-party로 유지보수된다 (Express는 서드파티 조합 필요).
3. **TypeScript 지원** — 타입 제네릭으로 라우트 핸들러의 요청/응답 타입을 명시할 수 있어 strict 모드와 궁합이 좋다.
4. 성능은 방명록 트래픽 수준에서 결정 요인이 아니지만, 손해도 없다.

Express를 배제한 사유: 검증·직렬화를 전부 수동/서드파티로 조립해야 하며, 그 조립 지점이 곧 계약 불일치 버그의 발생 지점이 된다.

### 1.3 프로세스 구성 (VM 1대 내)

```
[인터넷] → nginx (443, TLS 종단, 리버스 프록시) → Fastify (127.0.0.1:3001) → PostgreSQL (127.0.0.1:5432)
```

- Fastify와 PostgreSQL은 **루프백에만 바인딩** (외부 노출은 nginx 443만)
- 프로세스 관리: systemd 유닛 (재부팅 자동 시작, 크래시 재시작)
- TLS: Let's Encrypt (certbot) — api 서브도메인 인증서
- nginx에는 `X-Forwarded-For` 설정 필수 (rate limit이 실제 클라이언트 IP를 봐야 함). Fastify는 `trustProxy: true` (nginx 뒤에 있으므로)

### 1.4 PostgreSQL 백업 계획 (관리형이 아니므로 필수)

| 항목 | 계획 |
|------|------|
| 방식 | `pg_dump -Fc` (custom format, 압축) — cron으로 **매일 03:00 KST** |
| 1차 보관 | VM 내 `/var/backups/koscomlabor/` — 일일 백업 14개 보존 (14일 롤링) |
| 2차 보관 | NCP Object Storage 버킷에 업로드 (VM 디스크 장애 대비). 주 1회분은 8주 보존 |
| 복구 절차 | `pg_restore -d guestbook <파일>` — 절차를 07_backend_impl.md에 기록 |
| 복구 검증 | 월 1회 최신 백업을 임시 DB에 복원해 행 수 확인 (백업은 복원 테스트 전까지는 백업이 아니다) |
| 유의 | 백업 파일에 방명록 원문(개인 작성 콘텐츠) 포함 → Object Storage 버킷은 비공개 + 최소 권한 접근 키 |

NCP Object Storage 버킷 생성은 콘솔 작업 → 배포 단계에서 단계별 가이드를 작성해 사용자에게 전달한다. 버킷 확보 전까지는 1차(로컬) 백업만이라도 즉시 가동한다.

---

## 2. API 명세

공통 사항:

- Base URL: ~~`https://api.koscomlabor.cloud`~~ → **미확정** (배포 실사 결과 해당 도메인은 기존 onnuri 백엔드가 사용 중 — 07 문서 2.3/4절. 제안: `union-api.koscomlabor.cloud`. 확정 시 프론트 `NEXT_PUBLIC_API_BASE_URL`에 설정)
- 모든 요청/응답은 `application/json; charset=utf-8`
- 필드명은 **camelCase** (DB의 snake_case 컬럼은 API 경계에서 변환)
- 시각은 **ISO 8601 UTC** 문자열 (예: `"2026-08-16T05:30:00.000Z"`)
- 에러 응답은 전 엔드포인트 공통으로 `{ "error": { "code": string, "message": string } }` (2.4절)

### 2.1 `GET /guestbook` — 방명록 목록 조회

프론트 대응 함수: `listGuestbookEntries(): Promise<GuestbookResult<GuestbookEntry[]>>`

| 항목 | 내용 |
|------|------|
| 메서드/경로 | `GET /guestbook` |
| 인증 | 없음 (공개) |
| 쿼리 파라미터 | `limit` (선택, 정수 1–100, 기본 50), `offset` (선택, 정수 ≥ 0, 기본 0) — 5절 참조 |
| 성공 상태 코드 | `200 OK` |

**성공 응답 body: 최상위 JSON 배열** (봉투 객체 금지 — 프론트가 `Array.isArray(payload)`로 검사하며, `{ items: [...] }` 형태는 `invalid-response`로 처리된다). 정렬은 `createdAt` 내림차순 (최신 글 먼저).

```json
[
  {
    "id": "b3f1c9a0-6d2e-4f7b-9c1d-2a8e5f4b7c01",
    "author": "조합원",
    "body": "지부 출범을 축하합니다.",
    "createdAt": "2026-08-16T05:30:00.000Z"
  }
]
```

응답 헤더(선택 정보, 프론트 계약 밖 — body shape에 영향 없음):
- `X-Total-Count`: 전체 글 수 (삭제 제외). 프론트는 현재 무시하며, 향후 페이지네이션 UI 도입 시 사용 가능.

에러: `400 VALIDATION_ERROR` (limit/offset 형식 오류), `429 RATE_LIMITED`, `500 INTERNAL_ERROR`

**필드 대조표 — 응답 배열 원소 ↔ `GuestbookEntry` (guestbook.ts L11–17):**

| API 응답 필드 | API 타입 | guestbook.ts 필드 | 프론트 타입 | 옵셔널 | 일치 |
|---|---|---|---|---|---|
| `id` | string (UUID 문자열) | `GuestbookEntry.id` | `string` | 필수 | 일치 |
| `author` | string | `GuestbookEntry.author` | `string` | 필수 | 일치 |
| `body` | string | `GuestbookEntry.body` | `string` | 필수 | 일치 |
| `createdAt` | string (ISO 8601) | `GuestbookEntry.createdAt` | `string` (주석: ISO 8601) | 필수 | 일치 |
| (추가 필드 없음) | — | — | — | — | Fastify 응답 스키마로 4개 필드만 직렬화 |

프론트 파서(`parseGuestbookEntry`, L50–62)는 4개 필드 전부 `string`을 요구하고 하나라도 어긋나면 목록 전체를 `invalid-response`로 버린다. **null 허용 필드 없음. 숫자 id 금지 (UUID를 문자열로 반환).**

### 2.2 `POST /guestbook` — 방명록 글 등록

프론트 대응 함수: `createGuestbookEntry(input: GuestbookEntryInput): Promise<GuestbookResult<GuestbookEntry>>`

| 항목 | 내용 |
|------|------|
| 메서드/경로 | `POST /guestbook` |
| 인증 | 없음 (공개, 단 rate limit 적용 — 4.3절) |
| 성공 상태 코드 | `201 Created` (프론트는 `response.ok`만 검사하므로 2xx면 통과. 201 사용) |

**요청 body** — `GuestbookEntryInput` (guestbook.ts L19–22)과 문자 단위 일치:

```json
{
  "author": "조합원",
  "body": "지부 출범을 축하합니다."
}
```

| 요청 필드 | 타입 | guestbook.ts 필드 | 필수 | 서버 검증 규칙 (4.2절 상세) |
|---|---|---|---|---|
| `author` | string | `GuestbookEntryInput.author` | 필수 | trim 후 1–20자 |
| `body` | string | `GuestbookEntryInput.body` | 필수 | trim 후 1–500자 |
| (그 외 필드) | — | — | — | 미지의 필드는 무시 (스키마 `additionalProperties` 제거) |

**성공 응답 body: 생성된 단일 `GuestbookEntry` 객체** (배열 아님):

```json
{
  "id": "b3f1c9a0-6d2e-4f7b-9c1d-2a8e5f4b7c01",
  "author": "조합원",
  "body": "지부 출범을 축하합니다.",
  "createdAt": "2026-08-16T05:30:00.000Z"
}
```

필드 대조표는 2.1과 동일 (`GuestbookEntry` 4필드, 전부 필수 string, 추가 필드 없음).
저장·응답되는 `author`/`body`는 **trim 적용된 값** (이스케이프 없이 원문 저장 — 이스케이프는 렌더 계층 책임).

에러: `400 VALIDATION_ERROR`, `413 PAYLOAD_TOO_LARGE` (body 총 크기 > 16KB), `429 RATE_LIMITED`, `500 INTERNAL_ERROR`

### 2.3 `DELETE /admin/guestbook/:id` — 관리자 삭제 (프론트 계약 밖)

프론트 guestbook.ts에는 대응 함수가 **없다**. 운영자(curl 또는 추후 관리 도구) 전용이며, 프론트 계약에 영향을 주지 않는다. 사용자 생성 콘텐츠에 삭제 수단을 처음부터 두는 스킬 원칙에 따른다.

| 항목 | 내용 |
|------|------|
| 메서드/경로 | `DELETE /admin/guestbook/:id` (`:id` = 엔트리 UUID) |
| 인증 | `Authorization: Bearer <ADMIN_API_TOKEN>` — 4.5절 |
| 성공 상태 코드 | `200 OK` |

성공 응답 body:

```json
{ "deleted": true, "id": "b3f1c9a0-6d2e-4f7b-9c1d-2a8e5f4b7c01" }
```

동작: **soft delete** (`deleted_at` 기록). 목록/카운트에서 즉시 제외되지만 데이터는 보존 → 오삭제 복구 및 분쟁 대응 가능. 이미 삭제된 글에 재요청 시 `404 NOT_FOUND`.

에러: `401 UNAUTHORIZED` (토큰 누락/불일치), `404 NOT_FOUND` (없는 id 또는 이미 삭제), `400 VALIDATION_ERROR` (UUID 형식 아님), `429 RATE_LIMITED`, `500 INTERNAL_ERROR`

### 2.4 에러 응답 형식 (전 엔드포인트 공통)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "본문은 1자 이상 500자 이하여야 합니다."
  }
}
```

| code | HTTP | 발생 조건 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 필수 필드 누락, 길이 초과/미달, 형식 오류, 거부 조건(4.2절) 해당 |
| `UNAUTHORIZED` | 401 | **인증 수단 자체가 무효** — 관리자 토큰/세션 쿠키 누락·불일치·만료 (`requireAdmin`) |
| `INVALID_CREDENTIALS` | 401 | **인증은 유효하나 본문으로 재확인한 자격 증명이 불일치.** `POST /admin/password` 의 `currentPassword` **전용** (§12.4) — 다른 엔드포인트는 이 code 를 내지 않는다 |
| `NOT_FOUND` | 404 | 존재하지 않는 리소스/경로 |
| `PAYLOAD_TOO_LARGE` | 413 | 요청 body 16KB 초과 |
| `RATE_LIMITED` | 429 | 4.3절 한도 초과. `Retry-After` 헤더(초) 동봉 |
| `LINK_FETCH_FAILED` | 422 | 링크 메타데이터 추출 실패·차단 (§13.2) |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 (상세는 서버 로그에만 — 응답에 스택/내부정보 금지) |

`message`는 한국어 사용자 안내 문구. `code`는 안정 계약 (변경 시 리더 승인 + web-developer 통보).

**`UNAUTHORIZED` ↔ `INVALID_CREDENTIALS` 분리 근거 (2026-08-17, 계약 개정 1):** 둘 다 401 이지만 프론트의 올바른 대응이 다르다. `UNAUTHORIZED` 는 세션이 죽은 것이므로 **로그인 화면으로 전환**해야 하고, `INVALID_CREDENTIALS` 는 세션이 살아 있는데 입력값이 틀린 것이므로 **필드 인라인 에러**로 표시하고 화면을 유지해야 한다. 같은 code 면 구분이 불가능하다. 프론트는 `http.ts` 의 `CODE_TO_REASON` 에 `INVALID_CREDENTIALS: "invalid-credentials"` 를 등록해야 한다 — **미등록 code 는 `"network"` 로 잘못 분류된다.**

**현재 프론트의 에러 처리 실태 (중요):** guestbook.ts는 `response.ok === false`이면 에러 body를 **읽지 않고** 일괄 `reason: "network"`로 처리한다 (L77–83, L129–135). 즉 위 code 목록은 현 시점 프론트가 분기하지 않으며, 분기하려면 프론트 계약 확장이 필요하다 → 3절 제안 C. 백엔드는 프론트 대응 여부와 무관하게 처음부터 이 형식으로 응답한다 (형식을 나중에 바꾸는 것이야말로 경계면 버그의 원인).

### 2.5 부수 엔드포인트

- `GET /health` → `200 { "status": "ok" }` — 배포/모니터링용. 프론트 미사용. 인증 없음, rate limit 완화.

---

## 3. 계약 변경 제안 (프론트 guestbook.ts 확장이 필요한 항목 — 임의 확장 금지, 리더 경유 web-developer 합의 필요)

현 명세는 **프론트 수정 0으로 동작한다.** 아래는 개선을 위한 제안이며, 승인 전에는 반영하지 않는다.

| # | 제안 | 프론트 변경 내용 | 백엔드 영향 | 우선순위 |
|---|---|---|---|---|
| A | 목록 페이지네이션 파라미터 사용 | `listGuestbookEntries(options?: { limit?: number; offset?: number })`로 시그니처 확장 + 쿼리스트링 부착 | 없음 (서버는 이미 지원, 5절) | 글 50건 초과 시점에 |
| B | 총 건수 노출 | `X-Total-Count` 헤더를 읽어 반환값에 포함하거나, 봉투 응답으로 전환 | 봉투 전환 시 breaking — 헤더 방식 권장 | 낮음 |
| C | 에러 code 분기 | `!response.ok`일 때 body를 파싱해 `error.code`별 사용자 메시지 분기 (특히 `RATE_LIMITED`(429)와 `VALIDATION_ERROR`(400)는 "네트워크 오류"가 아니라 정확한 안내가 필요) | 없음 (서버는 이미 해당 형식으로 응답) | **높음 — 등록 실패 UX에 직결** |

주의: 제안 B에서 응답을 `{ items, total }` 봉투로 바꾸는 것은 **breaking change**다. 현 프론트는 최상위 배열이 아니면 전체를 `invalid-response` 처리하므로, 봉투 전환은 프론트·백엔드 동시 배포가 강제된다. 헤더 방식(비파괴)을 권장한다.

---

## 4. 보안 설계

### 4.1 개인정보 최소 수집

- **수집 항목: 닉네임(author) + 본문(body). 그 외 없음.** 실명·사번·이메일·연락처는 수집하지 않는다.
- 프론트 UI에도 실명 입력을 유도하는 문구를 두지 않도록 web-developer에 전달한다.
- **예외 — IP 주소 (리더 명시 승인 요청 항목):** 스팸 방지(rate limit)와 악성 게시물 대응을 위해 작성 시점의 클라이언트 IP를 다루게 된다. 최소화 설계:
  - rate limit 카운터는 **메모리에만** 유지 (윈도 경과 시 소멸, DB 저장 없음)
  - DB에는 원문 IP가 아닌 **서버 시크릿 salt를 섞은 HMAC-SHA-256 해시**(`ip_hash`)만 저장 — 동일 IP의 반복 어뷰징 식별용이며 역산 불가
  - 보존 90일 후 배치로 NULL 처리
  - **원문 IP를 DB·로그에 저장하지 않는다**
  - 이 항목(ip_hash 저장 여부·보존 기간)은 개인정보 관련 수집이므로 **리더 승인 필요**. 불승인 시 rate limit(메모리)만 운용하고 `ip_hash` 컬럼은 제거한다.
- 로그에는 개인정보(본문·닉네임·IP 원문)를 남기지 않는다. 요청 ID·경로·상태 코드·소요 시간 중심.

### 4.2 서버측 입력 검증 규칙 (`POST /guestbook`)

프론트 검증은 UX일 뿐이며 아래 규칙은 서버에서 강제한다. 위반 시 `400 VALIDATION_ERROR`.

| 필드 | 규칙 |
|---|---|
| `author` | 필수, string. trim 후 **1자 이상 20자 이하** (유니코드 코드포인트 기준). 제어 문자(개행 포함) 거부 |
| `body` | 필수, string. trim 후 **1자 이상 500자 이하** (코드포인트 기준). 개행 허용, 그 외 제어 문자 거부 |
| 공통 거부 조건 | (1) string 아닌 타입, (2) trim 후 빈 값, (3) 길이 초과, (4) 이중 방어: `<script`, `javascript:`, `onerror=` 등 스크립트 패턴 포함 시 거부 — 저장은 원문 그대로, 이스케이프는 렌더 계층 책임이되 명백한 공격 페이로드는 입구에서 차단, (5) URL 3개 이상 포함 시 거부 (스팸 휴리스틱) |
| 요청 크기 | body 전체 16KB 초과 시 `413` (Fastify `bodyLimit`) |
| 미지 필드 | 조용히 무시 (에러 아님 — 프론트 계약이 추가 필드를 보내게 되어도 하위 호환) |

한도 근거: author 20자·body 500자는 방명록 용도에 충분하며 프론트 UI(입력 폼 maxLength)와 동일 수치로 맞추도록 web-developer에 통보한다.

### 4.3 스팸 방지 (구체 수치)

| 계층 | 정책 |
|---|---|
| IP rate limit — 쓰기 | `POST /guestbook`: **IP당 1분에 3회, 1시간에 10회, 24시간에 30회**. 초과 시 `429` + `Retry-After` |
| 연속 등록 제한 | 동일 IP의 **직전 등록 후 30초 이내 재등록 거부** (429). 도배의 1차 차단선 |
| 중복 내용 제한 | 동일 IP가 동일 `body`를 24시간 내 재등록 시 거부 (400 `VALIDATION_ERROR`, "이미 등록된 내용입니다") |
| IP rate limit — 읽기 | `GET /guestbook`: IP당 1분 60회 (스크래핑 완화) |
| 관리자 경로 | `DELETE /admin/*`: IP당 1분 10회 (토큰 무차별 대입 완화) |
| 단계적 강화 (사전 합의만, 미구현) | 문제 발생 시: 허니팟 필드 → 관리자 승인제 순으로 강화. 허니팟 필드 추가는 프론트 계약 변경이므로 그 시점에 재합의 |

rate limit 상태는 메모리 저장 (VM 1대·단일 프로세스이므로 충분. 프로세스 재시작 시 카운터 초기화는 수용 가능한 트레이드오프).

### 4.4 CORS

- 허용 Origin (배포 단계에서 최종 확정, `*` 금지):
  - `https://koscomlabor.cloud`
  - `https://www.koscomlabor.cloud`
  - `https://onnuri.koscomlabor.cloud`
- 허용 메서드: `GET, POST` (admin DELETE는 브라우저 교차 출처 사용을 상정하지 않음 — 허용 목록에서 제외)
- 허용 헤더: `Content-Type, Accept`
- 자격증명(cookies) 불사용: `Access-Control-Allow-Credentials` 미설정
- 로컬 개발: `http://localhost:3000`은 개발 환경 변수로만 허용 (프로덕션 빌드에서 제외)

### 4.5 관리자 삭제 인증 방식 (제안 — 리더 승인 필요)

**정적 Bearer 토큰 방식**을 제안한다. 관리자가 소수(지부 담당자 1–2인)이고 삭제 단일 기능뿐인 현 단계에서 계정 시스템·JWT는 과설계다.

- 서버 환경변수 `ADMIN_API_TOKEN`에 **32바이트 이상 무작위 토큰** (`openssl rand -base64 32`로 생성) 저장. `.env.example`에는 키 이름만
- 요청: `Authorization: Bearer <토큰>` — **HTTPS 전용이므로 전송 구간 안전**
- 서버 비교는 **상수 시간 비교** (`crypto.timingSafeEqual`) — 타이밍 공격 차단
- `/admin/*` 경로 자체에 rate limit(4.3절) — 무차별 대입 완화
- 토큰 사용(삭제 성공/실패)은 감사 로그 기록 (대상 id·시각·결과만, 본문 미기록)
- 유출 시 대응: 환경변수 교체 + 재시작으로 즉시 회전 가능
- 향후 관리자 UI가 생기면 그 시점에 세션 기반 인증으로 승격 (현 단계 범위 밖)

---

## 5. 페이지네이션 정책

**제약: 프론트 계약상 `GET /guestbook` 응답은 최상위 배열이어야 하며, 현 프론트는 쿼리 파라미터를 보내지 않는다.** 이 제약 안에서:

1. **기본 동작 (현 프론트, 파라미터 없음):** 최신순(`createdAt DESC, id DESC` — 동시각 안정 정렬) **상위 50건**의 배열을 반환한다. 무제한 반환은 하지 않는다 (글이 수천 건이 되면 응답이 비대해지고, 상한을 나중에 도입하는 것이 오히려 동작 변경이 된다 — 처음부터 상한을 계약으로 명시).
2. **선택 파라미터 (서버는 지금부터 지원, 프론트는 제안 A 승인 후 사용):** `?limit=`(1–100, 기본 50) `&offset=`(≥0, 기본 0). 응답 shape은 동일한 최상위 배열 — 계약 비파괴.
3. **전체 건수:** `X-Total-Count` 응답 헤더 (body 불변, 비파괴).
4. offset 방식 선택 사유: 방명록 규모(수백–수천 건)에서 성능 문제 없고, 커서 방식은 프론트 계약 확장 폭이 커진다. 규모가 커지면 그 시점에 커서 전환을 별도 제안한다.

**프론트 노출 유의:** 기본 50건 상한은 "최근 50개만 보임"을 의미한다. 이 사실을 리더/웹개발자에게 공유하고, 초과 시점 전에 제안 A(페이지네이션 UI)를 진행한다.

---

## 6. DB 스키마 (마이그레이션 파일 전제)

마이그레이션 도구: `node-pg-migrate` (SQL 우선, 이력 관리). 콘솔 수동 변경 금지.

`migrations/001_create_guestbook_entries.sql`:

```sql
-- UUID 생성 (PostgreSQL 13+: gen_random_uuid()는 내장 pgcrypto 불필요)
CREATE TABLE guestbook_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author      varchar(80)  NOT NULL,  -- 20 코드포인트 검증은 앱 계층. 80은 UTF-8 여유 상한
  body        varchar(2000) NOT NULL, -- 500 코드포인트 검증은 앱 계층
  ip_hash     char(64),               -- HMAC-SHA-256 hex. 4.1절 리더 승인 대상. 불승인 시 컬럼 제거
  created_at  timestamptz  NOT NULL DEFAULT now(),
  deleted_at  timestamptz              -- soft delete (2.3절). NULL = 표시 대상
);

-- 목록 조회: 미삭제 글 최신순
CREATE INDEX idx_guestbook_list
  ON guestbook_entries (created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- 중복 내용 제한(4.3절) 조회용
CREATE INDEX idx_guestbook_ip_hash
  ON guestbook_entries (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;
```

컬럼 ↔ API 필드 매핑 (경계 변환):

| DB 컬럼 (snake_case) | API 필드 (camelCase) | 변환 |
|---|---|---|
| `id` (uuid) | `id` (string) | `uuid` → 문자열 직렬화 |
| `author` | `author` | 그대로 |
| `body` | `body` | 그대로 |
| `created_at` (timestamptz) | `createdAt` (string) | `.toISOString()` — ISO 8601 UTC |
| `ip_hash`, `deleted_at` | (노출 안 함) | API 응답에 절대 포함 금지 — Fastify 응답 스키마가 차단 |

---

## 7. QA 연계 준비 (구현 단계에서 제출할 것)

- 각 엔드포인트의 실제 curl 응답 캡처를 이 문서 옆에 병기 (명세 ↔ 실응답 대조)
- 경계값 테스트 케이스: author 0자/20자/21자, body 0자/500자/501자, 필수 필드 누락, `<script>` 포함 본문, 미지 필드 포함 요청, 숫자 타입 author, 1분 4회 연속 POST(429 확인), 30초 내 재등록(429), 동일 본문 재등록(400), 잘못된 admin 토큰(401), 삭제된 id 재삭제(404)
- 프론트 타입 대조표는 2.1/2.2의 표를 기준으로 qa-tester가 교차 검증

---

## 8. 리더 승인 결과 (2026-08-16)

리더가 8절(구 결정 요청) 전 항목을 승인했다: ① 명세 전체·최상위 배열 응답 ② ip_hash 저장 (HMAC·90일·원문 미저장/미로깅) ③ 정적 Bearer 토큰 ④ 기본 50건 ⑤ 계약 변경 A·C (web-developer가 프론트 연동 시 반영 — 백엔드는 guestbook.ts 를 수정하지 않는다) ⑥ 한도 20/500.

## 8-구. 리더 승인 필요 사항 (구현 착수 전 결정 요청 — 승인 완료, 기록 보존)

1. **이 명세 전체** — 특히 응답 shape (최상위 배열 유지) 승인
2. **`ip_hash` 저장** (4.1절) — 스팸 대응용 IP 해시의 DB 보관(90일) 가부. 불승인 시 메모리 rate limit만 운용
3. **관리자 인증 방식** (4.5절) — 정적 Bearer 토큰 방식 가부
4. **목록 기본 상한 50건** (5절) — web-developer에게 공유 필요
5. **계약 변경 제안 A·C** (3절) — web-developer와의 합의 개시 여부 (백엔드 구현은 승인과 무관하게 현 계약으로 진행 가능)
6. **입력 한도 수치** (author 20자 / body 500자) — 프론트 폼 maxLength와 동일 수치로 맞추도록 web-developer 통보

---

## 9. 로컬 실측 결과 (2026-08-16, macOS + PostgreSQL 16.15 + Node 26)

구현: `server/` (Fastify 5). 서버 기동 후 curl로 전 엔드포인트 실측. 원본 캡처 스크립트·전체 출력은 QA 인수인계 시 재실행 가능 (`server/` 로컬 구동 절차는 07 문서 참조).

### 9.1 명세 ↔ 실응답 대조 (pass/fail)

| # | 케이스 | 기대 | 실측 | 판정 |
|---|---|---|---|---|
| T01 | GET /guestbook (빈 목록) | 200, `[]`, X-Total-Count: 0 | 동일 | PASS |
| T02 | POST 정상 등록 | 201, 단일 객체 4필드 | `{"id":"4f02…","author":"테스트조합원","body":"…","createdAt":"2026-08-16T02:08:01.771Z"}` | PASS |
| T03 | 등록 30초 내 재등록 | 429 RATE_LIMITED + Retry-After | 429, `retry-after: 30`, code=RATE_LIMITED | PASS |
| T04r | author 누락 | 400 VALIDATION_ERROR | 400, "닉네임(author)은 필수 문자열입니다." | PASS |
| T05r | author 21자 | 400 | 400, "닉네임은 20자 이하여야 합니다." | PASS |
| T06r | body 501자 | 400 | 400, "본문은 500자 이하여야 합니다." | PASS |
| T07r | `<script>` 포함 본문 | 400 | 400, "허용되지 않는 내용이 포함되어 있습니다." | PASS |
| T08r | author 숫자 타입 | 400 | 400 | PASS |
| T09r | 공백뿐인 본문 | 400 | 400, "본문을 입력해 주세요." | PASS |
| T26 | URL 3개 포함 | 400 (스팸 휴리스틱) | 400, "링크는 2개까지만 포함할 수 있습니다." | PASS |
| T10 | 20KB 본문 | 413 PAYLOAD_TOO_LARGE | 413, code=PAYLOAD_TOO_LARGE | PASS |
| T11 | 미지 경로 | 404 NOT_FOUND | 404, code=NOT_FOUND | PASS |
| T12 | ?limit=0 | 400 | 400, code=VALIDATION_ERROR | PASS |
| T13 | 동일 IP·동일 본문 24h 내 재등록 | 400 "이미 등록된 내용입니다" | 동일 | PASS |
| T14 | 미지 필드 포함 + 공백 author | 201, 미지 필드 무시·trim 적용 | 201, 응답에 4필드만, author trim됨 | PASS |
| T15 | GET (2건) | 200, 최신순 배열, X-Total-Count: 2 | 동일 (최신 글이 배열 첫 원소) | PASS |
| T16 | ?limit=1&offset=1 | 200, 두 번째 글만 | 동일 | PASS |
| T17 | 관리자 삭제: 토큰 없음 | 401 UNAUTHORIZED | 401 | PASS |
| T18 | 관리자 삭제: 잘못된 토큰 | 401 | 401 | PASS |
| T19 | 관리자 삭제: UUID 아님 | 400 | 400, "id 는 UUID 형식이어야 합니다." | PASS |
| T20 | 관리자 삭제: 정상 | 200 `{deleted:true,id}` | 동일 (soft delete) | PASS |
| T21 | 삭제된 id 재삭제 | 404 | 404, "해당 글이 없거나 이미 삭제되었습니다." | PASS |
| T22 | 삭제 후 목록 | 삭제 글 제외, X-Total-Count: 1 | 동일 | PASS |
| T23 | CORS: 허용 Origin preflight | ACAO 헤더 포함 | `access-control-allow-origin` 반환, 메서드 GET/POST만 | PASS |
| T24 | CORS: 비허용 Origin | ACAO 헤더 없음 (브라우저 차단) | ACAO 미반환 | PASS |
| T25 | GET 분당 60회 초과 | 61회째부터 429 | 65회 중 200×54·429×11 (사전 GET 카운트 포함), Retry-After 동봉 | PASS |
| T27 | 경계값: author 20자·body 500자 | 201 (정확히 상한은 허용) | 201, 응답 4필드·길이 20/500 | PASS |

**27/27 PASS.** 유의: 검증 400 테스트는 직전 성공 등록 후 30초 이후에 수행해야 한다 — rate limit 검사가 입력 검증보다 앞서므로(자원 보호 원칙) 30초 이내에는 내용과 무관하게 429가 반환된다. QA 시나리오 작성 시 이 순서를 반영할 것.

### 9.2 실응답 ↔ 프론트 `parseGuestbookEntry` 대조

T02/T14/T27 실응답 모두: 필드 정확히 `id`, `author`, `body`, `createdAt` 4개 · 전부 string · `createdAt` ISO 8601 UTC(밀리초+Z) · 추가 필드 없음(Fastify 응답 스키마가 차단, T14의 미지 필드 미반사 확인). 목록은 최상위 배열. → guestbook.ts 파서 기준 전 항목 통과.

### 9.3 개인정보 실측 확인

- DB: `ip_hash` 64자 hex(HMAC-SHA-256)만 저장, 원문 IP 컬럼 없음 (psql 확인)
- 서버 로그: 요청 ID·메서드·경로·상태코드·소요시간만 기록. 본문·닉네임·클라이언트 IP 미기록 (grep 확인 — 127.0.0.1 은 기동 시 자체 바인드 주소 1건뿐)

---
---

# Part 2 — 게시물(공지·소식) DB 전환 + Admin 명세 (2026-08-16, 승인 대기 — 구현 금지 상태)

**계약 방향 주의 (방명록과 반대)**: Part 1(방명록)은 프론트 `guestbook.ts`가 계약의 출처였다. **Part 2는 이 명세가 계약의 단일 출처이고 프론트가 명세를 따라온다** (파일 기반 `content.ts`의 `PostSummary`/`PostDetail`은 파일 시대의 타입으로, 이번 전환에서 프론트가 API 계약에 맞춰 재작성됨). 기존 프론트 타입과의 매핑은 §11.4.

## 10. 데이터 모델

### 10.1 `posts` 테이블

```sql
CREATE TABLE posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 2026-08-17: 'education' 추가 (마이그레이션 1755300000004). 현재 유효 도메인은 3값 — §19
  category      text NOT NULL CHECK (category IN ('notice','news','education')),
  type          text NOT NULL CHECK (type IN ('link','article')),
  title         varchar(300)  NOT NULL,          -- 링크형: 메타데이터 자동 추출 후 admin이 수정 가능
  body          text,                            -- 작성형: markdown 필수 / 링크형: 선택(한줄 코멘트)
  url           text,                            -- 링크형 필수 (http/https)
  source        varchar(200),                    -- 작성형 출처. news+article은 필수(기존 원칙 계승), notice는 선택
  urgent        boolean NOT NULL DEFAULT false,
  deadline      date,                            -- KST 마감일 (마감 스트립·D-n 배지용). NULL = 마감 없음
  published_at  timestamptz NOT NULL DEFAULT now(),  -- 표시·정렬 기준 게시일. 자동 기록·수정 불가 (리더 판정 §15-6: 게시 시점 투명성 — 원문서 발행일은 본문·출처로 표기)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,                     -- soft delete
  -- 2026-08-17 추가 (마이그레이션 1755300000005) — 둘 다 nullable, 상세는 §20
  sort_order    integer,                         -- 수동 표시 순서. NULL = 지정 없음
  thumbnail_key text,                            -- 서버 캐싱한 썸네일 파일명. NULL = 없음
  CONSTRAINT posts_link_needs_url     CHECK (type <> 'link'    OR url  IS NOT NULL),
  CONSTRAINT posts_article_needs_body CHECK (type <> 'article' OR body IS NOT NULL),
  CONSTRAINT posts_news_article_needs_source
    CHECK (NOT (category = 'news' AND type = 'article') OR source IS NOT NULL)
);

-- 2026-08-17: sort_order 를 반영해 재생성 (§20.1)
CREATE INDEX idx_posts_list
  ON posts (category, urgent DESC, sort_order ASC NULLS LAST, published_at DESC, id DESC)
  WHERE deleted_at IS NULL;
```

- 링크형의 출처 = URL 자체 (§14 게시 정책). `source` 컬럼은 링크형에서 사용하지 않음(NULL)
- 정렬 규약 (2026-08-17 개정 — §20.2): **urgent 우선 → sort_order 오름차순(NULLS LAST) → published_at 내림차순 → id 내림차순.** 서버가 정렬 책임을 지며 공개·admin 전 목록에 동일 적용한다
- **분류(category) 도메인**: `notice` \| `news` \| `education`. 세 분류는 스키마·검증·정렬·CRUD 를 **완전히 공유**하며, 유일한 비대칭은 `posts_news_article_needs_source` 뿐이다 (news+article 에만 출처 강제 — education 은 강제하지 않음, 근거 §19.2)
- 위 SQL 은 **현재 유효 스키마**다. 실제 적용은 두 파일로 나뉘어 있다 — `1755300000001_create-posts.sql`(원본, `notice`/`news`) + `1755300000004_add-education-category.sql`(제약 교체). 신규 환경을 0001 부터 순서대로 올리면 위와 같은 상태가 된다

### 10.2 `post_attachments` 테이블

```sql
CREATE TABLE post_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid NOT NULL REFERENCES posts(id),
  filename     varchar(255) NOT NULL,   -- 원본 파일명 (표시·다운로드명)
  storage_key  varchar(255) NOT NULL,   -- 저장 키 (uuid.<ext>). 로컬 볼륨 → Object Storage 이전 시에도 키 유지
  mime_type    varchar(100) NOT NULL,
  size_bytes   bigint NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX idx_attachments_post ON post_attachments (post_id) WHERE deleted_at IS NULL;
```

### 10.3 `admin_sessions` 테이블

```sql
CREATE TABLE admin_sessions (
  token_hash   char(64) PRIMARY KEY,    -- 세션 토큰의 SHA-256 hex (원문 토큰 비저장)
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now()
);
```

### 10.4 `admin_credentials` 테이블 (2026-08-17 추가 — 비밀번호 변경 기능)

마이그레이션: `server/migrations/1755300000003_create-admin-credentials.sql`

```sql
CREATE TABLE admin_credentials (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- 단일 행 강제
  password_hash text NOT NULL,          -- argon2id
  seeded_at     timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz            -- NULL = 초기(시드) 비밀번호 그대로
);
```

- **단일 행 강제**: `CHECK (id = 1)` — 관리자 계정은 1개(비밀번호 단일)라는 현 운영 모델을 스키마로 고정
- `updated_at IS NULL` → 초기 비밀번호 (`GET /admin/me` 의 `passwordIsInitial = true`)
- 한 번이라도 변경하면 `updated_at` 이 채워지고 **영구히 false** (초기 비밀번호로 되돌려도 false — 실측 확인 §18)
- 이 테이블이 **비밀번호 해시의 권위 저장소**다. `ADMIN_PASSWORD_HASH` 환경변수와의 관계는 §12.3

## 11. 공개 API (인증 없음)

공통: camelCase, ISO 8601 UTC, 에러 형식 `{ error: { code, message } }` (§2.4 코드 체계 공유).

### 11.1 `GET /posts?category=&urgent=&limit=&offset=`

| 파라미터 | 규칙 |
|---|---|
| `category` | 필수. `notice` \| `news` \| `education` (2026-08-17 education 추가 — §19). 그 외 값·누락은 `400 VALIDATION_ERROR` `category 는 notice, news, education 중 하나여야 합니다 (필수).` |
| `urgent` | 선택. `true`면 urgent 글만 (히어로/긴급 배너 바인딩: `?category=notice&urgent=true&limit=1`) |
| `limit`/`offset` | 방명록과 동일 (limit 1–100 기본 50, offset ≥ 0) |

응답 `200`: **최상위 배열** (방명록과 shape 규약 통일 — 승인 항목 §15-1) + `X-Total-Count` 헤더. 원소 = PostSummary:

```json
{
  "id": "uuid", "category": "notice", "type": "link",
  "title": "...", "url": "https://... | null", "source": "... | null",
  "urgent": false, "deadline": "2026-09-01 | null",
  "publishedAt": "2026-08-16T02:00:00.000Z",
  "attachments": [ { "id": "uuid", "filename": "공문.pdf", "mimeType": "application/pdf",
                     "sizeBytes": 123456, "url": "/files/<attachmentId>/공문.pdf" } ],
  "thumbnailUrl": "/thumbnails/ATbGKR-Agmk-maxresdefault.jpg | null"
}
```

`body`는 목록에서 제외 (상세에서만). `attachments[].url`·`thumbnailUrl`은 API 도메인 상대 경로 — 프론트가 base URL을 붙임.

**`thumbnailUrl`** (2026-08-17 추가 — §20.4/§20.6): 링크형 YouTube 게시물의 서버 캐싱 썸네일. 그 외에는 `null`. **`sortOrder` 는 공개 응답에 없다** (admin 전용 — §20.6).

### 11.2 `GET /posts/:id`

응답 `200`: PostSummary + `"body": "markdown 원문 | null"`. 없는 id/삭제된 글: `404 NOT_FOUND`.

### 11.3 첨부 공개 서빙 `GET /files/:attachmentId/:filename`

- DB 조회로만 storage_key 해석 (경로 조작 원천 차단 — 사용자 입력이 파일시스템 경로에 닿지 않음)
- `:filename`은 다운로드 표시명 용도 (DB의 filename과 불일치 시 404)
- `Content-Disposition: inline`(이미지)/`attachment`(pdf), `Cache-Control: public, max-age=31536000, immutable` (storage_key가 내용 불변이므로)

### 11.4 기존 프론트 타입과의 매핑 (프론트 재작성 가이드)

| 기존 content.ts (파일 기반) | 신규 API | 비고 |
|---|---|---|
| `slug: string` | `id: string` (uuid) | 상세 라우트 `/notices/[slug]` → `/notices/[id]` |
| `dateIso`/`dateLabel`/`dateValue` | `publishedAt` 하나 | 표시 포맷·정렬값은 프론트 파생 계층(date.ts) 책임 — API는 정본만 제공 |
| `category: "notice"\|"news"\|"page"` | `"notice"\|"news"\|"education"` | `page`는 DB 전환 대상 아님 (파일 유지). `education` 은 2026-08-17 신설 (§19) |
| `urgent`, `deadline`, `source`, `title`, `body` | 동명 필드 | deadline은 `YYYY-MM-DD` 문자열 유지 |
| (없음) | `type`, `url`, `attachments` | 신규 — 링크 카드/첨부 UI 필요 |
| `verified` frontmatter | (없음) | §14 게시 정책으로 대체 |

## 12. Admin 인증

### 12.1 방식: 비밀번호 → 서버 세션 (httpOnly 쿠키)

- **비밀번호 저장**: 환경변수 `ADMIN_PASSWORD_HASH` = **argon2id** 해시 (생성 스크립트 제공 예정). argon2id 선택 사유: 메모리 하드 — GPU 대입에 강함. alpine(musl) prebuilt 확인 후 빌드 이슈 시 bcrypt로 대체 (승인 항목 §15-3)
- `POST /admin/login` body `{ "password": "..." }` → 검증 성공 시:
  - 토큰: 32바이트 무작위 → **SHA-256 해시만 DB 저장** (DB 유출 시에도 세션 탈취 불가)
  - 만료: 발급 후 **12시간** + 사용 시 `last_used_at` 갱신, 만료분은 로그인 시 배치 삭제
  - 쿠키: `Set-Cookie: admin_session=<토큰>; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=43200` — **host-only** (union-api 도메인, Domain 속성 미설정)
  - 응답 `200 { "ok": true, "expiresAt": "..." }` / 실패 `401 UNAUTHORIZED` (계정 존재 여부 힌트 없는 단일 메시지)
- `POST /admin/logout` → 세션 삭제 + 쿠키 만료. `GET /admin/me` → 세션 유효성 확인 (admin UI 초기 로드용) — **응답 확장은 아래 §12.1-a**
- **CORS 변경 필요**: admin UI는 www.koscomlabor.cloud(프론트)에서 union-api로 fetch — 같은 사이트(eTLD+1 동일)이므로 SameSite=Lax 쿠키가 전송되지만, **CORS에 `Access-Control-Allow-Credentials: true` 추가 필요** (허용 Origin은 기존 명시 목록 유지, `*` 불가 — 승인 항목 §15-2)
- 로그인 rate limit: **IP당 1분 5회, 1시간 10회** (429). 실패도 카운트 (대입 방어)
- 감사 로그: 로그인 성공/실패(IP 해시), 세션 발급·만료 — 비밀번호·토큰 원문 미로깅

### 12.1-a `GET /admin/me` 응답 확장 (2026-08-17)

인증: 기존과 동일 (`requireAdmin` — 세션 쿠키 또는 정적 Bearer).

```jsonc
{
  "ok": true,
  "method": "session" | "bearer",
  "expiresAt": "2026-08-17T12:00:00.000Z" | null,
  "passwordIsInitial": true | false   // ← 신규 필드
}
```

- `passwordIsInitial`: `admin_credentials.updated_at IS NULL` 일 때 `true`. 즉 **배포 시 env 로 시드된 초기 비밀번호를 아직 한 번도 바꾸지 않은 상태**. admin UI 는 이 값이 true 면 경고 배너 + 변경 CTA 를 상시 표시한다 (강제 차단은 하지 않음 — 리더 확정)
- 기존 필드(`ok`/`method`/`expiresAt`)의 의미·타입은 **변경 없음** (하위 호환). 응답 스키마 serializer 로 이 4개 필드만 직렬화된다
- 프론트 하위 호환 방어: 구버전 API 와 신버전 프론트가 잠시 공존할 수 있으므로, `passwordIsInitial` 이 boolean 이 아니면 프론트는 `false` 로 간주한다 (`invalidResponse` 로 처리하지 않음)

### 12.2 기존 방명록 정적 토큰과의 관계 (판단)

**병행 운영을 제안**한다: ① 기존 `Authorization: Bearer ADMIN_API_TOKEN` (curl 운영 경로 — 유지) ② 신규 세션 쿠키 (admin UI 경로). 방명록 `DELETE /admin/guestbook/:id` 및 신규 admin 엔드포인트 전부 **둘 중 하나면 인증 통과**. 사유: 장애 시 UI 없이도 curl 복구 경로 확보, 마이그레이션 리스크 0. UI 정착 후 정적 토큰 폐기는 별도 결정 (승인 항목 §15-4).

### 12.3 비밀번호 저장 위치: env → DB 전환 (2026-08-17)

**문제:** `ADMIN_PASSWORD_HASH` 는 `config.ts` 가 **기동 시 1회만** 읽어 `config.adminPasswordHash` 에 담아두는 값이었다. 런타임에 바꿀 방법이 없어, 비밀번호 변경이 곧 "SSH 접속 → 해시 생성 → .env 수정 → 컨테이너 재기동"이었다 (노조 담당자가 수행 불가).

**전환:** 해시의 권위 저장소를 `admin_credentials`(§10.4) 로 옮긴다.

| 항목 | 규칙 |
|---|---|
| 부팅 시드 | `INSERT INTO admin_credentials (id, password_hash) VALUES (1, $env) ON CONFLICT (id) DO NOTHING` — 앱 조립(`buildApp`) 중 1회 |
| env 의 역할 | **최초 부팅 시드 전용.** 행이 이미 있으면 env 값은 무시된다. 즉 `.env` 의 해시를 바꿔도 가동 중인 서버의 비밀번호는 바뀌지 않는다 |
| env 필수 여부 | **필수 유지** — 최초 배포 시드 + 설정 누락 조기 감지 (`config.ts` 검증 그대로) |
| 인증 시 조회 | `POST /admin/login` 과 `POST /admin/password` 는 **매 요청 DB 에서 활성 해시를 읽는다** → 변경이 재기동 없이 즉시 반영 |
| 행 부재 시 | 방어적으로 env 시드 해시로 폴백하고 경고 로그를 남긴다 (행이 없다는 이유로 관리자가 잠기지 않게) |
| 시드 실패 시 | **기동 거부** — DB 연결 불가/테이블 부재를 조용히 넘기지 않는다 (`config.ts` 의 "런타임에 조용히 깨지는 것 금지" 원칙 계승). 배포 순서상 **마이그레이션이 API 재기동보다 먼저** 적용돼야 한다 |

### 12.4 `POST /admin/password` — 비밀번호 변경 (신규, 2026-08-17)

인증: `requireAdmin` (세션 쿠키 또는 정적 Bearer). **인증만으로는 부족하고 현재 비밀번호를 본문으로 재확인해야 한다** — 자리를 비운 브라우저·탈취된 세션으로 비밀번호가 바뀌는 것을 막는다.

요청 본문: `{ "currentPassword": "…", "newPassword": "…" }`

**검증 순서 (이 순서 그대로 구현·검증한다):**

| # | 조건 | 상태 | code | message |
|---|------|------|------|---------|
| 0 | rate limit 초과 (loginLimiter) | 429 | `RATE_LIMITED` | 공통 문구 + `Retry-After` |
| 1 | `currentPassword`/`newPassword` 가 문자열이 아니거나 빈 문자열이거나 200자 초과 | 400 | `VALIDATION_ERROR` | `currentPassword 와 newPassword 는 1자 이상 200자 이하의 문자열이어야 합니다.` |
| 2 | `newPassword.length < 12` | 400 | `VALIDATION_ERROR` | `새 비밀번호는 12자 이상이어야 합니다.` |
| 3 | `newPassword === currentPassword` | 400 | `VALIDATION_ERROR` | `새 비밀번호가 현재 비밀번호와 같습니다.` |
| 4 | `argon2.verify(활성해시, currentPassword)` 실패 | 401 | `INVALID_CREDENTIALS` | `현재 비밀번호가 일치하지 않습니다.` |

12자 하한은 `scripts/hash-password.mjs`·`scripts/set-password.mjs` 와 동일 기준이다.

**200 성공 응답:**

```jsonc
{ "ok": true, "changedAt": "2026-08-17T12:00:00.000Z", "sessionsRevoked": 2 }
```

- `changedAt`: ISO 8601 UTC (`admin_credentials.updated_at`)
- `sessionsRevoked`: 이번 변경으로 무효화된 **다른** 세션 수 (정수, 0 이상)

**부수 효과:**

1. `admin_credentials.password_hash` = argon2id(newPassword), `updated_at = now()` → 이후 `passwordIsInitial` 영구 false
2. **세션 쿠키로 호출**: 현재 세션 토큰을 제외한 모든 `admin_sessions` 삭제 (현재 브라우저는 로그인 유지)
   **Bearer 로 호출**: 유지할 현재 세션이 없으므로 전 세션 삭제
   — 만료 세션을 먼저 정리(`pruneExpired`)한 뒤 삭제하므로 `sessionsRevoked` 는 "실제로 살아 있던 다른 세션 수"다
3. 로그: `{ route: "admin-password-change", method, sessionsRevoked }` — **평문·해시 미로깅**
4. 정적 Bearer 토큰(`ADMIN_API_TOKEN`)은 영향받지 않는다 (복구 수단 유지)

**rate limit:** `loginLimiter`(분당 5회/시간당 10회) 버킷을 로그인과 **공유**한다. 진입 시 `check` 만 하고, **#4 실패 시에만 `record`** 한다 (성공한 변경은 카운트하지 않음). 공유 이유: 현재 비밀번호 오입력도 로그인 시도와 동일한 무차별 대입 표면이다.

**복구 경로 (비밀번호 분실):** `server/scripts/set-password.mjs` — stdin 으로 새 비밀번호를 받아 argon2id 해시 후 `admin_credentials` UPSERT + `updated_at = now()` + 전 세션 삭제. `DATABASE_URL` 사용, **API 재기동 불필요**. 절차는 07 문서 §9.4.

## 13. Admin CRUD + 링크 메타데이터 + 파일 업로드 (전부 세션/토큰 인증 + `/admin/*` rate limit)

### 13.1 게시물 CRUD

| 메서드/경로 | 동작 | 성공 |
|---|---|---|
| `POST /admin/posts` | 생성. body = `{ category, type, title, body?, url?, source?, urgent?, deadline? }` — publishedAt 은 서버 자동 기록(수정 불가, §15-6 판정). 10.1 제약을 서버 검증(길이·필수 조합·URL 형식)으로 선행 | `201` Post 상세 shape |
| `PATCH /admin/posts/:id` | 부분 수정 (전달된 필드만). type 변경 시 제약 재검증 | `200` Post 상세 |
| `DELETE /admin/posts/:id` | soft delete (`deleted_at`) — 첨부도 목록에서 숨김(파일은 보존) | `200 { deleted, id }` |
| `GET /admin/posts?category=&limit=&offset=` | 삭제 포함 전체 목록 (`deletedAt`·`sortOrder` 필드 노출) — 관리 화면용. `category` 는 **선택**이고 생략 시 전 분류 | `200` 배열 |
| `POST /admin/posts/reorder` | 분류 내 수동 정렬 (2026-08-17 신설 — §20.3) | `200 { ok, category, updated }` |

검증 수치(안): title 1–300자, body ≤ 50,000자, source ≤ 200자, url ≤ 2,000자·http/https만.

`category` 허용값은 공개 API 와 동일하게 `notice` \| `news` \| `education` 이다 (`POST`/`PATCH` 본문, `GET /admin/posts` 쿼리 모두). 위반 시 `400 VALIDATION_ERROR` `category 는 notice, news, education 중 하나여야 합니다.` (공개 목록과 달리 `(필수)` 접미사가 없다 — admin 목록에서는 생략이 합법이기 때문).

### 13.2 링크 메타데이터 추출 `POST /admin/posts/preview-link`

body `{ "url": "https://..." }` → 응답 `200 { "title": "...", "siteName": "... | null" }` (og:title → `<title>` 순). 실패 시 `422 { error: { code: "LINK_FETCH_FAILED" } }` — admin이 제목 수동 입력으로 진행 (자동 추출은 편의 기능, 실패가 게시를 막지 않음).

**SSRF 방어 (필수 설계)**:

1. 스킴 `http:`/`https:`만, 포트 80/443만
2. **DNS 해석 결과 IP 검증**: 사설·예약 대역 전면 차단 — 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16(메타데이터 서비스), 0.0.0.0/8, 100.64.0.0/10, ::1, fc00::/7, fe80::/10, IPv4-mapped IPv6
3. **DNS 리바인딩 차단**: 검증한 IP로 직접 연결 (커스텀 lookup 고정 — 검증과 연결 사이 재해석 금지)
4. 리다이렉트 최대 3회, **각 홉마다 1–3 재검증**
5. 타임아웃: 연결 3초/전체 8초. 응답 본문 최대 1MB, `Content-Type: text/html`만 파싱
6. 결과는 서버가 저장하지 않음 (admin 확인 후 POST /admin/posts로 확정) — 추출 실패·변조 리스크를 admin 육안 확인이 최종 방어

### 13.3 파일 업로드

| 항목 | 설계 |
|---|---|
| 엔드포인트 | `POST /admin/posts/:id/attachments` (multipart/form-data, 필드명 `file`) → `201` attachment shape / `DELETE /admin/attachments/:id` (soft) |
| 화이트리스트 | **확장자+MIME 이중 검사**: pdf, png, jpg/jpeg, webp. MIME 스니핑(매직 바이트) 검증 — 확장자 위장 차단 |
| 크기 제한 | 파일당 **10MB**, 게시물당 **5개** (승인 항목 §15-5) |
| 저장 | Docker 명명 볼륨 `uploads` → 컨테이너 `/data/uploads/<storage_key>` (storage_key = uuid.ext — 원본 파일명은 DB에만, 파일시스템에 사용자 입력 미반영) |
| Object Storage 이전 여지 | 저장 계층을 `storage_key` 기반 인터페이스로 추상화 — 이전 시 서빙 경로만 교체, DB 무변경 |
| 백업 | 기존 pg_dump 크론에 uploads 볼륨 tar 백업 추가 (03:05 KST, 동일 14일 롤링) — 07 문서 갱신 예정 |
| nginx/caddy | 요청 크기 상한을 caddy 블록에서 12MB로 상향 필요 (현재 방명록 기준) |

## 14. 게시 정책 (명문화 — 리더 지시 반영)

1. **admin 인증자가 게시한 글 = 지부 공식 게시.** 내용 검증 책임은 인증된 담당자(사람)에게 있다. 백엔드는 인증·형식 검증만 수행하고 내용의 사실성을 판단하지 않는다
2. **링크형은 URL 자체가 출처다.** 별도 source 불요. 작성형은 기존 원칙 계승 — news는 출처 필수
3. **기존 verified 파일 게이트는 AI 경유 게시(파일 기반 content/)에만 존속한다.** DB 게시물에는 verified 개념이 없다 (1의 원칙으로 대체)

## 15. 리더 승인 결정 목록 (Part 2) — 판정 완료 (2026-08-16)

판정: 1 승인 / 2 승인(조건: origin 정확 매칭 allowlist 유지·와일드카드 금지, credentials 는 프로덕션 도메인+localhost:3000 만) / 3 승인(musl 이슈 시 bcrypt 폴백, 선택 결과 기록) / 4 승인(정적 토큰 = 복구용으로 용도 명시) / 5 승인 / **6 불허 — publishedAt 자동 기록·수정 불가** / 7 승인 / 8 승인. 원문 목록은 아래 보존.

1. 목록 응답 shape: 최상위 배열 + X-Total-Count (방명록과 통일) — 프론트가 따라올 기준
2. **CORS `Access-Control-Allow-Credentials: true` 추가** (세션 쿠키 전송용 — 보안 영향 있는 변경)
3. 비밀번호 해시 argon2id (musl 빌드 이슈 시 bcrypt 대체)
4. 인증 병행 운영: 세션 쿠키 + 기존 정적 Bearer 유지 (§12.2)
5. 업로드 한도: pdf/png/jpg/webp, 파일당 10MB, 게시물당 5개
6. `publishedAt` admin 수정 허용 (게시일 소급 표기 가능 — 운영 편의 vs 기록 정확성)
7. 상세 라우트 슬러그 → uuid 전환 (`/notices/[id]`) — web-developer 합의 필요
8. 검증 수치(§13.1)와 정렬 규약(urgent 우선 → publishedAt DESC)

## 16. 마이그레이션 전략

- `content/notices/`, `content/news/` 실사: **.gitkeep만 존재, 게시물 0건 — 이관 대상 없음 확인** (2026-08-16)
- 따라서 데이터 이관 없이 신규 마이그레이션 파일(`002_create_posts.sql`, `003_create_admin_sessions.sql`)만 추가
- 파일 기반 로더(content.ts)는 `page` 카테고리용으로 존속 — 프론트 전환 완료 후 notice/news 경로만 제거 (web-developer 영역)

## 17. Part 2 로컬 실측 결과 (2026-08-16, macOS + PostgreSQL 16 + Node 26)

`server/` 확장 구현 후 전 엔드포인트 curl 실측. **핵심 케이스 전부 PASS** (초기 배터리에서 실패로 보인 항목은 테스트 하니스의 zsh `echo` 이스케이프 해석 문제로 판명 — 서버 응답은 JSON 표준 이스케이프 정상, `body repr: '# 본문\n마크다운 개행 포함'` 확인).

### 17.1 인증·세션

| 케이스 | 기대 | 실측 | 판정 |
|---|---|---|---|
| 로그인 오답 | 401 단일 메시지 | 401 UNAUTHORIZED | PASS |
| password 누락 | 400 | 400 VALIDATION_ERROR | PASS |
| 로그인 정상 | 200 + Set-Cookie(HttpOnly; SameSite=Lax; Path=/admin) | 동일 (Max-Age 43199) | PASS |
| /admin/me 세션 쿠키 | 200 method=session | 동일 | PASS |
| /admin/me 무인증 | 401 | 401 | PASS |
| /admin/me 정적 Bearer | 200 method=bearer (병행 §12.2) | 동일 | PASS |
| 세션 만료 (DB 강제 만료 후) | 401 | 401 (만료 전 200 → 만료 후 401) | PASS |
| 로그아웃 → me | 401 | 200 → 401 | PASS |
| 로그인 rate limit | 분당 5회 초과 → 429 | 6번째 시도(분 창 내)부터 429 | PASS |
| 세션 인증으로 게시물 생성 | 201 (세션 쓰기 경로) | 201 | PASS |

### 17.2 게시물 CRUD

| 케이스 | 실측 | 판정 |
|---|---|---|
| notice+article 생성 | 201, publishedAt/createdAt 자동, deletedAt null | PASS |
| link형 url 누락 / article형 body 누락 / news+article source 누락 | 각 400 (CHECK 제약 3종의 서버 선행 검증) | PASS |
| publishedAt 지정 생성·수정 시도 | 400 "서버가 자동 기록" (§15-6 판정 이행) | PASS |
| news+link 생성 (source 없음) | 201 — 링크형은 URL이 출처 | PASS |
| GET /posts?category=notice | 200 최상위 배열 + X-Total-Count, 목록에 body 미포함 | PASS |
| category 누락 | 400 | PASS |
| GET /posts/:id | 200, body 포함(개행 이스케이프 정상) | PASS |
| PATCH 부분 수정(urgent=true) → urgent=true 필터 | 200 → 필터 1건 일치 | PASS |
| PATCH type=link (병합 후 url 없음) | 400 제약 재검증 | PASS |
| soft delete → 공개 404 / admin 목록 deletedAt 노출 | 전부 일치 | PASS |
| admin 목록 무인증 | 401 | PASS |

### 17.3 preview-link SSRF

| 케이스 | 실측 | 판정 |
|---|---|---|
| 공개 URL(example.com) | 200 `{"title":"Example Domain"}` | PASS |
| 127.0.0.1 / 10.0.0.1 / 169.254.169.254(메타데이터) | 422 "허용되지 않는 대상" | PASS |
| localhost:3001 / example.com:8080 | 422 포트 차단 | PASS |
| ftp:// | 422 스킴 차단 | PASS |
| 리다이렉트 5회(httpbingo) | 422 "리다이렉트가 너무 많습니다" (3회 제한) | PASS |
| 지연 10초 응답 | 422 타임아웃 (3초 유휴 소켓 차단) | PASS |

### 17.4 파일 업로드·서빙

| 케이스 | 실측 | 판정 |
|---|---|---|
| 정상 PDF 업로드 | 201 attachment shape | PASS |
| .png 확장자+텍스트 내용 (매직 불일치) | 400 | PASS |
| MIME 위장 (pdf 내용 + text/plain 선언) | 400 | PASS |
| 11MB | 413 PAYLOAD_TOO_LARGE | PASS |
| 게시물당 6번째 첨부 | 400 "5개까지" | PASS |
| 공개 상세 attachments 배열 / 서빙 | 5건, 200 + application/pdf + Content-Disposition attachment + immutable + nosniff, **서빙 바이트 = 원본 일치** | PASS |
| 파일명 불일치 URL / 삭제 후 서빙 | 각 404 | PASS |

### 17.5 회귀·품질

- 방명록(Part 1) GET/POST/관리자 삭제 회귀 정상 (계약 shape 불변)
- `tsc --noEmit` strict 통과, `tsc` 빌드 통과
- argon2id: macOS 정상 (musl 검증은 배포 시 Docker 빌드에서 — bcrypt 폴백 조건부 승인 §15-3)

### 17.6 구현 중 설계 정교화 (기록)

- **/admin/* rate limit (분당 10회)는 "실패한 인증 시도"만 카운트**하도록 정교화. 사유: 전 요청 카운트 시 정상 관리 작업(글 1건 작성 + 첨부 5개 + 목록 조회 > 10 요청/분)이 즉시 잠김. 무차별 대입 방어 목적에는 실패 카운트로 충분. 로그인 한도(5/분·10/시간)는 성공·실패 전부 카운트 유지

## 18. 비밀번호 변경 기능 로컬 실측 (2026-08-17) — 전 케이스 PASS

`admin_credentials` 도입(§10.4)과 `POST /admin/password`(§12.4) 구현 후 로컬 실측. 프로덕션과 동일한 마이그레이션 상태(0000–0002)에서 시작해 1755300000003 을 적용하고 검증했다. **curl 요청/응답 원문 캡처는 07 문서 §9.4** (분량 관계로 그쪽에 병기). 요약:

- **검증 순서** #1→#2→#3→#4 가 표 그대로 동작 (틀린 현재 비밀번호 + 11자 새 비밀번호 → `400` 12자 메시지, `401` 아님)
- **세션 처리**: 세션 쿠키로 변경 시 현재 세션 유지 + 나머지 무효화(`sessionsRevoked:2`), Bearer 로 변경 시 전 세션 무효화
- **즉시 반영**: 변경 후 재기동 없이 구 비밀번호 `401` / 신 비밀번호 `200`
- **`passwordIsInitial`**: 시드 직후 `true` → 변경 후 `false`. **초기 비밀번호로 되돌려도 `false` 유지** (`updated_at` 비가역)
- **계약 개정 1**: 인증 수단 무효 → `UNAUTHORIZED`, `currentPassword` 불일치 → `INVALID_CREDENTIALS` 로 실제 분리 확인. 로그인 오답은 `UNAUTHORIZED` 유지
- **rate limit**: `/admin/password` 가 loginLimiter 버킷 공유 — 분 창 5회 초과 시 `429` + `Retry-After: 60`
- **개인정보·시크릿**: 서버 로그 전체에 평문·argon2 해시 문자열 **없음**
- **방어 경로**: 행 삭제 시 env 폴백으로 로그인 유지(경고 로그), 재기동 시 재시드. 마이그레이션 미적용 상태에서는 **기동 거부**(exit 1 + 조치 안내)
- **마이그레이션 up → down → up 왕복** 정상 (롤백 근거)
- **회귀**: 방명록·게시물·admin CRUD·health 전부 이전과 동일 shape
- `tsc --noEmit` strict 통과, 빌드 통과

## 19. 게시물 세 번째 분류 `education`(노동교육) 추가 (2026-08-17)

근거: `_workspace/00_input/requirements-home-sections.md` **"노동교육 요건 개정"**. 노동교육 링크를 관리자가 admin 화면에서 직접 등록·수정·삭제할 수 있어야 한다는 사용자 요청("게시물을 수정가능한 형태로 하면 나중에 수정할게")에 따라, 정적 상수 배열 방식을 폐기하고 공지·소식과 나란한 **세 번째 게시물 분류**로 만든다.

### 19.1 변경 요약 (계약 관점)

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| `posts.category` 도메인 | `notice` \| `news` | `notice` \| `news` \| **`education`** |
| `GET /posts?category=` | 2값 | 3값 (필수 유지) |
| `GET /admin/posts?category=` | 2값 + 생략 | 3값 + 생략 |
| `POST`/`PATCH /admin/posts` 본문 `category` | 2값 | 3값 |
| 에러 문구 (전 경로) | `category 는 notice 또는 news 여야 합니다.` | `category 는 notice, news, education 중 하나여야 합니다.` |
| 응답 shape | — | **변경 없음.** 필드 추가·삭제·타입 변경 전무. `category` 가 가질 수 있는 문자열 값만 늘어났다 |

**별도 테이블을 만들지 않은 이유**: 기존 posts 파이프라인이 노동교육에 필요한 것을 이미 전부 갖고 있다 — 링크형 타입, 제목·URL·출처, 게시일 정렬, admin CRUD, soft delete, 첨부. `education_links` 테이블 신설은 같은 기능의 중복 구현이 된다.

### 19.2 `education` 에 `source` 를 강제하지 않는다 (결정·근거)

`posts_news_article_needs_source` 제약은 조건절이 `category = 'news'` 로 한정돼 있어 education 행에는 **애초에 적용되지 않는다.** 이 제약을 education 까지 확대할지 검토했고 **확대하지 않기로 판정**했다 (리더 의견 일치).

1. 노동교육 자료에는 지부가 **자체 제작**한 것이 섞일 수 있고, 그때 인용할 외부 출처가 존재하지 않는다. 강제하면 자체 자료를 올릴 수 없게 된다
2. 초기 콘텐츠는 전부 링크형인데 **링크형의 출처는 URL 자체**다 (§14-2 게시 정책). 링크형에 `source` 를 요구하는 것은 정책과 모순된다
3. news 에 출처를 강제하는 원래 취지는 "외부 조직의 소식을 옮길 때 출처를 밝힌다"이며, 교육자료 큐레이션에는 그대로 적용되지 않는다

따라서 **DB 제약·서버 검증 모두 news 에만 비대칭으로 남는다.** 서버 검증(`postValidate.ts`)의 조건과 DB 제약의 조건은 문자 그대로 동일해야 한다 (한쪽만 바꾸면 500 이 난다).

### 19.3 하위 호환 (구버전 프론트 안전성)

`education` 은 **추가일 뿐**이므로 기존 notice/news 의 동작·응답·정렬은 어떤 것도 바뀌지 않는다. API 를 프론트보다 먼저 배포해도 안전하다:

- 구버전 프론트의 `parsePostSummary`(`src/lib/api/posts.ts`)는 `category` 가 `notice`/`news` 가 아니면 `null` 을 반환한다. 그러나 구버전 프론트는 **`category=notice` 와 `category=news` 만 요청**한다 (`src/app/page.tsx:30` 의 `loadCategory(category: "notice" | "news")` — 실측 확인). 서버는 요청한 분류만 반환하므로 education 게시물이 구버전 파서에 도달하는 경로가 없다
- 유일한 이론적 경로는 `/notices/<education 게시물의 uuid>` 를 직접 입력하는 경우인데, uuid 추측이 필요하고 결과도 기존 "응답 형식 오류" 처리로 수렴한다 (크래시 아님)
- 반대 방향(프론트 먼저 배포)은 **불가**: education 을 요청하면 구버전 API 가 400 을 준다. **배포 순서는 API → 프론트** (07 §10.5)

### 19.4 분류 리터럴의 단일 출처화 (구현 메모)

이전에는 `"notice" | "news"` 리터럴이 4개 파일 12곳에 흩어져 있었다. 한 곳만 빠뜨리면 "등록은 되는데 목록에 안 나오는" 부분 고장이 나므로, `server/src/lib/postValidate.ts` 에 단일 출처를 두고 나머지를 전부 파생시켰다.

```ts
export const POST_CATEGORIES = ["notice", "news", "education"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];
export function isPostCategory(value: unknown): value is PostCategory
export const POST_CATEGORY_ERROR          // "category 는 notice, news, education 중 하나여야 합니다."
export const POST_CATEGORY_REQUIRED_ERROR // 위 + " (필수)" — 공개 목록용
```

**다음에 분류를 또 늘릴 때 고칠 곳은 두 개뿐이다**: 위 배열 + 새 마이그레이션(CHECK 제약). 타입·런타임 검증·에러 문구는 자동으로 따라온다. 각 파일에 리터럴을 다시 쓰지 말 것.

### 19.5 로컬 실측

curl 원문과 판정표는 **07 문서 §10.4**. 요약: 마이그레이션 up→down→up 왕복, education CRUD 전 과정(생성·공개 목록·공개 상세·admin 목록·수정·분류 전환·soft delete), 잘못된 category 거부 6종, notice/news 회귀 — **전 케이스 PASS**. `npm run typecheck`·`npm run build` 통과.

## 20. 게시물 수동 정렬 + YouTube 썸네일 서버 캐싱 (2026-08-17)

근거: `_workspace/00_input/requirements-sort-thumbnail.md` (사용자 요청 "노동교육 순서 고정되게 정렬기능도 추가하고 썸네일도 넣었으면 좋겠어. 혹시 유투브의 썸네일을 넣을 수는 없어?").
확정 계약: `_workspace/00_input/contract-sort-thumbnail.md` §1–§7 (백엔드 범위), §8 (프론트 범위).
구현·실측: 07 문서 §11.

**발단.** 노동교육 5건을 게시할 때 정렬 수단이 `published_at DESC` 뿐이어서 학습 순서를 맞추려고 **역순 등록**이라는 우회를 썼고, "사용자가 admin 에서 글을 추가하면 맨 위로 올라가 순서가 깨진다"는 한계를 그대로 안고 있었다 (07 §10.9). 그 근본 해결이다.

### 20.1 스키마 변경 (마이그레이션 `1755300000005_add-sort-order-and-thumbnail.sql`)

```sql
ALTER TABLE posts ADD COLUMN sort_order    integer;   -- NULL = 수동 지정 없음
ALTER TABLE posts ADD COLUMN thumbnail_key text;      -- NULL = 썸네일 없음

DROP INDEX idx_posts_list;
CREATE INDEX idx_posts_list
  ON posts (category, urgent DESC, sort_order ASC NULLS LAST, published_at DESC, id DESC)
  WHERE deleted_at IS NULL;
```

- **둘 다 nullable.** 기존 행은 전부 NULL 이므로 하위 호환이 보장된다 (§20.7)
- `sort_order` 에 CHECK 제약을 **걸지 않았다**: 값의 연속성(1..n)은 `POST /admin/posts/reorder` 가 트랜잭션으로 보장하고, DB 제약을 더하면 계약 밖 실패 모드(500)와 데이터 보정 시 방해가 생긴다
- PostgreSQL 은 `ASC` 의 기본 NULL 순서가 NULLS LAST 여서 저장된 인덱스 정의는 `sort_order` 로 정규화된다(실측). 마이그레이션에 명시한 이유는 ORDER BY 절과 문자 단위로 대조되게 하려는 것
- **인덱스가 정렬을 제공한다**(실측 근거 07 §11.5 ②): 같은 쿼리가 `Index Scan using idx_posts_list` + **Sort 노드 없음**. 정렬 절을 다른 것으로 바꾸면 `Sort` 노드가 나타난다 (대조군)
- **Down 은 데이터를 소멸시킨다** — 지정한 순서와 썸네일 키가 사라진다. 마이그레이션 파일 주석과 07 §11.9 에 경고를 남겼다

### 20.2 정렬 규칙 (전 분류·전 목록 공통)

```sql
ORDER BY urgent DESC, sort_order ASC NULLS LAST, published_at DESC, id DESC
```

| 우선순위 | 기준 | 의미 |
|---|---|---|
| 1 | `urgent DESC` | **긴급 공지는 수동 순서보다 위** (기존 동작 보존) |
| 2 | `sort_order ASC NULLS LAST` | 순서를 지정한 글이 미지정 글보다 **위** |
| 3 | `published_at DESC` | 미지정 글끼리는 기존과 동일하게 게시일 역순 |
| 4 | `id DESC` | 동시각 타이브레이커 (기존과 동일) |

- 적용 범위: **공개 목록(`GET /posts`)·공개 상세·admin 목록(`GET /admin/posts`)** 전부. 마감 스트립은 프론트가 `GET /posts` 결과에서 파생하므로 별도 쿼리가 없다 (전수 조사 07 §11.4)
- **admin 목록의 정렬이 바뀌었다**: 이전 `published_at DESC, id DESC` → 위 규칙. 규칙이 갈리면 관리자가 자기가 지정한 순서를 확인할 수 없다. 응답 shape 변경은 아니다
- **단서 — 분류 미지정 admin 목록**: `sort_order` 는 분류별로 1..n 이므로 전 분류 조회에서는 순위가 분류를 넘어 교차한다(notice#1 · news#1 · education#1 이 인접). 순서 조작은 분류를 지정한 화면에서 하는 것이 전제다 (계약 §8 의 admin UI 도 분류별로 동작)
- **부수 효과 (의도된 것)**: 새 글은 `sort_order = NULL` 로 생성되므로 순서를 지정해 둔 글들 **아래**에 붙는다. 07 §10.9 의 "글을 추가하면 학습 순서가 깨진다"가 구조적으로 해소된다 (실측 07 §11.5 R6)

### 20.3 `POST /admin/posts/reorder` — 순서 지정 (신설)

인증: 기존 `requireAdmin` (세션 쿠키 또는 정적 Bearer). rate limit: `/admin/*` 공통(실패 인증만 카운트).

**요청 본문**

```jsonc
{ "category": "notice" | "news" | "education", "ids": ["<uuid>", "<uuid>", ...] }
```

`ids` 배열의 순서대로 `sort_order` 를 **1, 2, 3 … n** 으로 지정한다.

**검증 (이 순서로 구현·실측됨 — QA 는 순서까지 교차 검증할 것)**

| # | 조건 | 상태 | code | message |
|---|------|------|------|---------|
| 1 | `category` 가 유효 분류가 아님(누락 포함) | 400 | `VALIDATION_ERROR` | `category 는 notice, news, education 중 하나여야 합니다.` (기존 문구 재사용) |
| 2 | `ids` 가 배열이 아니거나 원소가 UUID 형식이 아님 | 400 | `VALIDATION_ERROR` | `ids 는 UUID 배열이어야 합니다.` |
| 3 | `ids` 에 중복이 있음 | 400 | `VALIDATION_ERROR` | `ids 에 중복된 항목이 있습니다.` |
| 4 | `ids` 가 해당 분류 **활성 게시물 전체의 순열이 아님** | 409 | `CONFLICT` | `목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.` |

**#4 가 핵심 안전장치다 (낙관적 동시성 제어).** 서버가 트랜잭션 안에서 해당 분류의 활성(`deleted_at IS NULL`) 게시물 id 집합을 `FOR UPDATE` 로 잠근 뒤 `ids` 와 **완전 일치(같은 원소·같은 개수)** 를 확인한다. 불일치면 아무것도 쓰지 않고 거부한다 — 다른 창에서 글이 추가·삭제된 뒤 낡은 목록으로 덮어써 순서가 누락·중복되는 것을 막는다.

**원자성**: 조회·검증·갱신 전체가 하나의 트랜잭션이다. 갱신은 건별 `UPDATE … WHERE id = $1 AND category = $3 AND deleted_at IS NULL` 로 대상을 특정한다 (분류 전체를 무조건 UPDATE 하지 않는다 — 스킬 §3).

**200 성공 응답** (`additionalProperties: false` 직렬화 스키마 적용)

```jsonc
{ "ok": true, "category": "education", "updated": 5 }
```

**세부 규약 (실측 확인 — 07 §11.5)**

- 활성 0건 분류에 `ids: []` → `200 { updated: 0 }` (빈 집합의 순열은 빈 배열)
- soft delete 된 글의 id 를 포함하면 → `409` (활성 집합에 없음)
- 대문자 UUID 는 소문자로 정규화해 비교·갱신한다 (PostgreSQL uuid 출력이 항상 소문자여서, 정규화 없이는 같은 uuid 가 #4 에서 불일치로 오판된다)
- `updated_at` 은 **갱신하지 않는다**: `sort_order` 는 내용이 아니라 표시 메타데이터이고, 순서를 한 번 바꿀 때마다 분류 전체의 "최근 수정"이 갱신되면 그 값이 무의미해진다
- `ids` 개수 상한을 별도로 두지 않았다 — 전역 `bodyLimit` 16KB 가 uuid 약 430개에서 이미 막는다

**새 에러 code `CONFLICT`** 를 `server/src/lib/errors.ts` 의 `ErrorCode` 에 추가했다. ⚠ 프론트 `src/lib/api/http.ts` 의 `CODE_TO_REASON` 에 `CONFLICT: "conflict"` 를 등록하지 않으면 `?? "network"` 폴백으로 **연결 실패로 오분류**된다 (web-developer 영역 — 07 §11.8).

### 20.4 썸네일 취득·저장 (서버)

**왜 서버가 중계하는가.** `i.ytimg.com` 을 프론트에서 직접 로드하면 메인페이지를 여는 **모든 조합원의 IP·User-Agent·접속 시각·Referer 가 구글로 전송**된다. 이 프로젝트는 원문 IP 를 로그에 남기지 않고 방명록 IP 도 HMAC 해시 + 90일 후 NULL 처리하는 기준을 세워 두었다(07 §2.5). 서버가 한 번 받아 저장하면 **조합원 IP 는 구글에 닿지 않는다** — 서버 IP 하나만, 게시물 등록 시점에 한 번 닿는다.

**대상**: `type = "link"` 이고 URL 이 YouTube 영상인 게시물. **생성(POST)·수정(PATCH) 시 동기 수행.**

**videoId 추출** — 인식 형태(그 외는 썸네일 없음):

| 형태 | 예 |
|---|---|
| `youtube.com/watch?v={id}` | `www.` / `m.` / `music.` 서브도메인 포함 |
| `youtu.be/{id}` | 단축 링크 |
| `youtube.com/shorts/{id}` | Shorts |
| `youtube.com/embed/{id}`, `youtube.com/live/{id}` | (계약 명시 외 — 같은 videoId 체계라 무해하게 추가) |

`id` 는 정확히 `[A-Za-z0-9_-]{11}`. **정규식을 통과한 값만 URL·파일명 조립에 쓴다.**

**취득 순서**

1. `https://i.ytimg.com/vi/{id}/maxresdefault.jpg` (1280×720)
2. 실패 시 `https://i.ytimg.com/vi/{id}/mqdefault.jpg` (320×180)
3. **`hqdefault` 는 쓰지 않는다** — 480×360 4:3 레터박스라 16:9 카드에 검은 띠가 생긴다

`maxresdefault` 는 항상 존재하지 않는다. 리더 실측(게시된 5건)을 백엔드가 독립 재확인했다 — `Vj3lQ7Y71PU` 만 `maxres=404`, `mq=200`. **폴백이 실제로 필요하다** (07 §11.5 ①).

**보안 (SSRF 방어)**

| 방어선 | 구현 |
|---|---|
| 호스트 고정 | `i.ytimg.com` **하드코딩**. 사용자 입력은 videoId 뿐이며 정규식 통과값만 경로에 들어간다. **사용자 URL 을 그대로 fetch 하지 않는다** |
| 리다이렉트 | **미추종** — 3xx 는 그 변형의 실패로 처리 (실측: 301 → `http-301`) |
| TLS | 인증서 검증(기본값)이 실질적 최종 방어선 — DNS 가 오염돼도 공격자는 `i.ytimg.com` 의 유효 인증서를 제시할 수 없다 |
| 피어 IP | 접속한 피어가 공인 IP 인지 재확인 (`lib/ipGuard.ts` 재사용). 사설 대역이면 즉시 절단 |
| 타임아웃 | 연결 3초 / **두 변형 합계 6초** 예산 (게시 응답을 오래 붙잡지 않기 위해 linkPreview 의 8초보다 짧게) |
| 크기 | 최대 **2MB**, 초과 시 폐기하고 다음 변형으로 |
| 내용 검사 | 응답이 실제 JPEG 인지 **매직 바이트(`FF D8 FF`)로 검증**. Content-Type 은 믿지 않는다 (`lib/fileTypes.ts` 계승) |

**저장**

- 경로: `{UPLOAD_DIR}/thumbnails/` — 첨부와 분리한다 (첨부는 조합원 대상 문서, 썸네일은 **파생 캐시**)
- 파일명(= `thumbnail_key`): `{videoId}-{variant}.jpg` (예: `Vj3lQ7Y71PU-mqdefault.jpg`). **서버가 만든 값만 경로에 쓴다**
- 파일 모드 `0o600`, 디렉토리는 필요 시 생성
- **디스크 캐시 우선**: 같은 키의 파일이 이미 있으면 네트워크 요청 없이 재사용한다 (키가 videoId+변형에 고정이라 내용이 바뀌지 않는다 — `immutable` 헤더의 근거와 동일). 여러 게시물이 같은 영상을 걸어도 한 번만 받는다

**실패 처리**

- **썸네일 취득 실패가 게시를 막지 않는다** (§13.2 링크 프리뷰와 동일 원칙). `thumbnail_key = NULL` 로 두고 게시는 `201`/`200` 으로 성공시키며, 실패는 `request.log.warn` 으로만 남긴다 (URL 원문은 로그에 싣지 않는다)
- YouTube 영상 URL 이 아닌 경우는 **정상 경로**이므로 로그를 남기지 않는다 (대부분의 링크가 여기 해당 — 로그 노이즈 방지)
- 비동기 백그라운드 처리는 하지 않는다 (계약 §4: 일관성·에러 추적 우선). 타임아웃이 짧아 최악의 지연이 한정된다 (실측: 양 변형 404 → 0.38초)

**URL 변경 시**: PATCH 로 URL 이 바뀌면 **재취득**. 링크형→작성형 전환 시 `thumbnail_key = NULL`. 이전 파일은 지우지 않는다(캐시이며 키가 videoId 기반이라 재사용된다).
**계약보다 한 걸음 더**: URL 이 그대로여도 `thumbnail_key` 가 NULL 이면 재시도한다 — 일시적 실패를 관리자가 "다시 저장"만으로 복구할 수 있다.

### 20.5 `GET /thumbnails/:key` — 썸네일 제공 (신설 공개 라우트)

| 항목 | 규약 |
|---|---|
| key 검증 | `^[A-Za-z0-9_-]{11}-(maxresdefault\|mqdefault)\.jpg$` 불일치 → `400 VALIDATION_ERROR` |
| 없음 | `404 NOT_FOUND` |
| 성공 | `200` + `Content-Type: image/jpeg` + `Content-Length` + `Cache-Control: public, max-age=31536000, immutable` + `X-Content-Type-Options: nosniff` |
| rate limit | 기존 `filesLimiter`(IP 당 분당 120회) **공유** |

- **경로 조작이 구조적으로 불가능하다.** 위 문자 집합에는 `/`·`\`·`.` 연속이 없어 `..`·절대경로·중첩 디렉토리를 **표현할 수 없다**. `/files/:id/:name` 이 DB 조회로만 storage_key 를 해석해 사용자 입력을 경로에서 배제한 것과 같은 원칙이다. 그 위에 "해석된 경로가 썸네일 디렉토리를 벗어나지 않는가"를 한 번 더 확인한다(다중 방어 — 정규식이 완화되는 미래 변경 대비)
- **rate limit 근거 (계약 §5 가 판단을 요구한 항목)**: 썸네일은 첨부와 같은 "불변 정적 자산" 부류이고 정책을 나눌 이유가 없다. 한 페이지의 썸네일은 최대 5장이며 `immutable` 1년 캐시라 재방문 시 요청이 발생하지 않으므로 120회/분은 충분히 여유롭다. 버킷을 나누면 정책이 둘로 갈려 운영 시 어느 쪽이 막혔는지 판별이 어려워진다. 실측: 공유 버킷에서 120회 후 `429 RATE_LIMITED` + `Retry-After`
- `immutable` 이 안전한 근거: 키가 videoId+변형에 고정 = 내용 불변 (첨부의 storage_key 와 동일 논리)

### 20.6 응답 필드 추가 (계약 §6)

기존 필드는 **하나도 바뀌지 않았다.** 아래가 추가분이다.

| 응답 | 추가 필드 | 타입 |
|---|---|---|
| 공개 목록 `GET /posts` · 공개 상세 `GET /posts/:id` | `thumbnailUrl` | `string \| null` (`/thumbnails/<key>` 상대 경로) |
| admin 목록 `GET /admin/posts` · 생성/수정 응답 | `thumbnailUrl` + **`sortOrder`** | `string \| null`, `integer \| null` |

- `sortOrder` 는 **공개 응답에 넣지 않는다** — 정렬은 서버 책임이고, 노출하면 프론트가 재정렬하려는 유혹이 생긴다 (실측으로 부재 확인)
- 응답 스키마(serializer)에 필드를 추가하지 않으면 `additionalProperties: false` 때문에 **직렬화 단계에서 조용히 사라진다.** `postSummaryProperties`(공개)와 `adminPostSchema`(admin) 양쪽을 갱신했다
- **프론트 파서 요구사항 (web-developer)**: `thumbnailUrl`·`sortOrder` 가 없거나 타입이 다르면 **`null` 로 간주**하고 `invalidResponse` 로 떨어뜨리지 말 것 (구버전 API 와의 공존 방어)

### 20.7 하위 호환

**API 를 프론트보다 먼저 배포해도 안전하다.**

- 두 컬럼 모두 nullable, 기존 행은 NULL → 기존 정렬·응답이 그대로 유지된다(순서를 지정하기 전까지는 결과 순서도 이전과 동일)
- 구버전 프론트의 `parsePostSummary`(`src/lib/api/posts.ts`)는 **알지 못하는 필드를 무시**한다 (필드별 명시 검증 후 known 필드만 조립) — `thumbnailUrl` 추가로 깨지지 않는다
- 반대 방향(프론트 먼저)은 **불가**: 신버전 프론트가 `POST /admin/posts/reorder` 를 호출하면 구버전 API 가 404 를 준다. **배포 순서는 API → 프론트** (07 §11.7)

### 20.8 소급 적용 스크립트 (계약 §7)

`server/scripts/backfill-thumbnails.mjs` — 이미 게시된 링크형 게시물(노동교육 5건 + 금융노조 소식 링크형)에 썸네일을 소급 적용한다.

- 대상: `type = 'link' AND url IS NOT NULL AND thumbnail_key IS NULL AND deleted_at IS NULL`
- `DATABASE_URL` 과 `UPLOAD_DIR` 을 환경변수로 받는다
- **멱등**: 이미 키가 있는 행은 조회되지 않고, 디스크에 파일이 남아 있으면 네트워크 없이 키를 재사용한다
- 건별 성공·실패를 출력하고 실패해도 나머지를 계속 처리한다
- `UPDATE posts SET thumbnail_key = $2 WHERE id = $1 AND thumbnail_key IS NULL` — **대상 특정 필수 규칙 준수**
- `--dry-run` 은 DB 를 변경하지 않는다(디스크 캐시는 채운다 — 어느 변형이 쓰일지 보고하려면 취득이 필요)
- **취득 로직을 스크립트에 복사하지 않았다.** `dist/lib/youtubeThumbnail.js` 를 import 한다 — 복사해 두면 한쪽만 고쳐졌을 때 "API 로 올린 글과 backfill 한 글의 썸네일이 다른" 부분 고장이 된다

### 20.9 로컬 실측

curl 원문·판정표는 **07 문서 §11.5**. 요약: 마이그레이션 up→down→up 왕복, 정렬 규칙(urgent·sort_order·NULLS LAST 조합), reorder 200/400×6/409×4 전 분기 + 동시 실행, 썸네일 취득 성공·404 폴백·비YouTube·매직바이트 위조·2MB 초과·리다이렉트·사설 피어, `/thumbnails/:key` 정상·404·400·경로조작 10종, backfill 멱등성, notice/news/education·방명록·첨부 회귀 — **전 케이스 PASS**. `npm run typecheck`·`npm run build` 통과.
