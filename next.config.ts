import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 배포용: 서버 런타임을 .next/standalone 으로 self-contained 출력
  output: "standalone",

  images: {
    /*
     * ★ **`quality` 허용 목록**(2026-08-26 추가 · 디자이너 실측으로 발견).
     *
     * Next **16** 부터 `images.qualities` 기본값이 **`[75]`** 다. 목록에 없는 값을 요청하면
     * 옵티마이저가 **HTTP 400** 을 내고, `next/image` 는 조용히 기본값으로 떨어진다.
     * 그래서 `rally-2026-08-28/page.tsx` 의 배치도가 **`quality={90}` 을 선언했는데
     * 실제 `srcset` 8개 후보가 전부 `q=75` 로 나가고 있었다**(실측).
     *
     * ⚠ **이번 이미지 교체 작업이 만든 결함이 아니다** — 종전 `rally-layout.png` 도 같은 상태였다.
     * 선언과 실제가 어긋난 채 두면 다음 사람이 *"우리는 q=90 으로 낸다"* 를 근거로 삼는다.
     *
     * **90 이 필요한 이유**: 배치도는 **이미지 안에 읽어야 할 문자가 있다**(구역 라벨·무대 이름).
     * 검증 §44 조건 7 이 «quality 90 이상» 을 게시 조건으로 건다.
     *
     * ⚠ **허용 목록이라 75 를 빼면 안 된다** — `quality` 를 지정하지 않은 나머지 이미지가 전부 400 이 된다.
     * ⚠ 값을 늘릴 때마다 변형이 그만큼 더 생성·캐시된다. **필요한 값만 넣어라.**
     */
    qualities: [75, 90],
  },
};

export default nextConfig;
