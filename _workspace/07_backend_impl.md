# 07. 방명록 백엔드 구현 요약 · 배포 기록 (Docker/NCP VM)

작성일: 2026-08-16 (공개 배포 반영 갱신) | 작성자: backend-developer | 기준 명세: `_workspace/06_backend_api_spec.md`
상태: **API 공개 완료 — https://union-api.koscomlabor.cloud (TLS 유효, 스모크 통과). 프론트 배포는 6절**
최신 작업: **§11 수동 정렬(`sort_order`) + YouTube 썸네일 서버 캐싱 — 구현·로컬 실측 완료, 프로덕션 미적용**

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

### 10.8 프로덕션 적용 기록 (2026-08-17, 리더 수행)

커밋 `b9795cc`. §10.5 절차를 그대로 따랐고 편차 없음.

| 단계 | 결과 |
|------|------|
| **②-1 사전 관문** | 프로덕션 `pg_constraint` 조회 → `posts_category_check` **이름 일치 확인**. 불일치면 중단할 지점이었다 |
| ① rsync `server/` → `app/` | 완료 |
| ② DB 백업 | `/root/backups/pre_education_20260817_1704.dump` (11,969 bytes) |
| ③④ migrate 재빌드 → 적용 | `1755300000004_add-education-category` 적용 |
| ⑤ 제약 반영 확인 | `CHECK (category = ANY (ARRAY['notice','news','education']))` |
| ⑥ API 재빌드 + 재기동 | Recreated → Started (db healthy 대기 후) |
| ⑦ 기동 확인 | Server listening, `/health` 200, 오류 로그 없음 |

**⑧ 스모크 실측 (`https://union-api.koscomlabor.cloud`):**

```
GET /posts?category=education → 200, X-Total-Count: 0   ← 적용 전에는 400 이었다
GET /posts?category=edu       → 400 "category 는 notice, news, education 중 하나여야 합니다 (필수)."
GET /posts?category=notice    → 200, X-Total-Count: 0   (회귀 없음)
GET /posts?category=news      → 200, X-Total-Count: 1   (회귀 없음)
GET /guestbook                → 200                     (회귀 없음)
GET https://koscomlabor.cloud/ → 200                     (구버전 프론트 정상)
```

**API 를 프론트보다 먼저 배포한 근거가 실측으로 확인됐다** — 구버전 프론트는 `notice|news`
만 요청하므로 education 이 그 파서에 도달할 경로가 없다(§10.7 리스크는 신버전 프론트에만 적용).

**초기 데이터 5건은 아직 등록하지 않았다.** 프론트(노동교육 섹션) 배포 후 등록한다 —
등록 데이터·근거는 `_workspace/00_input/decision-education-content.md`.

### 10.9 노동교육 초기 데이터 등록 기록 (2026-08-17, 리더 수행)

프론트 배포(커밋 `184a81f`, Deploy Web run `32015364403`) 완료 후 등록했다.
등록 데이터·근거: `_workspace/00_input/decision-education-content.md`
최종 대조 결과: `_workspace/05_verifier_final.md` (통과)

**등록 방식**
- API 컨테이너 **내부**에서 `POST /admin/posts` 5회. 인증은 `ADMIN_API_TOKEN`(정적 Bearer).
  토큰은 컨테이너 환경변수에 이미 있어 **밖으로 꺼내지 않았고**, 호출도 `127.0.0.1:3001` 이라
  **외부망을 타지 않았다.** 사용자가 변경한 비밀번호는 사용하지 않았다
- **멱등 장치**: 실행 전 `GET /admin/posts?category=education` 이 0건인지 확인하고 아니면 중단.
  스크립트 재실행으로 5건이 10건이 되는 사고를 막는다
- **등록 순서 = 표시 순서의 역순** (⑤→④→③→②→①). 정렬이 `published_at DESC` 이고
  `publishedAt` 은 서버 자동 기록이라 수정 수단이 없기 때문이다. 건당 **1.1초 간격**을 둬
  같은 밀리초에 몰려 순서가 뒤집히는 것을 막았다

**결과**: 5건 전부 `201`. 공개 API 응답 순서가 의도한 학습 순서와 일치.

**⚠ 운영 주의 — 표시 순서는 취약하다.** 사용자가 admin 에서 노동교육 글을 새로 추가하면
게시일이 최신이므로 **맨 위로 올라가 학습 순서가 깨진다.** 근본 해결(`sort_order` 필드 또는
education 전용 정렬 규칙)은 후속 과제다 (디자이너 스펙 §15.6R-D3).

