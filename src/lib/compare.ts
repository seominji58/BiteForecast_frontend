import type {
  DataKind,
  FishingIndex,
  PlaceCompare,
  RegulationStatus,
  Series,
  SeriesReason,
  SeriesSource,
} from '@/api/types';

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
  TOO_FAR: '가까운 지수 지점 없음',
  LOCATION_CHECK: '위치 확인 필요 — 등록된 좌표가 실제 주소와 맞지 않아 자료를 연결하지 않았어요',
  DIFFERENT_SEA: '가까운 조위관측소가 다른 바다를 봐서 물때를 표시하지 않아요',
  LOCATION_REVIEW: '위치 검증 중 · 해황 판단 보류 (좌표가 주소와 다른 시·군에 있어요)',
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

// --- 요약 (홈·비교 화면) ---

type Point = { t: string; v: number | null };

/** 값이 있는 마지막 시각의 값 (실측 최신값 표시용) */
export function latestPoint(s: Series | undefined): Point | null {
  if (s?.status !== 'ok' || !s.points) return null;
  for (let i = s.points.length - 1; i >= 0; i--) if (s.points[i].v != null) return s.points[i];
  return null;
}

/** 하루 범위 "0.3~0.6" (값이 하나면 "0.5"). 자료가 없으면 null */
export function rangeOf(s: Series | undefined): { min: number; max: number } | null {
  const vs = (s?.status === 'ok' ? (s.points ?? []) : []).map((p) => p.v).filter((v): v is number => v != null);
  if (vs.length === 0) return null;
  return { min: Math.min(...vs), max: Math.max(...vs) };
}

export function rangeText(s: Series | undefined): string | null {
  const r = rangeOf(s);
  if (!r) return null;
  const unit = s!.unit === '°C' ? '°C' : ` ${s!.unit}`;
  const f = (n: number) => String(Math.round(n * 10) / 10);
  return r.min === r.max ? `${f(r.min)}${unit}` : `${f(r.min)}~${f(r.max)}${unit}`;
}

/** 지금 이후 첫 만조/간조 (없으면 마지막 것) */
export function nextExtreme(s: Series | undefined, now = new Date()) {
  const ex = s?.status === 'ok' ? (s.extremes ?? []) : [];
  return ex.find((e) => new Date(e.t) >= now) ?? null;
}

/** 지금 시간대에 맞는 지수 (오전/오후, 없으면 하루 단위, 그것도 없으면 첫 항목) */
export function currentIndexPeriod(f: FishingIndex, now = new Date()) {
  const periods = f.status === 'ok' ? (f.periods ?? []) : [];
  const want = now.getHours() < 12 ? '오전' : '오후';
  return periods.find((p) => p.period === want) ?? periods.find((p) => p.period === '일') ?? periods[0] ?? null;
}

/**
 * 사실 비교: 하루 최댓값이 더 낮은 곳 (명세 §14 허용 예시).
 * 앱의 판정이 아니라 수치 비교만 한다. 예보가 있으면 예보, 없으면 실측 기준.
 */
export function lowerOf(a: PlaceCompare, b: PlaceCompare, metric: 'wave_height' | 'wind_speed') {
  const pick = (p: PlaceCompare) => {
    const fc = findSeries(p, metric, 'forecast');
    return rangeOf(fc) ? { r: rangeOf(fc)!, kind: 'forecast' as const } : { r: rangeOf(findSeries(p, metric, 'observed')), kind: 'observed' as const };
  };
  const pa = pick(a);
  const pb = pick(b);
  if (!pa.r || !pb.r || pa.kind !== pb.kind) return null; // 예보와 실측을 섞어 비교하지 않음
  if (pa.r.max === pb.r.max) return { winner: null, aMax: pa.r.max, bMax: pb.r.max, kind: pa.kind };
  return { winner: pa.r.max < pb.r.max ? ('A' as const) : ('B' as const), aMax: pa.r.max, bMax: pb.r.max, kind: pa.kind };
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return '고요한 밤입니다';
  if (h < 11) return '좋은 아침입니다';
  if (h < 17) return '좋은 오후입니다';
  return '편안한 저녁입니다';
}
