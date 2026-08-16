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

---
---

# Part 2 — 게시물(공지·소식) DB 전환 + Admin 명세 (2026-08-16, 승인 대기 — 구현 금지 상태)

**계약 방향 주의 (방명록과 반대)**: Part 1(방명록)은 프론트 `guestbook.ts`가 계약의 출처였다. **Part 2는 이 명세가 계약의 단일 출처이고 프론트가 명세를 따라온다** (파일 기반 `content.ts`의 `PostSummary`/`PostDetail`은 파일 시대의 타입으로, 이번 전환에서 프론트가 API 계약에 맞춰 재작성됨). 기존 프론트 타입과의 매핑은 §11.4.

## 10. 데이터 모델

### 10.1 `posts` 테이블

```sql
CREATE TABLE posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text NOT NULL CHECK (category IN ('notice','news')),
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
  CONSTRAINT posts_link_needs_url     CHECK (type <> 'link'    OR url  IS NOT NULL),
  CONSTRAINT posts_article_needs_body CHECK (type <> 'article' OR body IS NOT NULL),
  CONSTRAINT posts_news_article_needs_source
    CHECK (NOT (category = 'news' AND type = 'article') OR source IS NOT NULL)
);

CREATE INDEX idx_posts_list ON posts (category, urgent DESC, published_at DESC, id DESC)
  WHERE deleted_at IS NULL;
```

- 링크형의 출처 = URL 자체 (§14 게시 정책). `source` 컬럼은 링크형에서 사용하지 않음(NULL)
- 정렬 규약: **urgent 우선 → published_at 내림차순** (기존 디자인 스펙 §5 계승, 서버가 정렬 책임)

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

## 11. 공개 API (인증 없음)

공통: camelCase, ISO 8601 UTC, 에러 형식 `{ error: { code, message } }` (§2.4 코드 체계 공유).

### 11.1 `GET /posts?category=&urgent=&limit=&offset=`

| 파라미터 | 규칙 |
|---|---|
| `category` | 필수. `notice` \| `news` |
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
                     "sizeBytes": 123456, "url": "/files/<attachmentId>/공문.pdf" } ]
}
```

`body`는 목록에서 제외 (상세에서만). `attachments[].url`은 API 도메인 상대 경로 — 프론트가 base URL을 붙임.

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
| `category: "notice"\|"news"\|"page"` | `"notice"\|"news"` | `page`는 DB 전환 대상 아님 (파일 유지) |
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
- `POST /admin/logout` → 세션 삭제 + 쿠키 만료. `GET /admin/me` → 세션 유효성 확인 (admin UI 초기 로드용)
- **CORS 변경 필요**: admin UI는 www.koscomlabor.cloud(프론트)에서 union-api로 fetch — 같은 사이트(eTLD+1 동일)이므로 SameSite=Lax 쿠키가 전송되지만, **CORS에 `Access-Control-Allow-Credentials: true` 추가 필요** (허용 Origin은 기존 명시 목록 유지, `*` 불가 — 승인 항목 §15-2)
- 로그인 rate limit: **IP당 1분 5회, 1시간 10회** (429). 실패도 카운트 (대입 방어)
- 감사 로그: 로그인 성공/실패(IP 해시), 세션 발급·만료 — 비밀번호·토큰 원문 미로깅

### 12.2 기존 방명록 정적 토큰과의 관계 (판단)

**병행 운영을 제안**한다: ① 기존 `Authorization: Bearer ADMIN_API_TOKEN` (curl 운영 경로 — 유지) ② 신규 세션 쿠키 (admin UI 경로). 방명록 `DELETE /admin/guestbook/:id` 및 신규 admin 엔드포인트 전부 **둘 중 하나면 인증 통과**. 사유: 장애 시 UI 없이도 curl 복구 경로 확보, 마이그레이션 리스크 0. UI 정착 후 정적 토큰 폐기는 별도 결정 (승인 항목 §15-4).

## 13. Admin CRUD + 링크 메타데이터 + 파일 업로드 (전부 세션/토큰 인증 + `/admin/*` rate limit)

### 13.1 게시물 CRUD

| 메서드/경로 | 동작 | 성공 |
|---|---|---|
| `POST /admin/posts` | 생성. body = `{ category, type, title, body?, url?, source?, urgent?, deadline? }` — publishedAt 은 서버 자동 기록(수정 불가, §15-6 판정). 10.1 제약을 서버 검증(길이·필수 조합·URL 형식)으로 선행 | `201` Post 상세 shape |
| `PATCH /admin/posts/:id` | 부분 수정 (전달된 필드만). type 변경 시 제약 재검증 | `200` Post 상세 |
| `DELETE /admin/posts/:id` | soft delete (`deleted_at`) — 첨부도 목록에서 숨김(파일은 보존) | `200 { deleted, id }` |
| `GET /admin/posts?category=&limit=&offset=` | 삭제 포함 전체 목록 (`deletedAt` 필드 노출) — 관리 화면용 | `200` 배열 |

검증 수치(안): title 1–300자, body ≤ 50,000자, source ≤ 200자, url ≤ 2,000자·http/https만.

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
