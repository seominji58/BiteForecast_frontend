/**
 * 수치를 사람이 읽는 문장으로 풀어 쓴다.
 *
 * 표현 기준은 공인 등급표를 그대로 쓴다 (앱의 판정이 아님, 명세 §14):
 * - 바람: 보퍼트 풍력계급 (기상청 사용 우리말 이름)
 * - 파도: WMO 해상상태 코드(Douglas) 파고 구간
 * 「낚시하기 좋다/안전하다」 같은 판정 표현은 쓰지 않는다.
 */
import type { DataKind, PlaceCompare, Series } from '@/api/types';
import { currentIndexPeriod, findSeries, latestPoint, nextExtreme, rangeOf, timeLabel } from '@/lib/compare';

/** 보퍼트 풍력계급: [상한 m/s, 이름, 체감 설명] */
const BEAUFORT: [number, string, string][] = [
  [0.2, '고요', '바람이 거의 없는'],
  [1.5, '실바람', '연기가 살짝 흔들리는'],
  [3.3, '남실바람', '얼굴에 바람이 느껴지는'],
  [5.4, '산들바람', '깃발이 가볍게 날리는'],
  [7.9, '건들바람', '먼지가 일고 잔가지가 흔들리는'],
  [10.7, '흔들바람', '작은 나무가 흔들리는'],
  [13.8, '된바람', '큰 가지가 흔들리고 우산을 쓰기 어려운'],
  [17.1, '센바람', '나무 전체가 흔들리고 걷기 힘든'],
  [20.7, '큰바람', '잔가지가 꺾이는'],
  [24.4, '큰센바람', '건물이 조금 손상될 수 있는'],
  [Infinity, '노대바람 이상', '매우 강한'],
];

/** WMO 해상상태 코드 파고 구간: [상한 m, 표현] */
const SEA_STATE: [number, string][] = [
  [0.1, '잔잔한 물결'],
  [0.5, '낮은 물결'],
  [1.25, '약간 일렁이는 물결'],
  [2.5, '다소 높은 물결'],
  [4, '높은 물결'],
  [6, '매우 높은 물결'],
  [Infinity, '아주 거친 물결'],
];

export function windName(ms: number): { name: string; feel: string } {
  const [, name, feel] = BEAUFORT.find(([max]) => ms <= max)!;
  return { name, feel };
}

export function seaState(m: number): string {
  return SEA_STATE.find(([max]) => m <= max)![1];
}

const f1 = (n: number) => String(Math.round(n * 10) / 10);

function hourText(iso: string) {
  return timeLabel(iso);
}

/** 예보 계열의 최댓값과 그 시각. after 를 주면 그 이후 시각만 본다 (이미 지난 시각을 「높아져요」로 말하지 않기) */
function peak(s: Series | undefined, after?: Date): { v: number; t: string } | null {
  if (s?.status !== 'ok' || !s.points) return null;
  let best: { v: number; t: string } | null = null;
  for (const p of s.points) {
    if (p.v == null || (after && new Date(p.t) < after)) continue;
    if (!best || p.v > best.v) best = { v: p.v, t: p.t };
  }
  return best;
}

export type Sentence = { key: string; text: string };

