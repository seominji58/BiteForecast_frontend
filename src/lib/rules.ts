/**
 * 금어기·금지체장 계산 (수산자원관리법 시행령 별표1·2 요약, 서버 /meta/fishing-rules) — 2026-11-23.
 * - 기간은 "MM-DD" 시작·끝(끝 포함). 끝이 시작보다 앞이면 해를 넘긴다 (12-01 ~ 01-31)
 * - notice: 해수부·시도 고시로 실제 기간이 정해짐. 그해 기간(year)이 고시돼 있으면 그 기간만 「금어기」로 센다
 *   (예: 고등어 2026 5.1~5.31). 그해 고시가 없으면 「고시 확인」으로만
 * - 지역 한정 기간(region)은 「지역」을 함께 보여준다 (사용자 위치로 걸러내지 않음 — 넓게 알리는 쪽)
 */
import type { FishingRules } from '@/api/types';

export type BanRule = FishingRules['ban'][number];
export type SizeRule = FishingRules['size'][number];
export type BanPeriod = BanRule['periods'][number];

const mmdd = (iso: string) => iso.slice(5, 10); // "2026-11-23" → "11-23"

export function inPeriod(p: Pick<BanPeriod, 'from' | 'to' | 'year'>, isoDay: string): boolean {
  if (p.year != null && p.year !== Number(isoDay.slice(0, 4))) return false;
  const d = mmdd(isoDay);
  return p.from <= p.to ? d >= p.from && d <= p.to : d >= p.from || d <= p.to;
}

/** "05-01" → "5.1" */
export const shortDay = (m: string) => `${Number(m.slice(0, 2))}.${Number(m.slice(3, 5))}`;

export const periodText = (p: BanPeriod) =>
  `${p.year ? `${p.year}년 ` : ''}${shortDay(p.from)}~${shortDay(p.to)}${p.region ? ` (${p.region})` : ''}`;

export type ActiveBan = { rule: BanRule; periods: BanPeriod[] };

/** 그날 금어기인 어종 (고시 어종은 그해 고시된 기간만 — 모르는 해는 넣지 않는다) */
export function activeBans(rules: FishingRules, isoDay: string): ActiveBan[] {
  return rules.ban
    .filter((r) => !r.notice || r.periods.some((p) => p.year != null))
    .map((r) => ({ rule: r, periods: r.periods.filter((p) => inPeriod(p, isoDay)) }))
    .filter((x) => x.periods.length > 0);
}

function addDays(isoDay: string, n: number): string {
  const t = new Date(`${isoDay}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** 앞으로 n일 안에 시작하는 금어기 (오늘 이미 금어기인 것은 뺀다). 가까운 순 */
export function upcomingBans(rules: FishingRules, isoDay: string, n = 30): { rule: BanRule; period: BanPeriod; inDays: number }[] {
  const out: { rule: BanRule; period: BanPeriod; inDays: number }[] = [];
  const now = new Set(activeBans(rules, isoDay).map((a) => a.rule.name));
  for (const r of rules.ban) {
    if (now.has(r.name)) continue;
    for (let i = 1; i <= n; i++) {
      const day = addDays(isoDay, i);
      // 고시 어종은 그해 고시된 기간만 (year 가 맞아야 함)
      const p = r.periods.find((x) => x.from === mmdd(day) && (r.notice ? x.year === Number(day.slice(0, 4)) : x.year == null || x.year === Number(day.slice(0, 4))));
      if (p) {
        out.push({ rule: r, period: p, inDays: i });
        break;
      }
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

/** 앱 어종 코드 → 해당 법령 규정 (없으면 둘 다 빈 배열 = 시행령에 금어기·금지체장 없음) */
export function rulesForSpecies(rules: FishingRules, code: string | null | undefined): { bans: BanRule[]; sizes: SizeRule[] } {
  const names = (code && rules.app_species[code]) || [];
  return {
    bans: rules.ban.filter((b) => names.includes(b.name)),
    sizes: rules.size.filter((s) => names.includes(s.name)),
  };
}
