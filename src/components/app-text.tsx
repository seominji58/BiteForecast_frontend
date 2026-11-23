/**
 * 앱 공통 Text (2026-11-23): 기기 글자 크기 설정을 키워도 화면이 깨지지 않게 배율 상한을 건다.
 * react-native 의 Text 대신 이것을 쓴다 (ThemedText 와 같은 상한).
 */
import { Text as RNText, type TextProps } from 'react-native';

import { MAX_FONT_SCALE } from '@/components/themed-text';

export function Text(props: TextProps) {
  // 한국어는 낱말 단위로 줄바꿈 (「떠나세 / 요?」처럼 글자 중간에서 끊기지 않게, iOS)
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} lineBreakStrategyIOS="hangul-word" {...props} />;
}
