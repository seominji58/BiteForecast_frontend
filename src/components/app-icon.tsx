import { Image, StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { ICONS, type AppIconName } from '@/constants/icons';

type Props = {
  name: AppIconName;
  size?: number;
  /** 단색 마스크 아이콘(tab-*)에 입힐 색 */
  tint?: ColorValue;
  /** 밝은 원 배경 위에 올리기 (컬러 아이콘을 어두운 배경·다크 모드에서 보이게) */
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** 이미지 아이콘. 장식이 아닌 의미는 항상 옆에 텍스트로 함께 표시한다 (NFR-05) */
export function AppIcon({ name, size = 24, tint, badge, style }: Props) {
  const image = (
    <Image
      source={ICONS[name]}
      style={[{ width: size, height: size }, tint ? { tintColor: tint } : null]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
  if (!badge) return style ? <View style={style}>{image}</View> : image;
  const d = Math.round(size * 1.5);
  return <View style={[styles.badge, { width: d, height: d, borderRadius: d / 2 }, style]}>{image}</View>;
}

const styles = StyleSheet.create({
  badge: { backgroundColor: '#F3F6F9', alignItems: 'center', justifyContent: 'center' },
});
