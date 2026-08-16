/**
 * 환경변수 파싱·검증. 필수 값이 없으면 기동을 거부한다 (런타임에 조용히 깨지는 것 금지).
 */

export interface AppConfig {
  host: string;
  port: number;
  databaseUrl: string;
  adminApiToken: string;
  adminPasswordHash: string;
  ipHashSecret: string;
  corsOrigins: string[];
  trustProxy: boolean;
  logLevel: string;
  uploadDir: string;
  /** 세션 쿠키 Secure 속성 — 프로덕션 true 고정, 로컬 http 테스트 시에만 false */
  cookieSecure: boolean;
}

function required(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`환경변수 ${name} 이(가) 설정되지 않았습니다. server/.env.example 참조.`);
  }
  return value.trim();
}

export function loadConfig(): AppConfig {
  const adminApiToken = required("ADMIN_API_TOKEN");
  if (adminApiToken.length < 32) {
    throw new Error("ADMIN_API_TOKEN 은 32자 이상이어야 합니다 (openssl rand -base64 32 권장).");
  }
  const ipHashSecret = required("IP_HASH_SECRET");
  if (ipHashSecret.length < 32) {
    throw new Error("IP_HASH_SECRET 은 32자 이상이어야 합니다 (openssl rand -base64 32 권장).");
  }

  const port = Number.parseInt(process.env.PORT ?? "3001", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT 가 올바르지 않습니다.");
  }

  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    "https://koscomlabor.cloud,https://www.koscomlabor.cloud,https://onnuri.koscomlabor.cloud"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (corsOrigins.length === 0 || corsOrigins.includes("*")) {
    throw new Error("CORS_ORIGINS 는 명시적 Origin 목록이어야 합니다 ('*' 금지).");
  }

  const adminPasswordHash = required("ADMIN_PASSWORD_HASH");
  if (!adminPasswordHash.startsWith("$argon2") && !adminPasswordHash.startsWith("$2")) {
    throw new Error("ADMIN_PASSWORD_HASH 는 argon2/bcrypt 해시여야 합니다 (scripts/hash-password.mjs 로 생성).");
  }

  return {
    host: process.env.HOST ?? "127.0.0.1",
    port,
    databaseUrl: required("DATABASE_URL"),
    adminApiToken,
    adminPasswordHash,
    ipHashSecret,
    corsOrigins,
    trustProxy: (process.env.TRUST_PROXY ?? "true") === "true",
    logLevel: process.env.LOG_LEVEL ?? "info",
    uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
    cookieSecure: (process.env.COOKIE_SECURE ?? "true") === "true",
  };
}
