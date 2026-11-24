/**
 * 오늘의 황금 포인트 (2026-11-23): 공식 등급 위에 「확인 가능한 사실」을 붙여 왜 추천하는지 보여준다.
 * 앱이 점수·확률을 지어내지 않는다 — 걸러내기(꼭)와 ✓ 개수(더 좋음)만.
 *
 * 꼭: 공식 지수 좋음 이상(topSpots) · 지금 특보 없음
 * 내 기준(파고·풍속 예보 최대): 넘는 곳은 빼지 않고 「⚠ 기준 초과」로 표시해 뒤로 (빈 목록보다 낫다)
 * ✓: 파도 잔잔(파고 0.5m 이하) · 물 돌이(다음 만조·간조)가 해 뜰·질 무렵 2시간 안
 * 정보(판단 아님): 실측 수온 · 오전/오후 중 더 좋은 시간대
 * 공식 지수의 수온은 그날 예측 수온이지 어종별 적정 수온이 아니라서 수온은 판단에 쓰지 않는다.
 */
import type { PlaceSummary } from '@/api/types';

import { GRADE_RANK, type Spot } from './briefing.ts';
import type { Criteria } from './criteria.ts';

export type Reason = { key: 'calm' | 'tide' | 'temp' | 'wave' | 'when' | 'over'; text: string; check: boolean };
export type Golden = Spot & { reasons: Reason[]; checks: number; over: boolean };

const hhmm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const local = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 「 · 예년 +1.2°C」 (실측과 근처 관측소 예년 같은 달 평균 차이, 0.5°C 미만이면 「예년 수준」) */
export function tempDiff(s: Pick<PlaceSummary, 'temp_obs' | 'temp_normal'>): string | null {
  if (!s.temp_obs || !s.temp_normal) return null;
  const d = Math.round((s.temp_obs.v - s.temp_normal.v) * 10) / 10;
  if (Math.abs(d) < 0.5) return ' · 예년 수준';
  return ` · 예년 ${d > 0 ? '+' : ''}${d}°C`;
}

/** 오전·오후 등급이 다르면 더 좋은 시간대 한 줄 */
export function betterPeriod(grades: Record<string, string>): string | null {
  const am = GRADE_RANK[grades['오전'] ?? ''];
  const pm = GRADE_RANK[grades['오후'] ?? ''];
  if (am == null || pm == null || am === pm) return null;
  return am > pm ? `오전이 더 좋아요 (${grades['오전']})` : `오후가 더 좋아요 (${grades['오후']})`;
}

export function goldenSpots(
  spots: Spot[],
  summary: (placeId: number) => PlaceSummary | undefined,
  c: Pick<Criteria, 'maxWave' | 'maxWind'>,
  opts: { today: boolean; limit?: number },
): Golden[] {
  const out: Golden[] = [];
  for (const sp of spots) {
    const s = summary(sp.placeId);
    if (opts.today && s?.warning_level === 'warning') continue;
    const wave = s?.wave_fc_max?.v;
    const wind = s?.wind_fc_max?.v;
    const overs = [
      wave != null && wave > c.maxWave ? `파고 ${wave}m` : null,
      wind != null && wind > c.maxWind ? `바람 ${wind}m/s` : null,
    ].filter((v): v is string => !!v);

    const reasons: Reason[] = overs.length ? [{ key: 'over', text: `${overs.join('·')} 기준 초과`, check: false }] : [];
    if (wave != null && !overs.length)
      reasons.push(
        wave <= 0.5 ? { key: 'calm', text: `파도 잔잔 ${wave}m`, check: true } : { key: 'wave', text: `파고 ${wave}m`, check: false },
      );
    const t = s?.next_tide;
    if (opts.today && t && s?.sunrise && s?.sunset) {
      const at = local(t.t);
      const near = [
        ['해 뜰 무렵', hhmm(s.sunrise)],
        ['해 질 무렵', hhmm(s.sunset)],
      ].find(([, m]) => Math.abs(at - (m as number)) <= 120);
      if (near) reasons.push({ key: 'tide', text: `${t.type === 'high' ? '만조' : '간조'} ${clock(t.t)} ${near[0]}`, check: true });
    }
    if (s?.temp_obs) reasons.push({ key: 'temp', text: `수온 ${s.temp_obs.v}°C${tempDiff(s) ?? ''}`, check: false });
    const g = sp.point.species.find((x) => x.species === sp.picks[0]?.species)?.grades;
    const when = g ? betterPeriod(g) : null;
    if (when) reasons.push({ key: 'when', text: when, check: false });
    out.push({ ...sp, reasons, checks: reasons.filter((r) => r.check).length, over: overs.length > 0 });
  }
  // 기준 안 → 등급 → ✓ 개수 → 원래 순서(좋음 이상 어종 수·거리)
  return out
    .map((g, i) => ({ g, i }))
    .sort((a, b) => Number(a.g.over) - Number(b.g.over) || b.g.top - a.g.top || b.g.checks - a.g.checks || a.i - b.i)
    .slice(0, opts.limit ?? 3)
    .map(({ g }) => g);
}
