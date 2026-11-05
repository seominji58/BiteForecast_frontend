import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** 기기에만 저장하는 작은 설정값 (홈 화면 기준 낚시터 등) */
async function read(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function write(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

const HOME_PLACE = 'biteforecast.home_place_id';

const RECENT = 'biteforecast.recent_place_ids';
const RECENT_MAX = 5;

/** 최근 선택한 낚시터 (기기 저장, 최대 5곳, 최신 순) */
export async function getRecentPlaceIds(): Promise<number[]> {
  try {
    const v = await read(RECENT);
    const ids = v ? JSON.parse(v) : [];
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

export async function pushRecentPlace(id: number): Promise<void> {
  const ids = await getRecentPlaceIds();
  await write(RECENT, JSON.stringify([id, ...ids.filter((x) => x !== id)].slice(0, RECENT_MAX))).catch(() => undefined);
}

/** 홈 화면 기준 낚시터. 저장된 값이 없으면 null → 홈에서 첫 실행 선택 화면을 보여준다 */
export function useHomePlace(): [number | null, (id: number) => void, boolean] {
  const [id, setId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    read(HOME_PLACE)
      .catch(() => null)
      .then((v) => {
        if (!alive) return;
        setId(v ? Number(v) : null);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const update = (next: number) => {
    setId(next);
    write(HOME_PLACE, String(next)).catch(() => undefined);
    pushRecentPlace(next);
  };
  return [id, update, loaded];
}
