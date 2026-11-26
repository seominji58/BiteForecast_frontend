import type { EnvSnapshot, JournalMutation, Metric, PointReason } from '@/api/types';

/** 2026. 11. 8. (토) 06:00 형식 (기기 시간대 기준) */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export const METRIC_LABEL: Record<Metric, string> = {
  tide_level: '조위',
  wave_height: '파고',
  wind_speed: '풍속',
  water_temp: '수온',
};

/** 기상청 단기예보 코드표 (원 코드 의미 그대로). SKY: 1 맑음·3 구름많음·4 흐림 / PTY: 0 없음·1 비·2 비/눈·3 눈·4 소나기 */
export const SKY_TEXT: Record<number, string> = { 1: '맑음', 3: '구름많음', 4: '흐림' };
export const PTY_TEXT: Record<number, string> = { 1: '비', 2: '비/눈', 3: '눈', 4: '소나기' };
export const ptyLabel = (v: number) => PTY_TEXT[v] ?? `코드 ${v}`;

/** 기상청 단기예보 WAV는 0.5m 단위. 0은 결측이 아니며 정밀도보다 작다는 뜻으로 표시한다. */
export function formatForecastWave(value: number | null | undefined): string {
  if (value == null) return '자료 없음';
  return value === 0 ? '0.5m 미만' : `${value}m`;
}

// 서버 지급 사유 (services/points.py). 2026-11-23 부터 활동만으로 쌓인다 (사진 인증 없음)
export const POINT_REASON_LABEL: Record<PointReason, string> = {
  JOURNAL_CREATED: '낚시 기록',
  DETAIL_FILLED: '어종·크기 기록',
  PHOTO_ATTACHED: '사진 첨부 (폐지된 규칙)',
  FIRST_PLACE: '처음 간 낚시터',
  PERSONAL_BEST: '같은 어종 최대어 갱신',
  POST_CREATED: '커뮤니티 글',
  COMMENT_CREATED: '댓글',
  CHALLENGE_VISIT: '탐험 도장',
};

/** 값이 없으면 0 이 아니라 「자료 없음」 (TC-02) */
export function formatEnvValue(s: EnvSnapshot): string {
  if (s.value == null) return '자료 없음';
  return `${s.value} ${s.unit}`;
}

export function formatEnvKind(s: EnvSnapshot): string | null {
  if (s.kind === 'observed') return '실측';
  if (s.kind === 'forecast') return '예보';
  return null;
}

/** 저장/삭제 결과 안내 문구 (포인트 증감 + 칭호 변경) */
/** 저장 직후 한 줄: 첫 포획·최대어 갱신 (내 기록과 비교) */
export function milestoneLine(res: JournalMutation): string | null {
  const m = res.milestone;
  if (!m) return null;
  if (m.kind === 'first_catch')
    return `🎉 ${m.species_name} 첫 포획!${m.length_cm != null ? ` (${m.length_cm}cm)` : ''} 내 도감에 추가됐어요.`;
  return `🏆 ${m.species_name} 내 최대어 갱신! ${m.previous_cm}cm → ${m.length_cm}cm`;
}

export function pointResultMessage(res: JournalMutation): string {
  const lines: string[] = [];
  const m = milestoneLine(res);
  if (m) lines.push(m, '');
  if (res.point_delta > 0) lines.push(`+${res.point_delta}P 획득`);
  else if (res.point_delta < 0) lines.push(`${res.point_delta}P (수정·삭제로 회수)`);

  if (res.title_changed) lines.push(`칭호가 「${res.title.current.name}」(으)로 바뀌었습니다.`);
  if (res.title.next) lines.push(`「${res.title.next.name}」까지 ${res.title.points_to_next}P`);
  lines.push(`총 ${res.total_points}P`);
  return lines.join('\n');
}

/** 「3시간 전」 같은 상대 시각 (7일 넘으면 날짜) */
export function timeAgo(iso: string, now = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}일 전`;
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}
