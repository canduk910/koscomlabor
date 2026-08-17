# syntax=docker/dockerfile:1
# 멀티스테이지: build(전체 deps + tsc) → prod(프로덕션 deps + dist 만)

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
RUN npm run build
# 이 스테이지는 마이그레이션 실행용으로도 쓰인다 (node-pg-migrate 는 devDependency)
#
# scripts/ COPY 는 2026-08-17 추가. 이전에는 누락돼 있어서 07 §9.7(비밀번호 분실 복구)의
# `docker compose --profile tools run --rm -T migrate node scripts/set-password.mjs` 가
# 이미지 안에 파일이 없어 실패하는 상태였다 (프로덕션에서 실행된 적이 없어 드러나지 않음).

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# 운영 스크립트 — 썸네일 소급 적용(backfill-thumbnails.mjs)은 **uploads 볼륨이 마운트된
# 이 컨테이너에서** 실행해야 한다 (migrate 서비스에는 볼륨이 없어 파일이 유실된다).
# 실행: docker compose exec api node scripts/backfill-thumbnails.mjs
# 스크립트는 dist/ 의 컴파일 결과를 import 하므로 로직 중복이 없다 (07 §11.6).
COPY scripts ./scripts
# 업로드 볼륨 마운트 지점을 node 소유로 준비 —
# 신규 명명 볼륨은 이미지의 소유권/권한을 물려받는다 (root 소유 시 EACCES, 실측 확인)
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
