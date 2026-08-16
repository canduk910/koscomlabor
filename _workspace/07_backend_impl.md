# 07. 방명록 백엔드 구현 요약 · 배포 가이드

작성일: 2026-08-16 | 작성자: backend-developer | 기준 명세: `_workspace/06_backend_api_spec.md` (리더 승인 완료)

---

## 1. 구현 요약

### 1.1 위치·구조 (모노레포 `server/`)

```
server/
├── package.json            # 자체 패키지 (프론트와 분리). scripts: dev/build/typecheck/migrate/start
├── tsconfig.json           # TypeScript strict + noUncheckedIndexedAccess 등 강화 옵션
├── .gitignore              # .env 커밋 금지 (.env.example 만 허용)
├── .env.example            # 키 이름만 (값 없음)
├── migrations/
│   └── 1755300000000_create-guestbook-entries.sql   # node-pg-migrate SQL 마이그레이션 (Up/Down)
└── src/
    ├── index.ts            # 엔트리포인트 (설정 로드 → 기동, SIGTERM 그레이스풀 종료)
    ├── app.ts              # Fastify 앱 조립: 라우트·CORS·에러 핸들러·rate limit 배선
    ├── config.ts           # 환경변수 파싱·검증 (필수값 누락 시 기동 거부)
    ├── db.ts               # pg Pool + GuestbookRepository (snake_case↔camelCase 경계 변환)
    └── lib/
        ├── errors.ts       # { error: { code, message } } 형식·ErrorCode 타입
        ├── validate.ts     # 서버측 입력 검증 (명세 4.2절 규칙 전체)
        ├── ipHash.ts       # IP HMAC-SHA-256 해시 (원문 IP 비저장 원칙)
        └── rateLimit.ts    # 인메모리 슬라이딩 윈도 limiter (다중 윈도 + 최소 간격)
```

루트 `tsconfig.json`은 `server`를 exclude, 루트 `eslint.config.mjs`는 `server/**`를 ignore — 백엔드는 자체 패키지에서 검증한다 (`npm run typecheck`). 프론트 빌드·린트에 영향 없음 (루트 `tsc --noEmit` 통과 확인).

### 1.2 기술 결정 (명세 이후 구현 단계에서 내린 것)

| 결정 | 내용 · 사유 |
|---|---|
| rate limit 자체 구현 | `@fastify/rate-limit` 대신 `src/lib/rateLimit.ts` 인메모리 슬라이딩 윈도 구현. 사유: 명세 4.3절이 요구하는 **다중 윈도(1분/1시간/24시간) + 30초 최소 간격 + "성공한 등록만 카운트"** 조합을 플러그인이 지원하지 않음. 의존성 0, 10분 주기 sweep으로 메모리 누수 방지. VM 1대·단일 프로세스 전제 (프로세스 재시작 시 카운터 초기화는 수용된 트레이드오프) |
| 검사 순서: rate limit → 검증 | POST에서 30초 간격·윈도 한도를 입력 검증보다 먼저 검사 (자원 보호). 따라서 성공 등록 후 30초 내에는 내용과 무관하게 429. 검증 실패는 카운트에 기록하지 않음 (오타로 조합원이 잠기지 않게) |
| 응답 스키마 직렬화 | 모든 라우트에 Fastify response schema 선언 (`additionalProperties: false`). 명세 외 필드는 직렬화 단계에서 제거 → shape 불일치를 코드 레벨에서 차단. 실측 T14로 미지 필드 미반사 확인 |
| 로그 개인정보 차단 | pino serializer를 method·url·statusCode로 제한. Fastify 기본 serializer의 `remoteAddress`(원문 IP)·헤더를 로그에서 제거. 본문·닉네임 미로깅 (실측 grep 확인) |
| 관리자 토큰 비교 | `crypto.timingSafeEqual` 상수 시간 비교 (길이 불일치 시에도 더미 비교로 시간 균일화) |
| 시크릿 | `.env`(로컬)/`EnvironmentFile`(systemd)로만 주입. `ADMIN_API_TOKEN`·`IP_HASH_SECRET` 32자 미만이면 기동 거부 |
| dotenv 미사용 | Node 20+ 내장 `--env-file` 사용 (의존성 절감) |

