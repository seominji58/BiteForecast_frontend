/**
 * 홈 요약 카드용 핵심 수치 (재설계 v2 §4-2).
 * - 오늘: 실측 최신값(관측 시각 라벨). 실측이 없으면 남은 시간 예보 최대(「예보 최대」 라벨)
 * - 실측과 예보를 한 칸에 섞지 않는다. 값이 없으면 null → 「자료 없음」
 */
import type { PlaceCompare } from '@/api/types';
import { currentIndexPeriod, findSeries, latestPoint, nextExtreme, timeLabel } from '@/lib/compare';
import { distanceGrade, seaState, windName } from '@/lib/describe';

export type KeyMetric = {
  label: string;
  value: string | null;
  grade: string | null; // 공인 등급표 표현 (낮은 물결, 산들바람 …)
  basis: string; // 「실측 15:00」 / 「예보 최대 21:00」 / 「자료 없음」
};

const f1 = (n: number) => String(Math.round(n * 10) / 10);

function futurePeak(pc: PlaceCompare, metric: 'wave_height' | 'wind_speed', now: Date) {
  const s = findSeries(pc, metric, 'forecast');
  if (s?.status !== 'ok' || !s.points) return null;
  let best: { v: number; t: string } | null = null;
  for (const p of s.points) {
    if (p.v == null || new Date(p.t) < now) continue;
    if (!best || p.v > best.v) best = { v: p.v, t: p.t };
  }
  return best;
}

export function keyMetrics(pc: PlaceCompare, now = new Date()): KeyMetric[] {
  const pick = (metric: 'wave_height' | 'wind_speed', label: string, unit: string, grade: (v: number) => string) => {
    const obs = latestPoint(findSeries(pc, metric, 'observed'));
    if (obs?.v != null) return { label, value: `${f1(obs.v)}${unit}`, grade: grade(obs.v), basis: `실측 ${timeLabel(obs.t)}` };
    const fc = futurePeak(pc, metric, now);
    if (fc) return { label, value: `${f1(fc.v)}${unit}`, grade: grade(fc.v), basis: `예보 최대 ${timeLabel(fc.t)}` };
    return { label, value: null, grade: null, basis: '자료 없음' };
  };
  const temp = latestPoint(findSeries(pc, 'water_temp', 'observed'));
  return [
    pick('wave_height', '파고', 'm', seaState),
    pick('wind_speed', '풍속', 'm/s', (v) => windName(v).name),
    temp?.v != null
      ? { label: '수온', value: `${f1(temp.v)}°C`, grade: null, basis: `실측 ${timeLabel(temp.t)}` }
      : { label: '수온', value: null, grade: null, basis: '자료 없음' },
  ];
}

/** 「다음 간조 18:50 · 소조기」 */
export function tideLine(pc: PlaceCompare, now = new Date()): string {
  const ext = nextExtreme(findSeries(pc, 'tide_extreme', 'forecast'), now);
  const phase = currentIndexPeriod(pc.fishing_index, now)?.tide_phase;
  if (!ext) return '자료 없음';
  return `다음 ${ext.type === 'high' ? '만조' : '간조'} ${timeLabel(ext.t)}${phase ? ` · ${phase}` : ''}`;
}

/** 「감성돔 좋음 · 우럭 보통 외 3」 (공식 지수, 한 줄) */
export function indexLine(pc: PlaceCompare, now = new Date()): string {
  const f = pc.fishing_index;
  const period = currentIndexPeriod(f, now);
  if (!period) return f.reason === 'TOO_FAR' ? '가까운 지수 지점 없음' : '자료 없음';
  const items = period.items.filter((i) => i.index);
  if (items.length === 0) return '자료 없음';
  const levels = new Set(items.map((i) => i.index));
  if (levels.size === 1) return `${items.length > 1 ? '모든 어종' : items[0].species} ${items[0].index}`;
  const shown = items.slice(0, 2).map((i) => `${i.species} ${i.index}`);
  return `${shown.join(' · ')}${items.length > 2 ? ` 외 ${items.length - 2}` : ''}`;
}

/** 5km 넘는 자료 지점 안내 (P0-5). 없으면 null */
export function farNote(pc: PlaceCompare): string | null {
  const wave = findSeries(pc, 'wave_height', 'observed')?.source;
  const tide = findSeries(pc, 'tide_extreme', 'forecast')?.source;
  const far = (
    [
      ['파도 부이', wave],
      ['물때 관측소', tide],
    ] as const
  ).filter(([, s]) => s?.distance_km != null && s.distance_km > 5);
  if (!wave) return '30km 안에 파도 관측 부이가 없어 예보만 보여드려요.';
  if (far.length === 0) return null;
  return `${far.map(([l, s]) => `${l} ${Math.round(s!.distance_km!)}km(${distanceGrade(s!.distance_km!)})`).join(', ')} 떨어진 자료예요.`;
}
