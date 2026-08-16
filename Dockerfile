# syntax=docker/dockerfile:1
# 프론트(Next.js) 프로덕션 이미지 — node:22-alpine 멀티스테이지 (standalone 출력)
#
# NEXT_PUBLIC_* 은 빌드타임에 번들에 임베드되므로 build ARG 로 주입한다:
#   docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://union-api.koscomlabor.cloud .
# (compose: deploy/web/docker-compose.yml 의 build.args 에서 주입)

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# postinstall(scripts/sync-pretendard.mjs)이 npm ci 시점에 실행되므로 scripts/ 를 먼저 복사
COPY scripts ./scripts
RUN npm ci

FROM deps AS build
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# 일일 재빌드 캐시 버스트: 마감 스트립 D-n 이 빌드 시점 고정이므로
# BUILD_DATE 가 바뀌면 이 지점부터 재실행된다 (deps 캐시는 유지)
ARG BUILD_DATE=dev
RUN echo "build date: $BUILD_DATE" && npm run build

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# content/ 는 런타임 fs 읽기 대상 (공지·소식 마크다운) — standalone 트레이싱에 안 잡힐 수 있어 명시 복사
COPY --from=build /app/content ./content
USER node
EXPOSE 3000
CMD ["node", "server.js"]