### 1.3 로컬 실행 절차 (macOS, QA 재현용)

```bash
# 1) PostgreSQL 16 (최초 1회)
brew install postgresql@16 && brew services start postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
createdb guestbook

# 2) 환경변수
cd server && cp .env.example .env
# .env 편집: DATABASE_URL=postgres://<mac사용자명>@127.0.0.1:5432/guestbook
#            ADMIN_API_TOKEN=$(openssl rand -base64 32)
#            IP_HASH_SECRET=$(openssl rand -base64 32)
#            CORS_ORIGINS=http://localhost:3000  TRUST_PROXY=false

# 3) 설치·마이그레이션·기동
npm install && npm run migrate && npm run dev   # http://127.0.0.1:3001

# 4) 검증
npm run typecheck && npm run build
curl -s http://127.0.0.1:3001/health   # {"status":"ok"}
```

실측 결과(27케이스 PASS)는 명세 06의 9절에 병기. **QA 유의: 검증 400 케이스는 직전 성공 등록 후 30초 이후에 실행할 것** (rate limit이 검증보다 선행).

---

## 2. NCP VM 배포 가이드

전제: 기존 NCP Server(VM) 1대 (onnuri.koscomlabor.cloud 운영 서버로 추정). **배포 전 사용자 확인 필요 사항은 6절.** 아래는 Ubuntu 22.04/24.04 LTS 기준 — 실제 OS 확인 후 필요시 조정.

목표 구성: `[인터넷] → nginx(443, TLS) → Fastify(127.0.0.1:3001) → PostgreSQL(127.0.0.1:5432)`

### 2.1 [사용자 콘솔 작업 A] DNS · ACG

1. **DNS**: 도메인 관리 콘솔에서 `api.koscomlabor.cloud` **A 레코드** → VM 공인 IP (TTL 300 권장)
2. **NCP ACG(방화벽)**: 해당 VM의 ACG 인바운드 규칙 확인
   - 허용: TCP 80 (certbot 검증·HTTPS 리다이렉트), TCP 443, (기존 SSH 22는 관리자 IP 대역만)
   - **금지: 3001(Fastify)·5432(PostgreSQL)는 절대 개방하지 않는다** — 루프백 전용
3. VM 내 ufw를 쓰고 있다면 동일 원칙 적용: `sudo ufw allow 80,443/tcp`

### 2.2 런타임 설치 (VM에서, sudo)

```bash
# Node.js 22 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 16 (PGDG 저장소)
sudo apt-get install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt-get install -y postgresql-16

# PostgreSQL 이 루프백에만 열려 있는지 확인 (기본값 localhost — 변경 금지)
sudo -u postgres psql -c "SHOW listen_addresses;"   # 'localhost' 이어야 함
```

### 2.3 DB·계정 생성 (VM에서)

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE guestbook_app LOGIN PASSWORD '<강한 비밀번호 — openssl rand -base64 24>';
CREATE DATABASE guestbook OWNER guestbook_app;
SQL
```

비밀번호는 즉시 2.4의 env 파일에만 기록 (커밋·채팅 공유 금지).

### 2.4 코드 배포·환경변수·마이그레이션

```bash
# 배포 위치 (예): /opt/koscomlabor
sudo mkdir -p /opt/koscomlabor && sudo chown $USER /opt/koscomlabor
cd /opt/koscomlabor && git clone <저장소 URL> app   # 이후 배포는 git pull
cd app/server && npm ci && npm run build

# 환경변수 파일 (systemd 용, root 소유·600)
sudo mkdir -p /etc/koscomlabor
sudo tee /etc/koscomlabor/server.env > /dev/null <<'ENV'
HOST=127.0.0.1
PORT=3001
DATABASE_URL=postgres://guestbook_app:<비밀번호>@127.0.0.1:5432/guestbook
ADMIN_API_TOKEN=<openssl rand -base64 32 결과>
IP_HASH_SECRET=<openssl rand -base64 32 결과>
CORS_ORIGINS=https://koscomlabor.cloud,https://www.koscomlabor.cloud,https://onnuri.koscomlabor.cloud
TRUST_PROXY=true
LOG_LEVEL=info
ENV
sudo chmod 600 /etc/koscomlabor/server.env

