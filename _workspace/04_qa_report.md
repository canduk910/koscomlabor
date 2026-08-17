# QA 리포트: 관리자 비밀번호 변경 (11회차)

> **배치 위치 안내**: 리더 지시는 "말미에 이어서"였으나, 이 파일은 **최신 회차가 최상단**인 내림차순(10→1) 관례로 관리되고 있다. 말미에 넣으면 1회차 아래에 묻히므로 관례를 따라 최상단에 추가했다(기존 내용 삭제·수정 0건). 위치 이동이 필요하면 알려주면 옮긴다.

- 작성: qa-tester | 작성일: 2026-08-17
- 검증 기준: **`_workspace/00_input/contract-password-change.md`(확정 계약 + 개정 1) = 판정 기준**, 요구사항 문서, 02 스펙 §14.8(§14.8.5 개정 반영본), 06 §10.4/§12.1-a/§12.3/§12.4, 07 §9, 03 §17
- 검증 대상(git 미커밋): 신규 4 (`server/migrations/1755300000003_create-admin-credentials.sql`, `server/src/repos/credentials.ts`, `server/scripts/set-password.mjs`, `src/components/admin/PasswordChangeForm.tsx`) + 수정 10
- **환경 격리**: 전용 QA DB `guestbook_qa` 신규 생성 + 스크래치패드 전용 env(`DATABASE_URL`=guestbook_qa, `COOKIE_SECURE=false`, `CORS_ORIGINS`에 localhost:3000, `ADMIN_PASSWORD_HASH`=QA 전용 해시). **`server/.env` 무수정, 개발 DB `guestbook` 무접촉, 프로덕션(101.79.31.30) 접속 0건**
- 검증 방법: ① 계약↔서버↔프론트 **필드 단위 3자 대조표** ② **curl 실왕복 45케이스**(계약 §2 표 순서대로) ③ **실브라우저 실조작 107 어서션**(headless Chrome + CDP 자체 드라이버 — `claude-in-chrome` MCP는 localhost 도달 불가로 대체, 아래 비고 1) ④ 대비 스크립트 재현 ⑤ 로그·스토리지 시크릿 grep ⑥ 빌드 6종
- 정리: `guestbook_qa` drop, API·dev·Chrome 프로세스 3종 종료(잔여 0), `server/.env` md5 불변 확인, 개발 DB 행수 기준선과 동일

## 11회차 요약: 통과 27 | 실패 0 | 권고 3 | 미검증 4

**최우선 리스크(서버가 `UNAUTHORIZED`를 내면 관리자가 로그아웃됨)는 실응답·실브라우저 양쪽에서 해소 확인.** 백엔드·프론트가 서로의 응답을 처음 받아본 왕복에서 경계면 불일치 0건.

### A. 경계면 3자 교차 대조 (계약 ↔ `routes/admin.ts` 실응답 ↔ `lib/api/admin.ts`)

**`GET /admin/me`** — 4필드 전부 일치. `additionalProperties:false` 스키마가 필드를 떨어뜨리지 않음을 **실응답으로 확인**.

| 필드 | 계약 §1 | 서버 (`admin.ts:31-41` 스키마 / `:254-284` 핸들러) | 프론트 (`admin.ts:768-781`) | 실응답 |
|---|---|---|---|---|
| `ok` | `true` | `boolean` required | 미검사(무해) | `true` |
| `method` | `"session"\|"bearer"` | `string` required, 2분기 | `=== "bearer" ? "bearer" : "session"` | 세션 `"session"` / Bearer `"bearer"` 둘 다 실측 |
| `expiresAt` | `string\|null` | `["string","null"]` required | 문자열 아니면 `null` | 세션 ISO / Bearer `null` |
| `passwordIsInitial` | `boolean` (신규) | `boolean` required, `active.updatedAt === null` | `=== true` (하위호환 방어) | 시드 후 `true` → 변경 후 `false` |

실응답 원문: `{"ok":true,"method":"session","expiresAt":"2026-08-17T12:42:10.094Z","passwordIsInitial":true}` / `{"ok":true,"method":"bearer","expiresAt":null,"passwordIsInitial":false}`

**`POST /admin/password`** — 요청 필드명(`currentPassword`/`newPassword`) 서버·프론트 동일. 성공 3필드 일치(`sessionsRevoked` 스키마 `integer` ↔ 프론트 `Number.isInteger` 아니면 0). 실패 5분기 전부 계약과 **문자 단위 일치**(아래 B).

**`http.ts` `CODE_TO_REASON`** — `INVALID_CREDENTIALS: "invalid-credentials"` 등록 확인(`src/lib/api/http.ts:82`). 미등록 시 `?? "network"`로 오분류되는 경로였으나 **정상 등록됨**. `ApiFailureReason`에도 추가(`:16`). 기존 reason 값·기존 엔드포인트 매핑 불변.

**타입 우회**: 이번 변경분(`src/components/admin`, `src/lib/api`, `server/src`)에 `as any`/`@ts-ignore`/`@ts-expect-error` **0건**. 유일한 `as unknown`은 `admin.ts:112`(기존 `requestJson` 반환 widening — 안전한 확대).

### B. API 실측 (curl) — 계약 §2 표 순서

