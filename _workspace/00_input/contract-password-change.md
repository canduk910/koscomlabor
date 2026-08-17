# 확정 API 계약 — 관리자 비밀번호 변경 (리더 확정, 2026-08-17)

이 문서는 backend-developer 와 web-developer 가 **동일하게 준수해야 하는 단일 계약**이다.
문자 단위로 일치시킨다. 계약을 바꿔야 한다고 판단되면 임의 변경하지 말고 리더에게 보고한다.

기존 06 명세(`_workspace/06_backend_api_spec.md`)의 §12(인증) 확장이다.

---

## 1. `GET /admin/me` — 응답 확장 (기존 엔드포인트)

인증: 기존과 동일 (`requireAdmin`).

**200 응답 (변경 후):**

```jsonc
{
  "ok": true,
  "method": "session" | "bearer",
  "expiresAt": "2026-08-17T12:00:00.000Z" | null,
  "passwordIsInitial": true | false   // ← 신규 필드
}
```

- `passwordIsInitial`: `admin_credentials.updated_at IS NULL` 일 때 `true`.
  즉 **배포 시 env 로 시드된 초기 비밀번호를 아직 한 번도 바꾸지 않은 상태**.
  한 번이라도 `POST /admin/password` 또는 복구 스크립트로 바꾸면 영구히 `false`.
- 기존 필드(`ok`/`method`/`expiresAt`)의 의미·타입은 변경 없음 (하위 호환).

---

## 2. `POST /admin/password` — 비밀번호 변경 (신규)

인증: `requireAdmin` preHandler (세션 쿠키 또는 정적 Bearer 둘 다 허용).
**인증만으로는 부족하고 현재 비밀번호를 본문으로 재확인해야 한다.**

**요청 본문:**

```jsonc
{ "currentPassword": "…", "newPassword": "…" }
```

**검증 순서와 응답 (순서 그대로 구현할 것 — QA 가 이 순서로 검증한다):**

| # | 조건 | 상태 | code | message |
|---|------|------|------|---------|
| 0 | rate limit 초과 (loginLimiter) | 429 | `RATE_LIMITED` | 기존 `tooManyRequests` 문구 + `Retry-After` |
| 1 | `currentPassword`/`newPassword` 가 문자열이 아니거나 빈 문자열이거나 200자 초과 | 400 | `VALIDATION_ERROR` | `currentPassword 와 newPassword 는 1자 이상 200자 이하의 문자열이어야 합니다.` |
| 2 | `newPassword.length < 12` | 400 | `VALIDATION_ERROR` | `새 비밀번호는 12자 이상이어야 합니다.` |
| 3 | `newPassword === currentPassword` | 400 | `VALIDATION_ERROR` | `새 비밀번호가 현재 비밀번호와 같습니다.` |
| 4 | `argon2.verify(활성해시, currentPassword)` 실패 | 401 | `INVALID_CREDENTIALS` | `현재 비밀번호가 일치하지 않습니다.` |

> **개정 1 (2026-08-17, 리더 — designer 지적 반영).** #4 의 code 를 `UNAUTHORIZED` 가 아니라
> **`INVALID_CREDENTIALS`** 로 분리한다. 이유: `requireAdmin` preHandler 가 세션 만료 시
> 내는 401 도 `UNAUTHORIZED` 라, 같은 code 면 프론트가 "세션 만료 → 로그인 화면으로"와
> "현재 비밀번호 틀림 → 필드 인라인 에러"를 구분할 수 없다. 두 상황의 올바른 UI 대응이
> 서로 다르므로 code 를 분리한다.
>
> - `UNAUTHORIZED` = 인증 수단(세션/Bearer) 자체가 무효 → 프론트는 로그인 화면으로 전환
> - `INVALID_CREDENTIALS` = 인증은 유효하나 본문의 `currentPassword` 불일치 → 필드 에러
>
> 이에 따라 프론트 `src/lib/api/http.ts` 도 확장한다:
> `ApiFailureReason` 에 `"invalid-credentials"` 추가, `CODE_TO_REASON` 에
> `INVALID_CREDENTIALS: "invalid-credentials"` 추가. (미등록 code 는 `"network"` 로
> 잘못 분류되므로 이 등록은 필수다.) 기존 reason 값·기존 엔드포인트 동작은 불변.

**200 성공 응답:**

```jsonc
{ "ok": true, "changedAt": "2026-08-17T12:00:00.000Z", "sessionsRevoked": 2 }
```

- `changedAt`: ISO 8601 UTC 문자열 (DB `updated_at`)
- `sessionsRevoked`: 이번 변경으로 무효화된 **다른** 세션 수 (정수, 0 이상).

