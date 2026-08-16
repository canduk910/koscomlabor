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

## 7. Part 2 (게시물 DB + Admin) — 구현 완료, 배포 대기 (2026-08-16)

구현·로컬 실측 완료 (06 명세 §17). **리더 지시로 배포 보류 — 프론트 구현·통합 QA 후 일괄 배포.** 배포 시 절차:

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
