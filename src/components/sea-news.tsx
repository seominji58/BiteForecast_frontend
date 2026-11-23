/**
 * 홈 「이번 달 바다」 카드 (2026-11-23): 제철 어종 칩(누르면 그 어종 시트) + 금어기 소식 한 줄.
 * 근거: 통계청 연근해 어획량 「어획 많은 달」, 수산자원관리법 금어기. 자료가 없으면 그리지 않는다
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCatchSeasons, useFishingRules } from '@/api/queries';
import { SpeciesImage } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { banNews, inSeason } from '@/lib/sea-news';
import { speciesByCode, type SpeciesItem } from '@/lib/species';

const SEAS = new Set(['서해', '남해', '동해', '제주']);

export function SeaNews({ today, region, onOpen }: { today: string | undefined; region: string; onOpen: (sp: SpeciesItem) => void }) {
  const theme = useTheme();
  const catches = useCatchSeasons();
  const rules = useFishingRules();
  if (!today) return null;
  const month = Number(today.slice(5, 7));
  const sea = SEAS.has(region) ? region : null;
  const fish = inSeason(catches.data, month, sea, (c) => !!speciesByCode(c));
  const bans = banNews(rules.data, today).slice(0, 2);
  if (!fish.length && !bans.length) return null;
  const banText = bans.map((b) => (b.kind === 'ended' ? `${b.name} 금어기 풀림` : `${b.days}일 뒤 ${b.name} 금어기`)).join(' · ');
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.head}>
        <ThemedText type="smallBold">
          {month}월 제철{sea ? ` · ${sea}` : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.src}>
          통계청 어획 많은 달
        </ThemedText>
      </View>
      {fish.length ? (
        <View style={styles.chips}>
          {fish.map((f) => {
            const sp = speciesByCode(f.code)!;
            return (
              <Pressable
                key={f.code}
                accessibilityRole="button"
                accessibilityLabel={`${sp.name}, ${f.seas.join('·')} 어획 많은 달. 자세히`}
                onPress={() => onOpen(sp)}
                style={({ pressed }) => [styles.chip, { backgroundColor: theme.tintSoft }, pressed && styles.pressed]}>
                <SpeciesImage code={sp.code} size={22} />
                <Text style={styles.chipText}>{sp.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {banText ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {banText}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  src: { fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingLeft: 6, paddingRight: 10, minHeight: 32 },
  chipText: { color: Brand.teal, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
