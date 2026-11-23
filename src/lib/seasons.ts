/**
 * 어종 1년 달력 계산 (2026-11-23): 달마다 산란기·금어기 여부.
 * - 산란기는 해역별 연구가 여럿이면 합쳐서 칠한다(어느 해역이든 산란기면 칠함). 해역은 범례 글로 따로 보여준다
 * - 금어기는 시행령·고시 기간 중 「그 달에 하루라도 걸치면」 칠한다. 지역 한정 기간도 넓게 알리는 쪽으로 포함
 * - 고시 어종(연도별 기간)은 그해 것만
 */
import type { FishingRules, SpeciesSeasons } from '@/api/types';

import { inPeriod, rulesForSpecies } from './rules.ts';

export type MonthCell = { month: number; spawn: boolean; peak: boolean; ban: boolean };

function monthHasBan(p: { from: string; to: string; year?: number | null }, year: number, month: number): boolean {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) {
    if (inPeriod(p, `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)) return true;
  }
  return false;
}

export function yearCells(code: string, year: number, seasons?: SpeciesSeasons, rules?: FishingRules): MonthCell[] {
  const s = seasons?.species[code];
  const bans = rules ? rulesForSpecies(rules, code).bans : [];
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      month: m,
      spawn: !!s?.periods.some((p) => p.months.includes(m)),
      peak: !!s?.periods.some((p) => p.peak.includes(m)),
      ban: bans.some((b) => b.periods.some((p) => monthHasBan(p, year, m))),
    };
  });
}

export type RailBadge = { label: string; tone: 'danger' | 'success' };

/**
 * 홈 어종 카드 배지: 지금 금어기일 때만 (2026-11-23 변경).
 * 산란기는 「잘 잡히는 시기」로 오해되기 쉬워 카드에 달지 않는다 (어종 시트의 1년 달력에서만)
 */
export function railBadge(code: string, today: string, rules?: FishingRules): RailBadge | null {
  if (!rules) return null;
  const { bans } = rulesForSpecies(rules, code);
  return bans.some((b) => b.periods.some((p) => inPeriod(p, today))) ? { label: '금어기', tone: 'danger' } : null;
}