| # | 케이스 | 실응답 | 판정 |
|---|---|---|---|
| 0 | rate limit 초과 | `429` `{"error":{"code":"RATE_LIMITED","message":"요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."}}` + `Retry-After: 6` | PASS |
| 0-b | 429 상태에서 **정상 요청도 차단**(진입 시 `check`) | `429` 동일 | PASS |
| 1a | `newPassword: ""` | `400 VALIDATION_ERROR` `currentPassword 와 newPassword 는 1자 이상 200자 이하의 문자열이어야 합니다.` | PASS |
| 1b | `currentPassword: 123`(비문자열) | 동일 | PASS |
| 1c | 필드 누락 `{}` | 동일 | PASS |
| 1d | `newPassword` 201자 | 동일 | PASS |
| 2 | `newPassword` 11자 | `400 VALIDATION_ERROR` `새 비밀번호는 12자 이상이어야 합니다.` | PASS |
| 2-순서 | **틀린 current + 11자 new** | `400` 12자 메시지 (401 아님 — #2가 #4보다 먼저) | PASS |
| 3 | `new === current` | `400 VALIDATION_ERROR` `새 비밀번호가 현재 비밀번호와 같습니다.` | PASS |
| 3-순서 | **틀린 current이면서 new===current** | `400` 동일 메시지 (#3이 #4보다 먼저) | PASS |
| 4 | 현재 비밀번호 불일치 | **`401` `{"error":{"code":"INVALID_CREDENTIALS","message":"현재 비밀번호가 일치하지 않습니다."}}`** | **PASS (최우선)** |
| — | **인증 실패와의 구분**: 쿠키 없음 / 위조 쿠키 | 둘 다 `401 UNAUTHORIZED` `관리자 인증에 실패했습니다.` — `INVALID_CREDENTIALS` **아님** | **PASS (최우선)** |
| 200 | 정상 변경 (세션 A로) | `{"ok":true,"changedAt":"2026-08-17T00:43:54.931Z","sessionsRevoked":2}` | PASS |

4개 message 전부 계약 §2 표와 **파이썬 문자열 비교로 문자 단위 일치** 확인.

| # | 부수 검증 | 실측 | 판정 |
|---|---|---|---|
| 5 | 변경 후 `GET /admin/me` | `passwordIsInitial:false` | PASS |
| 6 | 구 비밀번호 로그인 / 신 비밀번호 로그인 | `401 UNAUTHORIZED` / `200` (**재기동 없이 즉시 반영**) | PASS |
| 7 | **세션 무효화** A·B·C 중 A로 변경 | A `200` 유지, B·C `401`, `sessionsRevoked:2` 정확 | PASS |
| 8 | **만료 세션 부풀림 방지** 변경 직전 만료행 2건 주입 | `sessionsRevoked:2`(살아있던 B·C만) — 만료 2건은 `pruneExpired`로 선정리, 변경 후 `total=1` | PASS (07 §9.3-4 정교화 실동작) |
| 9 | **Bearer 경로** (살아있는 세션 2개) | `200 sessionsRevoked:2` → `admin_sessions` 0건, 두 쿠키 모두 `401` | PASS |
| 10 | Bearer + 현재 비밀번호 불일치 | `401 INVALID_CREDENTIALS` | PASS |
| 11 | `set-password.mjs` 복구 | `changedAt=… sessionsRevoked=1`, 전 세션 삭제, **재기동 없이** 새 비밀번호 로그인 `200`. 11자 입력 거부(exit 1). 평문·해시 미출력. **게시물·방명록 행수 불변** | PASS |
| 12 | 마이그레이션 | `1755300000003` 적용 후 컬럼·`CHECK (id = 1)`·PK가 계약 §4와 동일 | PASS |
| 13 | 부팅 시드 | 기동 시 `id=1`, `updated_at NULL` 1행 생성 | PASS |
| 14 | CORS preflight `OPTIONS /admin/password` | 허용 Origin: `allow-origin: http://localhost:3000` + `allow-credentials: true` + `allow-headers: Content-Type, Accept`. 비허용 Origin(`https://evil.example`)은 ACAO 미반환 | PASS |
| 15 | 비정상 본문 4종(빈 본문/text-plain/깨진 JSON/배열) | 전부 `400 VALIDATION_ERROR` — 500 누출 없음 | PASS |
| 16 | **회귀** | 방명록 POST 201·GET 200 / 로그인 200 / admin 게시물 생성 201·목록 200·PATCH 200·DELETE 200 / 공개 `GET /posts?category=notice` 200 / 로그아웃 200 + 이후 `401` — 전부 이전과 동일 | PASS |

### C. UI 실측 (실브라우저 조작 — headless Chrome + CDP, 107 어서션 전부 통과)

| # | 항목 | 실측 결과 | 판정 |
|---|---|---|---|
| 17 | **경고 배너 노출→소멸** | `passwordIsInitial:true` 상태에서 ready 뷰 **첫 자식**으로 `<section aria-labelledby="initial-password-title">` 렌더, 변경 성공 **즉시** DOM에서 제거(`/admin/me` 재호출 없음) | PASS |
| 18 | 배너 CTA / 헤더 버튼 동일 패널 | 둘 다 동일 패널 오픈, 열릴 때 `activeElement === #admin-current-password` | PASS |
| 19 | **PostForm과 상호 배타** | 비번 패널 열림→`새 게시물` 클릭 시 비번 패널 닫힘 / 반대도 성립. **`<h3>` 항상 정확히 1개**(`["비밀번호 변경"]` ↔ `["새 게시물 등록"]`) | PASS |
| 20 | **현재 비밀번호 오입력** (최대 리스크) | `stillOnAdminPanel:true, loginFormShown:false` — **로그아웃 안 됨**. 현재 비밀번호 필드 아래 `현재 비밀번호가 일치하지 않습니다.`(서버 message 그대로) + `aria-invalid="true"` + `activeElement`가 해당 필드로 이동 | **PASS (최우선)** |
| 21 | 세션 만료(대조군) | 패널 열어둔 채 외부에서 세션 행 삭제 → 제출 → `UNAUTHORIZED` → **로그인 화면 전환** + 패널 닫힘(평문 폐기). 20번과 정반대로 정확히 분기 | **PASS (최우선)** |
| 22 | 성공 문구 2갈래 | `sessionsRevoked=0`: `비밀번호를 변경했습니다. 이 브라우저의 로그인은 유지됩니다.` / `=2`: `비밀번호를 변경했습니다. 다른 기기의 로그인 2건이 해제되었습니다.` — 기존 상위 `<p role="status">` 슬롯 사용(토스트 신설 0) | PASS |
| 23 | 취소·성공 후 포커스 복귀 | 둘 다 `document.activeElement === 헤더 "비밀번호 변경" 버튼`(배너 CTA 아님 — 객체 동일성으로 확인) | PASS |
| 24 | 제출 버튼 비활성 조건 | 빈 폼에서 `disabled:false` — 눌러서 검증 → `현재 비밀번호를 입력해 주세요.` + 첫 오류 필드 포커스, 서버 요청 없음. busy일 때만 `disabled:true` + 라벨 `변경 중…` + `aria-busy="true"`, **`opacity:1` 유지**(대비 무손실), 입력 필드는 `disabled:false`(포커스 유실 방지), `cursor:not-allowed` | PASS |
| 25 | 서버 에러 4분기 UI 매핑 | `validation`(201자 주입) → 폼 하단 `<p role="alert">`에 서버 message 그대로 / `rate-limited` → `시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.` / `network`(fetch 차단) → `서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.` / `invalid-credentials` → 필드 에러(#20). **네 경우 모두 로그인 화면으로 튕기지 않음** | PASS |
| 26 | 하위호환 방어 | `/admin/me` 응답에서 `passwordIsInitial`를 가로채 제거(구버전 API 모사) → `invalidResponse`로 죽지 않고 ready 진입, **배너 미표시**(안전한 기본값), 헤더 진입점은 유지 | PASS |
| 27 | PostForm 회귀 | `LABEL_CLASS` → `ADMIN_LABEL_CLASS` 교체 후 라벨 7개 전부 `#1a1a1a / 18px / 600 / block` — 시각 회귀 0 | PASS |

### D. 접근성

| 항목 | 실측 | 판정 |
|---|---|---|
| 헤딩 순서 | 배너 있음+패널 닫힘: `h1 관리자 → h2 주의 — 초기 비밀번호를 사용 중입니다 → h2 게시물 관리`. 패널 열림: 뒤에 `h3 비밀번호 변경`. 변경 후: `h1 → h2 게시물 관리`. **건너뜀·중복 0** | PASS |
| 배너 라이브 리전 **미부착**(스펙상 의도) | `role=null, aria-live=null`, 하위 `[role=status\|alert\|aria-live]` **0개** | PASS |
| 라벨·autoComplete·maxLength | 3필드 전부 `label[for]` 연결(`현재 비밀번호 (필수)`/`새 비밀번호 (필수)`/`새 비밀번호 확인 (필수)` — "(필수)" 텍스트 표기), `type=password`, `current-password`/`new-password`/`new-password`, `maxLength=200` | PASS |
| `aria-invalid` / `aria-describedby` | 에러 없을 때 `aria-invalid` 미설정 → 에러 시 `"true"`. `aria-describedby`가 참조하는 **모든 id가 실제 DOM에 존재**(`getElementById` 전수 확인). 확인 필드는 힌트 없으므로 속성 자체 미출력(빈 문자열·유령 id 없음) | PASS |
| `role="alert"` 배치 | 필드 에러 3개 각 필드 아래 조건부 렌더(나타날 때 발화), 폼 하단 에러는 form 직계 `<p role="alert">` | PASS |
| 힌트 문구 | 스펙 §14.8.4와 문자 단위 일치(`본인 확인을 위해 현재 비밀번호를 다시 입력합니다.` / `12자 이상 200자 이하, 현재 비밀번호와 다르게 입력해 주세요.`) | PASS |
| **색 대비 재현** (`check-contrast.mjs`) | **#27 신규 `#093389` on `#fdf0e7` = 10.18** ✅ / 15.58 / 7.84 / 8.77 / 11.37 / 17.40 / 7.56 / 8.46 / 4.83 / 11.37 — §14.8.7 표 10개 값 **전부 일치**. 금지 조합도 재현(`#4b5563` on tint 6.76 AAA미달, `#ec6d1e` on tint 2.78 UI불가) | PASS |
| **구현 실측 색 ↔ 대비표** | 브라우저 `getComputedStyle` 실측: 배너 배경 `#fdf0e7`, 좌측바 `#7a3806` 4px, CTA `#093389`/`#ffffff`, 제목 `#7a3806` 18px/700, 본문 **`#1a1a1a`**(금지된 `text-ink-muted` 아님), 아이콘 `#7a3806` 24px `aria-hidden="true"`, 힌트 `#4b5563`, 에러 `#9c0d14`, 입력 보더 `#6b7280`/48px/radius 12px, 포커스 링 3px `#093389` — **스펙 값과 전부 일치, 임의 색 0건** | PASS |
| 키보드 전용 전 플로우 | 실 `Tab`/`Enter` 키 이벤트: Tab만으로 헤더 버튼 도달 → **Enter로 패널 열림 + 첫 필드 자동 포커스** → Tab 3회로 3필드 → 제출 → 취소, Shift+Tab 역방향 정상, **Enter로 제출 성공** | PASS |
| 포커스 링·터치 대상 | 헤더 버튼 `outline: 3px solid #093389`, `min-height:44px`(실측 44px). 입력 48px, CTA 44px, 제출·취소 44px | PASS |
| **360px 뷰포트** | `scrollWidth 360 = clientWidth 360` — **가로 스크롤 0**. 헤더 3버튼 **2줄 wrap**(새 게시물+비밀번호 변경 / 로그아웃). 배너 328px, **CTA `w-full` 292px×44px 세로 스택**, 제목 2줄·말줄임 없음(`text-overflow:clip`), 폼 우측 327px < 360px | PASS |
| ≥768px 배너 | `flex-direction:row` 단일 행, CTA 146px·1줄(라벨 줄바꿈 없음) | PASS |

### E. 보안·개인정보

| 항목 | 실측 | 판정 |
|---|---|---|
| 서버 로그 시크릿 | 전체 로그(144줄) grep: 평문 6종·`$argon2`/`argon2id`·`token_hash`/`admin_session=`·`currentPassword`/`newPassword` **전부 0건**. 기록된 라인은 `{"route":"admin-password-change","method":"session","sessionsRevoked":2}` / `{"result":"current-password-mismatch"}`뿐 | PASS |
| 응답 본문 해시 누출 | `GET /admin/me`·`POST /admin/password` 성공/실패 전 응답에 해시 문자열 0건 (직렬화 스키마가 4/3필드로 고정) | PASS |
| 프론트 평문 잔류 | 브라우저 실측: `localStorage` 0키, `sessionStorage` 0키, URL에 평문 없음, **직렬화 HTML(`outerHTML`)에도 평문 없음**(React 제어 input이 `value` 속성을 렌더하지 않음). 평문은 `PasswordChangeForm` 로컬 state에만 존재하고 언마운트로 폐기 | PASS |
| WHERE 없는 DELETE 전수 | `server/` 전체 grep: 2곳뿐 — `repos/sessions.ts:64`(`destroyAll`), `scripts/set-password.mjs:55`. **둘 다 `admin_sessions` 한정**. 게시물·방명록 테이블 대상 0건. 나머지 DELETE 3개는 전부 WHERE 보유. `TRUNCATE` 0건, `DROP TABLE`은 마이그레이션 Down뿐 | PASS |
| 현재 비밀번호 재확인 강제 | 세션만으로는 변경 불가 — #4 검증이 항상 수행됨(실측) | PASS |
| rate limit 정책 | `check`만 진입 시 수행, `record`는 **#4 실패에서만**(성공 변경 5회 연속 실행해도 카운트 안 됨 — 실측) | PASS |

### F. 빌드·정적 검사

| 명령 | 결과 |
|---|---|
| `npx next typegen` | 통과 |
| `npx tsc --noEmit` | 통과 (오류 0) |
| `npm run lint` | 통과 (오류·경고 0) |
| `npm run build` | 통과 (`/admin` ○ Static, 라우트 구성 변화 없음) |
| `cd server && npm run typecheck` | 통과 (strict) |
| `cd server && npm run build` | 통과 |

### 회귀 (이전 회차 실패 항목)

| 회차 | 항목 | 현재 상태 |
|---|---|---|
| 7회차 실패 #1 | `GmarketSans*.woff2`가 실제로는 OTF(`OTTO`) | **해소** — 두 파일 모두 시그니처 `774f4632`(`wOF2`) 확인 |
| 10회차 | 실패 0 | 해당 없음 |

### 권고 (실패 아님 — 리더 판단 사항)

| # | 분류 | 위치 | 내용 | 제안 |
|---|---|---|---|---|
| R1 | 예외 경로 견고성 | `server/src/repos/credentials.ts:59-73` (`update`) ↔ `server/src/routes/admin.ts:127-134` (`resolveCredentials`) | **폴백이 절반만 구현됨.** `resolveCredentials`는 행 부재 시 env로 폴백해 검증을 통과시키지만, 이어지는 `update()`는 `UPDATE … WHERE id = 1`이라 0행 → throw → **`500 INTERNAL_ERROR`**. 실측: 행 삭제 후 `POST /admin/password` → `500`. 프론트는 `INTERNAL_ERROR`가 `CODE_TO_REASON` 미등록이라 `network`로 낙하 → **"서버에 연결하지 못했습니다."**(원인과 무관한 문구). 트리거는 07 §9.7이 안내하는 "최후의 수단: 행 DELETE" 직후 재기동 전 구간뿐이라 심각도 낮음 | `credentials.update`를 `set-password.mjs:44-49`와 동일한 UPSERT(`INSERT … ON CONFLICT (id) DO UPDATE SET password_hash=…, updated_at=now() RETURNING updated_at`)로 바꾸면 행 부재 경로가 자가 치유되고 폴백 설계가 일관해진다 (1개 쿼리 교체) |
| R2 | 계약 문언 | `_workspace/00_input/contract-password-change.md:75-76` ↔ `server/src/routes/admin.ts:362-377` | 계약은 "Bearer 로 호출한 경우 모든 세션이 무효화"라고 쓰였으나, 구현 분기 기준은 "**유효한 세션 쿠키를 들고 왔는가**"다. 실측: Bearer + 유효 쿠키 동시 전송 시 `method:"session"`, `sessionsRevoked:1`로 그 쿠키 세션을 **유지**한다. 계약의 상위 원칙("현재 요청의 세션은 유지된다")에는 부합하며 브라우저·curl 실사용에서 겹칠 일이 없으므로 결함으로 보지 않음 | 계약 §2 문구를 "요청에 유효한 세션 쿠키가 없으면(=순수 Bearer 호출) 전 세션 무효화"로 정밀화하면 문언·구현이 완전 일치 |
| R3 | 문서 정합 | `_workspace/03_developer_impl.md` §17 "스펙과의 차이 1건" | 개발자가 "스펙 §14.8.5 표가 개정 1 이전 상태라 수정 필요"로 기록했으나, **리더가 이미 §14.8.5를 개정 반영본으로 갱신**했다(현재 스펙에 `invalid-credentials`→필드 에러 / `unauthorized`→로그인 화면 표 + "✅ 경계면 해소" 문단 존재). 기록이 역으로 낡음 | 03 §17의 해당 절을 "해소됨"으로 갱신 (코드 영향 0) |
| R4 | 운영 유의 (정보) | `server/src/app.ts:141`, `routes/admin.ts:299-302` | loginLimiter 공유는 계약 §2 규정대로지만, `/admin/login`은 **성공 로그인도 `consume`** 한다. 즉 "로그인 1회 + 현재 비밀번호 4회 오타"면 5회 소진으로 429. 또한 이 버킷은 **복구용 Bearer 경로도 함께 막는다**(실측: 로그인 4회 후 Bearer 변경 시도 → 429). 계약 준수이므로 실패 아님 | 운영 문서에 "잠금 시 최대 1시간 대기 또는 API 재기동(인메모리 리미터 초기화)" 한 줄 추가 권장 |

### 미검증 항목

| # | 항목 | 사유 |
|---|---|---|
| 1 | `claude-in-chrome` MCP(사용자 실제 Chrome)로의 조작 | **권한/도달 불가** — 확장이 `localhost:3000`·`127.0.0.1:3000`·LAN IP 모두 "error page"로 반려(외부 사이트 `example.com`은 정상 로드되어 확장 자체는 동작). dev 서버는 curl 200 응답 확인됨. 대체 수단으로 **격리 프로필의 headless Chrome을 CDP로 직접 구동**해 실조작 검증(위 C·D)을 수행했다. 실사용자 Chrome 프로필·확장 환경에서의 동작은 미검증 |
| 2 | 스크린리더 실낭독 (`role="alert"` 발화 타이밍, 배너 랜드마크 안내, `aria-describedby` 낭독 순서) | 보조기기 실행 환경 없음. DOM 속성 정확성까지만 검증 |
| 3 | 비밀번호 관리자(1Password·Chrome 저장) 자동완성·저장 프롬프트 실동작 | headless 환경에 비밀번호 관리자 부재. `autoComplete` 값 정확성까지만 검증 |
| 4 | 프로덕션 배포 검증 (07 §9.5 절차, 마이그레이션→API 재기동 순서, 프로덕션 스모크) | 지시에 따라 프로덕션 접속 0건. 배포는 리더 수행 범위 |

### 비고

1. **브라우저 도구 대체 경위**: `claude-in-chrome` MCP는 외부 사이트는 열지만 로컬 개발 서버(localhost/127.0.0.1/LAN IP)에 대해 일관되게 "Frame with ID 0 is showing error page"를 반환했고, dev 서버 로그에도 해당 요청이 도달하지 않았다(확장 측 사이트 권한 문제로 추정). 추측으로 넘기지 않기 위해, 별도 `--user-data-dir`의 headless Chrome을 띄우고 Node 내장 WebSocket만으로 CDP 드라이버를 작성해 **실제 마우스·키보드 이벤트와 `getComputedStyle`·`document.activeElement` 실측**으로 검증했다. 설치한 패키지 0건, 사용자 Chrome 프로필 무접촉.
2. **rate limit 리셋 방법**: 인메모리 리미터라 테스트 그룹 사이에 API 프로세스를 재기동해 초기화했다(DB 상태 유지). 리미터 자체의 동작은 재기동 전에 실측 완료(#0).
3. `server/dist`·`.next`는 검증 과정에서 재빌드되었다(둘 다 gitignore 대상, 현재 소스와 일치). 추적 파일 변경 0건 — `git status`가 개발자 변경분 21건 그대로.
4. 06 §18의 "429 + `Retry-After: 60`"은 예시값이며, 실측값은 슬라이딩 윈도 잔여시간에 따라 달라진다(이번 실측 6초). 불일치 아님.

---

# QA 리포트: 공지·소식 DB 전환 + admin 풀스택 (10회차)

- 작성: qa-tester | 작성일: 2026-08-17
- 검증 기준: 06 명세 Part 2(§10~17), 02 스펙 §14·§13.5.2(지부명 규칙)·§13.5.1(8차 축소 개정), 03 구현 §15, 07 §7
- 환경: 로컬 PostgreSQL 16 + `server/` 기동(ADMIN_PASSWORD_HASH는 QA 전용 임시 해시로 env 오버라이드 — 평문·해시 미출력, 검증 후 삭제) + 프론트 `next start`(API 연결 빌드)
- 검증 방법: **프론트 프로덕션 파서 직접 실행**(4회차 방식 + 쿠키 자ar 래퍼로 브라우저 모사) 27케이스 + curl 원시 헤더 실측 + 실렌더 HTML 검사 + 폰트 메트릭 재계산 + 대비 스크립트 + 빌드 3종(프론트)+server typecheck
- 정리: 테스트 게시물·첨부·세션 DB 삭제(posts 0/attachments 0/sessions 0), 업로드 파일 6개 제거(디렉토리 0), 프로세스 2종 종료, 임시 스크립트·비밀 파일 삭제, API 미설정 클린 재빌드 복원

## 10회차 요약: 통과 18 | 실패 0 | 미검증 4 | 비고 3

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | **응답 shape 3자 교차 (최우선)** | 목록 `GET /posts?category=`: **최상위 배열** + `x-total-count` + `access-control-expose-headers` 실측, 프로덕션 `listPosts` 파서 `ok:true` 통과(notice/news/urgent 필터 3케이스). 상세 `getPost`: PostSummary+body 파싱 통과. 첨부 배열: `parseAttachment` 5필드(id/filename/mimeType/sizeBytes/url) 전부 명세 §11.1과 일치. null 허용 필드(url·source·deadline·body)가 링크형/작성형 양쪽에서 정확히 구분 반환됨 |
| 2 | 인증 — 무인증 차단 | 무인증 `adminMe`·`adminListPosts` → 401 → 프론트 `reason:"unauthorized"` 정확 분기. 잘못된 비밀번호 로그인 → 401(계정 힌트 없는 단일 메시지 "인증에 실패했습니다.") |
| 3 | 인증 — 세션 쿠키 | 로그인 성공 시 `Set-Cookie: admin_session=…; Max-Age=43199; Path=/admin; HttpOnly; SameSite=Lax` 실측(명세 §12.1 일치, 값은 리포트에서 마스킹). `Secure`는 `COOKIE_SECURE` 기본 `true`(config.ts:70) — 로컬만 false, 프로덕션 기본 안전. 쿠키 보유 후 `adminMe` 통과 |
| 4 | CORS credentials | 허용 Origin(localhost:3000) preflight: `allow-origin` 정확 매칭 + **`allow-credentials: true`** + methods `GET, POST, PATCH, DELETE` + expose `X-Total-Count`. 비허용 Origin은 ACAO 미반환(와일드카드 없음 — §15-2 승인 조건 충족). 프론트 admin 전 요청 `credentials:"include"`(admin.ts:86) 코드 확인 |
| 5 | 세션 만료 처리 | `AdminApp.tsx:120` — 목록 조회가 `unauthorized`면 `setPhase("login")`으로 로그인 화면 복귀(세션 만료 UX). 로그인 에러 3분기 문구가 §14.2 지정 문구와 문자 단위 일치 |
| 6 | **번들 비밀 유출 0건** | 클라이언트 번들 15파일 + admin SSR HTML 고정문자열 검사: QA 평문 비밀번호·argon2 해시·Bearer 토큰·`ADMIN_PASSWORD`/`ADMIN_API_TOKEN`/`IP_HASH_SECRET`/`DATABASE_URL`/`argon2` **전부 0건** |
| 7 | CRUD E2E — 생성 | 작성형 공지(urgent+deadline+출처) 201, 링크형 소식(url) 201 — 둘 다 상세 shape 반환·파서 통과. `publishedAt`은 입력에 없고 서버 자동 기록(§15-6 판정 준수, `AdminPostInput`에 필드 부재 확인) |
| 8 | CRUD E2E — 수정·삭제 | PATCH 부분 수정(제목·urgent) 200 반영. DELETE soft → **공개 상세 404·공개 목록 0건·admin 목록엔 `deletedAt` 노출**·삭제 글의 첨부 파일도 404(공개 차단, 파일은 보존) |
| 9 | 공개 렌더 E2E (ISR) | API 연결 빌드 실렌더: 히어로 urgent 바인딩(긴급 배지·hero 제목·CTA `/notices/<uuid>`), 마감 스트립 **D-3·8/20**(오늘 KST 2026-08-17 기준 정확), 링크형 카드, 작성형 상세(h1·마크다운 h2 매핑·출처·첨부 행), 링크형 상세("원문 보기" 외부 링크). **ISR 60초 재검증 실측**(urgent 복구 → 재검증 후 히어로 반영, 삭제 → 재검증 후 빈 상태·폴백 복귀) — D-n이 요청 시점 계산으로 전환된 것 확인 |
| 10 | §14.1 링크형 카드 3중 병행 | 카드 전체 `target="_blank" rel="noopener noreferrer"`, 메타 "외부 링크(새 창) · example.com"(**호스트만** — 전체 URL 미노출), ↗ 아이콘, 접근성 이름에 메타 문구 포함(`<a>` 내부 텍스트) — HTML 실측 |
| 11 | §14.1 첨부 표시 | 목록 카드 "첨부 1"(문서 아이콘+caption), 상세 첨부 행(파일명·크기 "2KB"·API 절대 URL·↓ 아이콘·surface 카드). 다운로드 **바이트 완전 일치**(2125B), `content-disposition: attachment`, `cache-control: public, max-age=31536000, immutable`, 잘못된 filename 접근 404(§11.3 규정) |
| 12 | preview-link 3상태 | 성공(example.com → "Example Domain" 추출), 실패 폴백(존재하지 않는 호스트 → `link-fetch-failed` + 수동 입력 안내), 로딩 상태는 `PostForm.tsx:308` `role="status"` 코드 확인. 제목 필드 항상 편집 가능 |
| 13 | **SSRF 회귀 (프론트 경유)** | 6케이스 전부 차단: 127.0.0.1:3001(포트 규칙), 127.0.0.1:80·localhost 이름·192.168.0.1·169.254.169.254(대역 규칙 "허용되지 않는 대상입니다"), `file://`(스킴 규칙). 전부 `link-fetch-failed`로 프론트에 정확 분기 |
| 14 | 업로드 화이트리스트 | 정상 PDF 201. `.php`(MIME 불일치) 거부, **확장자 위장 `fake.pdf`(매직바이트 불일치) 거부** — 이중 검사 실동작. 프론트 선검증 상수(5개·10MB·pdf/png/jpg/webp)가 백엔드 한도와 동일 수치 |
| 15 | **지부명 표기 전수** | `grep -rn "코스콤지부" src/` → 짧은 표기 **0건**, 정식 표기 "코스콤(한국증권전산)지부" 10건(헤더·푸터·히어로 록업·메타데이터·admin 포함) — §13.5.2 공통 문구 규칙 준수 |
| 16 | 접근성 | admin 폼: 전 필드 가시 `<label htmlFor>`, "(필수)" 텍스트 표기(별표·색 단독 아님), `<fieldset><legend>` 2종(글 유형·카테고리), `autoComplete="current-password"`, `inputMode="url"`, `type="date"`, 로그인 에러 `role="alert"`, 저장·업로드·preview `role="status"`. **DeleteDialog**: `role="alertdialog"`+`aria-modal`+labelledby/describedby, **초기 포커스=취소**(useEffect), Tab 포커스 트랩, Esc·오버레이 클릭 취소. `/admin` `<meta name="robots" content="noindex, nofollow">` 실측 |
| 17 | 대비 (§14.6 재사용 설계) | 실사용 11조합 재실측 — 텍스트 전부 AAA(#8 11.37·#10 10.45·#12 8.46·#13 7.74·#14 8.46·#22 9.23·#2 16.65·#6 7.56·#7 7.23), UI 보더·아이콘 #20 4.83·#21 4.63(3:1 통과). **신규 조합 0건**, admin 하드코딩 hex 0건 |
| 18 | 회귀·빌드 | 방명록 API 200(Part 1 무영향), 상세 라우트 `[id]` 전환 정상 + **카테고리 불일치 id 404**(공지 id를 news 경로로 열람 차단), 탭 ARIA 유지, 폰트(Pretendard CSS 3참조·`font-display` 11개소)·헤더 v4 8차 축소분(`border-y-4`·`py-2 md:py-3`·마크 h-8/h-9·록업 15/17.7→16/18.9px) 스펙 일치. **등폭 재계산: 헤더 8차 모바일 0.37px·md 0.20px, 히어로 0.50/0.24px — 전부 ±2px 이내**. 375px 헤더 252.3px(여유 122.7px). 프론트 `tsc`0·`lint`0·`build` 통과(/ ○ ISR 1m, /admin ○, 상세 ƒ), `server` typecheck 통과 |

### 비고

1. **로컬 DB에 이전 스모크 잔여 데이터 존재** — 정리 시 posts 8건·attachments 6건이 삭제됨(이번 QA 생성분은 posts 2·attachment 1). 나머지는 개발자 스모크 잔여로 추정 — 로컬 개발 DB 한정이라 프로덕션 영향 없으나, 스모크 후 정리 완결성 개선 권고. 방명록 테이블에도 `[Part1 회귀 확인 - 삭제 예정]` 1행 잔존(권한 제약으로 미삭제 — 로컬 한정, 개발자 정리 요청).
2. `src/lib/api/admin.ts:92` `(await response.json()) as unknown` — `any`를 `unknown`으로 **좁히는** 방어적 캐스팅으로 타입 우회 아님(우회 grep 실질 0건).
3. DeleteDialog 오버레이 `div onClick`(취소) — 키보드 경로는 Esc·취소 버튼이 보장하므로 접근성 장벽 아님(보조 수단).

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | **admin UI 브라우저 실조작** — 라디오 전환 시 입력값 유지, preview 3상태 시각 전환, 파일 선택·선검증 UX, 다이얼로그 포커스 트랩 실동작, 실브라우저 CORS 쿠키 전송 | 브라우저 자동화 환경 없음 — 쿠키 자ar 래퍼로 계약·분기는 실행 검증, 쿠키 속성·CORS 헤더는 curl 실측으로 대체 |
| 2 | 프로덕션 도메인 CORS·`Secure` 쿠키 실동작 | 미배포 — 로컬 localhost:3000 origin만 확인. 배포 시 07 §7.1 스모크 필요 |
| 3 | 게시물당 5개 초과·10MB 초과 업로드 한도 실측 | 대용량 전송 시간 제약 — 프론트 선검증 상수·백엔드 한도 수치 일치는 코드 확인 |
| 4 | 스크린리더 실낭독, 실뷰포트 렌더 | 환경 제약(기존 회차와 동일) |

---

# QA 리포트: 헤더 v4 + 히어로 모드 2 등폭 록업 (9회차)

- 작성: qa-tester | 작성일: 2026-08-16
- 검증 기준: 스펙 §13.5(2026-08-16 6차)·§11.4 6차 개정, 구현 §13 (`SiteHeader.tsx`·`HeroPanel.tsx` 2파일)
- 검증 방법: 스펙 값 대조 + **hmtx 폰트 메트릭 등폭·폭 재계산**(8회차 방법론) + **장식 원형 원 방정식 겹침 판정** + 대비 실측 + 실빌드 HTML(메인·상세 임시 파일 라운드트립·클린 복원) + tsc/lint/build

## 9회차 요약: 통과 9 | 실패 1 | 미검증 2

### 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| 1 | 접근성/스펙 위반 (장식 원형 ↔ 록업 겹침) | `src/components/home/HeroPanel.tsx:22-25` (장식 원형 `-right-12 -bottom-12 size-36`) ↔ 모드 2 록업(54-61행) | **코드 기하 판정으로 겹침 확정.** 모바일 375px 모드 2: 패널 높이 ≈160px 기준 원(중심 (319,136), r=72) 대비 — 2줄 록업 우측 끝 하단 (314,89)은 중심 거리 **46.9 < 72 → 원 내부**, 부문구 우측 끝 (315,136)도 거리 4.3로 원 내부(부문구 폭은 0.95em 상한 추정). md 768px도 2줄 끝 거리 70.4 < 72로 경계 침범. 겹침 구간 대비 실측: 흰 록업/#2e7df7 = **3.89:1(본문 미달)**, 부문구 #d9e9ff/#2e7df7 = **3.16:1(미달·미채택 조합)** — §11.4 "장식 ... **텍스트 겹침 금지**" 명시 위반. 원인: 6차 개정으로 폴백 텍스트 폭이 ~150px("코스콤지부")→290px(록업)로 확대됐는데 장식 원형 위치가 재검토되지 않음(6회차까지는 겹치지 않았음 — 신규 발생) | (a) 모드 2에서 장식 원형 미렌더(§11.4에서 장식은 "선택" — 최소 수정) 또는 (b) 오프셋 확대(예: `-right-24 -bottom-24` → 가시 영역 48×48로 축소 시 록업 끝 거리 >r) — **위치·크기 확정은 frontend-designer 판단 사항으로 분류**(본 리포트의 기하 수치 제공). 스펙 §11.4 개정 시 장식 규정 재검토 누락 성격도 병존 — 디자이너에게 함께 전달 |

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | §13.5 구조 교차 | `border-y-[6px] border-primary`(상하 6px 띠·풀폭) + `bg-bg`(흰 배경) + 두 줄 `text-primary` — 빌드 HTML 실측, 구 네이비 밴드(`header bg-primary`) 잔존 0건, 마크 radius 제거(`rounded` 0건)·40/48px·alt/aria-hidden/priority 유지, gap 0.75rem·min-h-touch·홈 링크 1개 |
| 2 | 록업 크기 8종 | 헤더 1줄 `23.7px`/md `37.9px`·2줄 `20px`/md `32px`, 히어로 1줄 `30.8px`/md `66.2px`·2줄 `26px`/md `3.5rem`(56px) — 전부 행간 1.15·Gmarket Bold·자간 -0.02em·nowrap, 스펙 §13.5.2·§11.4 표 값과 일치(HTML 실측) |
| 3 | **등폭 검증 (핵심)** | hmtx 실측 4쌍 전부 통과: 헤더 모바일 223.3 vs 222.8(차 **0.45px**)·헤더 md 357.0 vs 356.5(**0.54px**)·히어로 모바일 290.1 vs 289.6(**0.50px**)·히어로 md 623.6 vs 623.8(**0.24px**) — 기준 ±2px 이내. CSS letter-spacing 방식(마지막 글자 포함)과 스펙식(n−1회) 양쪽 계산 모두 기준 내 |
| 4 | 375px 잘림 | 헤더: 록업 223.3 + 마크 51.5 + gap 12 = **286.7px vs 가용 343px(여유 56.3px)**. 히어로: 록업 290.1px vs 패널 내부 295px — **여유 4.9px, 잘림 없음**(스펙 검산 290≤295와 일치, 타이트함은 비고 참조) |
| 5 | 문구 | 부문구 "코스콤 조합원을 위한 정보 공유" 문자 단위 일치(소스·빌드), 구 문구 "공식 소식 공간" 잔존 **0건**(src grep + 빌드 HTML). 록업 명칭 2줄 자수 원문 유지. CTA·배지·액센트 바 모드 2 부재, 아이브로우 caption 제거 |
| 6 | 대비 | 신규 조합 0건 설계 확인 — 파란 텍스트/흰 배경 = 채택 #8(11.37:1) 재실측 재사용, 히어로 록업 흰/네이비 = #11. (겹침 구간 제외 — 실패 #1) |
| 7 | 포커스 링 | 헤더 파랑 링 복원(`focus-visible:outline-primary` HTML 실측) — 헤더 내 흰 링(`outline-white`) 잔존 **0건**. 히어로 모드 1 CTA의 outline-white는 §11.4 스펙 유지분(정상) |
| 8 | h1 위계·상세 회귀 | 메인 h1 정확히 1개(헤더 록업). 상세(임시 파일 실빌드): v4 띠 헤더 정상·로고 `<p>` 강등·h1=게시물 제목 1개 — 실측 후 삭제·클린 복원(잔존 0건, content/ .gitkeep 3개) |
| 9 | 빌드·범위 | `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(/ ○ Static·상세 ● SSG). 변경 2파일 외 무변경, 신규 폰트·토큰·자산·색 0건(§13.5.4 일치) |

### 비고

1. 히어로 록업 여유 4.9px는 **Gmarket Sans 로드 성공 전제** — 폴백 Pretendard의 한글 자폭이 다르면 nowrap 록업이 295px를 초과할 수 있음(폴백 시나리오 실브라우저 확인 권장, 미검증 #1 연동).
2. 실패 #1의 md 침범은 1.6px(거리 70.4 vs r 72)로 경계적 — 모바일이 주 위험.

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 실브라우저 — 겹침 시각 확증(실패 #1), Pretendard 폴백 시 록업 폭, 히어로 md 66.2px와 hero 스케일의 시각 균형 | 브라우저 환경 없음 — 기하·메트릭 계산으로 판정 가능한 범위는 전부 수행 |
| 2 | 스크린리더 (기존 회차와 동일) | 환경 제약 |

---

# QA 리포트: 폰트 회귀 + 자수 아이덴티티 헤더 (8회차)

- 작성: qa-tester | 작성일: 2026-08-16
- 검증 기준: A — 7회차 실패 #1 회귀 / B — 스펙 §13(2026-08-16 5차), 구현 §12 (`SiteHeader.tsx` 단일 파일)
- 검증 방법: 바이너리 시그니처 재실측 + §13 값 대조 + **폰트 메트릭 기반 375px 폭 재계산**(fontTools로 woff2 hmtx advance 실측) + 실빌드 HTML(메인·상세 — 임시 파일 라운드트립·클린 복원) + 실서빙 curl + tsc/lint/build

## 8회차 요약: 통과 8 | 실패 0 | 미검증 2

### A. 7회차 실패 #1 회귀 — **해소**

| 확인 | 결과 |
|------|------|
| 시그니처 | 두 파일 모두 `wOF2` 실측 (7회차 `OTTO`에서 수정 — 개발자·리더 확인에 더한 3중 확인) |
| 수정 코드 | `scripts/build-gmarket-fonts.py:76` — `font.flavor = "woff2"`를 `save()` 전에 설정 (지적한 수정 방법 그대로) |
| 크기 | 146,040B / 140,404B (255/250KB → 143/137KB — 브로틀리 압축 효과, 스펙 §12.3 예상 하단 인접) |
| 선언 일치 | `@font-face`의 `format("woff2")` ↔ 실데이터 woff2 일치 |
| 서빙·빌드 | 2종 모두 200 (크기 일치), tsc/lint/build 무영향 통과 |

### B. 자수 아이덴티티 헤더 — 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | §13.2 ↔ 구현 교차 | 풀폭 네이비 밴드 `bg-primary`(#093389 — 신규 색 0건)·하단 보더 제거·세로 패딩 0.75/1rem 유지, KFIU 마크 `rounded-lg`(8px)·40/48px·`alt=""`+aria-hidden+priority 유지, 마크-텍스트 gap 0.75rem·홈 링크 1개·`min-h-touch` — 코드·빌드 HTML 실측 전부 일치 |
| 2 | 명칭 2줄 (문자 단위) | 1줄 "전국금융산업노동조합" 15px/600/흰(Pretendard — `font-display` 미적용, §12.2 소형 원칙), 2줄 **"코스콤(한국증권전산)지부"**(괄호 포함 자수 원문) Gmarket Bold 700·자간 -0.02em·모바일 `text-[1.25rem]/[1.3]`(20px)·md `text-h1`(32px)·`whitespace-nowrap` — 빌드 HTML h1 내부에서 문자 단위 일치 실측. 구 표기 "코스콤지부" 헤더 잔존 0건 (히어로 폴백 h2의 "코스콤지부"는 §11.4 스펙 그대로 유지 — §13은 헤더만 대체) |
| 3 | 대비 | 신규 색 조합 0건 확인 — 흰 텍스트/#093389 = 채택 #11(11.37:1 AAA) 재사용, 재실측 불요(§13.3 명시와 일치). focus-visible 흰 링 3px offset 2(#11 UI 통과) 적용, **헤더 내 `outline-primary` 잔존 0건** grep |
| 4 | **375px 경계 재계산 (폰트 메트릭 실측)** | woff2 hmtx advance 실측: 지마켓산스 Bold 한글 **0.96em**(19.2px@20px)·괄호 0.41em(8.2px) → 2줄 실폭 = 228.0 − 자간 5.2 = **222.8px**. 행 합계 = 마크 51.5 + gap 12 + 222.8 = **286.3px vs 가용 343px → 여유 56.7px, 클리핑 위험 없음(통과)**. 스펙 §13.2의 344px 계산은 전각 1.0em 가정의 보수적 상한이었음 — 모바일 크기 조정 불필요 판단 근거로 디자이너에게 전달. 참고: 320px 초소형 뷰포트도 가용 288px로 1.7px 여유(경계 내), md 32px는 430 vs 720px 여유 |
| 5 | h1 위계 회귀 | 메인: h1 정확히 1개(헤더 로고 — 2줄 명칭 포함). 상세(임시 파일 실빌드): h1 = 게시물 제목 1개, 헤더 로고 `<p>` 강등, 상세에도 네이비 밴드 정상 렌더 — 실측 후 삭제·클린 복원(잔존 0건) |
| 6 | 기존 기능 무변화 | 히어로 폴백 h2·방명록 준비 카드·탭·상세 ● SSG 유지 (변경이 SiteHeader 단일 파일임을 확인) |
| 7 | 빌드 3종 | `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(/ ○ Static) |
| 8 | 신규 자산·토큰 0건 | §13.4대로 폰트·토큰·자산 추가 없음 (globals.css diff 없음, 기존 Gmarket `font-display` 유틸 재사용) |

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 실뷰포트 시각 확인 — 375px 실렌더(계산상 안전하나 육안 확증), 헤더·히어로 네이비 중복의 시각 판정(§13.3 "형태 대비+1.5rem 여백" — 코드 조건 충족 확인까지) | 브라우저/실기기 환경 없음 |
| 2 | 스크린리더 (기존 회차와 동일) | 환경 제약 |

---

# QA 리포트: 지마켓산스 폰트 페어링 (7회차)

- 작성: qa-tester | 작성일: 2026-08-16
- 검증 기준: 스펙 §12(2026-08-16 4차), 구현 §11
- 범위: `globals.css`(@font-face 2·`--font-display`·`@source not` 2), HeroPanel/SiteHeader/DateBadge/PostList 클래스, `public/fonts/gmarket/`(자산 3), `scripts/build-gmarket-fonts.py/.sh`
- 검증 방법: 배분표 grep 전수 + 실빌드 HTML(모드 1·2 — urgent 임시 파일 라운드트립·클린 복원 실측) + 실서빙 curl + **폰트 파일 바이너리 시그니처 실측** + 빌드 CSS 유틸리티 회귀

## 7회차 요약: 통과 11 | 실패 1 | 미검증 2 | 스펙 확인 필요 1

### 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| 1 | 폰트 자산 (변환 스크립트 결함) | `scripts/build-gmarket-fonts.py:65,75` → 산출물 `public/fonts/gmarket/GmarketSansMedium.woff2`·`GmarketSansBold.woff2` | **`.woff2` 확장자이지만 실데이터는 비압축 OTF.** 바이너리 시그니처 실측: 두 파일 모두 `OTTO`(OpenType CFF) — 정상 woff2는 `wOF2`(Pretendard 서브셋으로 대조 확인), `file` 판정도 "OpenType font data". 원인: `options.flavor = "woff2"`(65행)는 **Subsetter 옵션이라 `font.save()`(75행)가 무시** — flavor는 `TTFont.flavor` 속성 또는 `subset.save_font()` 경유로만 적용됨. 영향: ① `format("woff2")` 선언 ↔ 실데이터 불일치(콘텐츠 스니핑 없는 환경에서 로드 실패 위험) ② 전송량 낭비(브로틀리 압축 시 통상 40~60% 추가 절감 — 현 255/250KB가 스펙 예상 150~250KB 상단을 벗어난 이유) ③ 스펙 §12.3 "woff2로 변환" 미이행. 개발자 자가 검증은 크기·200 응답만 확인해 미탐지 | `font.save(str(dest))` 전에 `font.flavor = "woff2"` 설정(1줄) 또는 `subset.save_font(font, str(dest), options)` 사용 → 스크립트 재실행 → **시그니처 `wOF2` 확인** 후 재커밋(산출물 커밋 방식이므로 필수). 구현 문서의 크기 수치도 갱신 |

### 스펙 확인 필요 (frontend-designer 몫 — 스펙 내부 충돌)

| # | 내용 | 요청 |
|---|------|------|
| S1 | §11.4 "CTA 18px/**700**"·§11.5 "M/D 18px/**800**, D-n 15px/**600**" ↔ §12.2 배분표 "CTA **Medium 500**, M/D **Bold 700**, D-n **Medium 500**" — 4차 개정이 §12만 추가하고 §11 잔존 수치를 미갱신 | 구현은 최신 §12.2를 따름(타당 판단 — 실패 아님). §11.4/§11.5의 웨이트 수치를 §12.2 기준으로 갱신 요청 |

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 배분표 5곳 정확 적용 (최우선) | grep 전수: `font-display` 사용처 = 정확히 4파일 7개소 — 히어로 제목 모드 1·2(`font-bold tracking-[-0.03em]`), 헤더 로고타입(`font-bold tracking-[-0.02em]`, 상위 조직명 행 미적용), CTA(`font-medium tracking-[-0.01em]`), 배지 M/D(`font-bold tracking-[-0.01em]`)·D-n(`font-medium` 자간 0), 모바일 D-n(`font-medium` 자간 0) — §12.2 배분표와 1:1, **배분표 외 사용 0건** |
| 2 | 모드 1·2 실빌드 실측 | 모드 2(기본): 헤더 로고타입·히어로 폴백 제목 클래스 렌더 확인. 모드 1(urgent+deadline 임시 파일): 히어로 제목·CTA·배지 M/D·D-n·모바일 D-n 클래스 전부 DOM 실측 → 삭제·클린 재빌드 복원(잔존 0건) |
| 3 | Pretendard 유지 | 탭 레이블(`role="tab"` 병존 grep 0)·본문·목록 제목·방명록 폼·긴급 배지·마감 스트립·히어로 아이브로우/부문구/게시일·푸터 — `font-display` 미적용, `--font-sans` 불변 |
| 4 | 웨이트 대체 경계면 | hero 토큰 800 → `font-bold`(700) 명시 오버라이드: Gmarket 미보유 웨이트(800) 요청으로 인한 faux-bold 합성 방지. 폴백 시 Pretendard가 동일 700으로 렌더 — §12.3 "로드 실패 시 동일 웨이트의 Pretendard" 문구와 정확히 부합(모호성 없음 판단) |
| 5 | @font-face ↔ §12.3 | 빌드 CSS 실측: 2종(500/700)·`font-display:swap`·상대경로 src·`--font-display` 폴백 체인(Gmarket→Pretendard Variable→시스템) 스펙 블록과 일치. unicode-range 부재 — 스펙 §12.3에도 없음(일치). Light(300) @font-face 미선언 |
| 6 | 서빙 | Medium/Bold/LICENSE.txt 실서빙 200(260,692/255,900/4,872B), **Light 404**(미서빙 규정 §12.2 준수). 단 서빙 파일의 포맷은 실패 #1 |
| 7 | 라이선스 (§12.1) | `LICENSE.txt` 동봉(OFL 전문+출처+변환 고지) 실서빙 확인, OTF 원본 3종 `design/` 보존, name 레코드 보존 로직 스크립트 확인 |
| 8 | 외부 CDN 0건 유지 | 빌드 HTML·CSS의 http(s) URL 전수 = 온누리 콘텐츠 링크뿐. 폰트 요청 전부 셀프호스팅 상대경로 |
| 9 | `@source not` 회귀 | `_workspace`·`server` 스캔 제외 후에도 실사용 유틸리티 9종(rounded-full/bg-primary/min-h-touch/line-clamp-2/overflow-x-auto/rounded-2xl/shadow-card/font-medium/font-bold) 빌드 CSS 존재, tracking 3값 존재, 전 페이지 렌더 무변화 |
| 10 | 회귀 3종 | `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(/ ○ Static·상세 ● SSG 유지), 방명록 준비 카드 유지 |
| 11 | 기존 값 정정 확인 | PostList 모바일 D-n `font-bold`→`font-medium` — 6회차 개발자 해석 #5의 임의값이 §12.2 스펙 값으로 정정됨 |

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 실브라우저 렌더 (지마켓산스 적용 품질, OTF 데이터의 실렌더 여부 — 실패 #1과 연동, Pretendard 폴백 스왑 시 레이아웃 이동) | 브라우저 환경 없음. 실패 #1 수정 후 재확인 권장 |
| 2 | 스크린리더 (기존 회차와 동일) | 환경 제약 |

---

# QA 리포트: 디자인 v2 모던 전면 개편 + Pretendard (6회차)

- 작성: qa-tester | 작성일: 2026-08-16
- **검증 기준 시점**: 스펙 §1(v2 토큰 통합)·§2(채택 21+v2 5조합)·§11(2026-08-16 3차 신설)·§3.2(히어로 대체 주석)·구현 §10 — frontend-designer가 해석 지점 7건을 병렬 판정 중이므로 판정 결과에 따라 본 회차 해당 항목 재대조 필요
- 범위: 신규 HeroPanel/DeadlineStrip/DateBadge/sync-pretendard.mjs, 수정 11(globals.css·layout·page·PostList·BoardTabs·OnnuriGuideCard·GuestbookPanel·SiteFooter·content.ts·date.ts·package.json), 제거 UrgentBanner
- 검증 방법: 스펙 값 대조 + 대비 스크립트 재실측 + 금지 사항 grep 전수 + **히어로 양 모드 실빌드**(urgent+deadline 임시 파일 라운드트립 — 삭제·클린 복원 실측) + **D-n 경계값 실행 테스트**(고정 now 주입) + 폰트 실서빙 curl + tsc/lint/build

## 6회차 요약: 통과 13 | 실패 1 | 미검증 4

### 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| 1 | 디자인 값 (경미) | `src/components/layout/SiteFooter.tsx:19` (`rounded-badge` = 12px) ↔ 스펙 §10.3 "흰색 칩 radius `8px`" · §11.6 "로고 흰 칩은 **그대로** — 칩 보더는 제거" | v2 변경 규정은 보더 제거뿐인데 칩 radius가 8px→12px로 무규정 변경됨. 구현 문서 §10에도 radius 변경 언급 없음(조용한 이탈) | `rounded-badge`→`rounded-lg`(8px) 복원. 또는 v2 radius 체계 통일 의도라면 frontend-designer 판정(마침 병렬 판정 중 — 판정 목록에 추가 요청) 후 스펙 §10.3 개정으로 정합화 |

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 토큰 v2 (최우선) | 기존 15색 **값 변경 0건** 재확인(grep 15건 전부 5회차 값 유지) + v2 추가분(색 2·`--font-sans`·hero/hero-lg 자간 내장·tracking·radius 12/24/32·shadow 2) 스펙 §1과 값 일치. 빌드 CSS에 v2 토큰 전부 존재. display/h1/h2 자간은 토큰 모디파이어로 내장(구현 방식 차이, 값 동일 — 개발자 해석 #1) |
| 2 | 대비 재실측 | v2 채택 #22~#26(9.23/9.23/14.13/3.89/3.89) + 제한 3조합(#9c0d14·#d0101b·#4b5563 on soft = 6.87/4.52/6.14 미달 확인) 스크립트 재실행 — 스펙 §2 수치 완전 일치. 기존 조합은 값 무변경으로 1~5회차 실측 유효 |
| 3 | 히어로 모드 2 (폴백, 현재 기본) | 실빌드: 지정 문구 3종("전국금융산업노동조합"/"코스콤지부"/"코스콤 조합원을 위한 공식 소식 공간") **문자 단위 일치**, CTA·배지·스트립 부재, `aria-label="주요 소식"`·제목 h2·hero 스케일/색 스펙 일치 |
| 4 | 히어로 모드 1 (urgent 바인딩) | urgent 임시 파일 실빌드: 배지+게시일(primary-soft #23) → hero h2 제목(`line-clamp-3`) → 흰 액센트 바 4rem×4px(aria-hidden) → "자세히 보기" 필 CTA(`min-h-touch`·상세 href·hover `bg-primary-soft`·흰 포커스 링) — §11.4 구성 순서·값 전부 실측. 폴백 문구 부재 확인. 장식 원형 primary-bright aria-hidden·pointer-events-none·코너 밖 배치 |
| 5 | 마감 스트립 | 실빌드: D-4 항목 red 칩(`bg-urgent-strong`+흰 텍스트+**"D-4" 텍스트 병행** — 색 단독 아님)·D-45 기본형(#093389 on soft), M/D 표기(8/20·9/30 — 선행 0 없음), `nav aria-label="마감 예정 일정"`, `overflow-x-auto`(ul 내부 스크롤), 항목 `min-h-touch`·상세 링크, 구분선 aria-hidden. 0건 시 미렌더(모드 2 빌드에서 부재 실측) |
| 6 | 날짜 배지 | 56×56(`size-14`)·radius 12px·"M/D" 18px/800·"D-n" 15px/600·3변형 클래스, md+ 전용(`hidden md:flex`)·모바일 제목행 D-n 텍스트(default `text-primary` 11.37/임박 `text-urgent-strong` 8.46 — 흰 카드 위). **#2e7df7 밝은 블루 배지 미도입** 확인 |
| 7 | D-n 로직 (경계값 실행) | `daysUntilKst` 고정 now 주입 테스트: 오늘 마감 D-0 — KST 밤·**KST 자정 직후(UTC로는 전날)** 모두 0(타임존 오차 없음), 내일 1, 지난 마감 -1(로더 `days >= 0` 필터로 스트립·배지 미표시), D-7/D-8 임박 경계, 잘못된 입력 null. `getUpcomingDeadlinePosts` 마감 오름차순 정렬 코드 확인 |
| 8 | 금지 사항 감사 (grep 전수) | 레퍼런스 홍보물 문구·일정: 소스·content·빌드 HTML 잔존 **0건**(소스 내 "투쟁" 1건은 복사 금지 규정을 안내하는 주석 — 렌더 출력 0). `text-stroke` 0건, 원형 아이콘 사이드바 미도입, `primary-bright`(#2e7df7) 사용처 = 히어로 장식 원형 1곳뿐(텍스트 조합 0), soft 배경 위 빨강 텍스트 조합 0건, **UrgentBanner 파일 삭제·참조 0건**·`aria-label="긴급 공지"` DOM 부재 |
| 9 | 폰트 (셀프호스팅) | 빌드 HTML의 http(s) URL 전수 = onnuri 외부 링크뿐(CDN 0건), 빌드 CSS `url()` 외부 0건, 폰트 CSS src 전부 상대경로(http 2건은 라이선스 주석). **실서빙**: CSS 200(55.8KB)·woff2 서브셋 200(34.6KB), `font-display: swap` 92건, `--font-sans` 폴백 스택 정의·빌드 CSS 반영, head에 stylesheet 링크(precedence). `sync-pretendard.mjs` postinstall 코드 확인(node_modules→public 복사) |
| 10 | 카드화·필형 (§11.6) | PostList: 흰 카드 radius 16px(`rounded-2xl`)+`shadow-card`(hover 변형)+패딩 1rem/1.25rem+gap 0.75rem, divide 제거, urgent 좌보더·내향 포커스 유지. 탭: 컨테이너·탭 `rounded-full`만 변경(크기·상태·색·로빙 탭인덱스·키보드 코드 불변 diff 확인). 온누리: `rounded-card`+`shadow-card`, accent 불변. 방명록: 필드 12px·버튼 full·준비 카드 24px(로직 무변경 — 클래스만 diff 확인). 푸터: 딥블루 밴드(`bg-primary`·상단 보더 제거·지부명 흰/700·저작권 primary-soft #23) |
| 11 | 접근성 회귀 | h 레벨: h1×1(헤더)→h2×2(히어로·방명록 카드) 건너뜀 없음(폴백 h2 "코스콤지부"의 h1 중복은 §11.4 명시 허용). 탭 ARIA 실측 유지(true×1/false×2). CTA 접근성 이름 "자세히 보기"(화살표 아이콘 aria-hidden)·스트립 항목 이름에 D-n+날짜+제목. 터치: CTA·스트립 항목 `min-h-touch` |
| 12 | 간격 (§11.4·§9.1) | 헤더↓히어로 1.5rem(`mt-6`), 히어로↓스트립 0.75rem(`mt-3`), ↓온누리 카드 2rem(`mt-8`), 카드↓탭 2rem(`mt-8`) — 스펙 값 일치 |
| 13 | 빌드·복원 | `npx tsc --noEmit` 0·`npm run lint` 0(no-css-tags 라인 예외는 사유 주석 확인)·`npm run build` 통과(/ ○ Static·상세 ● SSG 유지). 임시 파일 2건 삭제·클린 재빌드·모드 2 복귀 실측(content/ .gitkeep만) |

### 비고

- `src/components/notice/` 빈 디렉토리 잔존(UrgentBanner 삭제 후) — 기능 영향 없음, 정리 권고.
- 개발자 해석 7건(자간 구현 방식·D-n 정적 한계·구분선 색·배지 D-n 채택·모바일 D-n 색·지난 마감 미표시·모드 2 액센트 바 미포함)은 코드가 문서 기재와 일치함을 확인 — frontend-designer 판정 대기 항목으로 유지. 특히 **해석 #2(D-n은 빌드 시점 고정 — 일일 재빌드 없으면 날짜 경과 시 D-n·스트립이 갱신되지 않음)는 운영 정책 결정 필요(리더)**.

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 실브라우저 폰트 렌더 품질 (Pretendard 적용 시각 확인, 폴백 전환) | 브라우저 환경 없음 — 서빙·선언·스택은 실측 완료 |
| 2 | 375px 히어로 타이포(40px) 줄바꿈·말줄임 실측, 마감 스트립 가로 스크롤 실조작 | 실뷰포트 환경 없음 |
| 3 | 방명록 실통신 회귀 | 이번 변경이 radius 클래스뿐(로직 diff 무변경 확인)이라 4회차 실통신 결과 유효 — 재실행은 생략 (통신 계약 재검증 아님을 명시) |
| 4 | 스크린리더 실낭독 (기존 회차와 동일) | 환경 제약 |

---

# QA 리포트: 실제 CI(금융노조+코스콤) 반영 (5회차)

- 작성: qa-tester | 작성일: 2026-08-16
- **검증 기준 시점**: `_workspace/02_designer_spec.md` §1(색상 15종)·§2(채택 21조합)·§9.2(accent 개정)·§10(2026-08-16 2차 신설) — frontend-designer가 병렬로 스펙 확인 중이므로 이후 개정 시 본 회차 대조는 재실행 필요
- 범위: `globals.css` 토큰 교체, `OnnuriGuideCard.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx`, `public/brand/` 자산 2종 + 토큰 교체 파급 전 사용처
- 검증 방법: 토큰 값 대조 + 대비 스크립트 전 조합 재실측 + grep 전수 감사 + **자산 픽셀 재생성 대조**(Pillow — 스펙 크롭 좌표로 원본에서 재생성 후 배포 자산과 픽셀 비교) + 실빌드 HTML/CSS 실측

## 5회차 요약: 통과 10 | 실패 0 | 미검증 3

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 토큰 값 교차 | `globals.css` ↔ 스펙 §1 개정: 15색 전부 값 일치 (교체 4: primary·primary-strong=#093389 동일값, urgent=#d0101b, urgent-strong=#9c0d14 / 신설 3: accent 계열 / 유지 8). 토큰명 전부 유지. 빌드 CSS 실측: 신 팔레트 6값 존재(#093389 ×2 = primary+strong), **구 팔레트 4값(#1d4ed8/#1e40af/#b91c1c/#991b1b) 잔존 0건** (src·빌드 CSS 양쪽) |
| 2 | 대비 재실측 (최우선) | 채택 21조합 전부 + 제한 조합(#ec6d1e/#fdf0e7) `check-contrast.mjs` 재실행 — **스펙 §2 수치와 22조합 전부 일치**. 텍스트 조합 전부 AAA(최저 7.23), UI 전용 조합 3:1 이상(#d0101b 5.57/5.09, #ec6d1e/#ffffff 3.10 — 스펙 표기대로 "여유 없음", #ec6d1e/#fdf0e7 2.78은 UI 불가 → 장식 전용 분류와 일치) |
| 3 | 토큰 교체 파급 (클래스 무변경 사용처) | 사용처별 신 값 조합을 §2 채택표와 대조: 탭 선택 `#fff/#093389`(#11)·hover `#093389/#eff6ff`(#10)·비선택(#7, 무변경), 긴급 배너 제목(#3)·게시일/아이콘 `#9c0d14/#fef2f2`(#13)·배지 `#fff/#9c0d14`(#14), urgent 목록 보더 `#d0101b`(#15), 본문 링크·상세 뒤로가기·방명록 버튼 `#093389`(#8·#11), 방명록 에러 텍스트 `#9c0d14/#fff`(#12), 포커스 링 primary(#8·#9)·배너 내 urgent-strong(#13) — 전부 채택 조합에 존재 |
| 4 | 원색 용법 감사 (grep 전수) | `#ec6d1e`(accent 원색): src 전체에서 accent 계열 사용 파일은 `OnnuriGuideCard.tsx` 1개뿐, 원색 클래스는 `border-accent`(좌측 장식 보더) 1곳. `text-accent`·`bg-accent` 단독 사용 0건 (텍스트·아이콘은 전부 `accent-strong`). `#5a5657` 토큰 미도입(스펙대로 로고 이미지 전용). tsx 내 hex는 주석뿐(코드 값 0건) |
| 5 | 가이드 카드 §9.2 개정 반영 | `bg-accent-tint`·`border-accent`(장식 전용 — 의미는 아이콘+문구+배경이 전달, 스펙 개정 문구와 코드 주석 일치)·제목/아이콘/hover 아웃라인 `accent-strong`·**포커스 링만 primary 유지**(키보드 일관성 — §10.4 지정) — 빌드 HTML 실측 |
| 6 | 로고 자산 (픽셀 검증) | `kfiu-mark.png` 247×192 PNG·`koscom-logo.png` 387×96 PNG — 표시 크기(48/24px)의 4배 레티나 스펙 일치. **크롭 좌표 재생성 대조: §10.3 좌표 (1030,820,2560,1200)→1530×380 크롭·LANCZOS 리샘플을 원본에서 재실행 → 배포 자산과 평균 채널 오차 0.0(픽셀 동일)**, kfiu도 무크롭 리샘플과 오차 0.0. koscom 4변 2px 경계 순백(255) 확인. 자산 내 색 최빈값 실측: 오렌지 `#ec6d1e`·파랑 `#093389` — 토큰 값과 정확 일치 |
| 7 | 헤더 마크 렌더 | 빌드 HTML: `<img alt="" aria-hidden="true">` + `priority` 반영(preload 링크 존재·`loading="lazy"` 없음). 헤더 링크 접근성 이름 = 지부명 텍스트만("전국금융산업노동조합 코스콤지부"). 헤더 배경 `bg-bg`(#ffffff) — 흰 배경 자산 배치 규정 충족. 높이 `h-10 md:h-12`(40/48px), gap 0.75rem — §3.1/§10.3 일치 |
| 8 | 푸터 칩 렌더 | 흰 칩 `bg-bg`(토큰, 하드코딩 아님)·radius 8px·패딩 8×12px(`px-3 py-2`)·`border-soft` 장식 보더, 로고 2종 각 24px(`h-6`)·gap 1rem·링크 아님·유의미 alt("전국금융산업노동조합"/"코스콤") 각 1건 — 빌드 HTML 실측, §10.3 일치. 코스콤 로고는 푸터 한정(헤더 미사용 grep 확인) |
| 9 | 회귀 | 탭 ARIA 상태·방명록 준비 중 카드·상세 라우트 ● SSG 유지, 온누리 카드 포커스 링 primary 유지. `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(○ Static 유지) |
| 10 | 375px 헤더 (코드 기준 산정) | 마크 폭 ≈52px(40×247/192) + gap 12px + 최장 텍스트행 "전국금융산업노동조합"(15px) ≈150px → 합계 ≈214px < 가용 343px(375−패딩 32) — 줄바꿈 없음 판단. 레티나: 표시 최대 48/24px 대비 자산 192/96px(4배)·srcSet 2x 제공 — 선명도 요건 충족 판단 (실기기 육안은 미검증 #1) |

### 비고

- `priority`는 HTML에서 `fetchpriority` 속성 대신 `<link rel="preload" as="image">` + eager 로딩으로 반영됨 (Next.js 렌더 방식 — 의도 충족, 이슈 아님).
- 스펙 §2 #19(#ec6d1e/#ffffff 3.10:1)는 "여유 없음" 명기 — CI 원색이므로 수용된 트레이드오프이며 장식 보더 전용으로 제한된 상태. 공식 CI 원색 특성상 조정 불가 항목.

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 실기기/실뷰포트 육안 확인 (375px 헤더 줄바꿈, 레티나 로고 선명도, JPG 유래 자산의 흰 배경 경계 자연스러움) | 브라우저/실기기 환경 없음 — 코드·자산 크기 기준 산정까지 수행 |
| 2 | 스크린리더 실낭독 (헤더 장식 마크 무시·푸터 로고 alt 낭독) | 환경 제약 (기존 회차와 동일) |
| 3 | 브라우저 실조작 (신 팔레트에서의 hover/focus 시각 상태) | 환경 제약 — 대비 수치 실측으로 대체 |

---

# QA 리포트: 방명록 백엔드 실통신 통합 (4회차)

- 작성: qa-tester | 작성일: 2026-08-16
- 범위: `server/`(Fastify+PostgreSQL) ↔ 프론트 연동 실통신 검증 (기준: 06 명세 §2/§4/§9, 03 구현 §8, 07 로컬 절차 §1.3)
- 환경: 로컬 PostgreSQL 16(brew) + 백엔드 `npm run dev`(127.0.0.1:3001) 직접 기동 + 프론트 `next start`(:3000, `NEXT_PUBLIC_API_BASE_URL` 설정 프로덕션 빌드)
- 핵심 방법: **프로덕션 파서 직접 실행** — `src/lib/api/guestbook.ts`를 Node(타입 스트리핑)로 그대로 import하여 실서버에 호출. 명세 ↔ 실응답(curl 원시) ↔ 프론트 파서 3자를 문서 대조가 아닌 실행으로 대조
- 정리: 테스트 등록 데이터 `TRUNCATE guestbook_entries`(0행 확인), 기동 프로세스 2종(3000/3001) 종료, 임시 스크립트·로그 삭제, 프론트는 미설정 클린 빌드로 복원

## 4회차 요약: 통과 14 | 실패 0 | 미검증 4

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 응답 shape 3자 대조 — 목록 (최우선) | `GET /guestbook` 실응답: 최상위 JSON 배열(봉투 없음)·원소 4필드(`id` UUID string/`author`/`body`/`createdAt` ISO 8601 UTC 밀리초+Z)·추가 필드 없음·`content-type: application/json; charset=utf-8` — 명세 §2.1과 일치, **프로덕션 `listGuestbookEntries` 실행이 `ok: true`로 파싱** (parseGuestbookEntry 통과) |
| 2 | 응답 shape 3자 대조 — 등록 | `POST /guestbook` 201 + 단일 객체 4필드 — `createGuestbookEntry` 실행 `ok: true`. author 앞뒤 공백 패딩 입력 → **응답이 trim된 값** 반환 실측 (명세 §2.2 "trim 적용된 값") |
| 3 | 에러 분기 — 429 | 성공 등록 30초 내 재등록: 원시 429 + `retry-after: 30` + body `{error:{code:"RATE_LIMITED",message:한국어}}` — 프론트 실행 결과 `reason: "rate-limited"` + "잠시 후 다시 시도" 안내. UI는 `result.message`를 그대로 표시(`GuestbookPanel.tsx:118`) |
| 4 | 에러 분기 — 400 | 31초 대기 후(rate limit 선행 검사 유의사항 §9 반영) author 21자: 원시 400 `VALIDATION_ERROR` — 프론트 `reason: "validation"` + **서버 한국어 message 원문 그대로**("닉네임은 20자 이하여야 합니다."). 목록 경로도 `limit=0` → validation 분기 확인 |
| 5 | E2E 데이터 흐름 (API 레벨) | 등록 → 목록 재조회: 신규 글이 배열 첫 원소(최신순), **서버 응답 entry와 목록 첫 원소 deep equal true** — 낙관적 prepend의 소스가 서버 응답값이므로 trim·표시값 불일치 구조적으로 없음. 재조회로 서버 영속(새로고침 동등) 확인 |
| 6 | 계약 A (페이지네이션) | `listGuestbookEntries({limit:1})` → 1건 배열, shape 불변 — 승인된 계약 확장 실동작 |
| 7 | CORS | Origin `http://localhost:3000` preflight: `access-control-allow-origin` 반환 + methods `GET, POST` + headers `Content-Type, Accept` + credentials 미설정 + `X-Total-Count` expose. 비허용 Origin은 ACAO 미반환 — 명세 §4.4 일치 |
| 8 | 설정 상태 렌더 | `NEXT_PUBLIC_API_BASE_URL` 설정 빌드 SSR HTML: `<form>` + 가시 `<label>` 2종(닉네임/내용) + maxLength 20/500(백엔드 한도와 동일 수치) + `role="status"` 2건(피드백·로딩) + 글자수 안내, 준비 중 카드 미렌더. `next start` 실서빙 200 확인 |
| 9 | 미설정 회귀 | 환경변수 없는 클린 빌드: 준비 중 카드 복귀·`<form>` 0건·번들/HTML에 API URL 잔존 0건 — §7.1 무회귀 |
| 10 | admin 비노출 | 프론트 `src/` grep: admin/ADMIN/Bearer/Authorization 0건. 설정 빌드 클라이언트 번들(`.next/static`) grep: `ADMIN_API_TOKEN`·`Authorization`·`admin/guestbook` 0건. GuestbookPanel에 삭제 UI 없음 — 명세 §2.3 "프론트 계약 밖" 준수 |
| 11 | 개인정보 실측 | DB: 원문 IP 컬럼 없음(스키마 `\d` 확인), `ip_hash`는 64자 hex(HMAC)만, IP 패턴 검색 0행. 서버 로그(실통신 37행): 닉네임·본문 문자열 0건, `remoteAddress` 0건(기동 바인드 주소 1건뿐), 필드는 method/url/statusCode/responseTime만 — 명세 §4.1 일치 |
| 12 | 정적 검사 | 프론트 `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(○ Static/● SSG 유지), `server/` 자체 `npm run typecheck`(strict) 통과 |
| 13 | 폼 스펙 §7.2 (코드 검증) | 가시 레이블·input `h-12`(48px)/`border-strong`/radius 8px/`px-3`·textarea `min-h-30`(120px)·등록 버튼 primary-strong/흰 텍스트/700/44px·hover 배경 유지+outline(스펙의 배경 변화 금지 준수)·전송 중 disabled+"등록 중…"·`role="status"` 상시 렌더·목록 0건 시 "아직 남겨진 글이 없습니다"(EmptyState 재사용)·실명 유도 문구 없음("닉네임") |
| 14 | 타입 경계 (계약 C) | `GuestbookErrorReason` 유니온 ↔ 명세 §2.4 code 매핑(`RATE_LIMITED`→rate-limited, `VALIDATION_ERROR`→validation, 그 외→network), `parseErrorBody` 필드별 typeof 검증, body 비명세 형식 시 HTTP 상태 기반 2차 방어선 — 타입 우회 0건 |

### 비고 (실패 아님)

1. 서버의 429 message와 프론트 폴백 문구가 동일 문자열("요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.") — 원시 curl로 서버 body 원문임을 확인해 구분 완료. 서버 문구 변경 시에도 프론트는 서버 message 우선이므로 동작 문제 없음.
2. 방명록 §7.2의 스펙 미정의 구간(로딩/조회 실패 상태, 등록 실패 텍스트 `text-urgent-strong` — §8 "적색은 긴급 배너 유일" 원칙과 긴장)은 개발자가 03 문서 §8에 명시한 대로 **frontend-designer 확인 대기** 항목.
3. 백엔드 기동 시 Fastify deprecation 경고(FSTDEP023, `disableRequestLogging`) — fastify@6 대비 정리 권고 (backend-developer 몫, 동작 영향 없음).

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 브라우저 실조작 E2E (폼 입력→제출→목록 UI 갱신, `role="status"` SR 낭독) | 브라우저 자동화 환경 없음 — 프로덕션 fetch·파서 코드를 Node에서 직접 실행하는 방식으로 통신 계약은 실검증했으나, React 상태 전이·DOM 갱신은 코드 리뷰까지만 |
| 2 | 장주기 rate limit (1시간 10회/24시간 30회)·중복 내용 24h 제한·ip_hash 90일 NULL 배치 | 시간 제약 (백엔드 자체 실측 27케이스 중 T13·T25에 부분 포함 — 06 §9) |
| 3 | 프로덕션 배포 환경 (nginx/TLS/api.koscomlabor.cloud CORS·X-Forwarded-For 경유 rate limit) | 미배포 — 07 §2.7 배포 검증 체크리스트로 배포 시점에 수행 필요 |
| 4 | 스크린리더·실뷰포트 (기존 1–3회차와 동일) | 환경 제약 |

---

# QA 리포트: 디지털온누리 가이드 링크 카드 (3회차 — 증분 검증)

- 작성: qa-tester | 작성일: 2026-08-16
- 범위: 신규 외부 링크 카드 + 인접 경계면 (변경 파일: `src/components/home/OnnuriGuideCard.tsx` 신규, `src/lib/routes.ts`, `src/components/ui/icons.tsx`, `src/app/page.tsx`)
- 기준: 스펙 §9(신규)·§8 갱신·§2 채택표 #19/#20, 구현 요약 §7
- 검증 방법: 스펙 ↔ 코드 교차 비교 + 실빌드 HTML 실측(배너 존재/부재 양 시나리오 — urgent 임시 파일 라운드트립 후 삭제·복원 실측) + 대비 스크립트 재실측 + tsc/lint/build

## 3회차 요약: 통과 13 | 실패 0 | 미검증 4 (1·2회차와 동일 사유)

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 배치 (배너 부재 — 현재 기본) | 실빌드 HTML 실측: 카드가 `<main>` 내 컨테이너의 첫 자식 — 배너 미렌더 시 헤더 아래 첫 요소(스펙 §9.1). 카드 문자열 위치 < tablist 위치 확인 |
| 2 | 배치 (배너 존재) | urgent+verified 임시 파일로 실빌드: **배너 → 카드 → 탭리스트** 순서 실측(오프셋 비교). 검증 후 파일 삭제·클린 재빌드·빈 상태 복원 실측(content/에 .gitkeep만, "QA 테스트" 잔존 0건) |
| 3 | 간격 | `page.tsx:26` 컨테이너 `mt-8`(2rem — main 상단 여백을 카드가 이어받음) + `page.tsx:29` 카드-탭리스트 `mt-8`(2rem) — 스펙 §9.1 값 일치 |
| 4 | 컨테이너 스타일 | `OnnuriGuideCard.tsx:20` — `bg-primary-tint`·`rounded-xl`(12px)·`border-l-4 border-primary`·`p-4`(1rem)/`md:px-6`(1.5rem)·`min-h-touch`(44px) — 스펙 §9.2 전 항목 일치 |
| 5 | 텍스트 스타일 | 제목 `text-body font-bold text-primary-strong`(18px/700/#1e40af), 설명 `mt-1`(0.25rem) `text-caption font-normal text-ink` — **tint 위 ink-muted 금지 준수**(§2 탈락표), 말줄임 클래스 없음(HTML 실측 — 새 창 안내 문구 보존) |
| 6 | #1d4ed8 용법 | 좌측 보더(`border-primary`) 전용 — 카드 내 텍스트·아이콘은 전부 `primary-strong`. `text-primary` 사용 0건 유지 |
| 7 | hover/focus-visible | `group-hover:underline`(제목) + `hover:outline-2 hover:outline-primary-strong`(배경 변화 없음), `focus-visible:outline-3 outline-primary offset-2` — 스펙 §9.2 상태표 그대로 |
| 8 | 외부 링크 안전성 | 실빌드 HTML 실측: `<a href="https://onnuri.koscomlabor.cloud/" target="_blank" rel="noopener noreferrer">` — 세 어트리뷰트 모두 렌더 확인 |
| 9 | 라우팅 경계 분리 | `routes.ts:21-24` — `EXTERNAL_LINKS`가 내부 `ROUTES`와 별도 객체(절대 URL 전용, 주석으로 blank/noopener 규약 명시). 내부 라우트 교차 검증 대상에 외부 URL이 섞이지 않는 구조. URL 스펙 문자열과 정확 일치 |
| 10 | 신규 색 조합 실측 | `check-contrast.mjs` 재실측: `#1a1a1a/#eff6ff` 15.99(AAA — 스펙 #19), `#1e40af/#eff6ff` 8.01(AAA — #8), `#1d4ed8/#eff6ff` 6.16(UI 3:1 통과 — #20, 보더 전용), hover outline `#1e40af/#ffffff` 8.72(AAA — #6) — 스펙 수치와 전부 일치 |
| 11 | 접근성 | 카드 전체 단일 `<a>` — 접근성 이름에 제목+"외부 페이지가 새 창에서 열립니다" 자동 포함(내부 텍스트, 코드 확인). 외부 이동 3중 표시(↗ 아이콘 + 문구 + 이름). `BookIcon`(24px)·`ExternalLinkIcon`(20px) 모두 `aria-hidden="true"`+`currentColor`. 터치 `min-h-touch` |
| 12 | 위계 보존 (§8 갱신) | 카드에 적색·urgent 계열·"긴급" 배지·전폭 배경 미사용 — 컨테이너 폭 내 주조색 계열만 (긴급 배너 시각 우위 유지) |
| 13 | 회귀 (인접 경계면) | `page.tsx` 수정이 유일한 접점 — 탭 ARIA 상태(aria-selected true×1/false×2) 실측 유지, 상세 라우트 ● SSG 유지, `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(/ ○ Static 유지) |

### 비고

- 아이콘-텍스트 간격 `gap-3`(0.75rem)·hover outline offset 미지정은 스펙이 정의하지 않은 구간 — Tailwind 표준 스케일 사용으로 임의 hex/px 아님, 이슈 아님.
- 신규 파일 4종에 hex/px 하드코딩·타입 우회(`as any` 등) 0건 (전문 코드 리뷰).

### 미검증 (1·2회차와 동일 — 환경 제약)

브라우저 실조작(hover/focus 시각 상태 실측 포함) / 스크린리더 실낭독 / 375px 실뷰포트(카드 설명 2줄 흘림 실측) / 방명록 §7.2(백엔드 미구축).

---

# QA 리포트: 메인페이지 탭 게시판 (2회차 — 회귀 검증)

- 작성: qa-tester | 작성일: 2026-08-16
- 범위: 1회차 실패 2건 해소 확인 + 수정·신규 파일의 인접 경계면 (스킬 §5 회귀 원칙)
- 수정·신규 파일: `src/app/notices/[slug]/page.tsx`, `src/app/news/[slug]/page.tsx`, `src/components/board/PostArticle.tsx`, `src/components/layout/SiteHeader.tsx`, `src/lib/content.ts`, 스펙 §4.2 개정본
- 검증 방법: 코드 교차 비교 + 실빌드 라운드트립(플레이스홀더 임시 파일 4건, 검증 후 전량 삭제·빈 상태 복원 실측) + tsc/lint/build 재실행

## 2회차 요약: 통과 12 | 실패 0 | 미검증 4 (1회차와 동일 사유) | 권고 2

### 이전 실패 항목 해소 확인

| # | 1회차 실패 | 판정 | 확인 내용 |
|---|-----------|------|----------|
| 1 | 미구현 상세 라우트 링크 | **해소** | `src/app/notices/[slug]/page.tsx`, `src/app/news/[slug]/page.tsx` 신규 확인. `PostList.tsx:33`·`UrgentBanner.tsx:24`의 href(`ROUTES.notice/news`) ↔ 실존 라우트 매칭. `dynamicParams = false`(양쪽 17행) + `generateStaticParams`가 `getVerifiedNotices/News`(verified만) 기반 — **실빌드 실측**: verified 파일만 `.next/server/app/notices|news/*.html` 생성, `verified: false` slug는 미생성(→404). `getVerifiedPost`가 상세 조회 시 verified 게이트 재적용 + slug 경로 조작 방어(`content.ts:192`) — 이중 방어 확인 |
| 2 | news source 필수 미강제 | **해소** | `content.ts:110-113` — `category === "news" && source === null`이면 throw. **실빌드 재실증**: source 누락 verified news 파일로 빌드 실패 + 파일 경로 포함 에러 메시지 확인. title/date와 동일한 "조용한 누락 대신 빌드 실패" 정책으로 일관화 |

### 스펙 §4.2 개정 ↔ 구현 교차 확인 (리더 지정 중점)

**통과.** 개정 스펙: md 미만 좌우 패딩 `0.25rem`·폰트 `1rem`/1.5, md 이상 `1rem`·18px, 분기점 **md**. `BoardTabs.tsx:112` 실코드: 기본(md 미만) `px-1 text-[1rem]/[1.5]` + `md:px-4 md:text-body md:min-w-32 md:flex-none` — 분기점 md로 정확히 일치, sm 분기 없음(스펙 의도와 동일). 탭리스트 `md:inline-flex md:w-auto`(95행)도 §3.5 균등분할→좌측 정렬 전환과 일치. 1회차 S1 종결.

### 신규 경계면 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 타입 경계 | `PostDetail = PostSummary + body`(`content.ts:35-37`) ↔ `PostArticle` props(`PostArticle.tsx:44`) ↔ 상세 페이지 `getVerifiedPost` 반환 타입 일치. 목록 경로는 `listVerifiedPosts`에서 body를 명시 제외(150-162행) — 클라이언트 직렬화 페이로드에 본문 미유입 |
| 2 | XSS/raw HTML | `rehype-raw`·`dangerouslySetInnerHTML` grep 0건. **실빌드 실측**: 본문에 `<script>alert(...)</script>` 포함 테스트 파일 → 렌더 DOM에 실행 가능한 script 요소 없음(RSC 페이로드 내 이스케이프 문자열로만 존재). react-markdown 기본 설정(raw HTML 미실행) 확인 |
| 3 | h1 유일성 | 상세 페이지 `SiteHeader asHeading={false}` → 로고 `<p>` 렌더 실측, `<h1>` 정확히 1개(게시물 제목) 실측. 본문 마크다운 h1/h2→h2, h3→h3 매핑으로 위계 역전 없음 |
| 4 | 디자인 토큰 | 상세 신규 파일 3종 hex/px 하드코딩 0건. `max-w-prose`(42rem)·`max-w-page`(48rem) 토큰, 본문 링크·뒤로가기 `text-primary-strong`(#1e40af — #1d4ed8 텍스트 금지 준수), 뒤로가기 `min-h-touch`, focus-visible 스타일 존재 |
| 5 | 라우팅 (신규) | 뒤로가기 `backHref = ROUTES.homeTab("notices"|"news")` → `/`·`/?tab=news` — 실존 경로·탭 파서와 일치(빌드 HTML에서 href 실측) |
| 6 | 타입 우회 | 전체 재grep — `as any|as unknown|@ts-ignore|@ts-expect-error` 0건 유지 |
| 7 | 빌드 3종 | `npx tsc --noEmit` 오류 0, `npm run lint` 오류 0, `npm run build` 통과(`/` ○ Static 유지, 상세 ● SSG). 임시 파일 4건 전량 삭제 후 클린 재빌드·빈 상태 복원 실측(content/에 .gitkeep만 잔존) |

### 권고 (실패 아님 — web-developer 참고)

1. `PostArticle.tsx:13-41` — 마크다운 h4~h6 미매핑: 콘텐츠가 h4 이하를 쓰면 브라우저 기본 스타일(h5/h6은 15px 미만 가능)로 렌더되어 스펙 "15px 미만 금지"를 우회할 여지. h4 이하 매핑 추가 또는 콘텐츠 규약에 "제목은 h3까지" 명시 권장.
2. `content.ts:192` slug 정규식이 거부하는 파일명(공백 등)은 목록에는 노출되나 상세가 404 — 파일명이 규약 밖이면 `parsePostFile`에서 throw하여 빌드에서 잡는 것이 일관적. (콘텐츠 파일명이 통제되는 현 운영에서는 실위험 낮음)

### 미검증 (1회차와 동일 — 환경 제약)

브라우저 실조작 키보드 내비게이션 / 스크린리더 실낭독 / 375px 실뷰포트 실측 / 방명록 §7.2(백엔드 미구축). 상세 페이지도 동일 제약 적용.

---

# QA 리포트: 메인페이지 탭 게시판 (1회차)

- 작성: qa-tester | 작성일: 2026-08-16
- 검증 대상: `src/` 전체, `content/`, `src/app/globals.css`
- 근거: `_workspace/00_input/requirements.md`, `_workspace/02_designer_spec.md`, `_workspace/03_developer_impl.md`, `union-qa-testing` 스킬, `union-webapp-dev` 스킬 §3
- 이전 리포트: 없음 (1회차 — 회귀 검증 대상 없음)
- 검증 방법: 코드 교차 비교 + 실빌드 HTML 실측(임시 플레이스홀더 콘텐츠 라운드트립, 검증 후 전부 삭제·빈 상태 복원 확인) + 대비 스크립트 실행 + tsc/lint/build 실행

## 요약: 통과 20 | 실패 2 | 미검증 4 | 스펙 확인 필요 1

## 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| 1 | 라우팅 (경계면: 링크 생산자 ↔ page 파일) | `src/components/board/PostList.tsx:33` (`hrefFor(post.slug)`), `src/components/notice/UrgentBanner.tsx:24` (`ROUTES.notice(post.slug)`) ↔ `src/app/` (상세 라우트 부재) | 목록 아이템·긴급 배너 링크가 `/notices/[slug]`, `/news/[slug]`를 가리키지만 `src/app/notices/[slug]/page.tsx`, `src/app/news/[slug]/page.tsx`가 존재하지 않음. 실빌드 HTML에서 `href="/notices/qa-test-…"` 출력 실측 확인 — **verified 콘텐츠가 1건이라도 등록되는 즉시 클릭 시 404**. 현재는 content/가 비어 있어 노출되지 않을 뿐임 (개발자도 03_developer_impl.md §4-4에서 인지·보고) | 상세 라우트(`src/app/notices/[slug]/page.tsx`, `src/app/news/[slug]/page.tsx`) 구현을 콘텐츠 등록의 선행 조건으로 확정하고 web-developer에게 구현 요청. 차기 스프린트로 미룬다면 "상세 페이지 구현 전 콘텐츠 등록 금지"를 운영 규칙으로 리더가 명문화할 것 (범위 판단은 리더 몫) |
| 2 | 콘텐츠 스키마 (경계면: 스펙 §5 ↔ 로더 ↔ 컴포넌트) | `src/lib/content.ts:115` (`source: readString(data.source)` — null 허용) ↔ `src/components/board/PostList.tsx:44` (`post.source !== null`일 때만 출처 렌더) ↔ 스펙 §5 "금융노조 소식 탭은 **출처 필수 표기**" | 로더가 news 카테고리의 `source` 누락을 허용하여 출처 없는 소식이 그대로 게시됨. 실증: source 없는 verified news 임시 파일이 출처 미표기 상태로 목록에 렌더됨을 빌드 HTML에서 확인. title/date는 누락 시 빌드 실패시키면서 news의 source는 조용히 통과 — 방어선 비일관 | `src/lib/content.ts`의 `parsePostFile`에서 `expectedCategory === "news"`이고 `readString(data.source) === null`이면 title/date와 동일하게 throw (98행 category 검사 인접에 추가). 오보 방지 원칙상 "조용한 누락"보다 빌드 실패가 안전 |

## 스펙 확인 필요 (frontend-designer 몫 — 스펙 자체의 조합 충돌)

| # | 위치 | 내용 | 요청 |
|---|------|------|------|
| S1 | 스펙 §4.2 ↔ `src/components/board/BoardTabs.tsx:112` | 스펙은 탭 좌우 패딩 1rem + "잘리면 모바일 한정 16px 축소 허용"을 규정하나, 375px에서 3탭 균등분할 시 두 조건이 물리적으로 양립 불가(개발자 계산: 탭당 가용 ~109px < 16px 텍스트+패딩 32px). 개발자는 모바일 한정 `px-1`(4px) + 16px(`text-[1rem]/[1.5]`)로 구현 (md+는 스펙대로 px-4·18px·min-w-32). 15px 미만 금지는 준수됨 | 디자이너가 모바일 패딩 축소치를 스펙에 공식 반영하거나 대안(탭 스크롤 등) 제시. 현 구현은 스펙 미정의 구간의 최소 해석으로 합리적 |

## 통과 항목 (검증한 것만)

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | verified 게이트 (실동작) | `verified: false` 임시 파일이 목록에서 제외됨을 빌드 HTML에서 실측 (`content.ts:87` — `readBoolean(data.verified) !== true → null`, boolean 정확 일치) |
| 2 | verified 게이트 (실동작) | `verified: true` + title/date 누락 파일 → 빌드 실패 실측 (`content.ts:94` throw, 에러 메시지에 파일 경로 포함 — 조용한 누락 방지 설계 확인) |
| 3 | 긴급 배너 (실동작) | urgent+verified 1건 존재 시 `aria-label="긴급 공지"` region·배지·아이콘 렌더, 0건 복원 시 DOM에서 완전 제외 — 양쪽 모두 빌드 HTML 실측 |
| 4 | 빈 상태 (실동작) | 콘텐츠 0건에서 "등록된 공지사항이 없습니다"/"등록된 소식이 없습니다" + 보조 메시지 렌더 실측. `role="status"` 미부여(스펙 §6대로), 가짜 예시 게시물 없음 |
| 5 | 방명록 폼 미렌더 (실동작) | 빌드 HTML에 `<form>` 0건 실측. `GuestbookPanel.tsx:29-35` — unconfigured/configured **양쪽 모두** PreparingCard 반환 (백엔드 실구축 전 disabled 폼·가짜 UI 노출 경로 없음, 스펙 §7.1 준수) |
| 6 | 방명록 API 계층 | `guestbook.ts` — `GuestbookResult` 판별 유니온으로 unconfigured 명시 반환, 응답은 `parseGuestbookEntry(unknown)`에서 필드별 typeof 검증. any/근거 없는 as 없음 |
| 7 | 콘텐츠 스키마 교차 | 스킬 §3 frontmatter(title/date/category/urgent/deadline/source/verified) ↔ `content.ts` 필드별 검증 함수 ↔ `PostSummary` ↔ `PostList` props — source 강제 건(실패 #2) 제외 전 필드 명칭·타입·옵셔널 일치. category↔디렉토리 불일치 시 throw 확인 |
| 8 | 라우트 상수 규약 | 모든 내부 링크가 `ROUTES` 상수 경유 (SiteHeader/PostList/UrgentBanner/BoardTabs grep 확인, 문자열 하드코딩 0건). `ROUTES.home`("/")·`homeTab` 쿼리 ↔ `page.tsx` 실존, `?tab=` 파서 `isTabId`와 `TAB_IDS` 단일 소스 일치 |
| 9 | 타입 우회 탐지 | `as any\|as unknown\|@ts-ignore\|@ts-expect-error` grep 결과 0건 |
| 10 | 디자인 토큰 값 | `globals.css` `@theme` 블록 ↔ 스펙 §1 — 색 12종·타이포 5단계(라인하이트/웨이트 포함)·간격 3종 전부 값 일치. create-next-app 다크모드 미디어쿼리 제거 확인 |
| 11 | 임의 값 하드코딩 | 컴포넌트 내 hex 하드코딩 0건, arbitrary value는 `text-[1rem]/[1.5]`(스펙 허용 모바일 16px, S1 참조) 1건뿐. radius(rounded/lg/xl=4/8/12px)·아이콘 크기(size-3.5/5/10=14/20/40px)·간격 전부 스펙 값과 일치 |
| 12 | #1d4ed8 텍스트 금지 | `text-primary` 사용처 0건 — `--color-primary`는 `focus-visible:outline-primary`(포커스 링, UI 전용)로만 사용. 본문 크기 링크·hover 텍스트는 전부 `primary-strong`(#1e40af). `#e5e7eb`(border-soft)는 divide/구분선 장식 전용, `#9ca3af` 미사용 |
| 13 | 색상 대비 (스크립트 실측) | 실사용 17조합 전부 `check-contrast.mjs` 실행 — 텍스트 조합 11종 전부 AAA 통과(최저 7.23:1), UI 전용 조합 6종(포커스 링·보더·아이콘) 전부 3:1 이상. 스펙 §2 수치와 완전 일치 |
| 14 | 탭 ARIA 구조 (실측) | tablist(`aria-label="게시판"`)/tab×3/tabpanel×3, `aria-controls`↔패널 id·`aria-labelledby`↔탭 id 교차 일치, `aria-selected` true×1/false×2·로빙 탭인덱스(선택 탭만 0) — SSR HTML에서 실측. 비선택 패널 `hidden` 실측, 패널 `tabindex=0` |
| 15 | 탭 키보드 (코드 검증) | `BoardTabs.tsx:62-87` — ←/→ 양끝 순환, Home/End, 이동 즉시 활성화(automatic activation) + `tabRefs` focus 이동. 탭 상태는 URL 쿼리 단일 소스(`useSyncExternalStore`), 잘못된 `?tab=` 값은 기본 탭 폴백 |
| 16 | 시맨틱 마크업 | landmark: header/main/footer + 배너 section role=region. 이동=`<Link>`/동작=`<button type="button">` 구분, `div onClick` 0건, `<img>` 0건(SVG 전부 `aria-hidden`+currentColor, 의미는 인접 텍스트 담당). 제목 h1(헤더)→h2(방명록 카드) 순서 건너뜀 없음 |
| 17 | 날짜 처리 | `date.ts` — Intl UTC 고정, 수동 계산 없음. `YYYY.MM.DD` 표기·`<time datetime="YYYY-MM-DD">` 빌드 HTML 실측(SSR이 `dateTime` 카멜케이스로 출력하나 HTML 속성 대소문자 무구분으로 유효 — 개발자 결정 8 확인) |
| 18 | 터치 대상·포커스 | 탭·헤더 링크·배너 링크 `min-h-touch`(44px), 목록 아이템 `py-4`+2행 콘텐츠(≥72px). 모든 인터랙티브 요소에 `focus-visible:outline-3` 존재(목록은 내향 offset -3), `:focus`(마우스)에는 미표시 |
| 19 | 정렬·배너 선택 로직 | `content.ts:120-125` urgent 우선→게시일 내림차순, `getLatestUrgentNotice`는 정렬 후 첫 건(최신 urgent) — 스펙 §5·§3.2 일치 |
| 20 | 빌드/정적 검사 | `npx tsc --noEmit` 오류 0, `npm run lint` 오류 0, `npm run build` 통과 — `/` 정적 프리렌더(○ Static) 유지. 테스트 파일 삭제 후 클린 재빌드로 빈 상태 복원 확인(content/에 .gitkeep만 잔존, "QA 테스트" 문자열 잔존 0건) |

## 미검증 항목

| # | 항목 | 사유 |
|---|------|------|
| 1 | 브라우저 실조작 키보드 내비게이션 (화살표/Home/End 실입력, 포커스 시각 확인) | 브라우저 E2E 실행 환경 미구성 — 코드 검증 + SSR HTML 실측까지만 수행 (통과 #14·15는 그 범위의 판정) |
| 2 | 스크린리더 실낭독 (탭 전환 안내, 배지 "긴급" 낭독) | 보조기기 실행 환경 없음 |
| 3 | 375px 실뷰포트에서 "금융노조 소식" 탭 잘림 여부 실측 | 뷰포트 렌더 환경 없음 — 개발자 계산값만 존재 (S1과 연동, 디자이너 확인 시 실기기 확인 권장) |
| 4 | 방명록 §7.2 작성 폼·글 목록 | NCP 백엔드 미구축 — 구현 자체가 이번 범위 외. API 계층 시그니처만 코드 검증(통과 #6) |

## 비고

- 다크 모드는 스펙이 명시적으로 범위 제외 — 검증 대상 아님.
- 검증용 임시 파일 4건(`qa-test-verified-urgent.md`, `qa-test-unverified.md`, `qa-test-broken.md`, `qa-test-news-no-source.md`)은 전부 명백한 플레이스홀더 문구(`[QA 테스트 파일입니다]`)로 작성했고, 검증 후 삭제·클린 재빌드로 잔존 없음을 확인했다.
- 실패 #1은 개발자가 이미 인지·보고한 항목이나, "콘텐츠 등록 즉시 404"라는 트리거 조건이 있으므로 리더의 명시적 결정(상세 라우트 선행 구현 또는 콘텐츠 등록 차단 규칙) 전까지 실패로 유지한다.
