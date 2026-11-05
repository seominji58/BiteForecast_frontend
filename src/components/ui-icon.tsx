import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';

import { Brand } from '@/constants/theme';

/**
 * 제공된 입질예보 아이콘 세트(assets/icons, AppIcon)에 대응되는 그림이 없을 때만 쓰는 보조 아이콘.
 * 현재 사용처: 현재 위치(GPS) · 지도 · 사진 추가. 색은 브랜드 청록으로 맞춘다.
 */
const NAMES = {
  gps: 'locate',
  map: 'map-outline',
  photo: 'image-outline',
} as const;

export type UiIconName = keyof typeof NAMES;

export function UiIcon({ name, size = 24, color = Brand.teal }: { name: UiIconName; size?: number; color?: ColorValue }) {
  return <Ionicons name={NAMES[name]} size={size} color={color as string} accessibilityElementsHidden />;
}