> **개정 2 (2026-08-17, 리더 — QA R2 반영).** 위 문장의 판정 기준을 정밀화한다.
> 원문은 "Bearer 로 호출한 경우"라고 썼으나, 실제 판정 기준은 **인증 헤더가 아니라
> 요청에 유효한 세션 쿠키가 있는가**이다.
>
> - 요청에 **유효한 세션 쿠키가 있으면**: 그 세션만 남기고 나머지를 삭제
>   (Bearer 헤더를 함께 보냈더라도 쿠키 세션은 유지된다 — 브라우저에서 작업 중인
>   관리자를 로그아웃시키지 않는 것이 옳다)
> - 요청에 **유효한 세션 쿠키가 없으면** (= Bearer 단독 복구 경로): 남길 세션이 없으므로
>   전 세션 삭제
>
> 어느 쪽이든 `sessionsRevoked` 는 실제로 삭제된 행 수다. 만료된 세션 행은 집계 전
> 정리되므로 숫자가 부풀지 않는다.

**부수 효과:**
1. `admin_credentials.password_hash` = argon2id(newPassword), `updated_at = now()`
2. 현재 세션 쿠키 토큰을 **제외한** 모든 `admin_sessions` 행 삭제
3. `request.log.info({ route: "admin-password-change", method, sessionsRevoked })` —
   **평문 비밀번호·해시를 로그에 남기지 않는다**

**rate limit 정책:** `loginLimiter` (분당 5회 / 시간당 10회) 버킷을 로그인과 공유한다.
진입 시 `loginLimiter.check(request.ip)` → 초과면 429. #4 실패 시에만
`loginLimiter.record(request.ip)` 를 호출한다 (성공한 변경은 카운트하지 않는다).

---

## 3. 프론트 API 계층 시그니처 (`src/lib/api/admin.ts`)

```ts
export interface AdminMe {
  method: "session" | "bearer";
  expiresAt: string | null;
  passwordIsInitial: boolean;
}

/** 세션 유효성 + 초기 비밀번호 여부 (§12.1 GET /admin/me) */
export async function adminMe(): Promise<ApiResult<AdminMe>>;   // ← 기존 ApiResult<null> 에서 변경

export interface PasswordChangeResult {
  changedAt: string;
  sessionsRevoked: number;
}

export async function adminChangePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ApiResult<PasswordChangeResult>>;
```

- 두 함수 모두 기존 `requestJson` 헬퍼를 통해 `credentials: "include"` 로 호출한다.
- `adminMe` 는 하위 호환 방어: `passwordIsInitial` 이 boolean 이 아니면 `false` 로 간주한다
  (구버전 API 와 신버전 프론트가 잠시 공존할 수 있으므로 `invalidResponse` 로 처리하지 않는다).
- `adminChangePassword` 는 응답에 `ok !== true` 이거나 `changedAt` 이 문자열이 아니면
  `invalidResponse("비밀번호 변경 응답 형식이 올바르지 않습니다.")`.
  `sessionsRevoked` 가 정수가 아니면 `0` 으로 간주한다.

**에러 → UI 문구 매핑 (`result.reason` 기준, `http.ts` 의 `CODE_TO_REASON` 경유):**

| reason | UI 대응 |
|--------|---------|
| `invalid-credentials` | **현재 비밀번호 필드의 인라인 에러**로 서버 message 표시 + 해당 필드로 포커스 이동 |
| `unauthorized` | **세션 만료** — 폼 에러가 아니라 로그인 화면으로 전환 (`setPhase("login")`) |
| `validation` | 폼 상단(또는 해당 필드) 에러로 서버 message 그대로 |
| `rate-limited` | `시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.` |
| 그 외 | `서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.` |

---

## 4. DB 스키마 (신규 마이그레이션)

`server/migrations/1755300000003_create-admin-credentials.sql`

```sql
-- Up Migration
CREATE TABLE admin_credentials (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash text NOT NULL,
  seeded_at     timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz            -- NULL = 초기(시드) 비밀번호 그대로
);

-- Down Migration
DROP TABLE admin_credentials;
```

- 단일 행 강제: `CHECK (id = 1)`
- `updated_at IS NULL` → 초기 비밀번호 (`passwordIsInitial = true`)

---

## 5. env 시드 규칙

- 부팅 시 1회: `INSERT INTO admin_credentials (id, password_hash) VALUES (1, $env)
  ON CONFLICT (id) DO NOTHING`
- 즉 **행이 이미 있으면 env 값은 무시된다.** `ADMIN_PASSWORD_HASH` 는 여전히 필수
  환경변수로 유지한다 (최초 부팅 시드 + 설정 누락 조기 감지).
- `.env.example` 과 `server/config.ts` 주석에 "최초 부팅 시드 전용, 이후 DB 가 권위"를 명시한다.

## 6. 복구 경로 (비밀번호 분실)

`server/scripts/set-password.mjs` 신설 — stdin 으로 새 비밀번호를 받아 argon2id 해시 후
`admin_credentials` 를 UPSERT 하고 `updated_at = now()` 로 갱신, 모든 `admin_sessions` 삭제.
`DATABASE_URL` 을 사용한다. 사용 절차는 07 문서에 기록한다.
