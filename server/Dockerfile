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
RUN npm run build
# 이 스테이지는 마이그레이션 실행용으로도 쓰인다 (node-pg-migrate 는 devDependency)

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# 업로드 볼륨 마운트 지점을 node 소유로 준비 —
# 신규 명명 볼륨은 이미지의 소유권/권한을 물려받는다 (root 소유 시 EACCES, 실측 확인)
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
