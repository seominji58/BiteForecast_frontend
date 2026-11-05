import type { PlaceType } from '@/api/types';
import type { IconName } from '@/components/screen';

/** 장소 유형별 아이콘 (사진 대신 사용) */
export const PLACE_ICON: Record<PlaceType, IconName> = {
  breakwater: 'wall',
  rock: 'image-filter-hdr',
  wharf: 'anchor',
  beach: 'beach',
  other: 'map-marker',
};
