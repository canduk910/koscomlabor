#!/bin/bash
# 프론트 재배포 스크립트 (서버 배치: /root/koscomlabor-web/deploy.sh)
#
# 용도 2가지:
#  - 코드 반영 배포: CI(.github/workflows/deploy.yml)가 rsync 로 /root/koscomlabor-web/src/ 를
#    갱신한 뒤 이 스크립트를 실행한다
#  - 일일 재빌드(크론 00:10 KST): rsync 없이 실행 — BUILD_DATE 캐시 버스트로
#    npm run build 만 재실행되어 마감 스트립 D-n 표기가 당일 날짜 기준으로 갱신된다
#
# 배포 설정 동기화 (2026-08-19, 07 문서 §12):
#   docker-compose.yml 의 단일 출처는 저장소 deploy/web/docker-compose.yml 이다.
#   CI rsync 가 src/deploy/web/ 로 실어 나르고, sync_compose 가 빌드 직전 루트로 복사한다.
#   배포 키는 command 제한으로 src/ 하위에만 쓸 수 있어 CI 가 루트에 직접 못 올리기 때문.
#
#   ! deploy.sh 자신은 자동 동기화하지 않는다 — 실행 중 자기 파일을 덮어쓰면 bash 가
#     오동작할 수 있다. 이 스크립트를 고칠 때는 저장소 deploy/web/deploy.sh 를 고치고
#     수동으로 서버에 반영한다 (scp + chmod 700).
set -euo pipefail
cd /root/koscomlabor-web

SRC_COMPOSE=src/deploy/web/docker-compose.yml
DST_COMPOSE=docker-compose.yml

# 저장소의 compose 를 루트로 반영한다. 크론 경로(rsync 없이 단독 실행)와 첫 배포 전을
# 포함해 어떤 실행 경로에서도 안전해야 한다 — 07 문서 §12.5 표 참조.
sync_compose() {
  if [ ! -f "$SRC_COMPOSE" ]; then
    echo "[compose] 원본 없음($SRC_COMPOSE) — 기존 $DST_COMPOSE 유지"
    return 0
  fi
  if cmp -s "$SRC_COMPOSE" "$DST_COMPOSE"; then
    echo "[compose] 변경 없음"
    return 0
  fi

  local bak
  bak="/root/backups/compose_web_$(date +%Y%m%d_%H%M%S).auto.yml"
  cp -p "$DST_COMPOSE" "$bak"
  cp "$SRC_COMPOSE" "$DST_COMPOSE"
  echo "[compose] 갱신 — 이전본 백업: $bak"
  diff -u "$bak" "$DST_COMPOSE" || true

  # 깨진 compose 로 빌드에 들어가지 않는다. 검증 실패 시 되돌리고 중단해
  # "배포는 성공, 반영은 안 됨" 상태를 만들지 않는다 (§12.5).
  if ! docker compose config -q; then
    cp -p "$bak" "$DST_COMPOSE"
    echo "[compose] 검증 실패 — 이전본으로 되돌리고 배포 중단" >&2
    return 1
  fi
}

echo "=== $(date '+%F %T') deploy start (BUILD_DATE=$(date +%F)) ==="
sync_compose
docker compose build --build-arg BUILD_DATE="$(date +%F)"
docker compose up -d web

# 확인
sleep 3
docker ps --filter name=koscomlabor-web --format "{{.Names}} {{.Status}}"
docker exec onnuri-caddy wget -qO /dev/null http://koscomlabor-web:3000/ && echo "web reachable from caddy: OK"
echo "=== $(date '+%F %T') deploy done ==="
