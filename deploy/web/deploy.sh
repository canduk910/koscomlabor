#!/bin/bash
# 프론트 재배포 스크립트 (서버 배치: /root/koscomlabor-web/deploy.sh)
# 사전: 로컬 머신에서 rsync 로 /root/koscomlabor-web/src/ 갱신
#   rsync -az --delete \
#     --exclude node_modules --exclude .next --exclude .git --exclude .idea --exclude .claude \
#     --exclude _workspace --exclude server --exclude deploy --exclude "*.pem" --exclude ".env*" \
#     ./ root@101.79.31.30:/root/koscomlabor-web/src/
set -euo pipefail
cd /root/koscomlabor-web

docker compose build
docker compose up -d web

# 확인
sleep 3
docker ps --filter name=koscomlabor-web --format "{{.Names}} {{.Status}}"
docker exec onnuri-caddy wget -qO /dev/null http://koscomlabor-web:3000/ && echo "web reachable from caddy: OK"
