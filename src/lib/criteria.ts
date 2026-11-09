/**
 * 「조건으로 찾기」 (사용자 결정 2026-11-05): 앱이 「좋은 곳」을 판정하지 않는다.
 * 사용자가 정한 파고·풍속 상한과 공식 특보·공식 바다낚시지수로 「내 조건에 맞는 곳」만 거른다.
 *
 * - 파고·풍속은 남은 시간 **예보 최대**로 본다 (실측 최신값만으로 통과시키지 않음 — 이후 높아질 수 있음)
 * - 예보가 없으면 「자료 부족」(통과로 치지 않음). 값을 만들지 않는다
 * - 해상 특보 발효 중이면 항상 제외. 특보 확인 불가(unknown)도 통과로 치지 않는다
 */
import type { FishingIndexLevel, PlaceSummary } from '@/api/types';

export type Criteria = {
  maxWave: number; // m
  maxWind: number; // m/s
  /** 공식 바다낚시지수 최소 등급 (null = 지수 조건 없음) */
  minIndex: FishingIndexLevel | null;
};

export const DEFAULT_CRITERIA: Criteria = { maxWave: 1.0, maxWind: 7, minIndex: null };

export const WAVE_STEPS = [0.5, 1.0, 1.5, 2.0];
export const WIND_STEPS = [4, 7, 10, 14];
export const INDEX_STEPS: (FishingIndexLevel | null)[] = [null, '보통', '좋음'];

const RANK: Record<FishingIndexLevel, number> = { 매우좋음: 5, 좋음: 4, 보통: 3, 나쁨: 2, 매우나쁨: 1 };

export type CheckResult = {
  status: 'meets' | 'fails' | 'unknown';
  /** 왜 그런지 (수치 근거). 판정 문구 없이 사실만 */
  notes: string[];
};

export function checkPlace(s: PlaceSummary | undefined, c: Criteria): CheckResult {
  if (!s) return { status: 'unknown', notes: ['자료 없음'] };
  const fails: string[] = [];
  const unknown: string[] = [];

  if (s.warning_level === 'warning') fails.push(`특보 발효 중(${s.warning_types.join('·') || '해상 특보'})`);
  else if (s.warning_level === 'unknown') unknown.push('특보 확인 불가');

  if (!s.wave_fc_max) unknown.push('파고 예보 없음');
  else if (s.wave_fc_max.v > c.maxWave) fails.push(`파고 예보 최대 ${s.wave_fc_max.v}m > ${c.maxWave}m`);

  if (!s.wind_fc_max) unknown.push('풍속 예보 없음');
  else if (s.wind_fc_max.v > c.maxWind) fails.push(`풍속 예보 최대 ${s.wind_fc_max.v}m/s > ${c.maxWind}m/s`);

  if (c.minIndex) {
    if (!s.index) unknown.push('낚시지수 없음');
    else if (RANK[s.index.best] < RANK[c.minIndex]) fails.push(`낚시지수 최고 ${s.index.best}`);
  }

  if (fails.length) return { status: 'fails', notes: fails };
  if (unknown.length) return { status: 'unknown', notes: unknown };
  const notes = [`파고 최대 ${s.wave_fc_max!.v}m · 풍속 최대 ${s.wind_fc_max!.v}m/s (예보)`];
  if (s.warning_level === 'nearby') notes.push('인근 해역 특보 있음');
  if (s.warning_level === 'preliminary') notes.push('예비특보 있음');
  return { status: 'meets', notes };
}

export function criteriaLabel(c: Criteria): string {
  return `파고 ≤${c.maxWave}m · 풍속 ≤${c.maxWind}m/s${c.minIndex ? ` · 지수 ${c.minIndex} 이상` : ''} · 특보 발효 제외`;
}

/** 특보 단계 짧은 표시 (확인 불가를 「없음」으로 바꾸지 않는다) */
export const WARNING_SHORT: Record<
  PlaceSummary['warning_level'],
  { text: string; color: 'danger' | 'warning' | 'textSecondary' | 'success' }
> = {
  warning: { text: '해상 특보 발효 중', color: 'danger' },
  nearby: { text: '인근 해역 특보', color: 'warning' },
  preliminary: { text: '예비특보', color: 'warning' },
  none: { text: '특보 없음', color: 'success' },
  unknown: { text: '특보 확인 불가', color: 'textSecondary' },
};

export const CHECK_TEXT: Record<CheckResult['status'], { label: string; color: 'success' | 'textSecondary' | 'warning' }> = {
  meets: { label: '내 조건 충족', color: 'success' },
  fails: { label: '조건 밖', color: 'textSecondary' },
  unknown: { label: '자료 부족', color: 'warning' },
};

export type Breakdown = {
  total: number;
  meets: PlaceSummary[];
  /**
   * 제외된 곳을 대표 이유 하나로만 센다 (중복 없음 → 합계 = 전체 − 맞는 곳).
   * 우선순위: 특보 발효 → 자료 부족 → 파고 초과 → 풍속 초과 → 지수 미달
   */
  warning: number;
  unknown: number;
  waveOver: number;
  windOver: number;
  indexLow: number;
  /** 자료가 모자라 판단할 수 없는 상태 (절반 이상 자료 부족이거나 자료 0) */
  insufficient: boolean;
};

/** 전체 낚시터를 내 기준으로 나눈다. 「조건 밖」 곳을 추천처럼 쓰지 않도록 이유별 곳 수만 센다 */
export function breakdown(list: PlaceSummary[], c: Criteria): Breakdown {
  const b: Breakdown = {
    total: list.length,
    meets: [],
    warning: 0,
    unknown: 0,
    waveOver: 0,
    windOver: 0,
    indexLow: 0,
    insufficient: false,
  };
  for (const s of list) {
    const r = checkPlace(s, c);
    if (r.status === 'meets') b.meets.push(s);
    else if (s.warning_level === 'warning') b.warning += 1;
    else if (r.status === 'unknown') b.unknown += 1;
    else if (s.wave_fc_max && s.wave_fc_max.v > c.maxWave) b.waveOver += 1;
    else if (s.wind_fc_max && s.wind_fc_max.v > c.maxWind) b.windOver += 1;
    else b.indexLow += 1;
  }
  b.insufficient = b.total === 0 || b.unknown >= b.total / 2;
  return b;
}

/** 「11/5 16:22 갱신 (2시간 전)」 — 예보·특보 중 더 오래된 쪽 기준 */
export function freshnessLine(ds: { forecast_fetched_at: string | null; warning_fetched_at: string | null }): string {
  const times = [ds.forecast_fetched_at, ds.warning_fetched_at].filter((t): t is string => !!t).map((t) => new Date(t));
  if (times.length === 0) return '아직 수집한 자료가 없어요';
  const t = new Date(Math.min(...times.map((d) => d.getTime())));
  const mins = Math.max(0, Math.round((Date.now() - t.getTime()) / 60000));
  const ago = mins < 60 ? `${mins}분 전` : mins < 1440 ? `${Math.floor(mins / 60)}시간 전` : `${Math.floor(mins / 1440)}일 전`;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `기상청 예보·특보 ${t.getMonth() + 1}/${t.getDate()} ${p2(t.getHours())}:${p2(t.getMinutes())} 갱신 (${ago})`;
}
