import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 배포용: 서버 런타임을 .next/standalone 으로 self-contained 출력
  output: "standalone",
};

export default nextConfig;
