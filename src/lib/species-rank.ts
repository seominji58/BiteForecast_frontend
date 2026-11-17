/**
 * 어종 순서: 「지도에 실제로 많이 찍히는 어종」 먼저 (2026-11-17).
 * 지도(explore)의 어종 필터와 같은 기준으로, 지금 범위 안에서 그 어종으로 남는 낚시터 수를 센다.
 * ① 그날 공식 낚시지수 발표 지점에 연결된 낚시터 (국립해양조사원, 공식 지수 어종만)
 * ② 최근 14일 이용자 조황 글에 그 어종이 있는 낚시터
 * ③ 낚시터가 공공데이터(전국낚시터정보표준데이터)에 대상 어종으로 적은 곳
 * 앱이 점수를 만들지 않는다 — 자료가 연결된 낚시터 「수」만 센다. 같은 수면 원래 목록 순서.
 */
import type { CatchSummary, FishingIndexDay, Place } from '@/api/types';
import type { SpeciesItem } from '@/lib/species';

export function speciesPlaceCounts(
  items: SpeciesItem[],
  {
    places,
    day,
    catches,
    scope,
  }: {
    places: Place[];
    day: FishingIndexDay | undefined;
    catches: CatchSummary[] | undefined;
    /** 지금 보고 있는 범위 (지역·내 주변). 위치가 확인되지 않은 낚시터는 부르는 쪽에서 뺀다 */
    scope: (p: Place) => boolean;
  },
): Map<string, number> {
  const inScope = new Set(places.filter(scope).map((p) => p.id));
  const out = new Map<string, number>();
  for (const it of items) {
    const names = [it.name, it.alias].filter((x): x is string => !!x);
    const ids = new Set<number>();
    if (it.indexName && day)
      for (const pt of day.points)
        if (pt.species.some((x) => x.species === it.indexName)) for (const l of pt.places) if (inScope.has(l.place_id)) ids.add(l.place_id);
    for (const c of catches ?? [])
      if (inScope.has(c.place_id) && c.species.some((n) => names.some((x) => n.includes(x)))) ids.add(c.place_id);
    for (const p of places)
      if (inScope.has(p.id) && p.info_species && names.some((n) => p.info_species!.includes(n))) ids.add(p.id);
    out.set(it.code, ids.size);
  }
  return out;
}

/** 수가 많은 순 (같으면 원래 순서). 수를 모르면(자료 전) 원래 순서 그대로 */
export function sortByCount<T extends { code: string }>(items: T[], counts: Map<string, number> | null): T[] {
  if (!counts) return items;
  return items
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (counts.get(b.x.code) ?? 0) - (counts.get(a.x.code) ?? 0) || a.i - b.i)
    .map((v) => v.x);
}
