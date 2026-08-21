import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 백엔드(server/)는 자체 패키지·tsconfig로 검증한다 — 프론트 lint 대상 아님
    "server/**",
    // QA 측정 도구(Playwright MCP)가 남기는 산출물 — .gitignore 대상이므로 lint 대상도 아니다.
    // 측정 중에 계속 새로 생기므로 지우는 것이 아니라 범위에서 빼는 것이 맞다(`server/**` 와 같은 계열).
    ".playwright-mcp/**",
  ]),
]);

export default eslintConfig;
