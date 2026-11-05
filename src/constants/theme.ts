/**
 * 앱 색상 (라이트/다크). 네이비·틸 바탕 + 주황 포인트.
 * 의미 전달은 색상만으로 하지 않고 항상 텍스트를 함께 표시한다 (NFR-05).
 */

import '@/global.css';

import { Platform } from 'react-native';

/** 배너·탭바 등 테마와 무관하게 고정인 브랜드 색 */
export const Brand = {
  navy: '#0F2C4A',
  navyDeep: '#0A1F36',
  teal: '#0E5C63',
  orange: '#F28C28',
  /** 상단 배너 그라데이션: 밤바다 → 노을 */
  hero: ['#0A1F36', '#123A5E', '#2C5D7C', '#C98654'] as const,
  onNavy: '#FFFFFF',
  onNavySecondary: '#B9C9D9',
  tabInactive: '#8FA4BA',
} as const;

export const Colors = {
  light: {
    text: '#13263A',
    background: '#EEF2F6',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E2E8F0',
    border: '#E1E7EE',
    textSecondary: '#5B6B7C',
    tint: '#0E5C63',
    onTint: '#FFFFFF',
    accent: '#EE8424',
    onAccent: '#FFFFFF',
    accentSoft: '#FDEBD8',
    tintSoft: '#DCEFEF',
    danger: '#C62828',
    warning: '#A86200',
    success: '#2E7D32',
    dangerSoft: '#FDECEC',
    warningSoft: '#FFF3E0',
    cautionSoft: '#FFF8D6',
  },
  dark: {
    text: '#E8EEF5',
    background: '#0A1420',
    backgroundElement: '#13202E',
    backgroundSelected: '#1E2E40',
    border: '#1F2D3C',
    textSecondary: '#9AABBD',
    tint: '#4DB6BC',
    onTint: '#06121C',
    accent: '#F5A04A',
    onAccent: '#1A0F00',
    accentSoft: '#3A2611',
    tintSoft: '#123236',
    danger: '#EF6B6B',
    warning: '#F0B054',
    success: '#6FCF73',
    dangerSoft: '#3A1616',
    warningSoft: '#3A2611',
    cautionSoft: '#33300F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
