/**
 * 전체 어종 보기 (홈 「어떤 어종을 잡으러 가세요?」 → 전체 어종 보기).
 * 공식 지수 제공 어종 / 그 밖의 어종으로 나눠 보여준다. 이미지가 없으면 기본 아이콘 — 목록에서 빠지지 않는다.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSpecies } from '@/api/queries';
import { SectionHeader, StackScreen } from '@/components/screen';
import { SpeciesImage } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHomeSpecies } from '@/lib/prefs';
import { INDEX_DISCLAIMER, mergeWithApi, type SpeciesItem } from '@/lib/species';

export default function SpeciesScreen() {
  const api = useSpecies();
  const all = useMemo(() => mergeWithApi(api.data), [api.data]);
  const [selected, setSelected] = useHomeSpecies();
  const pick = (code: string | null) => {
    setSelected(code);
    router.back();
  };
  const indexed = all.filter((s) => s.indexName);
  const others = all.filter((s) => !s.indexName);
  return (
    <StackScreen>
      <SectionHeader title={`공식 낚시지수 제공 ${indexed.length}종`} />
      <ThemedText type="small" themeColor="textSecondary">
        {INDEX_DISCLAIMER}
      </ThemedText>
      <Grid items={indexed} selected={selected} onPick={pick} />
      <SectionHeader title={`그 밖의 어종 ${others.length}종`} />
      <ThemedText type="small" themeColor="textSecondary">
        공식 낚시지수가 없는 어종이에요. 고르면 일반 낚시터 탐색과 실제 조황 기록으로 안내해요.
      </ThemedText>
      <Grid items={others} selected={selected} onPick={pick} />
      <Pressable accessibilityRole="button" onPress={() => pick(null)} style={styles.clear}>
        <ThemedText type="smallBold" themeColor="tint">
          어종 상관없이 보기 ›
        </ThemedText>
      </Pressable>
    </StackScreen>
  );
}

function Grid({ items, selected, onPick }: { items: SpeciesItem[]; selected: string | null; onPick: (c: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {items.map((s) => {
        const on = s.code === selected;
        return (
          <Pressable
            key={s.code}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${s.name}${s.indexName ? ', 공식 지수 제공' : ''}`}
            onPress={() => onPick(s.code)}
            style={({ pressed }) => [
              styles.cell,
              { backgroundColor: theme.backgroundElement, borderColor: on ? Brand.orange : theme.border },
              on && styles.cellOn,
              pressed && styles.pressed,
            ]}>
            <View style={[styles.art, { backgroundColor: theme.tintSoft }]}>
              <SpeciesImage code={s.code} size={72} label={s.name} />
            </View>
            <ThemedText type="smallBold" numberOfLines={1}>
              {s.name}
            </ThemedText>
            {s.alias ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.alias}>
                {s.alias}
              </ThemedText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '31.5%', borderWidth: 1.5, borderRadius: 14, overflow: 'hidden', alignItems: 'center', paddingBottom: 8, gap: 2 },
  cellOn: { borderWidth: 2.5 },
  art: { alignSelf: 'stretch', height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  alias: { fontSize: 11, lineHeight: 15 },
  clear: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
