/**
 * 어종 이미지·선택 카드 (홈·전체 어종·포인트 카드·상세·출조계획 공통).
 * 이미지가 없는 어종은 기본 아이콘으로 — 목록에서 빠지지 않는다.
 */
import { Image } from 'expo-image';
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

const CARD_W = 128;

/** 홈 어종 선택: 일러스트 + 이름 + 상태 한 줄의 가로 카드 (첫 칸은 「어종 상관없음」) */
export function SpeciesRail({
  items,
  selected,
  status,
  onSelect,
}: {
  items: SpeciesItem[];
  selected: string | null;
  /** 카드 아래 상태 한 줄 (예: 「공식 지수 26곳」 / 「공식 지수 없음」) */
  status: (s: SpeciesItem) => string;
  onSelect: (code: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      snapToInterval={CARD_W + 10}
      decelerationRate="fast">
      <SpeciesCard
        title="어종 상관없음"
        sub="모든 낚시터"
        on={selected == null}
        onPress={() => onSelect(null)}
        art={<AppIcon name="find-sea" size={44} />}
      />
      {items.map((s) => (
        <SpeciesCard
          key={s.code}
          title={s.name}
          sub={status(s)}
          badge={s.indexName ? '공식 지수' : null}
          on={selected === s.code}
          onPress={() => onSelect(s.code)}
          art={<SpeciesImage code={s.code} size={92} label={s.name} />}
        />
      ))}
    </ScrollView>
  );
}

function SpeciesCard({
  title,
  sub,
  badge,
  on,
  onPress,
  art,
}: {
  title: string;
  sub: string;
  badge?: string | null;
  on: boolean;
  onPress: () => void;
  art: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: on ? Brand.orange : theme.border },
        on && styles.cardOn,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.art, { backgroundColor: theme.tintSoft }]}>
        {art}
        {badge ? (
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>{badge}</ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.cardText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.sub}>
          {sub}
        </ThemedText>
      </View>
    </Pressable>
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
  rail: { gap: 10, paddingRight: 16 },
  card: { width: CARD_W, borderWidth: 1.5, borderRadius: 14, overflow: 'hidden' },
  cardOn: { borderWidth: 2.5 },
  art: { height: 88, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    left: 6,
    top: 6,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: 'rgba(14,92,99,0.92)',
  },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  cardText: { paddingHorizontal: 10, paddingVertical: 8, gap: 1 },
  sub: { fontSize: 12, lineHeight: 16 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
});
