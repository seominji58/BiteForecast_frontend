/**
 * 작성 중인 출조계획 임시 저장본 (설계안 §4 · 사용자 요청 2026-11-10).
 *
 * - 로그인 없이 작성할 수 있고, 저장하려는 순간 로그인을 요청한다
 * - 작성 내용은 기기에 임시 저장 → 로그인·가입 후, 앱을 완전히 껐다 켜도 이어 쓴다
 * - 임시 저장본은 하나만 둔다 (새로 작성하면 덮어씀)
 *
 * 삭제·만료 정책
 * 1) 서버 저장에 성공하면 바로 지운다 (중복 초안 방지)
 * 2) 「작성 취소」를 누르면 지운다
 * 3) 마지막으로 고친 지 7일이 지나면 버린다
 * 4) 끝 날짜가 이미 지났으면 버린다 (지난 출조를 새 계획으로 만들지 않게)
 * 계획 수정(이미 저장된 계획)은 임시 저장하지 않는다.
 */
import { useEffect, useSyncExternalStore } from 'react';

import type { SpeciesValue } from '@/components/species-field';
import { read, remove, write } from '@/lib/prefs';

export type TripDraft = {
  title: string;
  start: string;
  end: string;
  region: string | null;
  species: SpeciesValue;
  memo: string;
  placeId: number | null;
};

const KEY = 'biteforecast.trip_draft';
const MAX_AGE_MS = 7 * 86_400_000;

type Stored = TripDraft & { savedAt: number };

let draft: TripDraft | null = null;
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 기기에서 한 번 읽는다 (만료·지난 일정은 버림) */
export function loadTripDraft(): Promise<void> {
  if (loaded) return Promise.resolve();
  loading ??= read(KEY)
    .then((v) => {
      if (!v) return;
      const s = JSON.parse(v) as Stored;
      if (Date.now() - s.savedAt > MAX_AGE_MS || s.end < todayStr()) {
        remove(KEY).catch(() => undefined);
        return;
      }
      const { savedAt: _ignored, ...d } = s;
      draft = d;
    })
    .catch(() => undefined)
    .finally(() => {
      loaded = true;
      emit();
    });
  return loading;
}

/** 저장(null 이면 삭제). 메모리에 바로 반영하고 기기에도 쓴다 */
export function setTripDraft(d: TripDraft | null) {
  draft = d;
  loaded = true;
  emit();
  if (d) write(KEY, JSON.stringify({ ...d, savedAt: Date.now() } satisfies Stored)).catch(() => undefined);
  else remove(KEY).catch(() => undefined);
}

export const getTripDraft = () => draft;

/** { draft, loaded } — loaded 전에는 폼을 그리지 않아야 이어 쓰기가 정확하다 */
export function useTripDraft(): { draft: TripDraft | null; loaded: boolean } {
  useEffect(() => {
    loadTripDraft();
  }, []);
  const d = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => draft,
  );
  const isLoaded = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => loaded,
  );
  return { draft: d, loaded: isLoaded };
}
