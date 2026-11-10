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

// 서버 지급 사유 (services/points.py). 모두 관리자 인증이 완료된 기록에서만 생긴다
export const POINT_REASON_LABEL: Record<PointReason, string> = {
  JOURNAL_CREATED: '인증 완료 기록',
  DETAIL_FILLED: '어종·크기 기록 (인증)',
  PHOTO_ATTACHED: '사진 첨부 (폐지된 규칙)',
  FIRST_PLACE: '처음 간 낚시터 (인증)',
  PERSONAL_BEST: '같은 어종 최대 길이 갱신 (인증)',
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
export function pointResultMessage(res: JournalMutation): string {
  const lines: string[] = [];
  const v = res.journal?.verification.status;
  if (v === 'pending') lines.push('인증 검토를 신청했어요. 관리자가 사진을 확인해 승인하면 포인트가 지급돼요.');
  else if (v === 'none') lines.push('개인 기록으로 저장했어요. 사진 인증을 받으면 포인트가 지급돼요.');
  if (res.point_delta > 0) lines.push(`+${res.point_delta}P 획득`);
  else if (res.point_delta < 0) lines.push(`${res.point_delta}P (인증 내용 변경·삭제로 회수)`);

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
