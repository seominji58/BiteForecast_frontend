import type { PostCategory } from '@/api/types';
import type { AppIconName } from '@/constants/icons';

export const CATEGORY: Record<PostCategory, { label: string; icon: AppIconName }> = {
  catch: { label: '조황공유', icon: 'cat-catch' },
  question: { label: '낚시질문', icon: 'cat-question' },
  tip: { label: '정보·팁', icon: 'cat-tip' },
};

export const REPORT_REASONS = ['광고·홍보', '욕설·비방', '개인정보 노출', '허위·위험한 정보', '기타'] as const;

/** 인증 조황의 조과 한 줄: 「우럭 3마리 · 최대 32.5cm」 (괄호 속 표준명은 줄인다) */
export function catchLine(c: { species_name: string | null; count: number | null; max_length_cm: number | null }): string {
  const name = c.species_name?.replace(/\(.*\)/, '') ?? null;
  return [
    name && c.count != null ? `${name} ${c.count}마리` : name,
    !name && c.count != null ? `${c.count}마리` : null,
    c.max_length_cm != null ? `최대 ${c.max_length_cm}cm` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** 「11월 6일」 */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 「제주 제주시 · 김녕」 */
export function whereLine(p: { region_name: string | null; place_name: string | null }): string | null {
  return [p.region_name, p.place_name].filter(Boolean).join(' · ') || null;
}
