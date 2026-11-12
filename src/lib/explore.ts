/**
 * 홈·포인트 보기 화면이 같이 쓰는 탐색 범위 계산 (지역·날짜·어종).
 * 좌표 의심(D) 낚시터는 처음부터 뺀다 (기존 정책). 앱이 순위 점수를 만들지 않는다.
 */
import { useEffect, useMemo, useState } from 'react';

import { useFishingIndex, usePlaces, usePlacesSummary, useSpecies } from '@/api/queries';
import type { Place, PlaceSummary } from '@/api/types';
import { type Coords, getCurrentCoords } from '@/lib/location';
import { km } from '@/lib/place';
import { useHomeRegion, useHomeSpecies } from '@/lib/prefs';
import { mergeWithApi, speciesByCode } from '@/lib/species';

export const NEAR_KM = 60;

let lastFix: { coords: Coords; error: null } | null = null;

/** 받아 둔 기상청 예보가 하루 전체를 덮는 마지막 날짜 (KST, YYYY-MM-DD) */
export function forecastLastDay(validUntil: string | null): string | null {
  if (!validUntil) return null;
  const kst = new Date(new Date(validUntil).getTime() - 1000 + 9 * 3600_000);
  return kst.toISOString().slice(0, 10);
}

export function useExplore(date: string | undefined, today: string | undefined) {
  const places = usePlaces();
  const summary = usePlacesSummary(date);
  const fi = useFishingIndex(date);
  const speciesApi = useSpecies();
  const [region, setRegion] = useHomeRegion();
  const [speciesCode, setSpeciesCode] = useHomeSpecies();
  const near = region === '내 주변';
  // 「내 주변」을 고르면 그때 위치를 확인한다. 확인한 위치는 홈·포인트 화면이 함께 쓴다 (기기 안에서만)
  const [fix, setFix] = useState<{ coords: Coords | null; error: string | null } | null>(lastFix);
  useEffect(() => {
    if (!near || fix) return;
    let alive = true;
    getCurrentCoords().then((r) => {
      const next = 'coords' in r ? { coords: r.coords, error: null } : { coords: null, error: r.error };
      if ('coords' in r) lastFix = { coords: r.coords, error: null };
      if (alive) setFix(next);
    });
    return () => {
      alive = false;
    };
  }, [near, fix]);
  const gps = { loading: near && !fix, coords: fix?.coords ?? null, error: fix?.error ?? null };
  /** 「내 주변」을 누를 때마다 권한·현재 위치를 새로 확인한다 */
  const locate = () => {
    lastFix = null;
    setFix(null);
    setRegion('내 주변');
  };

  const allSpecies = useMemo(() => mergeWithApi(speciesApi.data), [speciesApi.data]);
  const species = speciesByCode(speciesCode) ?? allSpecies.find((x) => x.code === speciesCode) ?? null;
  const byId = useMemo(() => new Map((places.data ?? []).map((p) => [p.id, p])), [places.data]);
  const summaryById = useMemo(() => new Map((summary.data?.places ?? []).map((s) => [s.place_id, s])), [summary.data]);

  const inScope = useMemo(
    () => (p: Place) => {
      if (near) return !!gps.coords && km(gps.coords, p) <= NEAR_KM;
      if (region === '전국') return true;
      return summaryById.get(p.id)?.sea_group === region;
    },
    [near, gps.coords, region, summaryById],
  );
  const scoped: PlaceSummary[] = useMemo(
    () => (summary.data?.places ?? []).filter((s) => !s.location_suspect && byId.has(s.place_id) && inScope(byId.get(s.place_id)!)),
    [summary.data, byId, inScope],
  );
  const distOf = (placeId: number) => (near && gps.coords && byId.has(placeId) ? km(gps.coords, byId.get(placeId)!) : null);
  const scopeName = near ? `내 주변 ${NEAR_KM}km` : region;

  const day = fi.data;
  const periods = day?.periods ?? [];
  // 범위 안 공식 지점들의 물때 (발표값 중 가장 많은 값)
  const tide = useMemo(() => {
    if (!day) return null;
    const ids = new Set(scoped.map((s) => s.place_id));
    const count = new Map<string, number>();
    for (const p of day.points) {
      const t = p.tide_phase[periods[0]] ?? Object.values(p.tide_phase)[0];
      if (t && p.places.some((l) => ids.has(l.place_id))) count.set(t, (count.get(t) ?? 0) + 1);
    }
    return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [day, scoped, periods]);
  // 어종별 공식 지수 지점 수 (그날, 범위 안 공식 지점)
  const indexCount = (indexName: string | null) => {
    if (!day || !indexName) return null;
    return day.points.filter(
      (p) => p.species.some((x) => x.species === indexName) && p.places.some((l) => l.official && byId.has(l.place_id) && inScope(byId.get(l.place_id)!)),
    ).length;
  };

  const lastForecastDay = forecastLastDay(summary.data?.data_status.forecast_valid_until ?? null);
  return {
    places,
    summary,
    fi,
    day,
    periods,
    allSpecies,
    species,
    setSpeciesCode,
    speciesCode,
    region,
    setRegion,
    locate,
    near,
    gps,
    byId,
    summaryById,
    inScope,
    scoped,
    distOf,
    scopeName,
    tide,
    indexCount,
    lastForecastDay,
    pending: !!date && !!lastForecastDay && date > lastForecastDay,
    future: !!date && !!today && date !== today,
  };
}
