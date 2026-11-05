import type { PostCategory } from '@/api/types';
import type { IconName } from '@/components/screen';

export const CATEGORY: Record<PostCategory, { label: string; icon: IconName }> = {
  catch: { label: '조황공유', icon: 'fish' },
  question: { label: '낚시질문', icon: 'lightbulb-on-outline' },
  tip: { label: '정보·팁', icon: 'book-open-variant' },
};

export const REPORT_REASONS = ['광고·홍보', '욕설·비방', '개인정보 노출', '허위·위험한 정보', '기타'] as const;
