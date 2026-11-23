/**
 * 홈 「이번 주 낚시 브리핑」 계산 (2026-11-23, 사용자 결정: 공식 등급으로 정렬·추천해도 된다).
 * 앱이 점수를 지어내지 않는다 — 국립해양조사원 바다낚시지수 등급을 그대로 세고 줄 세운다.
 * - 한 지점·한 어종의 그날 등급 = 오전·오후 중 좋은 쪽
 * - 「좋음 이상」= 좋음·매우좋음, 「나쁨 이하」= 나쁨·매우나쁨
 * - 기타어종·어종 공통·「-」은 어종 순위에서 뺀다
 * - 범위(지역·내 주변)는 지점에 연결된 낚시터 중 하나라도 범위 안이면 포함
 */
import type { FishingIndexDay, IndexPoint } from '@/api/types';

export const GRADE_RANK: Record<string, number> = { 매우좋음: 5, 좋음: 4, 보통: 3, 나쁨: 2, 매우나쁨: 1 };
const SKIP = new Set(['기타어종', '어종 공통', '-', '']);

export function bestGrade(grades: Record<string, string>): string | null {
  let best: string | null = null;
  for (const g of Object.values(grades)) if (g && (best == null || (GRADE_RANK[g] ?? 0) > (GRADE_RANK[best] ?? 0))) best = g;
  return best && GRADE_RANK[best] ? best : null;
}

const isGood = (g: string | null) => !!g && GRADE_RANK[g] >= 4;
const isBad = (g: string | null) => !!g && GRADE_RANK[g] <= 2;

export function scopedPoints(day: FishingIndexDay | undefined, inScope: (placeId: number) => boolean): IndexPoint[] {
  return (day?.points ?? []).filter((p) => p.places.some((l) => inScope(l.place_id)));
}

export type DayStat = { date: string; good: number; veryGood: number; bad: number; total: number; ratio: number };

/** 그날 (지점×어종) 중 좋음 이상·나쁨 이하 개수 */
export function dayStat(day: FishingIndexDay, inScope: (placeId: number) => boolean): DayStat {
  let good = 0;
  let veryGood = 0;
  let bad = 0;
  let total = 0;
  for (const p of scopedPoints(day, inScope))
    for (const s of p.species) {
      if (SKIP.has(s.species)) continue;
      const g = bestGrade(s.grades);
      if (!g) continue;
      total++;
      if (isGood(g)) good++;
      if (g === '매우좋음') veryGood++;
      if (isBad(g)) bad++;
    }
  return { date: day.date, good, veryGood, bad, total, ratio: total ? good / total : 0 };
}

/** 이번 주 요약 한 줄: 가장 좋은 날 + 크게 나쁜 날 */
export function weekHeadline(stats: DayStat[], label: (d: string) => string): string | null {
  const ok = stats.filter((s) => s.total > 0);
  if (!ok.length) return null;
  const best = [...ok].sort((a, b) => b.ratio - a.ratio || b.veryGood - a.veryGood)[0];
  const worst = ok.filter((s) => s.total && s.bad / s.total >= 0.6).map((s) => label(s.date));
  if (best.ratio === 0) return '이번 주는 공식 지수 「좋음」 이상인 곳이 없어요';
  return `${label(best.date)}이 가장 좋아요${worst.length ? ` · ${worst.join('·')}은 대부분 나쁨` : ''}`;
}

export type SpeciesRank = { species: string; good: number; veryGood: number; total: number };

/** 그날 어종 순위: 좋음 이상 지점 수 → 매우좋음 수 */
export function speciesRanking(day: FishingIndexDay | undefined, inScope: (placeId: number) => boolean): SpeciesRank[] {
  const m = new Map<string, SpeciesRank>();
  for (const p of scopedPoints(day, inScope))
    for (const s of p.species) {
      if (SKIP.has(s.species)) continue;
      const g = bestGrade(s.grades);
      if (!g) continue;
      const r = m.get(s.species) ?? { species: s.species, good: 0, veryGood: 0, total: 0 };
      r.total++;
      if (isGood(g)) r.good++;
      if (g === '매우좋음') r.veryGood++;
      m.set(s.species, r);
    }
  return [...m.values()].sort((a, b) => b.good - a.good || b.veryGood - a.veryGood || a.species.localeCompare(b.species, 'ko'));
}

export type Spot = {
  point: IndexPoint;
  placeId: number;
  /** 그 지점의 좋음 이상 어종 (좋은 순) */
  picks: { species: string; grade: string }[];
  top: number;
  tide: string | null;
};

/**
 * 그날 가장 좋은 곳: 좋음 이상 어종이 있는 지점만, 최고 등급 → 좋음 이상 어종 수 → 거리 → 이름.
 * species 를 주면 그 어종만. excluded(placeId) 가 true 인 곳(지금 특보 발효 등)은 뺀다.
 */
export function topSpots(
  day: FishingIndexDay | undefined,
  inScope: (placeId: number) => boolean,
  opts: { species?: string | null; excluded?: (placeId: number) => boolean; dist?: (placeId: number) => number | null; limit?: number } = {},
): Spot[] {
  const out: (Spot & { d: number })[] = [];
  for (const p of scopedPoints(day, inScope)) {
    const link = p.places.find((l) => l.official && inScope(l.place_id)) ?? p.places.find((l) => inScope(l.place_id));
    if (!link || opts.excluded?.(link.place_id)) continue;
    const picks = p.species
      .filter((s) => !SKIP.has(s.species) && (!opts.species || s.species === opts.species))
      .map((s) => ({ species: s.species, grade: bestGrade(s.grades) ?? '' }))
      .filter((x) => isGood(x.grade))
      .sort((a, b) => GRADE_RANK[b.grade] - GRADE_RANK[a.grade] || a.species.localeCompare(b.species, 'ko'));
    if (!picks.length) continue;
    const tide = Object.values(p.tide_phase).find(Boolean) ?? null;
    out.push({ point: p, placeId: link.place_id, picks, top: GRADE_RANK[picks[0].grade], tide, d: opts.dist?.(link.place_id) ?? Infinity });
  }
  out.sort((a, b) => b.top - a.top || b.picks.length - a.picks.length || a.d - b.d || a.point.station_name.localeCompare(b.point.station_name, 'ko'));
  return out.slice(0, opts.limit ?? 3).map(({ d: _d, ...s }) => s);
}
