import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';

import { Brand } from '@/constants/theme';

/**
 * 제공된 입질예보 아이콘 세트(assets/icons, AppIcon)에 대응되는 그림이 없을 때만 쓰는 보조 아이콘.
 * 현재 사용처: 사진 추가, 출조계획·커뮤니티 줄 앞 아이콘 (GPS·지도는 2026-11-05 전용 아이콘 find-gps·find-map 으로 교체). 색은 브랜드 청록.
 */
const NAMES = {
  photo: 'image-outline',
  // 2026-11-17 출조계획·커뮤니티 레퍼런스의 얇은 선 아이콘 (줄 앞 표시용)
  calendar: 'calendar-outline',
  pin: 'location-outline',
  map: 'map-outline',
  fish: 'fish-outline',
  people: 'people-outline',
  check: 'checkbox-outline',
  memo: 'document-text-outline',
  title: 'bookmark-outline',
  edit: 'create-outline',
  camera: 'camera-outline',
  filter: 'funnel-outline',
  more: 'ellipsis-vertical',
  heart: 'heart-outline',
  heartOn: 'heart',
  chat: 'chatbubble-outline',
  add: 'add',
  chevron: 'chevron-forward',
  down: 'chevron-down',
  qr: 'qr-code-outline',
  pencil: 'pencil',
  wave: 'water-outline',
  wind: 'flag-outline',
  moon: 'moon-outline',
  alert: 'warning-outline',
} as const;

export type UiIconName = keyof typeof NAMES;

export function UiIcon({ name, size = 24, color = Brand.teal }: { name: UiIconName; size?: number; color?: ColorValue }) {
  return <Ionicons name={NAMES[name]} size={size} color={color as string} accessibilityElementsHidden />;
}
