/**
 * 홈 「이번 달 바다」 한 줄 (2026-11-23). 지어내지 않고 가진 공식 자료만 조합한다:
 *  - 제철: 통계청 연근해 어획량(2021~2025 월평균)에서 이번 달이 「어획 많은 달」인 어종 (그 달 비중 높은 순)
 *  - 금어기: 수산자원관리법 시행령·고시 — 최근 끝난 것(풀림)과 곧 시작하는 것
 * 어선 조업 시기와 낚시 시즌이 다른 어종(우럭·감성돔·민어)은 제철에서 뺀다
 */
import type { CatchSeasons, FishingRules } from '@/api/types';

import { activeBans, upcomingBans } from './rules.ts';

export const CATCH_DIFFERS = new Set(['croaker', 'rockfish', 'black_porgy']);

export type InSeason = { code: string; name: string; seas: string[]; share: number };

/** 이번 달이 어획 많은 달인 어종. sea 를 주면 그 바다만, 아니면 바다 상관없이 (가장 높은 비중으로) */
export function inSeason(
  catches: CatchSeasons | undefined,
  month: number,
  sea: string | null,
  known: (code: string) => boolean,
  limit = 4,
): InSeason[] {
  if (!catches) return [];
  const out: InSeason[] = [];
  for (const [code, s] of Object.entries(catches.species)) {
    if (CATCH_DIFFERS.has(code) || !known(code)) continue;
    const seas = Object.entries(s.seas).filter(([name, v]) => (!sea || name === sea) && v.peak.includes(month));
    if (!seas.length) continue;
    const share = Math.max(...seas.map(([, v]) => v.share[String(month)] ?? 0));
    out.push({ code, name: s.name, seas: seas.map(([n]) => n), share });
  }
  return out.sort((a, b) => b.share - a.share || a.code.localeCompare(b.code)).slice(0, limit);
}

const addDays = (isoDay: string, n: number) => {
  const t = new Date(`${isoDay}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export type BanNews = { name: string; kind: 'ended' | 'soon'; days: number };

/** 최근 n일 안에 끝난 금어기(오늘은 풀린 것) · 앞으로 n일 안에 시작하는 금어기 */
export function banNews(rules: FishingRules | undefined, today: string, n = 14): BanNews[] {
  if (!rules) return [];
  const now = new Set(activeBans(rules, today).map((a) => a.rule.name));
  const ended: BanNews[] = [];
  for (const r of rules.ban) {
    if (now.has(r.name)) continue;
    for (let i = 1; i <= n; i++) {
      const day = addDays(today, -i);
      const y = Number(day.slice(0, 4));
      const hit = r.periods.some((p) => p.to === day.slice(5, 10) && (r.notice ? p.year === y : p.year == null || p.year === y));
      if (hit) {
        ended.push({ name: r.name, kind: 'ended', days: i - 1 });
        break;
      }
    }
  }
  const soon = upcomingBans(rules, today, n).map((u) => ({ name: u.rule.name, kind: 'soon' as const, days: u.inDays }));
  return [...ended.sort((a, b) => a.days - b.days), ...soon];
}
