# 07. 방명록 백엔드 구현 요약 · 배포 기록 (Docker/NCP VM)

작성일: 2026-08-16 (공개 배포 반영 갱신) | 작성자: backend-developer | 기준 명세: `_workspace/06_backend_api_spec.md`
상태: **API 공개 완료 — https://union-api.koscomlabor.cloud (TLS 유효, 스모크 통과). 프론트 배포는 6절**

---

## 1. 구현 요약

### 1.1 위치·구조 (모노레포 `server/`)

```
server/
├── package.json / tsconfig.json           # Fastify 5 + TS strict. scripts: dev/build/typecheck/migrate
├── .gitignore / .env.example              # .env 커밋 금지, 키 이름만 예시
├── Dockerfile                             # node:22-alpine 멀티스테이지 (build → prod 최소 이미지)
├── .dockerignore
├── migrations/1755300000000_create-guestbook-entries.sql
├── deploy/                                # 프로덕션 배포 산출물 (서버 배치 사본의 원본)
│   ├── docker-compose.yml                 # → 서버 /root/koscomlabor-api/docker-compose.yml
│   ├── backup.sh                          # → 서버 /root/koscomlabor-api/backup.sh (cron 03:00 KST)
│   └── Caddyfile.api-block                # Caddy 사이트 블록 (도메인 확정 후 append 용)
└── src/
    ├── index.ts / app.ts / config.ts / db.ts
    └── lib/ errors.ts · validate.ts · ipHash.ts · rateLimit.ts
```

구현 상세(계약 준수·검증·rate limit·로그 정책)와 로컬 실측 27/27 PASS 는 06 명세 9절 참조.

### 1.2 기술 결정

| 결정 | 내용 · 사유 |
|---|---|
| rate limit 자체 구현 | 다중 윈도(1분/1시간/24시간)+30초 최소 간격+성공 등록만 카운트 조합을 `@fastify/rate-limit`이 지원하지 않아 `src/lib/rateLimit.ts` 인메모리 슬라이딩 윈도로 구현. VM 1대·단일 프로세스 전제 |
| 검사 순서 | rate limit → 입력 검증 (자원 보호). 성공 등록 후 30초 내 POST는 내용 무관 429 |
| 응답 스키마 직렬화 | 전 라우트 Fastify response schema(`additionalProperties: false`) — 명세 외 필드 직렬화 차단 |
| 로그 | method·url·statusCode만. 본문·닉네임·클라이언트 IP 미로깅 (원문 IP 금지 — 리더 승인 조건) |
| 관리자 토큰 | `crypto.timingSafeEqual` 상수 시간 비교 |
| 컨테이너화 | node:22-alpine 멀티스테이지 — prod 이미지는 프로덕션 deps+dist만. 마이그레이션은 build 스테이지 이미지의 일회성 `migrate` 서비스(profile: tools)로 실행 |

### 1.3 로컬 실행 (QA 재현)

```bash
brew install postgresql@16 && brew services start postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH" && createdb guestbook
cd server && cp .env.example .env   # DATABASE_URL/토큰 2종 채우기 (openssl rand -base64 32)
npm install && npm run migrate && npm run dev   # http://127.0.0.1:3001
```

유의: 검증 400 테스트는 직전 성공 등록 후 30초 이후 실행 (rate limit이 검증보다 선행).

---

## 2. 실제 배포 구성 (2026-08-16 완료 — Docker 기반)

당초 가이드(호스트 직접 설치)는 서버 실사 결과 폐기하고 Docker 로 적응했다. 서버: NCP VM `101.79.31.30` (Ubuntu 22.04, KST), 기존 onnuri 서비스(onnuri-app/onnuri-db/onnuri-caddy, compose: /root/digital_onnuri/backend/)와 **완전 격리 공존**.

### 2.1 구성도

```
[인터넷] → onnuri-caddy(80/443, TLS 자동)
             ├─ api.koscomlabor.cloud      → onnuri-app:8080   (기존 — 무변경)
             └─ <미확정 도메인>            → koscomlabor-api:3001   (신규 블록, 도메인 확정 후 추가)
                                              │ (docker network: deploy_web ─ 공유는 이것뿐)
                                              └→ koscomlabor-db:5432 (postgres:16-alpine,
                                                 koscomlabor-api_internal 네트워크 전용, 호스트 포트 미개방)
```

서버 배치:

```
/root/koscomlabor-api/
├── docker-compose.yml      # server/deploy/docker-compose.yml 사본
├── .env                    # chmod 600 — ADMIN_API_TOKEN·IP_HASH_SECRET·POSTGRES_PASSWORD·CORS_ORIGINS·TRUST_PROXY·LOG_LEVEL
├── backup.sh               # chmod 700
├── Caddyfile.api-block     # 도메인 확정 후 append 할 블록
└── app/                    # server/ rsync 사본 (node_modules·dist·.env 제외)
```

- DB 데이터: 명명 볼륨 `koscomlabor-api_pgdata`
- onnuri-db 는 접속·수정 일체 하지 않음 (자체 postgres:16-alpine 컨테이너)

### 2.2 배포·운영 명령 (서버에서)

```bash
cd /root/koscomlabor-api
docker compose build                          # 이미지 빌드
docker compose up -d db                       # DB 기동 (healthcheck 대기)
docker compose --profile tools run --rm migrate   # 마이그레이션 (일회성)
docker compose up -d api                      # API 기동
docker exec onnuri-caddy wget -qO- http://koscomlabor-api:3001/health   # {"status":"ok"}
```

업데이트 배포 (로컬 머신에서):

```bash
rsync -az --delete --exclude node_modules --exclude dist --exclude .env \
  server/ root@101.79.31.30:/root/koscomlabor-api/app/
scp server/deploy/docker-compose.yml root@101.79.31.30:/root/koscomlabor-api/docker-compose.yml
ssh root@101.79.31.30 'cd /root/koscomlabor-api && docker compose build && \
  docker compose --profile tools run --rm migrate && docker compose up -d api'
```

### 2.3 배포 중 발견한 함정 (재발 방지 기록)

1. **`api.koscomlabor.cloud` 는 onnuri 백엔드가 사용 중.** onnuri-caddy 의 `{$API_DOMAIN}` 환경변수가 정확히 이 도메인이다 (onnuri 프론트는 GitHub Pages, 백엔드만 이 VM). 같은 도메인 블록을 추가하면 `caddy validate` 가 "ambiguous site definition" 으로 거부 — 실측 확인 후 Caddyfile 즉시 원복. **방명록 API 도메인은 별도 서브도메인이어야 한다** (4절).
2. **다중 네트워크에서 서비스명 `db` 는 위험.** deploy_web 네트워크의 onnuri-db 가 `db` 별칭을 갖고 있어, deploy_web 에도 붙은 API 컨테이너에서 `db` 가 onnuri-db(172.18.x)로 해석됐다 (인증 실패 500 — 쓰기 없음, 즉시 교정). DATABASE_URL 호스트는 반드시 고유한 `koscomlabor-db` 를 쓴다 (compose 에 주석으로 명기).

### 2.4 시크릿

- `/root/koscomlabor-api/.env` (600, root) — 서버에서 `openssl rand` 로 생성. 값은 화면·로그·커밋 어디에도 노출하지 않았다
- `ADMIN_API_TOKEN` 확인 방법(관리자용): 서버에서 `grep ADMIN_API_TOKEN /root/koscomlabor-api/.env`
- 회전: `.env` 값 교체 후 `docker compose up -d api` (재생성)

### 2.5 백업 (설치 완료)

- **매일 03:00 KST** cron: `/root/koscomlabor-api/backup.sh` → `docker exec koscomlabor-db pg_dump -Fc` → `/root/backups/guestbook_YYYYMMDD.dump`, 14일 롤링. 설치 직후 1회 실행 검증 완료 (4,900 bytes 정상 생성)
- **03:30 KST** cron: ip_hash 90일 경과분 NULL 처리 (리더 승인 조건 이행)
- 기존 onnuri 크론(00:30)은 그대로 보존
- 복구: `docker exec -i koscomlabor-db pg_restore -U guestbook_app --clean --if-exists -d guestbook < /root/backups/guestbook_<날짜>.dump`
- **[사용자 콘솔 작업] 2차 보관 — NCP Object Storage**: ① 콘솔에서 비공개 버킷 생성(예: koscomlabor-backup) ② Sub Account 로 해당 버킷 쓰기 전용 키 발급 ③ VM 에 자격증명 설정(600) 후 `backup.sh` 말미 주석 해제 (S3 호환 엔드포인트 kr.object.ncloudstorage.com)

### 2.6 공개 (도메인 확정 후 남은 절차 — 15분 작업)

