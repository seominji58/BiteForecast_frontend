/**
 * 어종 이미지·선택 카드 (홈·전체 어종·포인트 카드·상세·출조계획 공통).
 * 이미지가 없는 어종은 기본 아이콘으로 — 목록에서 빠지지 않는다.
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SpeciesItem } from '@/lib/species';
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

const CARD_W = 92;
const GAP = 10;

/**
 * 홈 어종 선택 (레퍼런스: 그림이 큰 정사각 카드 + 이름, 선택 = 주황 테두리, 아래 점 표시).
 * 고른 카드를 다시 누르면 선택 해제(어종 상관없음).
 */
export function SpeciesRail({
  items,
  selected,
  onSelect,
}: {
  items: SpeciesItem[];
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const perPage = 4;
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  return (
    <View style={styles.railWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        snapToInterval={CARD_W + GAP}
        decelerationRate="fast"
        scrollEventThrottle={32}
        onScroll={(e) => setPage(Math.min(pages - 1, Math.round(e.nativeEvent.contentOffset.x / ((CARD_W + GAP) * perPage))))}>
        {items.map((s) => {
          const on = selected === s.code;
          return (
            <Pressable
              key={s.code}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${s.name}${s.indexName ? ', 공식 낚시지수 제공' : ''}`}
              onPress={() => onSelect(on ? null : s.code)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.backgroundElement, borderColor: on ? Brand.orange : theme.border },
                on && styles.cardOn,
                pressed && styles.pressed,
              ]}>
              <View style={[styles.art, { backgroundColor: theme.tintSoft }]}>
                <SpeciesImage code={s.code} size={84} label={s.name} />
              </View>
              <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
                {s.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      {pages > 1 ? (
        <View style={styles.dots}>
          {Array.from({ length: pages }, (_, i) => (
            <View key={i} style={[styles.pageDot, { backgroundColor: i === page ? Brand.orange : theme.border }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** 선택한 어종 띠 (홈 결과 위) */
export function SpeciesStrip({ item, line, onClear }: { item: SpeciesItem; line: string; onClear: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.strip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <SpeciesImage code={item.code} size={56} label={item.name} />
      <View style={styles.flex}>
        <ThemedText type="smallBold">
          {item.name}
          {item.alias ? <ThemedText type="small" themeColor="textSecondary">{` · ${item.alias}`}</ThemedText> : null}
        </ThemedText>
        <ThemedText type="small" themeColor={item.indexName ? 'tint' : 'textSecondary'} numberOfLines={2}>
          {line}
        </ThemedText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="어종 선택 해제" onPress={onClear} hitSlop={10}>
        <ThemedText type="small" themeColor="textSecondary">
          해제
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  railWrap: { gap: 8 },
  rail: { gap: GAP, paddingRight: 16 },
  card: { width: CARD_W, borderWidth: 1.5, borderRadius: 16, overflow: 'hidden', alignItems: 'center', paddingBottom: 8 },
  cardOn: { borderWidth: 2.5 },
  art: { alignSelf: 'stretch', height: 84, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  name: { paddingHorizontal: 6 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  pageDot: { width: 7, height: 7, borderRadius: 4 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
});
