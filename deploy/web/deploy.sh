#!/bin/bash
# 프론트 재배포 스크립트 (서버 배치: /root/koscomlabor-web/deploy.sh)
#
# 용도 2가지:
#  - 코드 반영 배포: 로컬에서 rsync 로 /root/koscomlabor-web/src/ 갱신 후 이 스크립트 실행
#  - 일일 재빌드(크론 00:10 KST): rsync 없이 실행 — BUILD_DATE 캐시 버스트로
#    npm run build 만 재실행되어 마감 스트립 D-n 표기가 당일 날짜 기준으로 갱신된다
#
#   rsync -az --delete \
#     --exclude node_modules --exclude .next --exclude .git --exclude .idea --exclude .claude \
#     --exclude _workspace --exclude server --exclude deploy --exclude "*.pem" --exclude ".env*" \
#     ./ root@101.79.31.30:/root/koscomlabor-web/src/
set -euo pipefail
cd /root/koscomlabor-web

echo "=== $(date '+%F %T') deploy start (BUILD_DATE=$(date +%F)) ==="
docker compose build --build-arg BUILD_DATE="$(date +%F)"
docker compose up -d web

# 확인
sleep 3
docker ps --filter name=koscomlabor-web --format "{{.Names}} {{.Status}}"
docker exec onnuri-caddy wget -qO /dev/null http://koscomlabor-web:3000/ && echo "web reachable from caddy: OK"
echo "=== $(date '+%F %T') deploy done ==="