1. **[사용자] 가비아 DNS**(koscomlabor.cloud 네임서버 = gabia) 에 A 레코드 추가: `<확정 서브도메인>` → `101.79.31.30`
2. `server/deploy/Caddyfile.api-block` 의 도메인을 확정값으로 수정 → 서버 `/root/koscomlabor-api/Caddyfile.api-block` 에 반영
3. 서버에서:
   ```bash
   CF=/root/digital_onnuri/backend/deploy/Caddyfile
   cp "$CF" "$CF.bak-$(date +%Y%m%d%H%M%S)"
   cat /root/koscomlabor-api/Caddyfile.api-block >> "$CF"
   docker exec onnuri-caddy caddy validate --config /etc/caddy/Caddyfile   # 반드시 통과 확인
   docker exec onnuri-caddy caddy reload --config /etc/caddy/Caddyfile    # restart 금지
   ```
4. `https://<도메인>/health` 200 (TLS 는 Caddy 가 자동 발급) 확인 → 06 명세 9절 축약 스모크 재실행
5. `.env` 의 `CORS_ORIGINS` 에 프론트 프로덕션 도메인 추가(확정 시) → `docker compose up -d api`
6. 프론트에 `NEXT_PUBLIC_API_BASE_URL=https://<도메인>` 설정 (web-developer 통보)

---

## 3. 원격 스모크 실측 (2026-08-16, deploy_web 네트워크 내부에서 — 도메인 미확정으로 TLS 경유 테스트는 2.6 이후)

| # | 케이스 | 결과 |
|---|---|---|
| S1 | GET /guestbook (빈) | 200, `[]`, X-Total-Count: 0 — PASS |
| S2 | POST 정상 | 201, 4필드 단일 객체 (id/author/body/createdAt) — PASS |
| S3 | 30초 내 재등록 | 429 RATE_LIMITED + `retry-after: 30` — PASS |
| S4 | (30초 창 내 검증실패 요청) | 429 — 설계대로 rate limit 선행. 400 경로는 로컬 실측 27종에서 검증 완료 |
| S5 | CORS Origin http://localhost:3000 | ACAO 반환 — PASS |
| S6 | CORS 비허용 Origin | ACAO 미반환(차단) — PASS |
| S7 | 관리자 삭제 무토큰 | 401 UNAUTHORIZED — PASS |
| S8 | 관리자 삭제 정상 | 200 `{deleted:true,id}` — PASS |
| S9 | 삭제 후 목록 | 200, `[]`, X-Total-Count: 0 — PASS |

**onnuri 무영향 확인**: 배포 전후 https://onnuri.koscomlabor.cloud 응답 SHA1 동일(`ef2365c4…`) · onnuri-app/db/caddy 컨테이너 가동시간 연속(재시작 없음) · Caddyfile 백업본과 diff 동일(원복 확인) · caddy 에러 로그 없음 · onnuri 백엔드(api.koscomlabor.cloud) 정상 응답.

## 4. 공개 완료 기록 (2026-08-16 — 2.6절 절차 이행)

1. **API 도메인 확정·공개: `https://union-api.koscomlabor.cloud`** (리더 확정, 가비아 A 레코드 반영 완료). Caddy 블록 append → `caddy validate` "Valid configuration" → `caddy reload`. Let's Encrypt 인증서 자동 발급, `/health` 200 실측
2. **CORS 갱신 완료**: `https://koscomlabor.cloud`, `https://www.koscomlabor.cloud`, `http://localhost:3000` — 3개 Origin 모두 preflight ACAO 실측, 비허용 Origin 차단 실측
3. **공개 도메인 경유 스모크**: GET 200 배열 / POST 201 4필드 / 30초 재등록 429+Retry-After / CORS 3종 — 전부 PASS, 테스트 글은 관리자 삭제로 정리
4. 잔여: Object Storage 2차 백업 콘솔 작업 (2.5절 가이드), 루트(@) DNS 가비아 수정 (사용자 — 6절 참조)

## 5. 운영 시 알아둘 것

- rate limit 카운터는 프로세스 메모리 — 컨테이너 재시작 시 초기화 (수용된 설계)
- 관리자 삭제는 soft delete. 완전 삭제 요구 시: 백업 확인 후 `docker exec koscomlabor-db psql -U guestbook_app -d guestbook -c "DELETE FROM guestbook_entries WHERE id='<id>';"`
- `GET /health` 는 rate limit 미적용 (모니터링용)
- 파괴적 docker 명령(prune, `down -v`) 금지 — `down -v` 는 DB 볼륨을 삭제한다

## 6. 프론트 실서비스 배포 (koscomlabor.cloud / www.koscomlabor.cloud)

### 6.1 저장소 변경 (최소 — 프론트 소스 무수정)

