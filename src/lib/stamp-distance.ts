/**
 * 탐험 도장 거리 확인 (2026-11-26, 원스토어 심사 대비).
 * 현재 위치는 폰 안에서만 쓰고, 서버에는 「몇 m 안」 구간(100·300·500)만 보낸다 → 위치정보 미전송.
 */
const R = 6371000;

export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 반경 안이면 보낼 구간, 밖이면 화면에 보일 안내 문구 */
export function stampBucket(m: number, radiusM: number, what: string): { within: 100 | 300 | 500 } | { error: string } {
  if (m > radiusM) {
    const dist = m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
    return { error: `${what}에서 ${dist} 떨어져 있어요. ${radiusM}m 안에서 찍을 수 있어요` };
  }
  return { within: m <= 100 ? 100 : m <= 300 ? 300 : 500 };
}
