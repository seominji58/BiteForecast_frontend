/**
 * 앱 색상 (라이트/다크). 의미 전달은 색상만으로 하지 않고 항상 텍스트를 함께 표시한다 (NFR-05).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1B2B',
    background: '#ffffff',
    backgroundElement: '#F0F3F6',
    backgroundSelected: '#DDE5EC',
    textSecondary: '#5A6673',
    tint: '#0A6EBD',
    onTint: '#ffffff',
    danger: '#C62828',
    warning: '#B26A00',
    success: '#2E7D32',
  },
  dark: {
    text: '#ECF2F8',
    background: '#0B1117',
    backgroundElement: '#18212B',
    backgroundSelected: '#243140',
    textSecondary: '#A3B0BD',
    tint: '#4FA8F0',
    onTint: '#0B1117',
    danger: '#EF6B6B',
    warning: '#F0B054',
    success: '#6FCF73',
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
