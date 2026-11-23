import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'caption'
    | 'bodyBold'
    | 'subtitle'
    | 'sectionTitle'
    | 'value'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

/**
 * 글씨 기준 (서비스 개선 설계 U1, 2026-11-16): 작은 글씨 14 · 본문 16 · 섹션 제목 18.
 * 시스템 글씨 크기 설정을 따르되 1.4배까지만 키워 레이아웃이 깨지지 않게 한다
 */
export const MAX_FONT_SCALE = 1.3;

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      lineBreakStrategyIOS="hangul-word"
      style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 500,
  },
  default: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: 500,
  },
  bodyBold: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: 700,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: 800,
    letterSpacing: -0.3,
  },
  value: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 800,
    letterSpacing: -0.3,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
