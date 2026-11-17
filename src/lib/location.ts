import * as Location from 'expo-location';

export type Coords = { lat: number; lon: number };

const TIMEOUT_MS = 10_000;

/**
 * 「내 주변 찾기」를 눌렀을 때만 호출한다 (사용자 결정 2026-11-05).
 * 앱 사용 중 권한만 요청하고, 좌표는 기기 안에서 거리 계산에만 쓴다 — 서버로 보내거나 저장하지 않는다.
 *
 * 순서: 위치 서비스 켜짐 확인 → 권한 → 최근 위치(5분 안) → 현재 위치(10초 안) → 실패하면 최근 위치(1시간 안)
 * 실패 이유를 나눠서 알려준다 (위치 서비스 꺼짐 / 권한 없음 / 시간 초과)
 */
export async function getCurrentCoords(): Promise<{ coords: Coords } | { error: string }> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      return { error: '휴대폰의 위치 서비스가 꺼져 있어요. 설정에서 켜거나 지역을 골라 찾아 주세요.' };
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      return { error: '위치 권한이 없어 현재 위치를 쓸 수 없어요. 설정에서 허용하거나 지역을 골라 주세요.' };
    }
    const recent = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    if (recent) return { coords: { lat: recent.coords.latitude, lon: recent.coords.longitude } };

    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]).catch(() => null);
    if (fresh) return { coords: { lat: fresh.coords.latitude, lon: fresh.coords.longitude } };

    // 지금 위치를 못 잡으면 1시간 안의 마지막 위치라도 (실내·지하 등)
    const older = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60_000 });
    if (older) return { coords: { lat: older.coords.latitude, lon: older.coords.longitude } };
    return { error: '위치를 잡지 못했어요(신호 약함). 바깥에서 다시 시도하거나 지역을 골라 주세요.' };
  } catch {
    return { error: '현재 위치를 확인하지 못했어요. 잠시 후 다시 시도하거나 지역을 골라 주세요.' };
  }
}