/** 홈 화면용 오늘 바다 이야기 (문장 목록) */
export function describeToday(pc: PlaceCompare, now = new Date()): Sentence[] {
  const out: Sentence[] = [];
  const obsWave = findSeries(pc, 'wave_height', 'observed');
  const obsWind = findSeries(pc, 'wind_speed', 'observed');
  const fcWave = findSeries(pc, 'wave_height', 'forecast');
  const fcWind = findSeries(pc, 'wind_speed', 'forecast');
  const temp = findSeries(pc, 'water_temp', 'observed');

  // 1) 파도
  const w = latestPoint(obsWave);
  const wavePeak = peak(fcWave, now);
  if (w?.v != null) {
    const station = obsWave?.source?.station_name;
    let text = `${hourText(w.t)} ${station ? `${station} ` : ''}관측 기준 파고는 ${f1(w.v)}m로 ${seaState(w.v)}이에요.`;
    if (wavePeak && wavePeak.v > w.v + 0.2) text += ` 예보상 ${hourText(wavePeak.t)}쯤 ${f1(wavePeak.v)}m까지 높아져요.`;
    out.push({ key: 'wave', text });
  } else if (wavePeak) {
    const r = rangeOf(fcWave)!;
    const span = r.min === r.max ? `${f1(r.max)}m` : `${f1(r.min)}~${f1(r.max)}m`;
    out.push({ key: 'wave', text: `오늘 예보 파고는 ${span}로 ${seaState(r.max)} 수준이에요.` });
  }

  // 2) 바람
  const wd = latestPoint(obsWind);
  const windPeak = peak(fcWind, now);
  if (wd?.v != null) {
    const n = windName(wd.v);
    let text = `바람은 ${f1(wd.v)}m/s로 ${n.feel} ${n.name} 정도예요.`;
    if (windPeak && windPeak.v >= wd.v + 1.5) {
      text += ` 예보로는 ${hourText(windPeak.t)}쯤 ${f1(windPeak.v)}m/s(${windName(windPeak.v).name})까지 강해져요.`;
    }
    out.push({ key: 'wind', text });
  } else if (windPeak) {
    const n = windName(windPeak.v);
    out.push({ key: 'wind', text: `예보상 남은 시간 중 바람이 가장 셀 때는 ${hourText(windPeak.t)}쯤 ${f1(windPeak.v)}m/s, ${n.name} 정도예요.` });
  }

  // 3) 수온 (오늘 첫 관측과 비교)
  const t = latestPoint(temp);
  if (t?.v != null) {
    const first = temp?.points?.find((p) => p.v != null);
    let text = `수온은 ${f1(t.v)}°C예요.`;
    if (first?.v != null && first.t !== t.t) {
      const d = t.v - first.v;
      if (Math.abs(d) >= 0.3) text += ` 오늘 ${hourText(first.t)}보다 ${f1(Math.abs(d))}°C ${d > 0 ? '올랐어요' : '내려갔어요'}.`;
    }
    out.push({ key: 'temp', text });
  }

  // 4) 물때
  const ext = nextExtreme(findSeries(pc, 'tide_extreme', 'forecast'), now);
  const period = currentIndexPeriod(pc.fishing_index, now);
  if (ext) {
    const phase = period?.tide_phase ? `오늘은 ${period.tide_phase}이고, ` : '';
    out.push({
      key: 'tide',
      text: `${phase}다음 ${ext.type === 'high' ? '만조' : '간조'}는 ${hourText(ext.t)}${ext.v != null ? `(${ext.v}cm)` : ''}예요.`,
    });
  }

  // 5) 공식 바다낚시지수 (기관 발표값을 그대로 전달)
  if (period && period.items.length > 0) {
    // 같은 등급끼리 묶어 반복을 줄인다: 「매우나쁨」 농어·돌돔 / 「보통」 우럭
    const byLevel = new Map<string, string[]>();
    for (const i of period.items) if (i.index) byLevel.set(i.index, [...(byLevel.get(i.index) ?? []), i.species]);
    if (byLevel.size) {
      const when = period.period === '일' ? '오늘' : `오늘 ${period.period}`;
      const groups = [...byLevel.entries()].map(([lv, sp]) =>
        sp.length === 1 ? `${sp[0]} 「${lv}」` : `「${lv}」 ${sp.join('·')}`,
      );
      out.push({ key: 'index', text: `국립해양조사원이 발표한 ${when} 바다낚시지수는 ${groups.join(', ')}이에요.` });
    }
  }

  // 6) 자료 지점 거리 (UX 검토 P0-5). 5km 넘는 지점은 모두 알린다 (물때 조위관측소 포함)
  const tideSrc = findSeries(pc, 'tide_extreme', 'forecast')?.source;
  const far = (
    [
      ['파도 관측 부이', obsWave?.source],
      ['물때 기준 조위관측소', tideSrc],
    ] as const
  ).filter(([, src]) => src?.distance_km != null && src.distance_km > 5);
  if (far.length) {
    const list = far.map(([label, src]) => `${label} ${Math.round(src!.distance_km!)}km(${distanceGrade(src!.distance_km!)})`);
    out.push({ key: 'distance', text: `자료 지점까지 거리: ${list.join(', ')}. 실제 현장과는 다를 수 있어요.` });
  }
  if (!obsWave?.source) {
    out.push({ key: 'distance', text: '이 낚시터는 30km 안에 파도 관측 부이가 없어 실측 없이 예보만 보여드려요.' });
  }

  if (out.length === 0) out.push({ key: 'none', text: '이 낚시터 주변에서 받을 수 있는 오늘 자료가 아직 없어요.' });
  return out;
}

/** 자료 지점 거리 등급 (UX 검토 §7) */
export function distanceGrade(km: number): string {
  if (km <= 5) return '인근';
  if (km <= 15) return '참고';
  return '먼 거리';
}

/**
 * 두 장소에 공통으로 있는 자료 종류. 둘 다 예보가 있으면 예보, 둘 다 실측만 있으면 실측, 아니면 null.
 * 비교 요약은 이 종류로만 만든다 — 예보와 실측을 나란히 놓지 않는다 (UX 검토 P0-3)
 */
export function commonKind(a: PlaceCompare, b: PlaceCompare, metric: 'wave_height' | 'wind_speed'): DataKind | null {
  const has = (p: PlaceCompare, k: DataKind) => findSeries(p, metric, k)?.status === 'ok';
  if (has(a, 'forecast') && has(b, 'forecast')) return 'forecast';
  if (has(a, 'observed') && has(b, 'observed')) return 'observed';
  return null;
}

function shortMetric(pc: PlaceCompare, metric: 'wave_height' | 'wind_speed', kind: DataKind | null): string | null {
  const label = metric === 'wave_height' ? '파고' : '바람';
  const unit = metric === 'wave_height' ? 'm' : 'm/s';
  const name = (v: number) => (metric === 'wave_height' ? seaState(v) : windName(v).name);
  if (kind === 'forecast') {
    const p = peak(findSeries(pc, metric, 'forecast'));
    return p ? `${label} 예보 최대 ${f1(p.v)}${unit}(${name(p.v)})` : `${label} 예보 없음`;
  }
  if (kind === 'observed') {
    const p = latestPoint(findSeries(pc, metric, 'observed'));
    return p?.v != null ? `${label} 실측 ${f1(p.v)}${unit}(${timeLabel(p.t)}, ${name(p.v)})` : `${label} 실측 없음`;
  }
  return `${label}: 두 곳에 같은 종류 자료가 없어 비교 생략`;
}

/** 비교 화면용 한 줄 요약. kinds 는 commonKind() 결과 — 두 장소가 같은 종류로 요약된다 */
export function describeShort(
  pc: PlaceCompare,
  kinds: { wave: DataKind | null; wind: DataKind | null },
): string {
  const parts = [shortMetric(pc, 'wave_height', kinds.wave), shortMetric(pc, 'wind_speed', kinds.wind)].filter(
    (x): x is string => !!x,
  );
  const ext = findSeries(pc, 'tide_extreme', 'forecast')?.extremes;
  if (ext?.length) {
    const highs = ext.filter((e) => e.type === 'high').map((e) => timeLabel(e.t));
    if (highs.length) parts.push(`만조 ${highs.join('·')}`);
  }
  return parts.join(', ');
}
