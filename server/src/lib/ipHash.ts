/**
 * IP 처리 원칙 (리더 승인 2026-08-16, 명세 4.1절):
 * - 원문 IP는 DB·로그 어디에도 저장하지 않는다
 * - DB에는 서버 시크릿 salt 를 섞은 HMAC-SHA-256 해시만 저장 (역산 불가)
 * - 보존 90일 후 배치로 NULL 처리 (배포 가이드의 유지보수 크론 참조)
 */
import { createHmac } from "node:crypto";

export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}
