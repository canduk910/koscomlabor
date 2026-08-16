/**
 * Pretendard Variable 다이나믹 서브셋을 public/으로 동기화 (디자인 스펙 §11.2 방식 A).
 * - 출처: npm `pretendard` 패키지 (SIL OFL 1.1) — 외부 CDN 미사용, 셀프호스팅.
 * - postinstall에서 실행되므로 클론 직후에도 자산이 보장된다.
 * - public/fonts/pretendard/ 는 생성물이므로 .gitignore 대상.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, "node_modules", "pretendard", "dist", "web", "variable");
const dest = path.join(root, "public", "fonts", "pretendard");

if (!fs.existsSync(src)) {
  console.error("[sync-pretendard] pretendard 패키지를 찾을 수 없습니다. npm install을 먼저 실행하세요.");
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

fs.copyFileSync(
  path.join(src, "pretendardvariable-dynamic-subset.css"),
  path.join(dest, "pretendardvariable-dynamic-subset.css"),
);
fs.cpSync(
  path.join(src, "woff2-dynamic-subset"),
  path.join(dest, "woff2-dynamic-subset"),
  { recursive: true },
);

const count = fs.readdirSync(path.join(dest, "woff2-dynamic-subset")).length;
console.log(`[sync-pretendard] 완료 — CSS 1개 + woff2 서브셋 ${count}개 → public/fonts/pretendard/`);
