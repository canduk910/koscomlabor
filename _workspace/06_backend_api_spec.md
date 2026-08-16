# 06. 방명록 백엔드 API 명세

작성일: 2026-08-16 | 작성자: backend-developer | 상태: **리더 승인 완료 (8절) · 구현 완료 · 로컬 실측 27/27 PASS (9절)**

계약의 단일 출처: `/Users/canduk/IdeaProjects/koscomlabor/src/lib/api/guestbook.ts`
이 명세의 모든 응답 shape은 위 파일의 타입과 **문자 단위로** 대조했다 (각 절의 대조표 참조).

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

- Base URL: `https://api.koscomlabor.cloud` (프론트 `NEXT_PUBLIC_API_BASE_URL`에 설정)
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
| `UNAUTHORIZED` | 401 | 관리자 토큰 누락/불일치 |
| `NOT_FOUND` | 404 | 존재하지 않는 리소스/경로 |
| `PAYLOAD_TOO_LARGE` | 413 | 요청 body 16KB 초과 |
| `RATE_LIMITED` | 429 | 4.3절 한도 초과. `Retry-After` 헤더(초) 동봉 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 (상세는 서버 로그에만 — 응답에 스택/내부정보 금지) |

`message`는 한국어 사용자 안내 문구. `code`는 안정 계약 (변경 시 리더 승인 + web-developer 통보).

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