# 마이그레이션 (env 파일 주입)
set -a; source /etc/koscomlabor/server.env; set +a
npx node-pg-migrate up -m migrations --migration-file-language sql
```

주의: `IP_HASH_SECRET`은 한번 정하면 유지한다 (변경 시 기존 ip_hash와의 동일 IP 대조가 끊김 — 중복 내용 제한이 리셋됨). `ADMIN_API_TOKEN`은 유출 의심 시 즉시 교체 + 서비스 재시작.

### 2.5 systemd 서비스

`/etc/systemd/system/koscomlabor-api.service`:

```ini
[Unit]
Description=Koscomlabor guestbook API (Fastify)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/koscomlabor/app/server
EnvironmentFile=/etc/koscomlabor/server.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=3
# 보안 강화
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now koscomlabor-api
curl -s http://127.0.0.1:3001/health   # {"status":"ok"}
journalctl -u koscomlabor-api -n 20    # 로그 확인 (개인정보 없음)
```

### 2.6 nginx 리버스 프록시 + TLS

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/api.koscomlabor.cloud`:

```nginx
server {
    listen 80;
    server_name api.koscomlabor.cloud;

    # certbot 이 이 블록을 443 으로 승격시킨다
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;  # rate limit 용 실제 IP — 필수
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 32k;   # 앱 bodyLimit(16KB)의 상위 방어선
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api.koscomlabor.cloud /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.koscomlabor.cloud   # DNS A 레코드 전파 후 실행 (자동 갱신 타이머 포함)
```

기존 VM에서 onnuri.koscomlabor.cloud 용 nginx 설정이 이미 있으면 **별도 server 블록으로 공존**한다 — 기존 설정을 수정하지 않는다.

### 2.7 배포 검증 체크리스트

```bash
curl -s https://api.koscomlabor.cloud/health                       # {"status":"ok"}
curl -s https://api.koscomlabor.cloud/guestbook                    # [] 또는 배열
curl -s -X POST https://api.koscomlabor.cloud/guestbook \
  -H "Content-Type: application/json" -d '{"author":"배포검증","body":"[배포 검증 테스트 — 삭제 예정]"}'   # 201
# 위에서 받은 id 로 관리자 삭제 (검증 글 정리)
curl -s -X DELETE https://api.koscomlabor.cloud/admin/guestbook/<id> \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"                      # 200
# CORS: 허용 Origin 에서만 access-control-allow-origin 반환 확인
curl -s -D - -o /dev/null -X OPTIONS https://api.koscomlabor.cloud/guestbook \
  -H "Origin: https://onnuri.koscomlabor.cloud" -H "Access-Control-Request-Method: POST"
```

이후 프론트 배포 환경에 `NEXT_PUBLIC_API_BASE_URL=https://api.koscomlabor.cloud` 설정 → web-developer 에 통보.

### 2.8 백업 (명세 1.4절 실행분)

`/usr/local/bin/koscomlabor-backup.sh` (root, 700):

```bash
#!/bin/bash
set -euo pipefail
BACKUP_DIR=/var/backups/koscomlabor
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d)
sudo -u postgres pg_dump -Fc guestbook > "$BACKUP_DIR/guestbook_${STAMP}.dump"
# 14일 롤링
find "$BACKUP_DIR" -name 'guestbook_*.dump' -mtime +14 -delete
# 2차 보관: NCP Object Storage (버킷 확보 후 주석 해제 — S3 호환 API)
# aws --endpoint-url=https://kr.object.ncloudstorage.com s3 cp \
#   "$BACKUP_DIR/guestbook_${STAMP}.dump" s3://<버킷명>/guestbook/
```

crontab (root): 
```
0 3 * * *  /usr/local/bin/koscomlabor-backup.sh                      # 매일 03:00 KST 백업
30 3 * * * sudo -u postgres psql -d guestbook -c "UPDATE guestbook_entries SET ip_hash = NULL WHERE created_at < now() - interval '90 days' AND ip_hash IS NOT NULL;"   # ip_hash 90일 보존 (리더 승인 조건)
```

