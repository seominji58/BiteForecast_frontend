import * as Location from 'expo-location';

export type Coords = { lat: number; lon: number };

/**
 * 「내 주변 찾기」를 눌렀을 때만 호출한다 (사용자 결정 2026-11-05).
 * 앱 사용 중 권한만 요청하고, 좌표는 기기 안에서 거리 계산에만 쓴다 — 서버로 보내거나 저장하지 않는다.
 */
export async function getCurrentCoords(): Promise<{ coords: Coords } | { error: string }> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      return { error: '위치 권한이 없어 현재 위치를 쓸 수 없어요. 지역을 골라 찾아 주세요.' };
    }
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { coords: { lat: pos.coords.latitude, lon: pos.coords.longitude } };
  } catch {
    return { error: '현재 위치를 확인하지 못했어요. 잠시 후 다시 시도하거나 지역을 골라 주세요.' };
  }
}
