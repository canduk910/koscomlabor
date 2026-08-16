/**
 * 서버 엔트리포인트. 설정 로드 → 앱 조립 → 기동.
 * 프로덕션에서는 systemd 가 이 프로세스를 관리한다 (07_backend_impl.md).
 */
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ host: config.host, port: config.port });
}

main().catch((error: unknown) => {
  // 기동 실패는 표준 에러로 명확히 알리고 종료 (systemd 재시작 대상)
  console.error("서버 기동 실패:", error instanceof Error ? error.message : error);
  process.exit(1);
});
