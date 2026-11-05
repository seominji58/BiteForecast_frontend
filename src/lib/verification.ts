import type { VerificationStatus } from '@/api/types';

/** 인증 상태 표시 (색과 함께 항상 글자로, NFR-05) */
export const VERIFY_LABEL: Record<
  VerificationStatus,
  { label: string; color: 'textSecondary' | 'warning' | 'success' | 'danger'; hint: string }
> = {
  none: { label: '개인 기록', color: 'textSecondary', hint: '포인트 없음 · 사진을 올려 인증을 신청할 수 있어요' },
  pending: { label: '인증 검토 중', color: 'warning', hint: '관리자가 사진을 확인하고 있어요' },
  approved: { label: '인증 완료', color: 'success', hint: '포인트가 지급된 기록이에요' },
  rejected: { label: '인증 반려', color: 'danger', hint: '사유를 확인하고 사진을 바꿔 다시 신청할 수 있어요' },
};
