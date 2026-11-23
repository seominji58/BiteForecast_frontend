/**
 * 어종 이미지·선택 카드 (홈·전체 어종·포인트 카드·상세·출조계획 공통).
 * 이미지가 없는 어종은 기본 아이콘으로 — 목록에서 빠지지 않는다.
 */
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { useTheme } from '@/hooks/use-theme';
import { SPECIES_IMAGES } from '@/lib/species-images';

export function SpeciesImage({ code, size, label }: { code: string | null; size: number; label?: string }) {
  const theme = useTheme();
  const src = code ? SPECIES_IMAGES[code] : undefined;
  if (src) {
    return (
      <Image
        source={src}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityLabel={label ? `${label} 그림` : undefined}
      />
    );
  }
  return (
    <View
      style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.tintSoft }]}
      accessibilityLabel={label ? `${label} (그림 준비 중)` : undefined}>
      <AppIcon name="cat-catch" size={Math.round(size * 0.5)} />
    </View>
  );
}


const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
