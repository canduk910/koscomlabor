/**
 * ADMIN_PASSWORD_HASH 생성 도구 (argon2id).
 *
 * 사용법 (평문이 셸 히스토리에 남지 않게 stdin 사용):
 *   node scripts/hash-password.mjs            # 프롬프트 없이 stdin 한 줄을 읽음
 *   echo -n "<비밀번호>" | node scripts/hash-password.mjs
 *
 * 출력: argon2id 해시 1줄 (해시는 비밀이 아니지만 평문은 절대 출력하지 않는다)
 */
import argon2 from "argon2";

let input = "";
process.stdin.setEncoding("utf-8");
for await (const chunk of process.stdin) input += chunk;
const password = input.replace(/\r?\n$/, "");

if (password.length < 12) {
  console.error("비밀번호는 12자 이상이어야 합니다.");
  process.exit(1);
}

const hash = await argon2.hash(password, { type: argon2.argon2id });
console.log(hash);
