/** 출조계획 표시 도우미 (설계안 docs/05_UX/2026-11-09_출조계획_설계안.md) */
import type { StopOutlook, TripStop } from '@/api/types';
import { dayLabel, formatDay, parseDay, timeLabel } from '@/lib/compare';
import { type Criteria, WARNING_SHORT } from '@/lib/criteria';

/** D-5 · D-day · 진행 중 · 지난 계획 */
export function dday(start: string, end: string, today: string): string {
  if (end < today) return '지난 계획';
  if (start <= today) return start === end ? 'D-day' : '진행 중';
  const n = Math.round((parseDay(start).getTime() - parseDay(today).getTime()) / 86_400_000);
  return `D-${n}`;
}

/** 11/14(토) ~ 11/15(일) · 1박 2일 */
export function periodLabel(start: string, end: string): string {
  const days = Math.round((parseDay(end).getTime() - parseDay(start).getTime()) / 86_400_000) + 1;
  if (days === 1) return `${dayLabel(start)} · 당일`;
  return `${dayLabel(start)} ~ ${dayLabel(end)} · ${days - 1}박 ${days}일`;
}

/** 계획 기간의 날짜 목록 */
export function tripDays(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = parseDay(start); formatDay(d) <= end; d.setDate(d.getDate() + 1)) out.push(formatDay(d));
  return out;
}

/** 'HH:MM:SS' → 'HH:MM' */
export const hm = (t: string | null) => (t ? t.slice(0, 5) : null);

export function timeRange(s: TripStop): string | null {
  const a = hm(s.start_time);
  const b = hm(s.end_time);
  if (a && b) return `${a} ~ ${b}`;
  return a ? `${a}부터` : b ? `${b}까지` : null;
}

/** Date → 'HH:MM' (서버 time) */
export function toHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function hmToDate(t: string | null): Date | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export type OutlookLine = {
  /** 한 줄 요약 */
  text: string;
  /** 내 기준 판단 (예보가 있을 때만) */
  fit: { label: string; color: 'success' | 'textSecondary' | 'warning' } | null;
  tone: 'textSecondary' | 'warning' | 'danger';
  tide: string | null;
};

/**
 * 장소 하나의 그날 해황 요약 문구. 값을 만들지 않는다.
 * - pending: 예보 발표 전 / past: 지난 날짜 / location_check: 위치 확인 필요
 * - 특보는 오늘일 때만 「지금 발효」로, 다른 날은 「그날 특보 발표 전」
 */
export function outlookLine(o: StopOutlook | undefined, c: Criteria, lastDay: string | null): OutlookLine {
  const tideText = (x: StopOutlook) =>
    x.tides.length
      ? `${x.tides.map((t) => `${t.type === 'high' ? '만조' : '간조'} ${timeLabel(t.t)}`).join(' · ')} — ${x.tides[0].station_name} 관측소${
          x.tides[0].station_km != null ? `(${x.tides[0].station_km}km)` : ''
        } 기준·참고`
      : null;
  if (!o) return { text: '해황 확인 중…', fit: null, tone: 'textSecondary', tide: null };
  if (o.forecast_status === 'location_check')
    return { text: '위치 확인 필요 — 좌표가 주소와 맞지 않아 해황을 연결하지 않았어요', fit: null, tone: 'warning', tide: null };
  if (o.forecast_status === 'past') return { text: '지난 날짜예요', fit: null, tone: 'textSecondary', tide: null };
  if (o.forecast_status === 'location_review') {
    // 좌표 기준 자료(파고·풍속·물때)는 판단 보류, 특보만 주소 기준으로
    const w =
      o.warning_level == null
        ? '특보 확인 불가'
        : o.warning_is_current
          ? `특보(주소 기준) ${WARNING_SHORT[o.warning_level].text}`
          : '그날 특보 발표 전';
    return {
      text: `위치 검증 중 · 해황 판단 보류 · ${w}`,
      fit: null,
      tone: o.warning_is_current && o.warning_level === 'warning' ? 'danger' : 'warning',
      tide: o.warning_note ?? null,
    };
  }
  if (o.forecast_status === 'pending')
    return {
      text: `파고·풍속 예보 발표 전${lastDay ? ` (예보는 ${dayLabel(lastDay)}까지)` : ''} · 출조 3~4일 전부터 보여드려요`,
      fit: null,
      tone: 'textSecondary',
      tide: tideText(o),
    };
  const warn =
    o.warning_level == null
      ? '특보 확인 불가'
      : o.warning_is_current
        ? WARNING_SHORT[o.warning_level].text + (o.warning_types.length ? `(${o.warning_types.join('·')})` : '')
        : '그날 특보 발표 전';
  const parts = [
    o.wave_fc_max ? `파고 최대 ${o.wave_fc_max.v}m` : '파고 예보 없음',
    o.wind_fc_max ? `풍속 최대 ${o.wind_fc_max.v}m/s` : '풍속 예보 없음',
    warn,
  ];
  // 내 기준: 홈과 같은 규칙 (특보 발효 중이면 제외, 자료 없으면 판단 안 함)
  let fit: OutlookLine['fit'];
  if (o.warning_is_current && o.warning_level === 'warning') fit = { label: '특보 발효 중', color: 'warning' };
  else if (!o.wave_fc_max || !o.wind_fc_max) fit = { label: '자료 부족', color: 'warning' };
  else if (o.wave_fc_max.v > c.maxWave || o.wind_fc_max.v > c.maxWind) fit = { label: '내 기준 밖', color: 'textSecondary' };
  else fit = { label: '내 기준 충족', color: 'success' };
  const danger = o.warning_is_current && o.warning_level === 'warning';
  return { text: parts.join(' · '), fit, tone: danger ? 'danger' : 'textSecondary', tide: tideText(o) };
}

export const DEFAULT_CHECKLIST_HINT = '기본 준비물 4가지가 들어가요. 계획에서 고치거나 더할 수 있어요.';
