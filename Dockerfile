# syntax=docker/dockerfile:1
# 프론트(Next.js) 프로덕션 이미지 — node:22-alpine 멀티스테이지 (standalone 출력)
#
# NEXT_PUBLIC_* 은 빌드타임에 번들에 임베드되므로 build ARG 로 주입한다:
#   docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://union-api.koscomlabor.cloud .
# (compose: deploy/web/docker-compose.yml 의 build.args 에서 주입)

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

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