복구: `sudo -u postgres pg_restore --clean --if-exists -d guestbook /var/backups/koscomlabor/guestbook_<날짜>.dump`
복구 검증(월 1회): 임시 DB에 복원 후 `SELECT count(*) FROM guestbook_entries;` 행 수 대조.

### 2.9 [사용자 콘솔 작업 B] NCP Object Storage (2차 백업)

1. NCP 콘솔 → Object Storage → 버킷 생성 (예: `koscomlabor-backup`, **비공개**)
2. 마이페이지 → 인증키 관리 → **백업 전용 Sub Account 권장** (Object Storage 해당 버킷 쓰기 권한만)
3. VM에 자격증명 설정 후 2.8 스크립트의 주석 해제 (자격증명 파일 600 권한)

### 2.10 업데이트 배포 절차 (반복 배포)

```bash
cd /opt/koscomlabor/app && git pull
cd server && npm ci && npm run build
set -a; source /etc/koscomlabor/server.env; set +a
npx node-pg-migrate up -m migrations --migration-file-language sql   # 새 마이그레이션 있을 때
sudo systemctl restart koscomlabor-api
curl -s https://api.koscomlabor.cloud/health
```

롤백: `git checkout <직전 태그/커밋>` 후 동일 절차. DB 마이그레이션 롤백은 `npm run migrate:down` (파괴적일 수 있으므로 백업 확인 후).

---

## 3. 로컬 실검증 결과 요약

- **typecheck**: `tsc -p tsconfig.json --noEmit` 통과 (strict + noUncheckedIndexedAccess 등)
- **build**: `tsc` emit 정상 (`dist/`)
- **lint**: 루트 eslint는 `server/**` 제외 구성 (백엔드는 자체 tsc로 검증). 루트 프론트 `tsc --noEmit`도 통과 — server 추가로 인한 프론트 영향 없음
- **curl 실측**: 27케이스 전부 PASS — 상세 표는 `06_backend_api_spec.md` 9절 (정상 등록/조회, 검증 실패 7종, 413/404/429, 중복 내용 400, 관리자 삭제 4종, CORS 허용/차단, GET rate limit, 경계값 20/500자)
- **개인정보**: DB에 ip_hash(HMAC 64hex)만 저장·원문 IP 없음, 로그에 본문·닉네임·클라이언트 IP 없음 (grep 실측)

## 4. web-developer 통보 사항 (리더 경유)

1. 프론트 폼 maxLength: author 20자 / body 500자 (서버와 동일 수치)
2. 승인된 계약 변경 A(페이지네이션 옵션)·C(에러 code 분기) 반영 시 참조: 에러 형식 `{ error: { code, message } }`, code 목록은 명세 2.4절. 특히 429 `RATE_LIMITED`(+`Retry-After` 헤더)와 400 `VALIDATION_ERROR`의 message는 사용자 표시 가능한 한국어 문구
3. 연동 시 `NEXT_PUBLIC_API_BASE_URL=https://api.koscomlabor.cloud` (배포 완료 후 확정 통보)

## 5. 운영 시 알아둘 것

- rate limit 카운터는 프로세스 메모리 — 서비스 재시작 시 초기화 (수용된 설계)
- 성공 등록 후 30초 내 POST는 내용 무관 429 (프론트는 등록 성공 후 폼을 비우고 재제출을 막는 UX 권장)
- 관리자 삭제는 soft delete — 데이터는 DB에 남음. 완전 삭제가 필요한 요청(개인정보 삭제 요구 등)은 psql로 해당 행 DELETE (절차: 백업 후 `DELETE FROM guestbook_entries WHERE id='<id>';`)
- `GET /health`에는 rate limit 미적용 (모니터링용)

## 6. 배포 전 사용자 확인 필요 사항

1. VM 접속 방법(SSH)·OS 종류/버전·여유 리소스 (본 가이드는 Ubuntu 기준)
2. 기존 VM의 nginx 사용 여부·설정 위치 (onnuri 서비스와의 공존 확인)
3. `api.koscomlabor.cloud` DNS 관리 위치 (A 레코드 추가 권한)
4. NCP 콘솔 작업 A(2.1)·B(2.9) 수행 가능 여부
