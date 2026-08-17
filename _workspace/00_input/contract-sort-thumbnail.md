# 확정 API 계약 — 수동 정렬 + 썸네일 (리더 확정, 2026-08-17)

backend-developer 와 web-developer 가 **동일하게 준수하는 단일 계약**이다. 문자 단위로 맞춘다.
바꿔야 한다고 판단되면 임의 변경하지 말고 리더에게 보고하라.

---

## 1. DB 스키마 (신규 마이그레이션 `1755300000005_add-sort-order-and-thumbnail.sql`)

```sql
ALTER TABLE posts ADD COLUMN sort_order    integer;   -- NULL = 수동 지정 없음
ALTER TABLE posts ADD COLUMN thumbnail_key text;      -- NULL = 썸네일 없음
```

- 둘 다 **nullable**. 기존 행은 NULL 이므로 하위 호환이 보장된다
- 목록 인덱스 `idx_posts_list` 를 새 정렬 규칙에 맞게 **재생성**하라
  (현재 `(category, urgent DESC, published_at DESC, id DESC)`).
  `sort_order ASC NULLS LAST` 를 반영한 형태로 만들고, 실제 쿼리 플랜을 확인해 근거를 남겨라
- Down 마이그레이션: 두 컬럼 DROP + 인덱스 원복. **컬럼을 지우면 지정한 순서와 썸네일 키가
  소멸한다**는 점을 주석에 명시하라

## 2. 정렬 규칙 (전 분류 공통)

```sql
ORDER BY urgent DESC, sort_order ASC NULLS LAST, published_at DESC, id DESC
```

- **`urgent` 가 여전히 최우선이다.** 긴급 공지는 수동 순서보다 위다 (기존 동작 보존)
- `sort_order` 가 지정된 글이 미지정 글보다 **위**에 온다 (`NULLS LAST`)
- 미지정 글끼리는 기존과 동일하게 게시일 역순
- 이 규칙은 **공개 목록·admin 목록·마감 스트립 등 모든 목록에 동일 적용**한다

## 3. `POST /admin/posts/reorder` — 순서 지정 (신규)

인증: 기존 `requireAdmin`.

**요청 본문**

```jsonc
{ "category": "notice" | "news" | "education", "ids": ["<uuid>", "<uuid>", ...] }
```

**의미:** `ids` 배열의 순서대로 `sort_order` 를 **1, 2, 3 … n** 으로 지정한다.

**검증 (순서 그대로 구현)**

| # | 조건 | 상태 | code | message |
|---|------|------|------|---------|
| 1 | `category` 가 유효 분류가 아님 | 400 | `VALIDATION_ERROR` | 기존 분류 오류 문구 재사용 |
| 2 | `ids` 가 배열이 아니거나 원소가 UUID 형식이 아님 | 400 | `VALIDATION_ERROR` | `ids 는 UUID 배열이어야 합니다.` |
| 3 | `ids` 에 중복이 있음 | 400 | `VALIDATION_ERROR` | `ids 에 중복된 항목이 있습니다.` |
| 4 | `ids` 가 **해당 분류의 활성 게시물 전체의 순열이 아님** | 409 | `CONFLICT` | `목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.` |

- **#4 가 이 엔드포인트의 핵심 안전장치다.** 서버가 해당 분류의 활성(`deleted_at IS NULL`)
  게시물 id 집합을 조회해 `ids` 와 **완전 일치(같은 원소, 같은 개수)** 하는지 확인한다.
  불일치면 거부한다 — 다른 창에서 글이 추가·삭제된 뒤 낡은 목록으로 정렬을 덮어써
  누락·중복이 생기는 것을 막는다. 낙관적 동시성 제어 역할이다
- **원자성**: 전체를 **하나의 트랜잭션**으로 갱신한다. `WHERE id = $1` 로 대상을 특정하고
  분류 전체를 무조건 UPDATE 하지 마라
- 새 에러 code `CONFLICT` 를 `server/src/lib/errors.ts` 의 `ErrorCode` 에 추가하고,
  프론트 `src/lib/api/http.ts` 의 `ApiFailureReason` 에 `"conflict"`,
  `CODE_TO_REASON` 에 `CONFLICT: "conflict"` 를 등록하라.
  **미등록 code 는 `"network"` 로 오분류된다 — 등록 필수**

**200 성공 응답**

```jsonc
{ "ok": true, "category": "education", "updated": 5 }
```

## 4. 썸네일 취득·저장 (서버)

**대상**: `type === "link"` 이고 URL 이 YouTube 영상인 게시물. **생성(POST)·수정(PATCH) 시 수행.**

**videoId 추출** — 아래 형태를 인식한다. 그 외는 썸네일 없음(`null`)으로 둔다.
- `https://www.youtube.com/watch?v={id}` (`m.youtube.com`, `youtube.com` 포함)
- `https://youtu.be/{id}`
- `https://www.youtube.com/shorts/{id}`
- `id` 는 정확히 `[A-Za-z0-9_-]{11}` — **정규식으로 검증하고, 통과한 값만 URL 조립에 쓴다**

**취득**
1. `https://i.ytimg.com/vi/{id}/maxresdefault.jpg` 시도
2. 실패(비200)면 `https://i.ytimg.com/vi/{id}/mqdefault.jpg`
3. **`hqdefault` 를 쓰지 마라** — 480×360 4:3 레터박스라 16:9 카드에 검은 띠가 생긴다

