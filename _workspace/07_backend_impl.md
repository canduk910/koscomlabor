# 07. 방명록 백엔드 구현 요약 · 배포 기록 (Docker/NCP VM)

작성일: 2026-08-16 (배포 반영 갱신) | 작성자: backend-developer | 기준 명세: `_workspace/06_backend_api_spec.md`
상태: **NCP VM 배포 완료 (컨테이너 가동·스모크 통과·백업 크론 설치). 단, 공개 도메인 미확정 — 4절 참조**

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

## 4. 미결 사항 (리더/사용자 결정 필요)

1. **방명록 API 공개 도메인** — `api.koscomlabor.cloud` 사용 불가(onnuri 백엔드 현역, 2.3절). **제안: `union-api.koscomlabor.cloud`** (대안: guestbook-api.*, jibu-api.*). 확정 시 2.6절 절차 15분 내 공개 가능. 06 명세의 Base URL·프론트 `NEXT_PUBLIC_API_BASE_URL` 도 확정값으로 갱신 필요
2. 프론트 프로덕션 도메인 확정 시 CORS_ORIGINS 추가 (현재 http://localhost:3000 만)
3. Object Storage 2차 백업 콘솔 작업 (2.5절 가이드)

## 5. 운영 시 알아둘 것

- rate limit 카운터는 프로세스 메모리 — 컨테이너 재시작 시 초기화 (수용된 설계)
- 관리자 삭제는 soft delete. 완전 삭제 요구 시: 백업 확인 후 `docker exec koscomlabor-db psql -U guestbook_app -d guestbook -c "DELETE FROM guestbook_entries WHERE id='<id>';"`
- `GET /health` 는 rate limit 미적용 (모니터링용)
- 파괴적 docker 명령(prune, `down -v`) 금지 — `down -v` 는 DB 볼륨을 삭제한다
