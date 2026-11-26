import type { PostCategory } from '@/api/types';
import type { AppIconName } from '@/constants/icons';

export const CATEGORY: Record<PostCategory, { label: string; icon: AppIconName }> = {
  catch: { label: '조황공유', icon: 'cat-catch' },
  question: { label: '낚시질문', icon: 'cat-question' },
  tip: { label: '정보·팁', icon: 'cat-tip' },
  free: { label: '자유게시판', icon: 'comment' },
};

export const REPORT_REASONS = ['광고·홍보', '욕설·비방', '개인정보 노출', '허위·위험한 정보', '기타'] as const;

/** 조황 글의 조과 한 줄: 「우럭 3마리 · 최대 32.5cm」 (괄호 속 표준명은 줄인다) */
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

/** 이모티콘만으로 된 글자 (🎣 · 👨‍👩‍👧 · 🇰🇷). 서버 schemas/community.py 와 같은 범위 */
export function isEmojiOnly(s: string): boolean {
  if (!s) return false;
  for (const ch of s) {
    const o = ch.codePointAt(0)!;
    const ok =
      (o >= 0x1f000 && o <= 0x1faff) ||
      (o >= 0x2600 && o <= 0x27bf) ||
      (o >= 0x1f1e6 && o <= 0x1f1ff) ||
      o === 0x200d ||
      o === 0xfe0f ||
      o === 0x20e3 ||
      (o >= 0x1f3fb && o <= 0x1f3ff);
    if (!ok) return false;
  }
  return true;
}

/** 글 제목 규칙: 일반 글자는 2자 이상, 이모티콘은 하나만 있어도 된다. 문제가 없으면 null */
export function titleError(title: string): string | null {
  const t = title.trim();
  if (!t) return '제목을 입력해 주세요.';
  if (Array.from(t).length < 2 && !isEmojiOnly(t)) return '제목은 2자 이상 입력해 주세요 (이모티콘은 하나만 있어도 돼요).';
  return null;
}
