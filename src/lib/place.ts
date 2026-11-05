import type { PlaceType } from '@/api/types';
import type { AppIconName } from '@/constants/icons';

/** 장소 유형별 이미지 아이콘 */
export const PLACE_IMAGE: Record<PlaceType, AppIconName> = {
  breakwater: 'place-breakwater',
  rock: 'place-rock',
  wharf: 'place-wharf',
  beach: 'place-beach',
  other: 'place-wharf',
};
