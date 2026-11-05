/**
 * 수치를 사람이 읽는 문장으로 풀어 쓴다.
 *
 * 표현 기준은 공인 등급표를 그대로 쓴다 (앱의 판정이 아님, 명세 §14):
 * - 바람: 보퍼트 풍력계급 (기상청 사용 우리말 이름)
 * - 파도: WMO 해상상태 코드(Douglas) 파고 구간
 * 「낚시하기 좋다/안전하다」 같은 판정 표현은 쓰지 않는다.
 */
import type { PlaceCompare, Series } from '@/api/types';
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

/** 예보 계열에서 하루 최댓값과 그 시각 */
function peak(s: Series | undefined): { v: number; t: string } | null {
  if (s?.status !== 'ok' || !s.points) return null;
  let best: { v: number; t: string } | null = null;
  for (const p of s.points) if (p.v != null && (!best || p.v > best.v)) best = { v: p.v, t: p.t };
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
  const wavePeak = peak(fcWave);
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
  const windPeak = peak(fcWind);
  if (wd?.v != null) {
    const n = windName(wd.v);
    let text = `바람은 ${f1(wd.v)}m/s로 ${n.feel} ${n.name} 정도예요.`;
    if (windPeak && windPeak.v >= wd.v + 1.5) {
      text += ` 예보로는 ${hourText(windPeak.t)}쯤 ${f1(windPeak.v)}m/s(${windName(windPeak.v).name})까지 강해져요.`;
    }
    out.push({ key: 'wind', text });
  } else if (windPeak) {
    const n = windName(windPeak.v);
    out.push({ key: 'wind', text: `오늘 예보로 바람은 가장 셀 때 ${f1(windPeak.v)}m/s, ${n.name} 정도예요.` });
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
    const items = period.items.filter((i) => i.index).map((i) => `${i.species} 「${i.index}」`);
    if (items.length) {
      const when = period.period === '일' ? '오늘' : `오늘 ${period.period}`;
      out.push({ key: 'index', text: `국립해양조사원이 발표한 ${when} 바다낚시지수는 ${items.join(', ')}이에요.` });
    }
  }

  // 6) 거리 안내 (관측소가 멀면)
  const far = [obsWave?.source, fcWave?.source].find((s) => s?.distance_km != null && s.distance_km >= 3);
  if (far) out.push({ key: 'distance', text: `관측 지점이 약 ${Math.round(far.distance_km!)}km 떨어져 있어 실제 현장과는 다를 수 있어요.` });

  if (out.length === 0) out.push({ key: 'none', text: '이 낚시터 주변에서 받을 수 있는 오늘 자료가 아직 없어요.' });
  return out;
}

/** 비교 화면용 한 줄 요약 */
export function describeShort(pc: PlaceCompare): string {
  const parts: string[] = [];
  const wave = peak(findSeries(pc, 'wave_height', 'forecast')) ?? latestPoint(findSeries(pc, 'wave_height', 'observed'));
  if (wave?.v != null) parts.push(`파고 최대 ${f1(wave.v)}m(${seaState(wave.v)})`);
  const wind = peak(findSeries(pc, 'wind_speed', 'forecast')) ?? latestPoint(findSeries(pc, 'wind_speed', 'observed'));
  if (wind?.v != null) parts.push(`바람 최대 ${f1(wind.v)}m/s(${windName(wind.v).name})`);
  const ext = findSeries(pc, 'tide_extreme', 'forecast')?.extremes;
  if (ext?.length) {
    const highs = ext.filter((e) => e.type === 'high').map((e) => timeLabel(e.t));
    if (highs.length) parts.push(`만조 ${highs.join('·')}`);
  }
  return parts.length ? parts.join(', ') : '받을 수 있는 자료가 없어요';
}
