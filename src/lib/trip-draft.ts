/**
 * 로그인 전에 작성하던 출조계획 (설계안 §4 · 사용자 결정 2026-11-09).
 * 저장하려는 순간 로그인을 요청하고, 로그인·가입 후 작성 내용을 그대로 이어 쓴다.
 * 앱 메모리에만 둔다 — 기기에 계획을 따로 저장하지 않는다 (앱을 완전히 끄면 사라짐).
 */
import { useSyncExternalStore } from 'react';

import type { SpeciesValue } from '@/components/species-field';

export type TripDraft = {
  title: string;
  start: string;
  end: string;
  region: string | null;
  species: SpeciesValue;
  memo: string;
  placeId: number | null;
};

let draft: TripDraft | null = null;
const listeners = new Set<() => void>();

export function setTripDraft(d: TripDraft | null) {
  draft = d;
  listeners.forEach((l) => l());
}

export const getTripDraft = () => draft;

export function useTripDraft(): TripDraft | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => draft,
  );
}
