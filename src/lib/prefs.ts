import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { type Criteria, DEFAULT_CRITERIA } from '@/lib/criteria';

/** 기기에만 저장하는 작은 설정값 (홈 화면 기준 낚시터 등) */
export async function read(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function write(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function remove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

const HOME_PLACE = 'biteforecast.home_place_id';

const RECENT_MAX = 5;
export const RECENT_PLACES = 'biteforecast.recent_place_ids';
export const RECENT_SPECIES = 'biteforecast.recent_species_codes';
/** 최근 비교한 낚시터 쌍 「A-B」 */
export const RECENT_COMPARES = 'biteforecast.recent_compares';

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

const EXPLORE_REGION = 'biteforecast.explore_region';

/** 출조 탐색에서 고른 지역(시·도). 'all' = 고르지 않음 */
export function useExploreRegion(): [string, (v: string) => void] {
  const [v, setV] = useState('all');
  useEffect(() => {
    let alive = true;
    read(EXPLORE_REGION)
      .then((x) => alive && x && setV(x))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const update = (next: string) => {
    setV(next);
    write(EXPLORE_REGION, next).catch(() => undefined);
  };
  return [v, update];
}

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

/** 기기 저장 문자열 값 하나 (불러오기 전에는 loaded=false) */
function useStored(key: string): [string | null, (v: string | null) => void, boolean] {
  const [v, setV] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    read(key)
      .catch(() => null)
      .then((x) => {
        if (!alive) return;
        setV(x || null);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [key]);
  const update = (next: string | null) => {
    setV(next);
    write(key, next ?? '').catch(() => undefined);
  };
  return [v, update, loaded];
}

/**
 * 홈 「선택한 낚시터의 해황」에 쓸, 사용자가 홈에서 직접 고른 낚시터 (검색·후보에서 고름).
 * 최근 본 낚시터(useHomePlace)와 다르다 — 상세 화면을 둘러본 것만으로 바뀌지 않는다.
 */
export function useHomeSelection(): [number | null, (id: number | null) => void, boolean] {
  const [v, setV, loaded] = useStored('biteforecast.home_selected_place');
  return [v ? Number(v) : null, (id) => setV(id == null ? null : String(id)), loaded];
}

export const SEA_GROUPS = ['서해', '남해', '동해', '제주'] as const;
export type SeaChoice = (typeof SEA_GROUPS)[number];

/** 홈 「오늘의 출조 탐색」에서 고른 바다 권역. 「내 주변」은 위치를 매번 버튼으로 확인하므로 저장하지 않는다 */
export function useHomeSea(): [SeaChoice | null, (v: SeaChoice | null) => void] {
  const [v, setV] = useStored('biteforecast.home_sea');
  return [(SEA_GROUPS as readonly string[]).includes(v ?? '') ? (v as SeaChoice) : null, setV];
}

// --- 홈 목표 어종 (홈·전체 어종 화면·상세가 같은 값을 본다) ---
const HOME_SPECIES = 'biteforecast.home_species';
let homeSpecies: string | null = null;
let homeSpeciesLoaded = false;
const homeSpeciesSubs = new Set<(v: string | null) => void>();

/** 홈에서 고른 목표 어종 코드(lib/species.ts). null = 어종 상관없음 */
export function useHomeSpecies(): [string | null, (code: string | null) => void] {
  const [v, setV] = useState<string | null>(homeSpecies);
  useEffect(() => {
    homeSpeciesSubs.add(setV);
    if (!homeSpeciesLoaded) {
      read(HOME_SPECIES)
        .catch(() => null)
        .then((x) => {
          homeSpeciesLoaded = true;
          homeSpecies = x || null;
          homeSpeciesSubs.forEach((f) => f(homeSpecies));
        });
    }
    return () => {
      homeSpeciesSubs.delete(setV);
    };
  }, []);
  const update = (code: string | null) => {
    homeSpecies = code;
    homeSpeciesLoaded = true;
    homeSpeciesSubs.forEach((f) => f(code));
    write(HOME_SPECIES, code ?? '').catch(() => undefined);
  };
  return [v, update];
}
