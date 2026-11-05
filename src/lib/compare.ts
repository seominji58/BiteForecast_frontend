import type { DataKind, PlaceCompare, RegulationStatus, Series, SeriesReason, SeriesSource } from '@/api/types';

/** 'YYYY-MM-DD' → 기기 로컬 자정 Date (시간대 밀림 방지) */
export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** min~max 날짜 목록 */
export function dayList(min: string, max: string): string[] {
  const out: string[] = [];
  for (let d = parseDay(min); d <= parseDay(max); d.setDate(d.getDate() + 1)) out.push(formatDay(d));
  return out;
}

/** 11/5 (목) */
export function dayLabel(s: string): string {
  const d = parseDay(s);
  return `${d.getMonth() + 1}/${d.getDate()} (${d.toLocaleDateString('ko-KR', { weekday: 'short' })})`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 기기 로컬 시각 HH:mm (OS·엔진별 로캘 형식 차이를 피하려고 직접 만든다) */
export function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function findSeries(p: PlaceCompare, metric: Series['metric'], kind: DataKind): Series | undefined {
  return p.series.find((s) => s.metric === metric && s.kind === kind);
}

export const REASON_TEXT: Record<SeriesReason, string> = {
  NO_STATION: '가까운 관측소가 없습니다',
  NO_DATA: '자료 없음',
  FUTURE_DATE: '미래 날짜에는 실측 자료가 없습니다',
  NOT_CONNECTED: '예보 자료 연결 준비 중',
};

export const KIND_TEXT: Record<DataKind, string> = { forecast: '예보', observed: '실측' };

export const REGULATION_TEXT: Record<RegulationStatus, string> = {
  PROHIBITED: '낚시 금지 확인',
  CONDITIONAL: '조건부 제한 확인',
  OFFICIALLY_OPEN: '공식 개방 확인',
  UNVERIFIED: '규제 확인되지 않음',
};

/** "국립해양조사원 · 속초 관측소 · 0.7km" (좌표 없으면 「거리 확인 불가」, FR-07) */
export function sourceLine(src: SeriesSource | null): string {
  if (!src) return '';
  const dist = src.distance_km != null ? `${src.distance_km}km` : '거리 확인 불가';
  return `${src.agency} · ${src.station_name} 관측소 · ${dist}`;
}

export type HourRow = { hour: string; a: number | null | undefined; b: number | null | undefined };

/**
 * 두 계열을 같은 시간축(기기 로컬 시각 HH:00)으로 맞춘 표.
 * - null: 관측 시각은 있으나 값 결측 → 「자료 없음」
 * - undefined: 그 시각에 해당 계열 자료 자체가 없음
 * 보간하지 않는다 (FR-05).
 */
export function hourTable(a: Series | undefined, b: Series | undefined): HourRow[] {
  const toMap = (s: Series | undefined) =>
    new Map((s?.status === 'ok' ? (s.points ?? []) : []).map((p) => [pad2(new Date(p.t).getHours()), p.v]));
  const ma = toMap(a);
  const mb = toMap(b);
  const hours = [...new Set([...ma.keys(), ...mb.keys()])].sort();
  return hours.map((h) => ({ hour: `${h}:00`, a: ma.get(h), b: mb.get(h) }));
}

export function formatValue(v: number | null | undefined, unit: string): string {
  if (v === undefined) return '–';
  if (v === null) return '자료 없음';
  return `${v}${unit === '°C' ? '' : ' '}${unit}`;
}
