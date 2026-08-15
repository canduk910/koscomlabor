#!/usr/bin/env node
// WCAG 2.x 대비 비율 검사기
// 사용법:
//   node check-contrast.mjs "#전경색" "#배경색"          — 한 쌍 검사
//   node check-contrast.mjs "#fg1:#bg1" "#fg2:#bg2" ...  — 여러 쌍 일괄 검사

function hexToRgb(hex) {
  const h = hex.replace(/^#/, "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`잘못된 hex 색상: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const [l1, l2] = [luminance(hexToRgb(fg)), luminance(hexToRgb(bg))];
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function grade(r) {
  const marks = [];
  marks.push(r >= 7 ? "AAA(본문) 통과" : r >= 4.5 ? "AA(본문) 통과 — AAA 미달" : "본문 사용 불가");
  marks.push(r >= 4.5 ? "AAA(큰텍스트) 통과" : r >= 3 ? "AA(큰텍스트)·UI 통과" : "UI 사용 불가");
  return marks.join(" | ");
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('사용법: check-contrast.mjs "#fg" "#bg"  또는  "#fg:#bg" 쌍 나열');
  process.exit(2);
}

const pairs = args[0].includes(":")
  ? args.map((a) => a.split(":"))
  : [[args[0], args[1]]];

let failed = false;
for (const [fg, bg] of pairs) {
  if (!fg || !bg) { console.error(`쌍이 불완전합니다: ${fg}:${bg}`); process.exit(2); }
  const r = ratio(fg, bg);
  if (r < 4.5) failed = true;
  console.log(`${fg} on ${bg}  →  ratio ${r.toFixed(2)}  →  ${grade(r)}`);
}
process.exit(failed ? 1 : 0);
