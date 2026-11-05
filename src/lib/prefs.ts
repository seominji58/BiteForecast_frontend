import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { type Criteria, DEFAULT_CRITERIA } from '@/lib/criteria';

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

const RECENT_MAX = 5;
export const RECENT_PLACES = 'biteforecast.recent_place_ids';
export const RECENT_SPECIES = 'biteforecast.recent_species_codes';

/** 최근 선택 목록 (기기 저장, 최신 순). 장소·어종 등 선택 시트가 공통으로 쓴다 */
export async function getRecent(key: string): Promise<string[]> {
  try {
    const v = await read(key);
    const list = v ? JSON.parse(v) : [];
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}

export async function pushRecent(key: string, value: string, max = RECENT_MAX): Promise<void> {
  const list = await getRecent(key);
  await write(key, JSON.stringify([value, ...list.filter((x) => x !== value)].slice(0, max))).catch(() => undefined);
}

export const pushRecentPlace = (id: number) => pushRecent(RECENT_PLACES, String(id));

const CRITERIA = 'biteforecast.criteria';

/** 「조건으로 찾기」 기준 (기기 저장) */
export function useCriteria(): [Criteria, (c: Criteria) => void] {
  const [c, setC] = useState<Criteria>(DEFAULT_CRITERIA);
  useEffect(() => {
    let alive = true;
    read(CRITERIA)
      .then((v) => {
        if (alive && v) setC({ ...DEFAULT_CRITERIA, ...JSON.parse(v) });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const update = (next: Criteria) => {
    setC(next);
    write(CRITERIA, JSON.stringify(next)).catch(() => undefined);
  };
  return [c, update];
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
