/**
 * SSRF 방어용 IP 검증 (명세 06 §13.2).
 * 사설·예약·링크로컬·멀티캐스트 대역을 전면 차단한다.
 */
import net from "node:net";

/** IPv4 문자열 → 32bit 정수 */
function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  const [a, b, c, d] = parts;
  if (a === undefined || b === undefined || c === undefined || d === undefined) return -1;
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

interface Cidr {
  base: number;
  maskBits: number;
}

function cidr(spec: string): Cidr {
  const [ip, bits] = spec.split("/");
  return { base: ipv4ToInt(ip ?? ""), maskBits: Number.parseInt(bits ?? "32", 10) };
}

/** 차단 IPv4 대역 (사설·루프백·링크로컬·예약·멀티캐스트·CGN·벤치마크) */
const BLOCKED_V4: Cidr[] = [
  cidr("0.0.0.0/8"),
  cidr("10.0.0.0/8"),
  cidr("100.64.0.0/10"),
  cidr("127.0.0.0/8"),
  cidr("169.254.0.0/16"), // 링크로컬 — 클라우드 메타데이터 서비스 포함
  cidr("172.16.0.0/12"),
  cidr("192.0.0.0/24"),
  cidr("192.0.2.0/24"),
  cidr("192.168.0.0/16"),
  cidr("198.18.0.0/15"),
  cidr("198.51.100.0/24"),
  cidr("203.0.113.0/24"),
  cidr("224.0.0.0/4"), // 멀티캐스트
  cidr("240.0.0.0/4"), // 예약 + 브로드캐스트
];

function isBlockedV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value < 0) return true; // 파싱 불가 → 차단
  return BLOCKED_V4.some(({ base, maskBits }) => {
    const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
    return (value & mask) === (base & mask);
  });
}

/**
 * 공인 IP 여부. 사설·예약 대역이면 false.
 * IPv6 는 루프백·링크로컬·ULA·미지정·NAT64·IPv4-mapped 를 차단하고,
 * IPv4-mapped 는 내장 IPv4 로 재검사한다.
 */
export function isPublicIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return !isBlockedV4(ip);
  if (family !== 6) return false;

  const lower = ip.toLowerCase();
  // IPv4-mapped (::ffff:a.b.c.d) → 내장 IPv4 재검사
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped !== null && mapped[1] !== undefined) return !isBlockedV4(mapped[1]);

  if (lower === "::" || lower === "::1") return false;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return false; // fe80::/10 링크로컬
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) return false; // fc00::/7 ULA
  if (lower.startsWith("ff")) return false; // 멀티캐스트
  if (lower.startsWith("64:ff9b:")) return false; // NAT64 (내장 IPv4 검사 불가 → 보수적으로 차단)
  if (lower.startsWith("2001:db8:")) return false; // 문서용
  return true;
}
