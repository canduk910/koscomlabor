/**
 * 업로드 화이트리스트 (명세 06 §13.3, 리더 승인 §15-5):
 * pdf/png/jpg/webp — 확장자 + MIME + 매직 바이트 3중 검사.
 */

export interface AllowedType {
  ext: string;
  mime: string;
  matches: (buffer: Buffer) => boolean;
  disposition: "inline" | "attachment";
}

const ALLOWED: AllowedType[] = [
  {
    ext: ".pdf",
    mime: "application/pdf",
    matches: (b) => b.length >= 4 && b.subarray(0, 4).toString("latin1") === "%PDF",
    disposition: "attachment",
  },
  {
    ext: ".png",
    mime: "image/png",
    matches: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
    disposition: "inline",
  },
  {
    ext: ".jpg",
    mime: "image/jpeg",
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    disposition: "inline",
  },
  {
    ext: ".webp",
    mime: "image/webp",
    matches: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("latin1") === "RIFF" &&
      b.subarray(8, 12).toString("latin1") === "WEBP",
    disposition: "inline",
  },
];

/** 파일명 확장자 + 선언 MIME + 실제 내용(매직 바이트)이 모두 일치하는 허용 타입 반환. 불일치 시 null */
export function resolveAllowedType(filename: string, declaredMime: string, head: Buffer): AllowedType | null {
  const lower = filename.toLowerCase();
  for (const type of ALLOWED) {
    const extMatch = type.ext === ".jpg" ? lower.endsWith(".jpg") || lower.endsWith(".jpeg") : lower.endsWith(type.ext);
    if (extMatch && declaredMime.toLowerCase() === type.mime && type.matches(head)) {
      return type;
    }
  }
  return null;
}

export function dispositionFor(mime: string): "inline" | "attachment" {
  return ALLOWED.find((type) => type.mime === mime)?.disposition ?? "attachment";
}

/** 표시용 파일명 정리 — 경로 구분자·제어 문자 제거, 255자 제한 */
export function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = name.replace(/[/\\\u0000-\u001F\u007F]/g, "_").trim();
  const limited = [...cleaned].slice(0, 255).join("");
  return limited.length > 0 ? limited : "file";
}