| 파일 | 변경 |
|---|---|
| `next.config.ts` | `output: "standalone"` 한 줄 추가 (Docker self-contained 출력) |
| `Dockerfile` (신규, 루트) | node:22-alpine 멀티스테이지. `NEXT_PUBLIC_API_BASE_URL` 은 **build ARG** 로 주입 (NEXT_PUBLIC 은 빌드타임 임베드). 런타임 이미지에 standalone·static·public·**content/**(마크다운 fs 읽기 대상) 복사 |
| `.dockerignore` (신규, 루트) | node_modules·.next·.git·_workspace·server·deploy·시크릿·원본 CI jpg 제외 |
| `deploy/web/` (신규) | `docker-compose.yml`·`Caddyfile.web-block`·`deploy.sh` — 서버 배치 사본의 원본 |

### 6.2 서버 구성

```
/root/koscomlabor-web/
├── docker-compose.yml      # web 서비스: build ./src (ARG 로 API URL 임베드), deploy_web 네트워크, 호스트 포트 미개방
├── deploy.sh               # 재배포: rsync 후 build + up -d web
├── Caddyfile.web-block
└── src/                    # 저장소 rsync 사본
```

Caddy: `koscomlabor.cloud, www.koscomlabor.cloud` → `reverse_proxy koscomlabor-web:3000` 블록 append (validate → reload).
**루트(@) DNS 는 아직 GitHub IP 잔존** — 루트 인증서 발급은 실패→백오프 재시도 상태가 정상이며, 사용자가 가비아에서 A 레코드를 101.79.31.30 으로 바꾸면 자동 발급된다. www 는 즉시 발급.

### 6.2-1 디자인 v2 재배포 · 일일 재빌드 (2026-08-16)

- **디자인 v2 (a0ad5c5) 재배포 완료.** Pretendard 는 npm `pretendard` 패키지에서 postinstall(`scripts/sync-pretendard.mjs`)로 `public/fonts/pretendard/` 에 동기화(셀프호스팅, 외부 CDN 0건). Docker 빌드에서 postinstall 이 돌도록 **deps 스테이지에 `COPY scripts ./scripts` 를 npm ci 앞에 추가** (없으면 npm ci 가 postinstall 실패로 중단됨 — 실측 후 반영). 빌드 로그에서 woff2 92개 동기화 확인
- **일일 재빌드 크론 (리더 결정)**: 매일 **00:10 KST** `/root/koscomlabor-web/deploy.sh` — 마감 스트립 D-n 표기가 빌드 시점 고정이므로 날짜 경과 반영 목적. Dockerfile 의 `ARG BUILD_DATE` 캐시 버스트로 deps 캐시는 유지하고 `npm run build` 만 재실행 (소요 약 40초, 00:30 onnuri 배치와 충돌 없음). 로그: `/root/koscomlabor-web/rebuild.log`, 로테이션: `/etc/logrotate.d/koscomlabor-web` (주 1회, 4세대, 압축)
- 크론 전체 현황: 00:10 웹 재빌드 → 00:30 onnuri 배치(기존) → 03:00 DB 백업 → 03:30 ip_hash 정리

### 6.3 재배포 절차

```bash
# 로컬에서
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude .idea --exclude .claude \
  --exclude _workspace --exclude server --exclude deploy --exclude "*.pem" --exclude ".env*" \
  ./ root@101.79.31.30:/root/koscomlabor-web/src/
ssh root@101.79.31.30 '/root/koscomlabor-web/deploy.sh'
```

`NEXT_PUBLIC_API_BASE_URL` 변경 시 compose 의 build args 수정 후 재빌드 필요 (런타임 env 로는 반영 안 됨).

## 7. Part 2 (게시물 DB + Admin) — **프로덕션 배포 완료 (2026-08-17)**

QA 10회차 통과 후 리더 승인으로 API 배포 완료. 구현·로컬 실측은 06 명세 §17, 프로덕션 스모크는 아래 §7.4.

### 7.1 배포 절차 (일괄 배포 시)

1. rsync (기존 2.2절 동일) — 마이그레이션 002·003 포함됨
2. **ADMIN_PASSWORD 초기 설정** (서버에서, 리더 지시 방식):
   ```bash
   # 평문은 화면·채팅·로그에 출력하지 않는다
   umask 077
   PW=$(openssl rand -base64 24)
   printf '%s' "$PW" > /root/koscomlabor-api/ADMIN_PASSWORD.initial
   cat >> /root/koscomlabor-api/ADMIN_PASSWORD.initial <<'NOTE'

   [안내] 위 첫 줄이 admin 로그인 초기 비밀번호입니다.
   확인 후 이 파일을 삭제하세요: rm /root/koscomlabor-api/ADMIN_PASSWORD.initial
   NOTE
   HASH=$(printf '%s' "$PW" | docker run --rm -i -v /root/koscomlabor-api/app:/app -w /app node:22-alpine sh -c "npm ci --omit=dev >/dev/null 2>&1 && npm i argon2 >/dev/null 2>&1 && node scripts/hash-password.mjs")
   printf 'ADMIN_PASSWORD_HASH=%s\n' "$HASH" >> /root/koscomlabor-api/.env
   unset PW HASH
   ```
   (간편 대안: 로컬에서 `node scripts/hash-password.mjs` 로 해시만 만들어 .env 에 넣고, 평문은 위 파일 방식으로 서버에 기록)
   → **사용자 안내: SSH 로 `/root/koscomlabor-api/ADMIN_PASSWORD.initial` 확인 후 파일 삭제**
3. `docker compose build && docker compose --profile tools run --rm migrate && docker compose up -d api`
   - compose 에 `uploads` 볼륨(→ /data/uploads)·`UPLOAD_DIR` 반영됨 (deploy/docker-compose.yml)
   - **argon2 musl 검증**: Docker 빌드에서 argon2 native 모듈이 alpine(musl)에서 로드되는지 확인 — 실패 시 bcryptjs 폴백 (§15-3 조건부 승인, 결과 기록)
4. 백업 크론 확장: 03:05 KST uploads 볼륨 tar 백업 추가
   ```
   5 3 * * * docker run --rm -v koscomlabor-api_uploads:/data:ro -v /root/backups:/backup alpine tar czf /backup/uploads_$(date +\%Y\%m\%d).tar.gz -C /data . && find /root/backups -name 'uploads_*.tar.gz' -mtime +14 -delete
   ```
5. caddy: union-api 블록에 요청 크기 상한 확인 (Caddy 기본 무제한 — 앱 계층 10MB 제한이 실효선. nginx 아님so client_max_body_size 불필요)
6. 스모크: 06 명세 §17 배터리 축약판 (로그인/CRUD/업로드/SSRF 차단 1종)

### 7.2 프론트(web-developer) 계약 참조

- 계약 출처: 06 명세 Part 2 (§10–16). 기존 방명록과 반대 방향 — 프론트가 명세를 따름
- CORS credentials 활성화됨: fetch 시 `credentials: "include"` 필요 (세션 쿠키)
- 목록 shape: 최상위 배열 + X-Total-Count 헤더 (방명록과 동일 규약)

## 8. CI/CD (GitHub Actions, 2026-08-16)

저장소: github.com/canduk910/koscomlabor (private, main 단일 브랜치 운영)

### 8.1 구성

| 워크플로 | 트리거 | 내용 |
|---|---|---|
| `.github/workflows/ci.yml` | 모든 push·PR | web: npm ci → tsc --noEmit → lint → build (NEXT_PUBLIC_API_BASE_URL 더미) / server: npm ci → typecheck → build. setup-node npm 캐시 |
| `.github/workflows/deploy.yml` | **main push 의 CI 성공 시** (workflow_run) | checkout(CI 통과 커밋) → rsync → `/root/koscomlabor-web/deploy.sh` → https://koscomlabor.cloud 200 헬스 확인(10회 재시도). concurrency 로 중복 배포 방지(진행 중 배포 취소 안 함) |

### 8.2 배포 SSH 보안

- **전용 ed25519 배포 키** — GitHub Secrets `DEPLOY_SSH_KEY` (외 `SSH_HOST`, `SSH_USER`). 로컬 키 파일은 등록 즉시 삭제, 값 미출력
- 서버 authorized_keys 에 **command 제한**: `/root/koscomlabor-web/deploy-key-wrapper.sh` 가 (a) `/root/koscomlabor-web/src/` 대상 rsync (b) `deploy.sh` 실행 — 두 가지만 허용, 그 외 명령·포트포워딩·pty 거부. 키 유출 시에도 임의 root 셸 불가
- 호스트키 고정: `.github/known_hosts` (ssh-keyscan 사전 등록, StrictHostKeyChecking=yes)

### 8.3 운영 규칙 (사용자 안내)

1. **main 에 push 하면 CI 통과 시 웹이 자동 배포된다** (약 2–4분). 배포를 원치 않는 작업은 브랜치에서
2. **API(server/)는 CD 제외** — Part 2 배포 보류·.env(ADMIN_PASSWORD_HASH) 선행 조건 때문. 수동 배포 유지 (§7.1). Part 2 일괄 배포 후 API CD 편입 별도 판단
3. 배포 실패 시: GitHub Actions 로그 확인 → 서버측 로그는 `/root/koscomlabor-web/rebuild.log` 및 `docker logs koscomlabor-web`
4. 서버 호스트키 재설치 등으로 변경되면 `.github/known_hosts` 재생성 필요 (ssh-keyscan)
5. 일일 00:10 재빌드 크론과 CD 는 독립 — 충돌 없음 (deploy.sh 는 동일 스크립트, docker 가 빌드 직렬화)

### 7.3 배포 중 발견·수정한 문제 (재발 방지 기록)

1. **compose 의 env_file `$` 보간으로 argon2 해시 훼손** — `$argon2id$v=19$m=65536...` 의 `$argon2id`/`$v`/`$m` 을 변수로 치환해 컨테이너가 84자 깨진 값을 받았고 기동이 거부됐다(설정 검증이 조기에 잡아냄). 수정: compose 의 `env_file` 을 **long syntax + `format: raw`** 로 변경. 확인 방법: `docker compose run --rm --entrypoint sh api -c 'echo ${#ADMIN_PASSWORD_HASH}'` → 97
   - 참고: `docker compose` 실행 시 "The \"argon2id\" variable is not set" 경고가 뜨는 것은 compose 가 프로젝트 `.env` 를 자기 보간용으로도 자동 로드하기 때문이며 **무해하다** (컨테이너 값은 raw 로 온전). 신경 쓰이면 후속 개선: 앱 전용 env 파일 분리
2. **profile 서비스는 `docker compose build` 대상에서 제외** — `migrate`(profiles: tools)가 구 이미지로 실행돼 신규 마이그레이션이 적용되지 않았다("Migrations complete!" 만 출력). 수정: `docker compose --profile tools build migrate` 를 선행 (compose 주석·아래 절차에 반영)
3. **uploads 명명 볼륨이 root 소유 → 업로드 EACCES(500)** — 컨테이너는 node(uid 1000)로 실행된다. 수정: Dockerfile prod 스테이지에 `RUN mkdir -p /data/uploads && chown -R node:node /data` 추가(신규 볼륨은 이미지 소유권을 물려받음) + 기존 볼륨은 1회 `docker run --rm -v koscomlabor-api_uploads:/data/uploads alpine chown -R 1000:1000 /data/uploads`
4. **argon2id musl 검증 결과: 정상** — alpine 이미지에서 로드·해시 성공. **bcrypt 폴백 불필요** (§15-3 조건 해소)

### 7.4 프로덕션 스모크 실측 (2026-08-17)

| 케이스 | 결과 |
|---|---|
| `/health` | 200, TLS 유효 |
| admin 로그인 실패 / 성공 | 401 / 200 + `Set-Cookie: HttpOnly; Secure; SameSite=Lax; Path=/admin` (프로덕션 Secure 확인) |
| `/admin/me` (세션) | 200 |
| 게시물 생성 → 공개 목록·상세 | 201 / 200 배열+X-Total-Count / 200 |
| preview-link 정상 | 200 `{"title":"Example Domain"}` |
| preview-link 169.254.169.254 (메타데이터) | 422 LINK_FETCH_FAILED (SSRF 차단) |
| 첨부 업로드 → 서빙 | 201 / 200 + attachment·immutable·nosniff, **바이트 원본 일치** |
| 잘못된 타입 업로드 | 400 |
| CORS: koscomlabor.cloud / www | ACAO 정확 반환 + `Allow-Credentials: true` |
| CORS: evil.example | ACAO 미반환 (차단) |
| 방명록 회귀 | 200 정상 |
| soft delete 후 공개 상세·첨부 서빙 | 각 404 |
| **테스트 데이터 정리** | posts/attachments/uploads 볼륨 전부 0건으로 정리 완료 |

**onnuri 무영향**: 응답 SHA1 동일(`ef2365c4…`), onnuri 컨테이너 uptime 연속(42h/5d/6d), Caddyfile diff = union-api 블록에 4줄(request_body 12MB) 추가만.

### 7.5 운영 반영 사항

- Caddy: `union-api` 블록에만 `request_body { max_size 12MB }` 추가 (업로드용). 기존 블록 무변경, validate → reload
- 크론 추가: **03:05 KST uploads 볼륨 tar 백업**(`/root/koscomlabor-api/backup-uploads.sh`, 14일 롤링, 1회 실행 검증 완료). 전체 크론: 00:10 웹 재빌드 → 00:30 onnuri → 03:00 DB 백업 → 03:05 uploads 백업 → 03:30 ip_hash 정리
- admin 초기 비밀번호: `/root/koscomlabor-api/ADMIN_PASSWORD.initial` (600, 안내문 포함). **확인 후 삭제 필요**

## 9. 관리자 비밀번호 변경 기능 (2026-08-17) — 구현 완료, **프로덕션 적용 완료** (§9.10)

계약: `_workspace/00_input/contract-password-change.md` (+ 개정 1). 명세: 06 §10.4 / §12.1-a / §12.3 / §12.4.

### 9.1 문제와 해결

`ADMIN_PASSWORD_HASH` 는 `config.ts` 가 **기동 시 1회만** 읽던 값이라 런타임 변경이 불가능했다. 비밀번호를 바꾸려면 SSH → 해시 생성 → `.env` 수정 → 컨테이너 재기동이 필요했고, 이는 노조 담당자가 수행할 수 있는 절차가 아니다.

해시의 권위 저장소를 **`admin_credentials` 단일 행 테이블**로 옮기고, env 는 **최초 부팅 시드 전용**으로 격하했다. 인증 시 매 요청 DB 를 읽으므로 변경이 **재기동 없이 즉시 반영**된다.

### 9.2 변경 파일

| 파일 | 내용 |
|---|---|
| `server/migrations/1755300000003_create-admin-credentials.sql` | 신규. 단일 행 테이블 (`CHECK (id = 1)`), `updated_at NULL` = 초기 비밀번호 |
| `server/src/repos/credentials.ts` | 신규. `ensureSeeded` / `getActive` / `update` — snake_case ↔ camelCase 변환 경계 |
| `server/src/repos/sessions.ts` | `destroyOthers(token)` / `destroyAll()` 추가 |
| `server/src/routes/admin.ts` | 로그인 검증을 DB 활성 해시로 전환, `GET /admin/me` 에 `passwordIsInitial` 추가, `POST /admin/password` 신규, `resolveCredentials` 폴백 헬퍼 |
| `server/src/app.ts` | `AdminCredentialsRepository` 주입 + 부팅 시드 (실패 시 기동 거부) |
| `server/src/lib/errors.ts` | `INVALID_CREDENTIALS` code 추가 (계약 개정 1) |
| `server/src/config.ts` | `adminPasswordHash` 가 "시드 전용"임을 주석 명시 |
| `server/.env.example` | 동일 취지 주석 + 변경·복구 경로 안내 |
| `server/scripts/set-password.mjs` | 신규. 분실 복구용 강제 재설정 (stdin, 평문 미출력) |

### 9.3 설계 판단 기록 (리더 확인 요망 항목 포함)

1. **시드 실패 시 기동을 거부한다** (권장안 채택). `buildApp` 에서 `ensureSeeded` 가 던지면 풀을 닫고 재던져 `index.ts` 가 exit 1 한다. 근거: `config.ts` 가 이미 "필수 값 없으면 기동 거부 — 런타임에 조용히 깨지는 것 금지" 원칙을 세웠고, 자격 증명 저장소를 읽지 못하는 채로 뜨면 (a) 폴백 경로로만 동작해 비밀번호 변경이 무음 실패하거나 (b) 관리자가 이유 없이 잠긴다. 대신 **에러 메시지에 원인과 조치를 명시**해 크래시 루프가 자가 설명되게 했다.
   - 실측: `서버 기동 실패: admin_credentials 시드에 실패했습니다. 마이그레이션 1755300000003_create-admin-credentials 적용 여부와 DB 연결을 확인하세요. 원인: relation "admin_credentials" does not exist` (exit 1)
   - **운영 함의: 마이그레이션이 API 재기동보다 반드시 먼저 적용돼야 한다** (9.5 절차의 순서가 이 때문에 고정이다). 순서를 어기면 API 가 크래시 루프에 빠지지만, 마이그레이션을 적용하면 `restart: unless-stopped` 로 자동 복구된다 (데이터 손실 없음).
2. **행 부재 시 env 해시 폴백** (기동 후 런타임 경로). 기동은 거부하되, 이미 떠 있는 서버가 어떤 이유로 행을 잃은 경우에는 `resolveCredentials` 가 env 시드 해시로 폴백하고 `row-missing-fallback-to-env` 경고를 남긴다. 기동 시점의 엄격함과 런타임의 가용성을 분리한 것이다.
3. **WHERE 절 없는 DELETE 의 명시적 예외 2곳** — `sessions.destroyAll()` 과 `scripts/set-password.mjs` 의 `DELETE FROM admin_sessions`. 스킬 §3 의 대상 특정 규칙에 대한 의도적 예외이며 근거는 코드 주석에도 남겼다: (a) 대상이 조합 콘텐츠가 아니라 재발급 가능한 휘발성 인증 상태이고, (b) "비밀번호를 바꿨으니 전 기기 로그아웃"이라는 요구가 곧 전체 삭제이며, (c) 호출부가 비밀번호 변경 경로로 한정된다. 세션을 남겨야 하는 경로는 전부 `destroyOthers(token)`(WHERE 있음)를 쓴다. **게시물·방명록 테이블에는 이 예외를 적용하지 않는다.**
4. **`sessionsRevoked` 산출 전 `pruneExpired()` 선행** (계약에 없는 정교화). 만료된 세션 행이 남아 있으면 "무효화된 다른 세션 수"가 실제보다 부풀려져 관리자에게 거짓 정보를 준다. 만료분을 먼저 정리해 살아 있던 세션만 센다.
5. **rate limit 버킷을 로그인과 공유**하되 `check` 만 하고 **#4 실패 시에만 `record`** 한다. 성공한 변경을 카운트하면 정상 작업이 자기 자신을 잠근다.
6. **초기 비밀번호로 되돌려도 `passwordIsInitial` 은 false 로 유지**된다 (`updated_at` 이 한 번 채워지면 되돌아가지 않음). 배너의 의미가 "이 값을 아는 사람이 배포자 말고 또 있다"가 아니라 "담당자가 한 번도 관리하지 않았다"이므로 이 동작이 맞다고 판단했다. 실측 확인(§9.4 #18).

### 9.4 로컬 실측 (2026-08-17, macOS + PostgreSQL 16 + Node 26) — 전 케이스 PASS

로컬 DB 는 프로덕션과 동일한 마이그레이션 상태(0000–0002)에서 시작했다. 로컬 `.env` 의 `ADMIN_PASSWORD_HASH` 는 **검증용으로 변경**했다(평문 미기록).

**마이그레이션 up → down → up 왕복 확인** (프로덕션 롤백 절차의 근거):

```
$ npm run migrate       → Migrations complete!  (pgmigrations 4건)
  admin_credentials 컬럼: id smallint NOT NULL DEFAULT 1 / password_hash text NOT NULL
                          / seeded_at timestamptz NOT NULL DEFAULT now() / updated_at timestamptz NULL
  제약: admin_credentials_pkey PRIMARY KEY (id), admin_credentials_id_check CHECK ((id = 1))
$ npm run migrate:down  → DROP TABLE admin_credentials;  (to_regclass → null)
$ npm run migrate       → 재적용 정상 (4건)
```

**시나리오 실측 (curl 요청/응답 원문):**

| # | 케이스 | 실응답 | 판정 |
|---|---|---|---|
| 1 | `POST /admin/login` (초기 비번) | `200` `{"ok":true,"expiresAt":"2026-08-17T12:22:04.577Z"}` + `Set-Cookie: admin_session=…; Max-Age=43199; Path=/admin; HttpOnly; SameSite=Lax` | PASS |
| 2 | `GET /admin/me` (세션) | `200` `{"ok":true,"method":"session","expiresAt":"2026-08-17T12:22:04.577Z","passwordIsInitial":true}` | PASS |
| 2-b | `GET /admin/me` (Bearer) | `200` `{"ok":true,"method":"bearer","expiresAt":null,"passwordIsInitial":true}` | PASS |
| 4 | `POST /admin/password` 무인증 | `401` `{"error":{"code":"UNAUTHORIZED","message":"관리자 인증에 실패했습니다."}}` | PASS |
| 5 | #1 `newPassword` 누락 | `400` `{"error":{"code":"VALIDATION_ERROR","message":"currentPassword 와 newPassword 는 1자 이상 200자 이하의 문자열이어야 합니다."}}` | PASS |
| 5-b | #1 201자 `newPassword` | `400` 동일 메시지 | PASS |
| 6 | #2 11자 `newPassword` | `400` `{"error":{"code":"VALIDATION_ERROR","message":"새 비밀번호는 12자 이상이어야 합니다."}}` | PASS |
| 7 | #3 새 비번 = 현재 비번 | `400` `{"error":{"code":"VALIDATION_ERROR","message":"새 비밀번호가 현재 비밀번호와 같습니다."}}` | PASS |
| 8 | #4 현재 비번 불일치 | `401` `{"error":{"code":"INVALID_CREDENTIALS","message":"현재 비밀번호가 일치하지 않습니다."}}` | PASS |
| 9 | **검증 순서**: 틀린 현재 비번 + 11자 새 비번 | `400` 12자 메시지 (401 아님 — #2 가 #4 보다 먼저) | PASS |
| 10 | 정상 변경 (세션 A, 세션 B·C 존재) | `200` `{"ok":true,"changedAt":"2026-08-17T00:22:05.714Z","sessionsRevoked":2}` | PASS |
| 11 | 변경 후 `GET /admin/me` (세션 A **유지**) | `200` `{"ok":true,"method":"session","expiresAt":"…","passwordIsInitial":false}` | PASS |
| 12 | 세션 B / C | 각 `401` (타 기기 로그아웃) | PASS |
| 13 | 구 비밀번호 로그인 | `401` `{"error":{"code":"UNAUTHORIZED","message":"인증에 실패했습니다."}}` | PASS |
| 14 | 신 비밀번호 로그인 (**재기동 없이**) | `200` `{"ok":true,"expiresAt":"2026-08-17T12:24:07.119Z"}` | PASS |
| 16 | Bearer 경로 변경 (세션 2개 생존) | `200` `{"ok":true,"changedAt":"2026-08-17T00:24:07.414Z","sessionsRevoked":2}` → `admin_sessions` 0건 | PASS |
| 18 | 초기 비번으로 되돌린 뒤 `GET /admin/me` | `passwordIsInitial:false` (영구 false — 9.3-6) | PASS |
| 19 | **로그 유출 검사** | 서버 로그 전체에 평문·`$argon2` 문자열 **없음**. 기록된 라인: `{"route":"admin-password-change","method":"session","sessionsRevoked":2,"msg":"admin password changed"}` | PASS |

**계약 개정 1 (401 code 분리) 실측:**

| 케이스 | 실응답 | 판정 |
|---|---|---|
| 인증 수단 무효 (쿠키 없음) | `401` `{"error":{"code":"UNAUTHORIZED","message":"관리자 인증에 실패했습니다."}}` | PASS |
| 인증 유효 + `currentPassword` 불일치 | `401` `{"error":{"code":"INVALID_CREDENTIALS","message":"현재 비밀번호가 일치하지 않습니다."}}` | PASS |
| 로그인 오답 (다른 엔드포인트) | `401` `UNAUTHORIZED` 유지 — `INVALID_CREDENTIALS` 는 `/admin/password` 전용 | PASS |

**방어 경로·부수 기능 실측:**

| 케이스 | 실응답 | 판정 |
|---|---|---|
| #0 rate limit (loginLimiter 공유) | 분 창 5회 초과 시 `429` + `retry-after: 60` + `{"error":{"code":"RATE_LIMITED",…}}` | PASS |
| `admin_credentials` 행 삭제 후 `GET /admin/me` | `200 passwordIsInitial:true` + 경고 로그 `{"route":"admin-credentials","result":"row-missing-fallback-to-env"}` — **로그인 안 깨짐** | PASS |
| 행 부재 상태로 재기동 | `ensureSeeded` 가 재시드 (`updated_at` NULL) | PASS |
| `scripts/set-password.mjs` | `관리자 비밀번호를 재설정했습니다. changedAt=2026-08-17T00:27:27.496Z sessionsRevoked=2` → 기존 세션 `401`, 새 비번 로그인 `200` (**재기동 없이**) | PASS |
| `set-password.mjs` 11자 입력 | `비밀번호는 12자 이상이어야 합니다.` (exit 1) | PASS |
| 마이그레이션 미적용 상태 기동 | exit 1 + 조치 안내 메시지 (9.3-1) | PASS |

**기존 엔드포인트 회귀 (하위 호환):** `GET /guestbook` 200 / `GET /posts?category=notice` 200 + `X-Total-Count` / `GET /posts` (category 누락) 400 / `GET /admin/posts` Bearer 200·무인증 401 / `POST /admin/logout` 200 / `GET /health` 200 — 전부 이전과 동일.

**품질:** `npm run typecheck` (strict, `noUncheckedIndexedAccess`·`exactOptionalPropertyTypes` 포함) 통과, `npm run build` 통과.

### 9.5 프로덕션 배포 절차

전제 (리더 실측, 2026-08-17): 컨테이너 `koscomlabor-api`/`koscomlabor-db`/`koscomlabor-web` 가동 중, 프로덕션 DB 는 마이그레이션 0000–0002 까지만 적용, `admin_credentials` 없음. 배치 경로 `/root/koscomlabor-api/` (compose + `app/` + `.env`).

> **순서 고정 — 마이그레이션이 API 재기동보다 먼저.** 반대로 하면 API 가 시드 실패로 기동을 거부한다 (9.3-1). 아래 순서를 지키면 무중단에 가깝다 (api 재생성 몇 초).

```bash
# ① 로컬에서 소스 동기화
rsync -az --delete --exclude node_modules --exclude dist --exclude .env \
  server/ root@101.79.31.30:/root/koscomlabor-api/app/

# ② 서버에서 — 백업 먼저 (롤백 대비)
ssh root@101.79.31.30
cd /root/koscomlabor-api
docker exec koscomlabor-db pg_dump -Fc -U guestbook_app guestbook > /root/backups/pre_pwchange_$(date +%Y%m%d_%H%M).dump

# ③ 마이그레이션 이미지 재빌드 후 적용 (profile 서비스는 일반 build 대상이 아님 — §7.3-2)
docker compose --profile tools build migrate
docker compose --profile tools run --rm migrate      # 1755300000003 적용

# ④ 적용 확인
docker exec koscomlabor-db psql -U guestbook_app -d guestbook -c '\d admin_credentials'

# ⑤ API 이미지 재빌드 + 재기동 (이때 .env 의 ADMIN_PASSWORD_HASH 로 1회 시드된다)
docker compose build api
docker compose up -d api

# ⑥ 기동·시드 확인
docker logs --tail 30 koscomlabor-api                # "Server listening" — 시드 실패 메시지 없어야 함
docker exec koscomlabor-db psql -U guestbook_app -d guestbook \
  -c 'SELECT id, seeded_at, updated_at FROM admin_credentials;'   # updated_at 은 NULL 이 정상
docker exec onnuri-caddy wget -qO- http://koscomlabor-api:3001/health
```

**⑦ 스모크 (프로덕션):** `POST /admin/login` → `GET /admin/me` 에 `passwordIsInitial:true` 확인 → 잘못된 `currentPassword` 로 `401 INVALID_CREDENTIALS` 확인. **프로덕션에서 실제 비밀번호 변경까지 수행할지는 리더 판단** (수행하면 그 시점부터 `.env` 의 해시는 무의미해지고 배너가 사라진다).

**주의:**
- `.env` 의 `ADMIN_PASSWORD_HASH` 는 **지우지 말 것**. 필수 환경변수로 남아 있고(설정 누락 조기 감지), 행 부재 시 폴백에도 쓰인다. 다만 시드 이후에는 이 값을 바꿔도 실제 비밀번호는 바뀌지 않는다
- 프론트(web) 배포는 별도. `passwordIsInitial` 을 소비하는 UI 와 `INVALID_CREDENTIALS` → `invalid-credentials` reason 등록이 web-developer 작업이며, **API 를 먼저 배포해도 구버전 프론트는 정상 동작**한다 (필드 추가일 뿐이고 기존 필드 불변)

### 9.6 롤백

| 상황 | 조치 |
|---|---|
| 코드만 되돌림 (테이블 유지) | 이전 이미지로 `docker compose up -d api`. `admin_credentials` 가 남아 있어도 구버전 코드는 이 테이블을 읽지 않고 `.env` 해시로 인증하므로 **동작한다**. 단 그 사이 비밀번호를 바꿨다면 `.env` 의 구 비밀번호로 되돌아간다 |
| 스키마까지 되돌림 | `docker compose --profile tools run --rm migrate npx node-pg-migrate down -m migrations --migration-file-language sql` → `DROP TABLE admin_credentials` (로컬 왕복 검증 완료). **변경된 비밀번호는 소멸**하고 `.env` 해시가 다시 유일한 진실이 된다 |
| DB 손상 | ②에서 뜬 `pre_pwchange_*.dump` 로 `pg_restore --clean --if-exists` (2.5절 복구 절차) |

`admin_credentials` 는 신규 테이블이므로 기존 데이터(방명록·게시물·첨부)에는 어떤 영향도 없다.

### 9.7 비밀번호 분실 복구 절차 (운영 매뉴얼)

관리자가 비밀번호를 잊었을 때. **API 컨테이너 재기동 불필요, 서비스 중단 없음.**

```bash
ssh root@101.79.31.30
cd /root/koscomlabor-api

# 평문이 셸 히스토리에 남지 않도록 stdin 으로만 전달한다
umask 077
read -rs NEWPW              # 화면에 표시되지 않음 (12자 이상)
printf '%s' "$NEWPW" | docker compose --profile tools run --rm -T migrate \
  node scripts/set-password.mjs
unset NEWPW
```

출력 예: `관리자 비밀번호를 재설정했습니다. changedAt=… sessionsRevoked=N`

- `migrate` 서비스(build 스테이지)를 재사용하는 이유: 전체 의존성(`pg`, `argon2`)과 `scripts/`, `DATABASE_URL` 이 이미 갖춰져 있다. `-T` 는 stdin 파이프용(TTY 할당 끄기)
- **부수 효과: 모든 기기의 세션이 무효화**된다 (재로그인 필요). 정적 `ADMIN_API_TOKEN` 은 영향 없음
- 실행 후 `passwordIsInitial` 은 false 가 된다 (경고 배너 사라짐)
- 최후의 수단(스크립트도 못 쓸 때): `DELETE FROM admin_credentials WHERE id = 1;` 후 API 재기동 → `.env` 의 해시로 재시드된다. **`WHERE id = 1` 을 반드시 붙일 것**

### 9.8 미결 사항

- 프로덕션 적용은 리더가 수행 (이 작업 범위는 코드·마이그레이션·문서까지)
- 프론트 대응(`passwordIsInitial` 배너 + 변경 폼 + `http.ts` 의 `invalid-credentials` reason 등록)은 web-developer 영역. **`CODE_TO_REASON` 미등록 시 `INVALID_CREDENTIALS` 가 `network` 로 오분류되어 잘못된 문구가 뜬다** — 배포 전 확인 필요
  - **해소 (QA 11회차 실측):** `src/lib/api/http.ts:82` 에 등록 확인됨. 오분류 경로 없음.

### 9.9 리더 후속 조치 (2026-08-17, QA 11회차 권고 반영)

QA 판정은 **통과(실패 0)** 였고, 권고 4건에 대한 리더 처리는 다음과 같다.

| 권고 | 처리 | 내용 |
|------|------|------|
| R1 폴백 절반 구현 | **코드 수정** | `repos/credentials.ts` 의 `update()` 를 순수 `UPDATE` → **UPSERT** 로 교체 |
| R2 계약 문언 부정확 | **문서 수정** | 계약 문서에 "개정 2" 추가 — 판정 기준은 인증 헤더가 아니라 유효 세션 쿠키 유무 |
| R3 03 문서 기록 낡음 | **문서 수정** | `03_developer_impl.md` §17 에 종결 후속 기록 추가 |
| R4 rate limit 잠김 | **운영 안내 추가** | 아래 참조 |

**R1 상세.** `getActive()` 는 행 부재 시 env 해시로 폴백하지만 `update()` 는 `WHERE id = 1` 이라
같은 상황에서 0행 → 500 이 되어 **폴백이 절반만 동작**했다. `set-password.mjs` 와 동일한
UPSERT 문장으로 교체해 자가 치유시켰다. 대상은 여전히 단일 행(id = 1)이므로 "대상 특정 필수"
규칙에 부합한다. 이에 따라 §9.7 의 최후 수단도 정정한다 — `DELETE FROM admin_credentials
WHERE id = 1` 후에는 **재기동 없이도** env 해시로 로그인되고(폴백), 그 상태에서 비밀번호를
변경하면 행이 UPSERT 로 다시 생성된다. 재기동은 선택 사항이다.

**R4 운영 안내 — 로그인 잠김 시 대처.**
`loginLimiter` 는 `POST /admin/login` 의 **성공·실패 전 시도**와 `POST /admin/password` 의
**현재 비밀번호 오입력**을 같은 IP 버킷(분당 5회 / 시간당 10회)에 누적한다. 따라서
"로그인 1회 + 비밀번호 오타 4회" 만으로 429 가 되고, 이때 **복구용 Bearer 경로도 함께 막힌다**
(`/admin/*` 은 별도로 `adminLimiter` 분당 10회도 적용).

- 정상 대처: `Retry-After` 헤더의 초만큼 대기한다 (최대 1시간 버킷까지 고려)
- 급할 때: rate limit 은 **프로세스 메모리**에만 있으므로 `docker compose restart api` 로 즉시 초기화된다
  (DB·세션·비밀번호에는 영향 없음. 단 진행 중 요청이 끊기므로 관리자 작업이 없을 때 수행)
- 이 동작은 무차별 대입 방어의 의도된 결과이며 계약 준수 사항이다 (완화하려면 계약 변경 필요)

### 9.10 프로덕션 적용 기록 (2026-08-17, 리더 수행)

커밋 `28bbfb5`. §9.5 절차를 그대로 따랐고 편차 없음.

| 단계 | 결과 |
|------|------|
| ① rsync `server/` → `/root/koscomlabor-api/app/` | 완료 (`--exclude node_modules,dist,.env,uploads`) |
| ② DB 백업 | `/root/backups/pre_pwchange_20260817_1011.dump` (10,592 bytes) |
| ③ `--profile tools build migrate` → `run --rm migrate` | `1755300000003_create-admin-credentials` 적용 |
| ④ 스키마 확인 | `CHECK (id = 1)` 제약 포함 생성 확인 |
| ⑤ `build api` → `up -d api` | Recreated → Started (db healthy 대기 후) |
| ⑥ 기동·시드 확인 | 시드 실패 메시지 없음. `admin_credentials` 1행, `seeded_at=2026-08-17 01:12:16+00`, `updated_at=NULL` |
| ⑦ 스모크 (`https://union-api.koscomlabor.cloud`) | 아래 |
| ⑧ 웹 배포 | `git push origin main` → CI 성공 → Deploy Web run `31984390279` 성공 |

**⑦ 스모크 실측 (프로덕션):**

```
POST /admin/login  (초기 비밀번호)  → 200 {"ok":true,"expiresAt":"2026-08-17T13:13:17.688Z"}
GET  /admin/me                      → 200 {"ok":true,"method":"session",...,"passwordIsInitial":true}
POST /admin/password (틀린 current) → 401 {"error":{"code":"INVALID_CREDENTIALS",
                                              "message":"현재 비밀번호가 일치하지 않습니다."}}
POST /admin/logout                  → 200
```

**시드 무결성 확인이 이번 배포의 핵심 관문이었다** — env→DB 전환 후에도 기존 초기 비밀번호로
로그인이 되는가. 200 으로 확인됐다(관리자 잠김 없음). 스모크용 세션은 로그아웃으로 정리했고,
남은 세션 3건은 배포 이전부터 존재하던 것으로 이번 작업과 무관하다.

**웹 번들 검증:** `https://koscomlabor.cloud/admin` 200, 참조 청크 9개를 내려받아 신규 문자열
전수 확인 — `초기 비밀번호를 사용 중입니다`, `다른 기기의 로그인 ${n}건이 해제되었습니다`,
`admin/password`, `invalid-credentials`, `INVALID_CREDENTIALS`, `passwordIsInitial` 모두 존재.

**프로덕션에서 비밀번호 변경은 수행하지 않았다** — 새 비밀번호는 사용자가 정할 값이다.
`passwordIsInitial` 이 `true` 이므로 관리 화면에 경고 배너가 떠 있다. 사용자가 UI 에서 변경한
뒤 `/root/koscomlabor-api/ADMIN_PASSWORD.initial` 을 삭제하면 된다.

## 10. 게시물 세 번째 분류 `education`(노동교육) 추가 (2026-08-17) — 구현 완료, **프로덕션 미적용**

근거: `_workspace/00_input/requirements-home-sections.md` "노동교육 요건 개정". 명세는 06 §19.
**이 작업 범위는 서버·DB·문서까지이고, 프로덕션 적용은 리더가 수행한다** (§10.5 절차).

### 10.1 변경 파일

| 파일 | 변경 |
|------|------|
| `server/migrations/1755300000004_add-education-category.sql` | **신규.** `posts_category_check` 를 DROP → 3값으로 ADD. Down 은 2값으로 복원 |
| `server/src/lib/postValidate.ts` | 분류 **단일 출처** 신설 (`POST_CATEGORIES`/`PostCategory`/`isPostCategory`/에러 문구 2종). `PostInput.category` 를 `PostCategory` 로. 검증부를 `isPostCategory` 로 교체 |
| `server/src/routes/posts.ts` | 공개 목록 category 검증 → `isPostCategory` + `POST_CATEGORY_REQUIRED_ERROR` |
| `server/src/routes/admin.ts` | admin 목록 category 검증 → `isPostCategory` + `POST_CATEGORY_ERROR`, 지역 타입 `PostCategory \| null` |
| `server/src/repos/posts.ts` | 타입 시그니처 4곳 (`PostSummaryRow`·`DbPostRow`·`listPublic`·`listAdmin`) → `PostCategory` |
| `_workspace/06_backend_api_spec.md` | §10.1·§11.1·§11.4·§13.1 갱신, §19 신설, 개정 이력 |

**프론트(`src/`)는 건드리지 않았다** — web-developer 병렬 작업 영역.

### 10.2 `notice`/`news` 하드코딩 전수 조사

`grep -rn "notice" server/src` + `grep -rn "news" server/src` 로 **12곳 전부** 확인·수정했다.
한 곳이라도 빠지면 "등록은 되는데 목록에 안 나오는" 부분 고장이 되므로, 개별 수정 대신
**리터럴을 한 곳으로 모으고 나머지를 파생**시켰다 (06 §19.4).

| 파일:라인(수정 전) | 내용 | 처리 |
|---|---|---|
| `lib/postValidate.ts:7` | `PostInput.category` 타입 | `PostCategory` |
| `lib/postValidate.ts:52` | 생성·수정 검증 조건 | `isPostCategory()` |
| `lib/postValidate.ts:53` | 에러 문구 | `POST_CATEGORY_ERROR` (3값 나열) |
| `lib/postValidate.ts:112` | `category === "news" && type === "article"` 출처 강제 | **의도적 유지** (06 §19.2) |
| `routes/posts.ts:113` | 공개 목록 쿼리 검증 | `isPostCategory()` |
| `routes/posts.ts:116` | 에러 문구 `…notice 또는 news…(필수)` | `POST_CATEGORY_REQUIRED_ERROR` |
| `routes/admin.ts:320` | 지역 변수 타입 | `PostCategory \| null` |
| `routes/admin.ts:322` | admin 목록 쿼리 검증 | `isPostCategory()` |
| `routes/admin.ts:323` | 에러 문구 | `POST_CATEGORY_ERROR` |
| `repos/posts.ts:18` | `PostSummaryRow.category` | `PostCategory` |
| `repos/posts.ts:41` | `DbPostRow.category` | `PostCategory` |
| `repos/posts.ts:124` | `listPublic(category)` | `PostCategory` |
| `repos/posts.ts:163` | `listAdmin(category)` | `PostCategory \| null` |

수정 후 재조사 결과 `server/src` 에 남은 분류 리터럴은 **`POST_CATEGORIES` 배열 선언 1줄과
news 출처 규칙 1줄뿐**이다 (둘 다 의도된 것).

### 10.3 제약 이름 — 추측하지 않고 실측했다

0001 은 `category` 에 **이름 없는 인라인 CHECK** 를 썼으므로 이름은 PostgreSQL 이 자동 생성한다.
로컬 전용 DB(`edu_check`)에 0001–0003 을 올린 뒤 조회해 확정했다.

```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'posts'::regclass AND contype = 'c';
-- posts_category_check | CHECK ((category = ANY (ARRAY['notice'::text, 'news'::text])))
```

교체 후에도 **같은 이름을 유지**했다 (up→down 왕복 시 스키마가 원본과 완전히 동일해지도록).
`DROP CONSTRAINT` 에 `IF EXISTS` 를 **쓰지 않았다** — 이름이 다르면 크게 실패해야 한다.
`IF EXISTS` 였다면 구 제약이 남은 채 새 제약만 추가돼 education INSERT 가 계속 거부되는
부분 고장이 된다. 마이그레이션은 트랜잭션이므로 실패해도 DB 는 무변경이다.

**변경하지 않은 것** (확인만):
- `posts_news_article_needs_source` — 조건이 `category = 'news'` 로 한정돼 education 에 무관. 존치 근거는 06 §19.2
- `posts_link_needs_url` / `posts_article_needs_body` — `type` 만 보므로 education 에도 올바르게 적용
- `idx_posts_list (category, urgent DESC, published_at DESC, id DESC) WHERE deleted_at IS NULL` — `pg_indexes` 로 정의 무변경 확인. 분류 추가는 컬럼값 도메인이 넓어질 뿐이라 인덱스와 무관

### 10.4 로컬 실측 (2026-08-17, macOS + PostgreSQL 16.15 + Node 26) — 전 케이스 PASS

**검증 환경 격리**: 개발 DB `guestbook` 을 오염시키지 않으려고 전용 DB `edu_check` 를 만들어
검증하고 끝나고 drop 했다. `server/.env` 도 수정하지 않고 스크래치패드에 별도 env 파일
(포트 3399, 일회용 시크릿)을 만들어 썼다. 종료 후 `dropdb edu_check` 완료, `guestbook` 무변경 확인.

**① 마이그레이션 up / down 왕복**

```
$ node --env-file=<scratch>/edu.env node_modules/node-pg-migrate/bin/node-pg-migrate.js \
    up -m migrations --migration-file-language sql
### MIGRATION 1755300000004_add-education-category (UP) ###   → Migrations complete!

$ psql -d edu_check -tA -c "SELECT pg_get_constraintdef(oid) FROM pg_constraint
                             WHERE conname='posts_category_check';"
CHECK ((category = ANY (ARRAY['notice'::text, 'news'::text, 'education'::text])))
```

| 케이스 | 기대 | 실측 | 판정 |
|---|---|---|---|
| UP 적용 | 제약 3값 | 위 출력 | PASS |
| 다른 CHECK 4종 | 무변경 | `posts_article_needs_body`·`posts_link_needs_url`·`posts_news_article_needs_source`·`posts_type_check` 정의 동일 | PASS |
| `idx_posts_list` | 무변경 | 정의 문자열 동일 | PASS |
| **education 행이 남은 상태에서 DOWN** | **실패해야 함** | `ERROR: check constraint "posts_category_check" of relation "posts" is violated by some row` → 롤백, 제약·`pgmigrations` 무변경 | PASS (위험 재현 확인) |
| education 행 정리 후 DOWN | 2값으로 복원 | `CHECK ((category = ANY (ARRAY['notice'::text, 'news'::text])))` | PASS |
| DOWN 상태에서 education INSERT | DB 거부 | `ERROR: new row for relation "posts" violates check constraint "posts_category_check"` | PASS |
| 재 UP | 3값 복귀 | 동일 | PASS |

**② education CRUD (curl 원문)**

```bash
API=http://127.0.0.1:3399
AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

# [C1] 생성 — 링크형, source 없음
curl -s -X POST "$API/admin/posts" "${AUTH[@]}" \
  -d '{"category":"education","type":"link","title":"노동교육 영상 1",
       "url":"https://www.youtube.com/watch?v=EDUTEST01"}'
201 {"id":"fd7fd831-40a2-4bdb-a2f9-9672f8ab194d","category":"education","type":"link",
     "title":"노동교육 영상 1","url":"https://www.youtube.com/watch?v=EDUTEST01","source":null,
     "urgent":false,"deadline":null,"publishedAt":"2026-08-17T04:46:58.212Z","attachments":[],
     "body":null,"createdAt":"2026-08-17T04:46:58.212Z","updatedAt":"2026-08-17T04:46:58.212Z",
     "deletedAt":null}

# [C2] 공개 목록
curl -s -D- "$API/posts?category=education"
HTTP/1.1 200 OK   x-total-count: 1
[{"id":"fd7fd831-…","category":"education","type":"link","title":"노동교육 영상 1",
  "url":"https://www.youtube.com/watch?v=EDUTEST01","source":null,"urgent":false,
  "deadline":null,"publishedAt":"2026-08-17T04:46:58.212Z","attachments":[]}]

# [C3] 공개 상세
curl -s "$API/posts/fd7fd831-…"
200 {… ,"attachments":[],"body":null}

# [C4] admin 목록
curl -s -D- -H "Authorization: Bearer $TOKEN" "$API/admin/posts?category=education"
HTTP/1.1 200 OK   x-total-count: 1   (createdAt/updatedAt/deletedAt 포함)

# [C5] 수정 (관리자가 직접 고칠 수 있어야 한다는 요구의 핵심)
curl -s -X PATCH "$API/admin/posts/fd7fd831-…" "${AUTH[@]}" \
  -d '{"title":"노동교육 영상 1 (수정)","url":"https://www.youtube.com/watch?v=EDUTEST02"}'
200 {… "title":"노동교육 영상 1 (수정)","url":"https://www.youtube.com/watch?v=EDUTEST02",
     "publishedAt":"2026-08-17T04:46:58.212Z",   ← 불변
     "updatedAt":"2026-08-17T04:47:20.700Z"}     ← 갱신

# [C6] 분류 전환 education → notice → education
curl -s -X PATCH … -d '{"category":"notice"}'      200 (category:"notice")
curl -s -X PATCH … -d '{"category":"education"}'   200

# [C15] 정렬 (urgent 우선 → publishedAt DESC)
curl -s "$API/posts?category=education"
  urgent=true  2026-08-17T04:47:54.600Z 자체 제작 교육자료
  urgent=false 2026-08-17T04:46:58.212Z 노동교육 영상 1 (수정)

# [C16] soft delete
curl -s -X DELETE "$API/admin/posts/fd7fd831-…" -H "Authorization: Bearer $TOKEN"
200 {"deleted":true,"id":"fd7fd831-…"}
curl -s -D- "$API/posts?category=education"   → x-total-count: 1  (2건 중 1건으로 감소)
curl -s "$API/posts/fd7fd831-…"               → 404 {"error":{"code":"NOT_FOUND", …}}
curl -s -H "Authorization: Bearer $TOKEN" "$API/admin/posts?category=education"
  자체 제작 교육자료      deletedAt=null
  노동교육 영상 1 (수정)  deletedAt=2026-08-17T04:48:10.579Z     ← admin 에는 남음
curl -s -X DELETE …(재삭제)  → 404 "해당 게시물이 없거나 이미 삭제되었습니다."
```

**③ 잘못된 category 거부 (6종)**

```
GET  /posts?category=edu       → 400 {"error":{"code":"VALIDATION_ERROR",
                                   "message":"category 는 notice, news, education 중 하나여야 합니다 (필수)."}}
GET  /posts  (category 누락)   → 400 동일 문구
GET  /posts?category=page      → 400 동일 문구   ← page 는 파일 기반 전용, DB 분류 아님
GET  /admin/posts?category=edu → 400 {"…":"category 는 notice, news, education 중 하나여야 합니다."}  ((필수) 없음)
POST /admin/posts category=edukation → 400 동일
POST /admin/posts category 누락      → 400 동일
```

**④ education 의 제약 대칭성**

| 케이스 | 기대 | 실측 | 판정 |
|---|---|---|---|
| education + link + url 누락 | 400 | `링크형 게시물은 url 이 필수입니다.` | PASS |
| **education + article + source 없음** | **201 허용** | 201 생성 (`source:null`) | PASS (06 §19.2 결정대로) |
| news + article + source 없음 | 400 유지 | `금융노조 소식(작성형)은 출처(source)가 필수입니다.` | PASS (회귀 없음) |

**⑤ 기존 notice/news 회귀**

```
POST /admin/posts (notice+article, source 없이, urgent/deadline 포함) → 201  (기존과 동일하게 허용)
GET  /posts?category=notice               → 200  x-total-count: 1
GET  /posts?category=notice&urgent=true   → 200  x-total-count: 1
GET  /posts?category=news                 → 200  x-total-count: 0
GET  /admin/posts        (분류 미지정)     → 200  x-total-count: 3   ← 전 분류 합산, education 포함
GET  /admin/posts?category=notice          → 200  x-total-count: 1
GET  /guestbook                            → 200
GET  /admin/posts (무인증)                 → 401
```

**⑥ 품질**: `npm run typecheck` (strict, `noUncheckedIndexedAccess`·`exactOptionalPropertyTypes`) 통과,
`npm run build` 통과.

### 10.5 프로덕션 배포 절차

전제: `/root/koscomlabor-api/` (compose + `app/` + `.env`), 프로덕션 DB 는 마이그레이션
0000–0003 까지 적용된 상태(§9.10). 이번엔 **신규 테이블이 아니라 기존 테이블의 제약 교체**다.

> **순서 고정 — 마이그레이션이 API 재기동보다 먼저.** 반대로 하면 새 API 가 education 을 받아
> 놓고 DB 가 거부해 500 이 난다. 아래 순서면 무중단에 가깝다 (api 재생성 몇 초).
> `ALTER TABLE … ADD CONSTRAINT` 는 기존 행 전체를 검증하지만 posts 는 소규모라 즉시 끝난다.

```bash
# ① 로컬에서 소스 동기화
rsync -az --delete --exclude node_modules --exclude dist --exclude .env --exclude uploads \
  server/ root@101.79.31.30:/root/koscomlabor-api/app/

# ② 서버에서 — 백업 먼저 (롤백 대비)
ssh root@101.79.31.30
cd /root/koscomlabor-api
docker exec koscomlabor-db pg_dump -Fc -U guestbook_app guestbook \
  > /root/backups/pre_education_$(date +%Y%m%d_%H%M).dump

# ②-1 **제약 이름 사전 확인 (이번 배포 고유 관문 — 반드시 수행)**
#     posts_category_check 가 아니면 ③이 실패한다. 그때는 적용을 멈추고 리더에게 보고할 것.
docker exec koscomlabor-db psql -U guestbook_app -d guestbook -c \
  "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conrelid='posts'::regclass AND contype='c' ORDER BY conname;"
# 기대: posts_category_check | CHECK ((category = ANY (ARRAY['notice'::text, 'news'::text])))

# ③ 마이그레이션 이미지 재빌드 후 적용 (profile 서비스는 일반 build 대상이 아님 — §7.3-2)
docker compose --profile tools build migrate
docker compose --profile tools run --rm migrate      # 1755300000004 적용

# ④ 적용 확인 — 3값이 됐는지
docker exec koscomlabor-db psql -U guestbook_app -d guestbook -tAc \
  "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='posts_category_check';"
# 기대: CHECK ((category = ANY (ARRAY['notice'::text, 'news'::text, 'education'::text])))

# ⑤ API 이미지 재빌드 + 재기동
docker compose build api
docker compose up -d api

# ⑥ 기동 확인
docker logs --tail 30 koscomlabor-api                # "Server listening"
docker exec onnuri-caddy wget -qO- http://koscomlabor-api:3001/health
```

**⑦ 스모크 (프로덕션).** 생성한 id 를 반드시 기록해 두었다가 `WHERE id IN (...)` 로 정리한다
(조건 없는 DELETE 금지 — CLAUDE.md 규칙).

```
GET  /posts?category=education            → 200 [] + X-Total-Count: 0   (아직 데이터 없음)
GET  /posts?category=edu                  → 400 "…notice, news, education 중 하나여야 합니다 (필수)."
GET  /posts?category=notice               → 200 (기존 건수 그대로 — 회귀 없음)
GET  /posts?category=news                 → 200 (기존 건수 그대로)
POST /admin/posts (education 1건)         → 201  ← id 기록
GET  /posts?category=education            → 200 1건
DELETE /admin/posts/<기록한 id>            → 200
```

**주의:**
- **초기 데이터(노동교육 링크 5건)는 이 작업에 포함되지 않는다.** fact-verifier 검증 게이트를
  통과 중이며, **승인된 건만** 리더가 별도로 등록한다
- **배포 순서는 API → 프론트.** 반대로 하면 신버전 프론트가 `category=education` 을 요청하는데
  구버전 API 가 400 을 준다. API 를 먼저 배포해도 **구버전 프론트는 정상 동작**한다 —
  구버전 프론트는 notice/news 만 요청하므로 education 이 그 파서에 도달할 경로가 없다 (06 §19.3)
- 프론트의 `PostCategory` 확장·`/education/[id]` 라우트·admin 분류 선택지는 web-developer 영역

### 10.6 롤백

| 상황 | 조치 |
|---|---|
| 코드만 되돌림 (제약은 3값 유지) | 이전 이미지로 `docker compose up -d api`. 구버전 코드는 education 을 받지 않을 뿐이고 **DB 는 넓은 제약이라 문제없다.** 단 이미 등록된 education 게시물은 조회 경로가 사라져 admin 목록(분류 미지정)에만 보인다 |
| **스키마까지 되돌림** | **education 게시물을 먼저 정리해야 한다.** 아래 참조 |
| DB 손상 | ②의 `pre_education_*.dump` 로 `pg_restore --clean --if-exists` (2.5절) |

**스키마 롤백이 그냥 되지 않는 이유 (실측 확인).** CHECK 제약은 soft delete 여부와 무관하게
**테이블의 모든 행**에 적용된다. `category='education'` 인 행이 하나라도 남아 있으면
(`deleted_at` 이 채워진 행 포함) down 마이그레이션이

```
ERROR: check constraint "posts_category_check" of relation "posts" is violated by some row
```

로 실패한다. 트랜잭션이므로 **DB 는 무변경으로 안전**하지만 롤백은 진행되지 않는다.

```bash
# ① 대상 확인 (필수 — 건수를 먼저 보고한다)
docker exec koscomlabor-db psql -U guestbook_app -d guestbook -c \
  "SELECT id, title, deleted_at FROM posts WHERE category = 'education';"

# ② 보존이 필요하면 백업을 먼저 뜬다 (education 행은 이 시점에 소멸한다)
docker exec koscomlabor-db pg_dump -Fc -U guestbook_app guestbook \
  > /root/backups/pre_education_rollback_$(date +%Y%m%d_%H%M).dump

# ③ 첨부가 달려 있으면 FK 때문에 ④가 막히므로 첨부부터 (WHERE 절 필수)
docker exec koscomlabor-db psql -U guestbook_app -d guestbook -c \
  "DELETE FROM post_attachments WHERE post_id IN (SELECT id FROM posts WHERE category = 'education');"

# ④ education 게시물 삭제 (WHERE 절 필수 — 조건 없는 DELETE 금지)
docker exec koscomlabor-db psql -U guestbook_app -d guestbook -c \
  "DELETE FROM posts WHERE category = 'education';"

# ⑤ down 마이그레이션
docker compose --profile tools run --rm migrate \
  npx node-pg-migrate down -m migrations --migration-file-language sql
```

기존 notice/news 데이터·방명록·첨부에는 어떤 영향도 없다 (제약 도메인만 좁아진다).

### 10.7 미결 사항

- **프로덕션 적용은 리더가 수행** (이 작업 범위는 코드·마이그레이션·문서까지). 프로덕션에 쓰기 작업 없음
- 노동교육 초기 데이터 5건은 **fact-verifier 승인 후 리더가 등록**. 백엔드는 스키마·검증·명세까지만
- 프론트 대응(`PostCategory` 3값 확장 + `parsePostSummary` 판정, `/education/[id]` 라우트,
  admin `PostForm` 분류 선택지, 메인 노동교육 섹션)은 web-developer 영역. **프론트가
  `education` 을 파서에 등록하지 않으면 목록 응답 전체가 `invalidResponse` 로 떨어진다** —
  QA 는 `src/lib/api/posts.ts` 의 `parsePostSummary` 조건절을 반드시 교차 확인할 것
