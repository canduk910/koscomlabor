/**
 * 지리 계산 순수 함수 (디자인 스펙 §20.14.3).
 *
 * "내 위치"의 거리·방위·정확도 표기가 여기서 나온다. 전부 **계산값**이며 창작이 아니다.
 * 부수효과가 없으므로 서버·클라이언트 어디서든 안전하다.
 */

/** 지구 평균 반지름(m) — 하버사인 표준값 */
const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** 두 좌표 사이 대권거리(m). 하버사인 — 수 km 범위에서 오차 무시 가능 */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** 8방위 한글 라벨. 인덱스는 북(0)에서 시계방향 45°씩 */
const BEARING_LABELS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"] as const;

/**
 * `from` 에서 본 `to` 의 8방위 한글 라벨.
 * 화면에는 **"집결 위치에서 {방위}"** 로 나가므로 기준점이 집결 위치임에 주의한다.
 */
export function bearingLabel8(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  const index = Math.round(((deg % 360) + 360) / 45) % 8;
  return BEARING_LABELS[index] ?? BEARING_LABELS[0];
}

/**
 * 거리 한국어 표기 (§20.14.3).
 * **1000m 미만은 10m 단위 반올림**(`약 480m`), **1km 이상은 소수 1자리**(`약 3.2km`).
 * GPS 값을 1m 단위로 쓰면 갖고 있지 않은 정밀도를 주장하게 된다.
 */
export function formatDistanceKo(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 1000) return `약 ${Math.round(meters / 10) * 10}m`;
  return `약 ${(meters / 1000).toFixed(1)}km`;
}