**후속 점검 항목**
- `오바마 대통령이 말하는 노조` 는 원출처 미표기 개인 채널 재업로드로 **예고 없이 삭제될 수
  있다.** 링크 정기 점검 대상 (fact-verifier §8-#3-3)
- 5건의 자막(캡션) 제공 여부 미확인 (접근성)

## 11. 게시물 수동 정렬 + YouTube 썸네일 서버 캐싱 (2026-08-17) — 구현 완료, **프로덕션 미적용**

근거: `_workspace/00_input/requirements-sort-thumbnail.md` / 확정 계약 `_workspace/00_input/contract-sort-thumbnail.md` §1–§7. 명세는 06 §20.
**이 작업 범위는 서버·DB·스크립트·문서까지이고, 프로덕션 적용은 리더가 수행한다** (§11.7 절차). 프로덕션에 쓰기 작업은 하지 않았다.

### 11.1 변경 파일

| 파일 | 변경 |
|------|------|
| `server/migrations/1755300000005_add-sort-order-and-thumbnail.sql` | **신규.** `sort_order`·`thumbnail_key` 컬럼 추가 + `idx_posts_list` 재생성. Down 은 인덱스 원복 + 컬럼 DROP (데이터 소멸 경고 주석) |
| `server/src/lib/youtubeThumbnail.ts` | **신규.** videoId 추출, 썸네일 취득(SSRF 방어·매직 바이트 검증·변형 폴백), 디스크 캐시, key/URL 규약 단일 출처 |
| `server/src/lib/errors.ts` | `ErrorCode` 에 `CONFLICT` 추가 (근거 주석 + 프론트 미등록 리스크 경고) |
| `server/src/repos/posts.ts` | 정렬 규칙 단일 출처 `ORDER_BY` 상수 신설, 목록 쿼리 2곳 교체, `POST_COLUMNS`·`DbPostRow` 에 컬럼 2개, `thumbnailUrl`(공개)·`sortOrder`(admin) 직렬화, `create`/`update` 에 `thumbnailKey` 인자, **`reorder()` 트랜잭션 신설** |
| `server/src/routes/posts.ts` | 공개 응답 스키마에 `thumbnailUrl` 추가, **`GET /thumbnails/:key` 신설** |
| `server/src/routes/admin.ts` | admin 스키마에 `sortOrder` 추가, `resolveThumbnailKey()` 헬퍼(생성·수정 공용), **`POST /admin/posts/reorder` 신설**, reorder 응답 스키마 |
| `server/scripts/backfill-thumbnails.mjs` | **신규.** 소급 적용(멱등, `--dry-run`, `WHERE id = $1`) |
| `server/Dockerfile` | build·prod 스테이지에 `COPY scripts ./scripts` 추가 (§11.3 — 기존 누락 결함 동시 수정) |
| `_workspace/06_backend_api_spec.md` | §10.1·§11.1·§11.2·§13.1 갱신, **§20 신설**, 개정 이력 |

**프론트(`src/`)는 건드리지 않았다** — web-developer 영역(계약 §8). `_workspace/02·03·04·05` 문서도 읽기만 했다.

### 11.2 계약 대비 차이 (전부 계약을 좁히지 않는 방향의 추가)

| 항목 | 계약 | 구현 | 사유 |
|---|---|---|---|
| videoId 인식 형태 | watch / youtu.be / shorts | + `embed/{id}`, `live/{id}`, `music.youtube.com` | 같은 11자 videoId 체계이고 정규식 관문은 동일하다. 인식 못 하면 썸네일만 없으므로 확장이 무해하다 |
| PATCH 재취득 조건 | "URL 이 바뀌면 재취득" | + `thumbnail_key` 가 NULL 이면 URL 이 같아도 재시도 | 일시적 실패를 관리자가 "다시 저장"만으로 복구할 수 있게 한다. 성공 시에는 재취득하지 않으므로 비용 증가 없음 |
| 타임아웃 | "짧게" | 연결 3초 / 두 변형 합계 6초 | linkPreview 는 8초지만 게시 응답을 붙잡으므로 더 짧게. 양 변형 404 실측 0.38초 |
| 2MB 초과 시 | "폐기" | 폐기 후 **다음 변형 시도** | 계약의 "실패 시 mqdefault" 취지와 일치. mqdefault 가 2MB 를 넘을 일은 없다 |
| 피어 IP 검사 | (없음) | 접속 피어가 공인 IP 인지 확인 | 호스트가 하드코딩이라 SSRF 표면은 0 이지만, `ipGuard` 재사용 6줄로 DNS 오염 시나리오까지 닫힌다 |
| `updated_at` on reorder | (미규정) | **갱신하지 않음** | 순서는 내용이 아니다. 갱신하면 분류 전체의 "최근 수정"이 무의미해진다 |
| 대문자 UUID | (미규정) | 소문자 정규화 후 비교·갱신 | 정규화 없이는 같은 uuid 가 #4 에서 불일치로 오판된다 (PostgreSQL uuid 출력은 항상 소문자) |

계약을 **바꾼 것은 없다.** 위는 모두 계약이 침묵한 지점의 결정이며, 응답 shape·에러 code·상태 코드·문구는 계약과 문자 단위로 일치한다.

### 11.3 `Dockerfile` 의 `scripts/` 누락 — 기존 결함 발견·수정

썸네일 소급 적용 스크립트를 프로덕션에서 실행할 경로를 확인하다가 발견했다.

**문제.** `Dockerfile` 의 build·prod 스테이지가 `src`·`migrations`·`tsconfig.json` 만 COPY 하고 **`scripts/` 를 COPY 하지 않았다.** 따라서 §9.7 에 적어 둔 비밀번호 분실 복구 절차

```bash
printf '%s' "$NEWPW" | docker compose --profile tools run --rm -T migrate node scripts/set-password.mjs
```

는 컨테이너 안에 파일이 없어 `Cannot find module /app/scripts/set-password.mjs` 로 **실패한다.** 프로덕션에서 한 번도 실행된 적이 없어 드러나지 않았다 (§9.10 적용 기록에 이 명령은 없다).

**조치.** build 스테이지(복구 스크립트용)와 prod 스테이지(backfill 용) 양쪽에 `COPY scripts ./scripts` 를 추가했다. 다음 `docker compose build` 로 함께 반영되므로 추가 절차는 없다.

**backfill 은 `migrate` 서비스가 아니라 `api` 컨테이너에서 실행해야 한다.** `migrate` 서비스에는 `uploads` 볼륨이 마운트되어 있지 않아, 거기서 실행하면 썸네일 파일이 컨테이너 임시 파일시스템에 쓰이고 `--rm` 과 함께 **유실**된다(DB 에는 키가 남아 404 가 되는 최악의 조합). `api` 컨테이너는 `uploads` 볼륨·`UPLOAD_DIR`·`DATABASE_URL` 을 모두 갖고 있고 `pg` 는 프로덕션 의존성이다.

### 11.4 `ORDER BY` 전수 조사

`grep -rn "ORDER BY" server/src server/scripts server/migrations` 로 **전수 조사**했다. 한 곳이라도 빠지면 "admin 에서는 순서대로인데 메인은 다른" 부분 고장이 되므로, 개별 수정 대신 **정렬 규칙을 상수 하나로 모으고 목록 쿼리가 그것을 참조**하게 했다.

| 위치(수정 전) | 내용 | 처리 |
|---|---|---|
| `repos/posts.ts:134` | 공개 목록 `urgent DESC, published_at DESC, id DESC` | **`ORDER_BY` 상수로 교체** (신규 규칙) |
| `repos/posts.ts:173` | admin 목록 `published_at DESC, id DESC` | **`ORDER_BY` 상수로 교체** (urgent·sort_order 가 새로 반영됨) |
| `repos/posts.ts:78` | 첨부 목록 `created_at ASC` | **의도적 유지** — 게시물 목록이 아니라 한 게시물의 첨부 표시 순서(업로드 순) |
| `db.ts:40` | 방명록 목록 `created_at DESC, id DESC` | **무관** — posts 테이블이 아니다 (Part 1 계약) |
| (신규) `scripts/backfill-thumbnails.mjs:59` | 소급 적용 처리 순서 | 표시 순서와 무관한 배치 처리 순서 |

**게시물 목록 쿼리는 위 2곳이 전부다.** 마감 스트립은 별도 쿼리 없이 프론트가 `GET /posts` 결과에서 파생한다 (`src/app/page.tsx:72` → `selectUpcomingDeadlines`, `src/components/home/DeadlineStrip.tsx` — 읽기 확인). 따라서 서버 정렬 규칙 하나로 마감 스트립까지 함께 따라온다.

수정 후 재조사 결과 `server/src` 에 남은 게시물 목록 `ORDER BY` 리터럴은 **`ORDER_BY` 상수 선언 1줄뿐**이다.

### 11.5 로컬 실측 (2026-08-17, macOS + PostgreSQL 16.15 + Node 22) — 전 케이스 PASS

**검증 환경 격리**: 개발 DB `guestbook` 과 `server/.env` 를 건드리지 않았다. 전용 DB `sort_thumb_check` 를 만들어 검증하고 끝나고 `dropdb` 했다. env 는 스크래치패드에 별도 파일(포트 3401, 일회용 시크릿, `UPLOAD_DIR` 도 스크래치패드)을 만들어 썼다. 종료 후 확인: `sort_thumb_check` 잔존 0, `server/.env` mtime 무변경, `server/uploads/` 무변경(빈 디렉토리 유지).

**① 마이그레이션 up / down 왕복 + 인덱스**

```
$ node --env-file=<scratch>/sortthumb.env node_modules/node-pg-migrate/bin/node-pg-migrate.js \
    up -m migrations --migration-file-language sql
### MIGRATION 1755300000005_add-sort-order-and-thumbnail (UP) ###   → Migrations complete!

$ psql -d sort_thumb_check -tA -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns
                                    WHERE table_name='posts' AND column_name IN ('sort_order','thumbnail_key');"
sort_order|integer|YES
thumbnail_key|text|YES

$ psql -d sort_thumb_check -tA -c "SELECT indexdef FROM pg_indexes WHERE indexname='idx_posts_list';"
CREATE INDEX idx_posts_list ON public.posts USING btree
  (category, urgent DESC, sort_order, published_at DESC, id DESC) WHERE (deleted_at IS NULL)
   ↑ ASC NULLS LAST 는 PostgreSQL 의 ASC 기본값이라 정의에 표기되지 않는다 (동일 의미)
```

| 케이스 | 기대 | 실측 | 판정 |
|---|---|---|---|
| UP 적용 | 컬럼 2개 nullable | 위 출력 | PASS |
| 다른 CHECK 5종 | 무변경 | `posts_article_needs_body`·`posts_category_check`(3값)·`posts_link_needs_url`·`posts_news_article_needs_source`·`posts_type_check` 정의 동일 | PASS |
| DOWN | 컬럼 0개 + 인덱스 원본 복원 | 컬럼 count 0, `(category, urgent DESC, published_at DESC, id DESC)` = 0001 정의와 동일 | PASS |
| 재 UP | 신규 인덱스 복귀 | 동일 | PASS |

**② 쿼리 플랜 (계약 §1 이 요구한 근거)**

```
$ psql -d sort_thumb_check -c "EXPLAIN SELECT id, category, …, sort_order, thumbnail_key FROM posts
    WHERE deleted_at IS NULL AND category='education'
    ORDER BY urgent DESC, sort_order ASC NULLS LAST, published_at DESC, id DESC LIMIT 50 OFFSET 0;"
 Limit  (cost=0.14..8.16 rows=1 width=1179)
   ->  Index Scan using idx_posts_list on posts  (cost=0.14..8.16 rows=1 width=1179)
         Index Cond: (category = 'education'::text)
   ← **Sort 노드 없음** = 인덱스가 정렬을 그대로 제공한다

$ 대조군 — 정렬 절만 다르게:
$ psql … "EXPLAIN SELECT id FROM posts WHERE deleted_at IS NULL AND category='education' ORDER BY title;"
 Sort  (cost=8.17..8.17 rows=1 width=532)
   Sort Key: title
   ->  Index Scan using idx_posts_list on posts …
   ← 인덱스가 커버하지 못하는 정렬에는 Sort 노드가 나타난다 (①의 Sort 부재가 우연이 아님을 확인)
```

`enable_seqscan=off` 를 걸지 않은 상태에서도 플래너가 인덱스를 선택했다.

**③ 썸네일 취득 (curl 원문)**

```bash
API=http://127.0.0.1:3401
AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

# [T1] maxresdefault 존재
curl -s -X POST "$API/admin/posts" "${AUTH[@]}" \
  -d '{"category":"education","type":"link","title":"노동조합이란 무엇인가",
       "url":"https://www.youtube.com/watch?v=ATbGKR-Agmk"}'
201 {"id":"45e75857-…","category":"education","type":"link","title":"노동조합이란 무엇인가",
     "url":"https://www.youtube.com/watch?v=ATbGKR-Agmk","source":null,"urgent":false,"deadline":null,
     "publishedAt":"2026-08-17T11:11:42.681Z","attachments":[],
     "thumbnailUrl":"/thumbnails/ATbGKR-Agmk-maxresdefault.jpg",   ← 추가 필드
     "body":null,"createdAt":"…","updatedAt":"…","deletedAt":null,"sortOrder":null}   ← 추가 필드

# [T2] maxresdefault 404 → mqdefault 폴백 (youtu.be 형태)
curl -s -X POST "$API/admin/posts" "${AUTH[@]}" \
  -d '{"category":"education","type":"link","title":"오바마 대통령이 말하는 노조",
       "url":"https://youtu.be/Vj3lQ7Y71PU"}'
201 { … "thumbnailUrl":"/thumbnails/Vj3lQ7Y71PU-mqdefault.jpg" … }

# 저장 결과 — 모드 0600, 첨부와 분리된 thumbnails/ 하위
$ ls -l <UPLOAD_DIR>/thumbnails/
-rw-------  73512  ATbGKR-Agmk-maxresdefault.jpg
-rw-------  11282  Vj3lQ7Y71PU-mqdefault.jpg
$ file …/ATbGKR-Agmk-maxresdefault.jpg   → JPEG image data, …, 1280x720   (16:9)
$ file …/Vj3lQ7Y71PU-mqdefault.jpg       → JPEG image data, …,  320x180   (16:9)
$ xxd -l 3 -p …/*.jpg                    → ffd8ff  (양쪽 모두 JPEG SOI)
```

**리더 실측 재확인 (독립 검증)** — 게시된 5건 전수:

```
ATbGKR-Agmk  maxres=200  mq=200
-WrzgLtvuPU  maxres=200  mq=200
jeK7W_SADUs  maxres=200  mq=200
Vj3lQ7Y71PU  maxres=404  mq=200     ← 폴백이 실제로 필요하다 (리더 실측과 일치)
OFfbgB5dOIA  maxres=200  mq=200
```

| 케이스 | 기대 | 실측 | 판정 |
|---|---|---|---|
| `watch?v=` / `youtu.be/` / `shorts/` 형태 | 인식 | 3형태 모두 키 생성 | PASS |
| `m.youtube.com/watch?v=` | 인식 | 키 생성 (backfill 경로에서 확인) | PASS |
| 비YouTube 링크 (`kfiu.or.kr/board/1234`) | `null`, 로그 없음 | `thumbnailUrl:null`, warn 0건 | PASS |
| 작성형(article) | `null` | `thumbnailUrl:null` | PASS |
| `?v=short` (11자 아님) | `null`, URL 조립 안 함 | `thumbnailUrl:null` | PASS |
| `?v=../../etc/passwd` | `null` | `thumbnailUrl:null` (정규식 관문에서 차단) | PASS |
| **존재하지 않는 videoId `ZZZZZZZZZZZ`** (양 변형 404) | **게시는 성공** | `201` + `thumbnailUrl:null` + warn 1건, 소요 **0.381초** | PASS |
| 같은 videoId 재사용 (작성형→링크형 복귀) | 네트워크 없이 캐시 재사용 | 0.100초 (첫 취득의 1/10 이하) | PASS |

warn 로그 원문 (URL 원문·개인정보 없음):

```json
{"level":40,"route":"admin-post-create","reason":"maxresdefault:http-404,mqdefault:http-404",
 "msg":"thumbnail acquisition failed"}
```

**④ 썸네일 보안 (호스트가 하드코딩이라 API 로 도달할 수 없는 경로 — 하네스 검증)**

`dist/lib/youtubeThumbnail.js` 를 스크래치패드에 복사한 뒤 **상수만 바꿔** 같은 코드 경로를 실행했다(수정 대상: `THUMBNAIL_HOST` / `path` / `MAX_BYTES` / `port`). 리포지토리 소스는 변경하지 않았고 하네스는 검증 후 삭제했다.

| 케이스 | 바꾼 상수 | 실측 결과 | 판정 |
|---|---|---|---|
| 200 이지만 JPEG 아님 (HTML) | host=`example.com`, path=`/` | `key=null reason=maxresdefault:not-jpeg,mqdefault:not-jpeg` | PASS (Content-Type 아니라 내용으로 판정) |
| 2MB 상한 초과 | `MAX_BYTES=1000` (실제 73KB 취득) | `reason=…:too-large` | PASS |
| 3xx 리다이렉트 | host=`wikipedia.org`, path=`/` (301) | `reason=…:http-301` (추종 안 함) | PASS |
| 사설 IP 피어 | host=`127.0.0.1`, port=8443 + 로컬 리스너 | `reason=…:non-public-peer` (TLS 핸드셰이크 전 절단) | PASS |
| 위 4종 모두 | — | `out/` 에 **파일 0개** (실패 시 저장 없음) | PASS |

**⑤ 정렬 규칙 (curl 원문)**

```bash
# [R2] 학습 순서 명시 지정 — 역순 등록 우회 없이
curl -s -X POST "$API/admin/posts/reorder" "${AUTH[@]}" \
  -d '{"category":"education","ids":["45e75857-…","5b341281-…","dc472784-…","6b945b0c-…","41bd1cb4-…"]}'
HTTP/1.1 200 OK
{"ok":true,"category":"education","updated":5}

# [R3] 공개 목록 — 지정 순서대로, thumbnailUrl 포함, sortOrder 는 없음
curl -s "$API/posts?category=education"
  노동조합이란 무엇인가        | /thumbnails/ATbGKR-Agmk-maxresdefault.jpg | sortOrder 포함: False
  오바마 대통령이 말하는 노조   | /thumbnails/Vj3lQ7Y71PU-mqdefault.jpg     | sortOrder 포함: False
  shorts 형태               | /thumbnails/jeK7W_SADUs-maxresdefault.jpg | sortOrder 포함: False
  짧은 id                   | null                                      | sortOrder 포함: False
  경로조작 시도              | null                                      | sortOrder 포함: False

# [R4] admin 목록 — 같은 순서 + sortOrder 노출 (공개/admin 정렬 일치 확인)
curl -s -H "Authorization: Bearer $TOKEN" "$API/admin/posts?category=education"
  1 노동조합이란 무엇인가 / 2 오바마 … / 3 shorts 형태 / 4 짧은 id / 5 경로조작 시도

# [R5] urgent 가 sort_order 보다 우선 — sortOrder=5 인 글을 urgent 로
curl -s -X PATCH "$API/admin/posts/41bd1cb4-…" "${AUTH[@]}" -d '{"urgent":true}'
curl -s "$API/posts?category=education"
  urgent=True  경로조작 시도          ← sortOrder 5 인데 맨 위 (기존 동작 보존)
  urgent=False 노동조합이란 무엇인가   ← 이하 sort_order 순
  urgent=False 오바마 … / shorts 형태 / 짧은 id

# [R6] 새 글은 맨 아래 (sort_order NULL + NULLS LAST) — 07 §10.9 문제의 구조적 해소
curl -s -X POST "$API/admin/posts" "${AUTH[@]}" \
  -d '{"category":"education","type":"article","title":"나중에 추가한 새 글","body":"본문"}'
curl -s "$API/posts?category=education"
  1. urgent=True  경로조작 시도
  2..5. (sort_order 1–4 지정 글)
  6. urgent=False 나중에 추가한 새 글     ← **학습 순서가 깨지지 않는다**
```

| 케이스 | 기대 | 실측 | 판정 |
|---|---|---|---|
| 공개 목록 = 지정 순서 | 일치 | 일치 | PASS |
| admin 목록 = 공개 목록 순서 | 일치 | 일치 (규칙 공유) | PASS |
| urgent 우선 | 수동 순서보다 위 | 위 | PASS |
| 미지정 글 = 게시일 역순 | 기존 동작 | 기존 동작 | PASS |
| 새 글이 지정 글 아래 | NULLS LAST | 맨 아래 | PASS |
| 공개 응답에 `sortOrder` 부재 | 없어야 함 | 없음 | PASS |

**⑥ `POST /admin/posts/reorder` 전 분기**

```
# #1 category (400 VALIDATION_ERROR)
{"category":"edu","ids":[]}                 → 400 "category 는 notice, news, education 중 하나여야 합니다."
{"ids":[]}                (category 누락)    → 400 동일
# #2 ids 형식 (400)
{"category":"education"}  (ids 누락)         → 400 "ids 는 UUID 배열이어야 합니다."
{"category":"education","ids":"abc"}         → 400 동일
{"category":"education","ids":["not-a-uuid"]}→ 400 동일
{"category":"education","ids":[1,2]}         → 400 동일
# #3 중복 (400) — 순열 검증보다 먼저
{"category":"education","ids":["45e…","45e…"]} → 400 "ids 에 중복된 항목이 있습니다."
# #4 순열 아님 (409 CONFLICT)
개수 부족(1건)                                → 409 "목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요."
없는 uuid 포함                                → 409 동일
빈 배열(활성 6건 존재)                          → 409 동일
다른 분류 id 로 시도                            → 409 동일
삭제된 글의 id 포함                             → 409 동일
낡은 목록(5건)으로 시도 — 그 사이 1건 추가됨        → 409 동일  ← 계약이 막으려던 바로 그 사고
# 검증 순서
{"category":"edu","ids":["nope"]}            → 400 category 문구  ← #1 이 #2 보다 먼저
# 정상 분기
활성 0건 분류 + ids=[]                        → 200 {"ok":true,"category":"news","updated":0}
대문자 UUID 5건                               → 200 {"updated":5} (정규화 확인)
무인증                                        → 401 UNAUTHORIZED
```

**409 후 DB 무변경 확인** (부분 적용이 없어야 한다):

```
$ psql -tA -c "SELECT coalesce(sort_order::text,'NULL'), title FROM posts
                WHERE category='education' ORDER BY sort_order NULLS LAST;"
1|노동조합이란 무엇인가 / 2|오바마 … / 3|shorts 형태 / 4|짧은 id / 5|경로조작 시도 / NULL|나중에 추가한 새 글
   ← 409 를 받은 요청은 아무것도 쓰지 않았다
```

**동시 실행 (원자성·순열 무결성)** — 서로 반대 순서인 reorder 2건을 동시 전송:

```
A: 200 {"ok":true,"category":"education","updated":7}
B: 200 {"ok":true,"category":"education","updated":7}
최종 sort_order: 1..7 연속, 중복 없음 (판정 쿼리: count(DISTINCT sort_order)=count(*) AND min=1 AND max=count → "연속·유일 OK")
   ← FOR UPDATE 로 직렬화되어 두 순서가 섞이지 않는다
```

**⑦ `GET /thumbnails/:key`**

```
# 정상
$ curl -s -D- -o served.jpg "$API/thumbnails/ATbGKR-Agmk-maxresdefault.jpg"
HTTP/1.1 200 OK
content-type: image/jpeg
content-length: 73512
cache-control: public, max-age=31536000, immutable
x-content-type-options: nosniff
$ cmp served.jpg <UPLOAD_DIR>/thumbnails/ATbGKR-Agmk-maxresdefault.jpg   → 바이트 동일

# 형식 맞지만 파일 없음 → 404
$ curl -s "$API/thumbnails/AAAAAAAAAAA-maxresdefault.jpg"
404 {"error":{"code":"NOT_FOUND","message":"썸네일을 찾을 수 없습니다."}}

# key 형식 위반 → 400
hqdefault.jpg                     → 400      ATbGKR-Agmk-hqdefault.jpg      → 400  ← hqdefault 는 애초에 불가
ATbGKR-Agmk-maxresdefault.png     → 400      short-mqdefault.jpg            → 400
ATbGKR-Agmk-maxresdefault.jpg.jpg → 400

# 경로 조작 10종 — 어느 것도 파일에 닿지 않는다
../../../etc/passwd                               → 404 (라우터 미매칭 — 핸들러에 도달조차 안 함)
..%2F..%2Fetc%2Fpasswd                            → 400 VALIDATION_ERROR
%2e%2e%2f%2e%2e%2fetc%2fpasswd                    → 400
ATbGKR-Agmk-maxresdefault.jpg/../../../etc/passwd → 404
..;/etc/passwd                                    → 404
..%2F..%2Fuploads%2Fthumbnails%2FATbGKR-…jpg      → 400 {"error":{"code":"VALIDATION_ERROR",
                                                          "message":"썸네일 key 형식이 올바르지 않습니다."}}

# rate limit (filesLimiter 공유) — 125회 연속
200: 119건 / 429: 6건, retry-after: 4
429 {"error":{"code":"RATE_LIMITED","message":"요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."}}
   ← 119 인 것은 앞선 /files 요청 1건이 같은 버킷을 이미 소비했기 때문 (분당 120 정확)
```

**⑧ PATCH 시 썸네일 수명주기**

| 케이스 | 기대 | 실측 | 판정 |
|---|---|---|---|
| 제목만 변경 | 키·sortOrder 유지, 재취득 없음 | `ATbGKR-Agmk-maxresdefault.jpg`, `sortOrder:5` 유지 | PASS |
| URL 변경 (`-WrzgLtvuPU`) | 재취득 | `-WrzgLtvuPU-maxresdefault.jpg` | PASS |
| 링크형 → 작성형 | `thumbnail_key = NULL` | `thumbnailUrl:null`, `sortOrder:5` 유지 | PASS |
| 작성형 → 링크형 복귀 | 디스크 캐시 재사용 | 동일 키, 0.100초 | PASS |
| 비YouTube URL 로 변경 | 해제 | `thumbnailUrl:null` | PASS |
| 위 전 과정에서 `sort_order` | 보존 | `5` 유지 (DB 직접 확인) | PASS |

**⑨ 소급 적용 스크립트 (멱등성)**

```
# 사전 조건: 마이그레이션 이전 게시 상태 재현 (thumbnail_key NULL + 캐시 파일 제거)
$ ... node scripts/backfill-thumbnails.mjs --dry-run
대상 후보 6건 (thumbnail_key 가 비어 있는 활성 링크형 게시물)
  [dry-run] 449c0bf0-… (education) → OFfbgB5dOIA-maxresdefault.jpg (fetch)
  [건너뜀]  41bd1cb4-… (education) — YouTube 영상 URL 아님
  [건너뜀]  6b945b0c-… (education) — YouTube 영상 URL 아님
  [dry-run] 5b341281-… (education) → Vj3lQ7Y71PU-mqdefault.jpg (fetch)     ← 404 폴백도 동작
  [건너뜀]  45e75857-… (education) — YouTube 영상 URL 아님
  [dry-run] 176badc1-… (news)      → Vj3lQ7Y71PU-mqdefault.jpg (cache)     ← 같은 영상 재사용
완료 — 대상 6건 / 적용 3건 / 건너뜀 3건 / 실패 0건 (dry-run: DB 무변경)
$ psql -tAc "SELECT count(*) FROM posts WHERE thumbnail_key IS NOT NULL;"  → 1  (변경 없음)

$ ... node scripts/backfill-thumbnails.mjs           # 실제 적용
완료 — 대상 6건 / 적용 3건 / 건너뜀 3건 / 실패 0건        exit=0

$ ... node scripts/backfill-thumbnails.mjs           # 재실행 (멱등)
대상 후보 3건 … 완료 — 대상 3건 / 적용 0건 / 건너뜀 3건 / 실패 0건    exit=0
   ← 채워진 3건은 후보에서 사라진다. 남은 3건은 YouTube 가 아닌 링크(영구 건너뜀)
```

**⑩ 회귀 (기존 기능)**

```
GET  /health                       → 200      GET /guestbook                → 200
GET  /posts?category=notice        → 200      POST /guestbook               → 201
GET  /posts?category=news          → 200      GET /admin/me (bearer)        → 200
GET  /posts?category=education     → 200 (X-Total-Count: 6)
GET  /posts?category=edu           → 400      GET /posts (category 누락)     → 400
GET  /posts/<uuid아님>              → 400      GET /admin/posts (무인증)      → 401
GET  /files/<없는id>/x.pdf          → 404
첨부 업로드 → 201 attachment shape / 서빙 → 200   (uploads/ 루트와 thumbnails/ 공존 확인)
```

응답 키 집합 대조 (직렬화 스키마 누락 여부 확인):

```
공개 목록  : attachments category deadline id publishedAt source thumbnailUrl title type urgent url
공개 상세  : 위 + body
admin     : 위 + createdAt deletedAt sortOrder updatedAt
   ← thumbnailUrl 은 공개·admin 모두, sortOrder 는 admin 만 (계약 §6 준수)
```

**⑪ 개인정보·시크릿 로그 점검** (서버 로그 전문 grep, 전부 0건): 정적 토큰 문자열, `argon2`, 평문 비밀번호, 방명록 본문, 클라이언트 IP. 로그의 유일한 `127.0.0.1` 은 기동 시 바인딩 주소(`Server listening at http://127.0.0.1:3401`)다.

**⑫ 품질**: `npm run typecheck` (strict, `noUncheckedIndexedAccess`·`exactOptionalPropertyTypes`) 통과, `npm run build` 통과. 타입 우회(`any`·근거 없는 `as`) 없음.

### 11.6 배포 전 확인 사항 — 아웃바운드 네트워크

썸네일 취득은 **API 컨테이너에서 `i.ytimg.com:443` 으로 나가는 HTTPS 요청**을 필요로 한다. 현재 프로덕션에서 아웃바운드 HTTPS 는 이미 쓰이고 있지만(`POST /admin/posts/preview-link` 의 링크 프리뷰), `i.ytimg.com` 도달 여부는 프로덕션에서 확인된 바 없다. **적용 절차 ⑦-0 에서 먼저 확인한다.** 막혀 있어도 게시는 정상 동작하고 썸네일만 비는 설계이므로(§20.4) 서비스 위험은 없다.

### 11.7 프로덕션 배포 절차

전제: `/root/koscomlabor-api/` (compose + `app/` + `.env`), 프로덕션 DB 는 마이그레이션 0000–0004 까지 적용된 상태(§10.8). 이번엔 **컬럼 2개 추가 + 인덱스 재생성**이다.

> **순서 고정 — 마이그레이션이 API 재기동보다 먼저.** 반대로 하면 새 API 가 `sort_order`/`thumbnail_key` 를 SELECT 하는데 컬럼이 없어 **모든 게시물 조회가 500** 이 된다(이번 변경에서 가장 큰 위험). 아래 순서면 무중단에 가깝다(api 재생성 몇 초).
> `ALTER TABLE … ADD COLUMN` (기본값 없는 nullable)은 테이블 재작성이 없어 즉시 끝난다. `DROP INDEX`/`CREATE INDEX` 는 짧은 락을 잡지만 posts 는 소규모다.
> **구버전 코드는 새 컬럼이 있어도 정상 동작한다** — 마이그레이션만 먼저 적용해 둔 중간 상태가 안전하다.

```bash
# ① 로컬에서 소스 동기화
rsync -az --delete --exclude node_modules --exclude dist --exclude .env --exclude uploads \
  server/ root@101.79.31.30:/root/koscomlabor-api/app/

# ② 서버에서 — 백업 먼저 (롤백 대비)
ssh root@101.79.31.30
cd /root/koscomlabor-api
docker exec koscomlabor-db pg_dump -Fc -U guestbook_app guestbook \
  > /root/backups/pre_sortthumb_$(date +%Y%m%d_%H%M).dump

# ②-1 현재 인덱스 정의 사전 확인 (③이 DROP 할 대상)
docker exec koscomlabor-db psql -U guestbook_app -d guestbook -tAc \
  "SELECT indexdef FROM pg_indexes WHERE indexname='idx_posts_list';"
# 기대: CREATE INDEX idx_posts_list ON public.posts USING btree
#         (category, urgent DESC, published_at DESC, id DESC) WHERE (deleted_at IS NULL)
# 다르면 적용을 멈추고 리더에게 보고할 것 (마이그레이션의 DROP INDEX 가 전제로 삼는 값이다)

# ③ 마이그레이션 이미지 재빌드 후 적용 (profile 서비스는 일반 build 대상이 아님 — §7.3-2)
docker compose --profile tools build migrate
docker compose --profile tools run --rm migrate      # 1755300000005 적용

# ④ 적용 확인 — 컬럼 2개 + 새 인덱스
docker exec koscomlabor-db psql -U guestbook_app -d guestbook -tAc \
  "SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_name='posts' AND column_name IN ('sort_order','thumbnail_key');"
# 기대: sort_order|YES  /  thumbnail_key|YES
docker exec koscomlabor-db psql -U guestbook_app -d guestbook -tAc \
  "SELECT indexdef FROM pg_indexes WHERE indexname='idx_posts_list';"
# 기대: … (category, urgent DESC, sort_order, published_at DESC, id DESC) WHERE (deleted_at IS NULL)
#   ("ASC NULLS LAST" 는 PostgreSQL 기본값이라 표기되지 않는다 — 정상)

# ⑤ API 이미지 재빌드 + 재기동 (scripts/ COPY 도 이때 함께 반영된다 — §11.3)
docker compose build api
docker compose up -d api

# ⑥ 기동 확인
docker logs --tail 30 koscomlabor-api                # "Server listening"
docker exec onnuri-caddy wget -qO- http://koscomlabor-api:3001/health
```

**⑦ 스모크 (프로덕션).** 생성한 id 를 반드시 기록해 두었다가 `WHERE id IN (...)` 로 정리한다 (조건 없는 DELETE 금지 — CLAUDE.md 규칙).

```bash
# ⑦-0 아웃바운드 도달 확인 (§11.6) — 막혀 있으면 썸네일만 비고 게시는 정상
docker compose exec api node -e \
 "require('https').get({host:'i.ytimg.com',path:'/vi/ATbGKR-Agmk/maxresdefault.jpg'},r=>{console.log(r.statusCode);r.destroy();}).on('error',e=>console.log('ERR',e.message))"
# 기대: 200

# ⑦-1 회귀 (기존 필드 불변 + 새 필드 등장)
GET  /posts?category=education      → 200, 5건, 각 원소에 "thumbnailUrl" 존재(초기엔 null), "sortOrder" 부재
GET  /posts?category=notice / news  → 200 (기존 건수 그대로)
GET  /guestbook                     → 200
GET  /admin/posts?category=education → 200, "sortOrder":null 노출

# ⑦-2 썸네일 소급 적용 — **api 컨테이너에서** (uploads 볼륨이 여기 있다 — §11.3)
docker compose exec api node scripts/backfill-thumbnails.mjs --dry-run   # 먼저 무엇이 바뀌는지 본다
docker compose exec api node scripts/backfill-thumbnails.mjs             # 적용 (노동교육 5건 + 소식 링크형)
GET  /posts?category=education      → 200, thumbnailUrl 이 채워짐
GET  /thumbnails/<받은 key>          → 200 image/jpeg   ← Caddy 는 경로 제한 없이 전량 프록시하므로 설정 변경 불필요

# ⑦-3 정렬 적용 — 노동교육 학습 순서를 명시 고정 (역순 등록 우회 해제)
#     현재 표시 순서대로 id 를 모은 뒤 그 배열을 그대로 보낸다 (지금 순서 = 의도한 학습 순서)
GET  /admin/posts?category=education     → id 5개를 표시 순서로 수집
POST /admin/posts/reorder                → 200 {"ok":true,"category":"education","updated":5}
GET  /posts?category=education           → 순서 동일 확인 (이제 published_at 우연에 의존하지 않는다)

# ⑦-4 (선택) 정렬 스모크: 새 글 1건 생성 → 맨 아래에 붙는지 확인 → 기록한 id 로 DELETE
```

**주의:**
- **배포 순서는 마이그레이션 → API → 프론트.** 프론트를 먼저 배포하면 `POST /admin/posts/reorder` 가 404 다. API 를 먼저 배포해도 **구버전 프론트는 정상 동작**한다 (새 필드를 무시한다 — 06 §20.7)
- 프론트의 순서 조작 UI(위/아래 이동 버튼)·썸네일 카드 렌더·`http.ts` 의 `conflict` reason 등록은 web-developer 영역 (계약 §8)
- `⑦-3` 을 하지 않으면 노동교육 순서는 여전히 `published_at` 역순 우연에 의존한다. **적용 절차의 일부로 반드시 수행할 것**
- 썸네일 파일은 기존 `uploads` 명명 볼륨의 `thumbnails/` 하위에 쌓인다 (5건 약 300KB) — 볼륨 용량 영향은 무시할 수준

### 11.8 프론트 미등록 리스크 (web-developer 인계 — 배포 전 확인 필요)

**`src/lib/api/http.ts` 의 `CODE_TO_REASON` 에 `CONFLICT: "conflict"` 를 등록하지 않으면 409 응답이 `?? "network"` 폴백으로 떨어져 "서버에 연결하지 못했습니다" 류의 잘못된 문구가 뜬다.** `ApiFailureReason` 에 `"conflict"` 추가도 함께 필요하다.

실측 확인(2026-08-17, 읽기): `src/lib/api/http.ts:76–86` 의 `CODE_TO_REASON` 에 `CONFLICT` **없음**, `STATUS_TO_REASON`(88–94)에도 `409` **없음**. 즉 현재 프론트 상태로는 409 가 `network` 로 오분류된다. 직전 회차(`INVALID_CREDENTIALS`, §9.8)와 **같은 유형의 리스크**이며 그때는 QA 교차 확인으로 해소됐다. QA 는 이 두 곳을 반드시 확인할 것.

사용자에게 보여야 하는 문구는 계약 §8 이 고정했다 — **"목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요."** 를 표시하고 **목록을 재조회**한다. 낡은 순서로 재시도하게 두면 409 가 반복된다.

### 11.9 롤백

| 상황 | 조치 |
|---|---|
| 코드만 되돌림 (컬럼 유지) | 이전 이미지로 `docker compose up -d api`. 구버전 코드는 두 컬럼을 읽지 않으므로 **정상 동작한다.** 단 정렬은 `urgent → published_at` 으로 돌아가고(인덱스는 넓은 정의라 무해), `thumbnailUrl` 이 사라져 프론트 썸네일이 빈다. 지정한 `sort_order` 값은 DB 에 그대로 남아 재배포 시 되살아난다 |
| **스키마까지 되돌림** | `docker compose --profile tools run --rm migrate npx node-pg-migrate down -m migrations --migration-file-language sql` → 컬럼 2개 DROP + 인덱스 원복. **지정한 순서와 썸네일 키가 영구 소멸한다** (아래 보존 절차) |
| DB 손상 | ②의 `pre_sortthumb_*.dump` 로 `pg_restore --clean --if-exists` (2.5절) |

**down 은 education 때와 달리 그냥 성공한다** (CHECK 제약 교체가 아니라 컬럼 삭제이므로 기존 행 검증이 없다). 그래서 **사고로 실행되기 쉽다** — 실행 전에 값을 보존할 것:

```bash
# ① 소멸할 값 백업 (되돌린 뒤 재적용하려면 이 출력이 유일한 근거다)
docker exec koscomlabor-db psql -U guestbook_app -d guestbook -c \
  "SELECT id, category, sort_order, thumbnail_key FROM posts
    WHERE sort_order IS NOT NULL OR thumbnail_key IS NOT NULL ORDER BY category, sort_order;"

# ② DB 전체 백업
docker exec koscomlabor-db pg_dump -Fc -U guestbook_app guestbook \
  > /root/backups/pre_sortthumb_rollback_$(date +%Y%m%d_%H%M).dump

# ③ down
docker compose --profile tools run --rm migrate \
  npx node-pg-migrate down -m migrations --migration-file-language sql
```

썸네일 **파일**은 `uploads` 볼륨의 `thumbnails/` 에 남으므로, 재적용 시 `backfill-thumbnails.mjs` 가 네트워크 없이 키를 복구한다. `sort_order` 는 복구 수단이 없으므로 ①의 출력이 유일한 근거다. 기존 게시물 내용·방명록·첨부에는 어떤 영향도 없다.

### 11.10 미결 사항

- **프로덕션 적용은 리더가 수행** (이 작업 범위는 코드·마이그레이션·스크립트·문서까지). 프로덕션에 읽기·쓰기 어떤 접근도 하지 않았다
- **`⑦-3` 정렬 명시 적용을 빠뜨리면 이번 작업의 목적(노동교육 순서 고정)이 달성되지 않는다.** 마이그레이션·코드만 올라가고 `sort_order` 가 전부 NULL 이면 동작은 이전과 완전히 동일하다
- **프론트 `CODE_TO_REASON` 미등록** — §11.8. web-developer 작업 전까지 409 가 `network` 로 오분류된다
- **아웃바운드 도달 미확인** — `i.ytimg.com` 접근 가능 여부는 프로덕션에서 확인되지 않았다 (§11.6, 절차 ⑦-0). 실패해도 게시는 정상이며 썸네일만 빈다
- **`uploads` 볼륨 백업은 여전히 DB 만 대상**이다 (`deploy/backup.sh` 는 pg_dump 만). 썸네일은 `backfill` 로 언제든 재생성되는 파생 캐시라 백업이 불필요하지만, **첨부 파일은 여전히 백업 대상이 아니다** — 06 §13.3 이 예정했던 uploads tar 백업이 미구현 상태다. 이번 작업 범위 밖이며 별도 과제로 남긴다
- **`Vj3lQ7Y71PU`(오바마 영상)는 원출처 미표기 재업로드로 예고 없이 삭제될 수 있다** (§10.9 후속 점검 항목). 영상이 삭제되면 이미 캐싱한 썸네일은 **계속 표시된다** — 링크는 죽었는데 썸네일은 살아 있는 상태가 되므로, 링크 정기 점검 시 함께 확인할 것
- 디자이너 재판정 대기: 썸네일 카드 프레임 일관성(요구사항 문서의 쟁점 ③). 백엔드는 16:9 이미지만 제공하며 표시 규격은 디자이너·web-developer 영역

---

## 12. 배포 설정(compose)을 CI/CD 대상에 편입 (2026-08-19)

### 12.1 배경 — 실제 사고

`/rally-2026-08-28` 배포 시 네이버 지도 키(`NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`)를 저장소
`deploy/web/docker-compose.yml` 에 추가했으나 **배포는 성공했는데 지도가 렌더되지 않았다.**

원인은 파이프라인 구조였다. `.github/workflows/deploy.yml` 의 rsync 는

- 대상이 서버의 **`/root/koscomlabor-web/src/`** (루트가 아니다)
- 제외 목록에 **`--exclude deploy`**

즉 **저장소의 배포 설정이 서버로 전달되는 경로가 처음부터 없었다.** compose 는 최초 1회
수동 배치된 사본이었고, 그 뒤 저장소 쪽 수정은 서버에 반영된 적이 없다. 빌드타임 임베드
값이라 키가 없으면 지도 블록이 통째로 비는데, 헬스 체크(`/` 200)는 통과하므로 CI 는 성공으로
보고했다. 리더가 서버 파일을 직접 고쳐 복구했다(백업 `/root/backups/compose_web_20260819_1100.yml`).

**손으로 맞춰 놓은 상태는 해결이 아니다.** 같은 사고가 다음 compose 변경에서 반복된다.

### 12.2 제약 — 배포 키가 command 제한이다

배포 전용 SSH 키는 서버 `deploy-key-wrapper.sh` 로 **두 가지만** 허용한다(§8.2).

1. `/root/koscomlabor-web/src/` 를 대상으로 하는 rsync
2. `/root/koscomlabor-web/deploy.sh` 실행

compose 가 있어야 할 위치인 **`/root/koscomlabor-web/` 루트에는 CI 가 직접 쓸 수 없다.**
이는 키가 유출돼도 임의 root 쓰기가 불가능하도록 한 의도적 설계이며, **이 작업에서 wrapper 를
느슨하게 바꾸지 않는다.**

### 12.3 채택안과 대안 검토

**채택: rsync 로 `src/deploy/` 를 실어 나르고, `deploy.sh` 가 빌드 직전 루트로 복사한다.**

1. `deploy.yml` rsync 제외 목록에서 `deploy` 제거 → `src/deploy/web/docker-compose.yml` 도착
2. 서버 `deploy.sh` 가 `docker compose build` 직전 그 파일을 루트 `docker-compose.yml` 로 복사

검토했으나 채택하지 않은 대안:

| 대안 | 기각 사유 |
|------|----------|
| `deploy.sh` 가 복사 없이 `docker compose -f src/deploy/web/docker-compose.yml` 을 직접 사용 | compose 의 `context: ./src` 는 파일 위치 기준 상대경로다. 위치가 바뀌면 `src/deploy/web/src` 를 찾아 깨진다. `--project-directory` 로 우회할 수 있으나 상대경로 해석이 compose 버전에 따라 미묘하다. 또한 루트에 남은 옛 compose 를 수동 조작자가 쓰게 되어 **진실이 둘**이 된다 |
| compose 를 저장소 루트로 옮긴다 | 서버에서는 어차피 `src/` 하위에 도착하므로 루트 복사가 여전히 필요하다. 이득 없이 저장소만 어지럽다 |
| wrapper 에 루트 쓰기 rsync 를 허용 | 배포 키의 보안 전제를 무너뜨린다. 범위 밖 |

**`deploy.sh` 자신은 자동 동기화하지 않는다.** 실행 중인 스크립트 파일을 덮어쓰면 bash 가
파일 오프셋 기준으로 나머지를 읽어 오동작할 수 있다. `deploy.sh` 변경은 저장소
`deploy/web/deploy.sh` 를 고친 뒤 **수동으로 서버에 반영**한다(빈도가 낮은 파일이다).

### 12.4 변경 전후 파이프라인

**변경 전**

```
저장소 push → CI → deploy.yml
  ├─ rsync (--exclude deploy) ──→ 서버 /root/koscomlabor-web/src/
  └─ ssh deploy.sh              ──→ docker compose build (루트 compose 사용)
                                      ↑ 이 파일은 저장소와 연결이 끊겨 있다 ✗
```

**변경 후**

```
저장소 push → CI → deploy.yml
  ├─ rsync (deploy 포함) ───────→ 서버 /root/koscomlabor-web/src/
  │                                 └─ src/deploy/web/docker-compose.yml
  └─ ssh deploy.sh              ──→ ① sync_compose: src/deploy/web/docker-compose.yml
                                      → 루트 docker-compose.yml 복사 (+백업·검증)
                                    ② docker compose build / up -d
```

### 12.5 안전 설계 — `sync_compose`

크론(00:10 KST 일일 재빌드)은 **rsync 없이** `deploy.sh` 를 단독 실행한다. 복사 로직은 그
경로에서도 안전해야 한다.

| 상황 | 동작 |
|------|------|
| 원본(`src/deploy/web/docker-compose.yml`) 없음 | **기존 루트 파일 유지**하고 그대로 빌드 진행 (크론·첫 배포 경로) |
| 원본과 루트가 동일 | 복사 생략 (로그 노이즈·불필요한 mtime 변경 방지) |
| 원본과 루트가 다름 | 루트 파일을 `/root/backups/compose_web_<TS>.auto.yml` 로 백업 → 복사 → **변경 내역을 로그에 diff 출력** |
| 복사 후 `docker compose config -q` 실패 | **백업본으로 되돌리고 스크립트 중단(exit≠0)** |

검증 실패 시 옛 설정으로 조용히 계속 진행하지 **않는다.** 그것이 바로 이번 사고의 유형
("배포는 성공, 반영은 안 됨")이다. 실패는 CI 를 붉게 만들어 드러내야 한다. 이때도 이미 떠
있는 컨테이너는 그대로이므로 **서비스 중단은 없다.**

### 12.6 롤백 절차

파이프라인이 깨지면 어떤 배포도 불가능하므로 되돌리는 방법을 먼저 적어 둔다.
**서버 롤백만으로 즉시 원상복구된다** (저장소 변경은 서버 `deploy.sh` 가 옛 버전이면 무해하다
— `src/deploy/` 가 올라와도 아무도 읽지 않는다).

**백업 파일**

| 파일 | 백업 경로 |
|------|----------|
| 서버 `deploy.sh` (변경 전) | `/root/backups/deploy_sh_20260819_1146.sh` |
| 서버 `docker-compose.yml` (변경 전) | `/root/backups/compose_web_20260819_1146.yml` |
| 〃 (리더 수동 복구 시점) | `/root/backups/compose_web_20260819_1100.yml` |

**① 서버 롤백 — 이것만으로 파이프라인이 변경 전으로 돌아간다**

```bash
ssh root@101.79.31.30
cp -p /root/backups/deploy_sh_20260819_1146.sh      /root/koscomlabor-web/deploy.sh
chmod 700 /root/koscomlabor-web/deploy.sh
cp -p /root/backups/compose_web_20260819_1146.yml   /root/koscomlabor-web/docker-compose.yml

# 확인 — sync_compose 가 사라지고 compose 에 지도 키가 있어야 한다
grep -c sync_compose /root/koscomlabor-web/deploy.sh          # 기대: 0
grep NEXT_PUBLIC_NAVER_MAP_CLIENT_ID /root/koscomlabor-web/docker-compose.yml  # 기대: x79smqla3u

/root/koscomlabor-web/deploy.sh                                # 재배포로 확정
```

**② 저장소 롤백 (선택 — ①만으로도 안전하다)**

```bash
cd /Users/koscom/IdeaProjects/koscomlabor
git revert --no-edit <이 작업 커밋 해시>
git push origin main
```

**③ 복구 확인**

```bash
curl -s https://koscomlabor.cloud/rally-2026-08-28 | grep -o 'ncpKeyId=[a-z0-9]*'   # 기대: ncpKeyId=x79smqla3u
curl -s -o /dev/null -w '%{http_code}\n' https://koscomlabor.cloud/                 # 기대: 200
```

**④ 롤백 판단 기준** — 다음 중 하나면 즉시 ① 실행

- CI 배포 잡 실패
- 배포 후 `https://koscomlabor.cloud/` 가 200 이 아님
- `/rally-2026-08-28` 에서 `ncpKeyId` 가 사라짐
- `rebuild.log` 에 `[compose] 검증 실패` 출력