**보안 (SSRF 방어)**
- 요청 호스트는 **`i.ytimg.com` 고정**이다. 사용자 입력은 videoId 뿐이고 위 정규식으로 검증된다.
  절대 사용자 URL 을 그대로 fetch 하지 마라
- 리다이렉트 **금지** (`redirect: "manual"` 또는 동등 수단)
- 타임아웃 필수, 최대 크기 **2MB**, 초과 시 폐기
- 응답이 실제 JPEG 인지 **매직 바이트(`FF D8 FF`)로 검증**한다. Content-Type 만 믿지 마라
  (기존 `lib/fileTypes.ts` 의 내용 검사 방식 계승)

**저장**
- 경로: `{UPLOAD_DIR}/thumbnails/` (첨부와 분리 — 첨부는 조합원 대상 문서, 썸네일은 파생 캐시)
- 파일명(= `thumbnail_key`): `{videoId}-{variant}.jpg` (예: `Vj3lQ7Y71PU-mqdefault.jpg`).
  **서버가 만든 값만 경로에 쓴다**
- 파일 모드 `0o600`, 디렉토리는 필요 시 생성

**실패 처리**
- **썸네일 취득 실패가 게시를 막지 않는다** (06 §13.2 링크 프리뷰와 동일 원칙).
  `thumbnail_key = NULL` 로 두고 게시는 성공시킨다. 실패는 `request.log.warn` 으로만 남긴다
- 게시 응답을 늦추지 않는 것이 바람직하나, **비동기 백그라운드 처리는 이번 범위에서 하지 마라**
  (일관성·에러 추적이 복잡해진다). 타임아웃을 짧게 잡아 동기 처리한다

**URL 변경 시**: PATCH 로 URL 이 바뀌면 썸네일을 **재취득**한다. 링크형→작성형으로 바뀌면
`thumbnail_key = NULL`. 이전 파일은 지우지 않아도 된다(캐시이며 키가 videoId 기반이라 재사용된다).

## 5. `GET /thumbnails/:key` — 썸네일 제공 (신규 공개 라우트)

- `key` 는 `^[A-Za-z0-9_-]{11}-(maxresdefault|mqdefault)\.jpg$` 로 **엄격 검증**.
  불일치 시 400. **경로 조작(`..`) 이 구조적으로 불가능해야 한다**
- 파일 없으면 404
- `Content-Type: image/jpeg`
- `Cache-Control: public, max-age=31536000, immutable` — 키가 videoId+변형에 고정되므로 안전
- rate limit: 기존 `filesLimiter` 정책을 참고해 적용 여부를 판단하고 근거를 남겨라

## 6. API 응답 필드 추가

**공개 목록·상세 (`/posts`, `/posts/:id`)** — 기존 필드는 불변, 아래를 **추가**한다:

```jsonc
{ "thumbnailUrl": "/thumbnails/ATbGKR-Agmk-maxresdefault.jpg" | null }
```

- 첨부(`/files/...`)와 동일하게 **상대 경로**로 내려준다. 프론트가 `resolveApiUrl()` 로 절대화한다
- `sortOrder` 는 **공개 응답에 넣지 마라** (정렬은 서버 책임이고, 노출하면 프론트가
  재정렬하려는 유혹이 생긴다)

**admin 목록·상세 (`/admin/posts`, `/admin/posts/:id`)** — 위 `thumbnailUrl` 에 더해:

```jsonc
{ "sortOrder": 1 | null }
```

- admin UI 가 현재 순서를 표시·조작하려면 필요하다
- 응답 스키마(serializer)에 필드를 추가하지 않으면 **직렬화 단계에서 조용히 떨어진다**
  (`additionalProperties: false`) — 반드시 스키마도 함께 갱신하라

**프론트 파서**: `thumbnailUrl`·`sortOrder` 가 없거나 타입이 다르면 **`null` 로 간주**하고
`invalidResponse` 로 떨어뜨리지 마라 (구버전 API 와의 공존 방어).

## 7. 소급 적용 스크립트

`server/scripts/backfill-thumbnails.mjs` — 기존 링크형 게시물 전체를 훑어 썸네일이 없는 것에
대해 §4 절차를 수행하고 `thumbnail_key` 를 채운다.

- **`DATABASE_URL` 과 `UPLOAD_DIR` 을 환경변수로 받는다**
- 이미 `thumbnail_key` 가 있는 행은 건너뛴다 (멱등)
- 건별 성공·실패를 출력하고, 실패해도 나머지를 계속 처리한다
- `UPDATE` 는 반드시 `WHERE id = $1` (대상 특정 필수 규칙)

## 8. 순서 지정 UI 계약 (프론트)

`src/lib/api/admin.ts`:

```ts
export async function adminReorderPosts(
  category: PostCategory,
  ids: string[],
): Promise<ApiResult<{ updated: number }>>;
```

- `reason === "conflict"` → **"목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요."**
  를 표시하고 목록을 재조회한다. 낡은 순서로 재시도하게 두지 마라
- admin UI 조작 방식은 **위/아래 이동 버튼**으로 한다 (리더 확정).
  드래그앤드롭은 키보드·스크린리더 접근성 비용이 크고, 숫자 직접 입력은 중복·누락을
  사용자가 관리해야 한다. 구체 스펙은 디자이너가 확정한다
