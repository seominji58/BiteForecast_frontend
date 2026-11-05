import type { PostCategory } from '@/api/types';
import type { AppIconName } from '@/constants/icons';

export const CATEGORY: Record<PostCategory, { label: string; icon: AppIconName }> = {
  catch: { label: '조황공유', icon: 'cat-catch' },
  question: { label: '낚시질문', icon: 'cat-question' },
  tip: { label: '정보·팁', icon: 'cat-tip' },
};

export const REPORT_REASONS = ['광고·홍보', '욕설·비방', '개인정보 노출', '허위·위험한 정보', '기타'] as const;
