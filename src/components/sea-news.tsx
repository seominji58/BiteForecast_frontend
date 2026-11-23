/**
 * 홈 「이번 달 바다」 카드 (2026-11-23): 제철 어종 칩(누르면 그 어종 시트) + 금어기 소식 한 줄.
 * 근거: 통계청 연근해 어획량 「어획 많은 달」, 수산자원관리법 금어기. 자료가 없으면 그리지 않는다
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCatchSeasons, useFishingRules } from '@/api/queries';
import { Text } from '@/components/app-text';
import { SpeciesImage } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { banNews, inSeason } from '@/lib/sea-news';
import { speciesByCode, type SpeciesItem } from '@/lib/species';

const SEAS = new Set(['서해', '남해', '동해', '제주']);

const PER = 2; // 한 번에 보이는 제철 어종 수 (좁은 화면에서도 한 줄)

export function SeaNews({ today, region, onOpen }: { today: string | undefined; region: string; onOpen: (sp: SpeciesItem) => void }) {
  const theme = useTheme();
  const catches = useCatchSeasons();
  const rules = useFishingRules();
  const [page, setPage] = useState(0);
  if (!today) return null;
  const month = Number(today.slice(5, 7));
  const sea = SEAS.has(region) ? region : null;
  const fish = inSeason(catches.data, month, sea, (c) => !!speciesByCode(c));
  const bans = banNews(rules.data, today).slice(0, 2);
  if (!fish.length && !bans.length) return null;
  const banText = bans.map((b) => (b.kind === 'ended' ? `${b.name} 금어기 풀림` : `${b.days}일 뒤 ${b.name} 금어기`)).join(' · ');
  const pages = Math.max(1, Math.ceil(fish.length / PER));
  const p = Math.min(page, pages - 1); // 지역이 바뀌어 어종 수가 줄면 마지막 쪽으로
  const shown = fish.slice(p * PER, p * PER + PER);
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {month}월 제철{sea ? ` · ${sea}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.src} numberOfLines={1}>
            통계청 어획 많은 달
          </ThemedText>
        </View>
        {pages > 1 ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {p + 1}/{pages}
            </ThemedText>
            {(
              [
                ['‹', -1, '이전 제철 어종'],
                ['›', 1, '다음 제철 어종'],
              ] as const
            ).map(([t, d, label]) => {
              const off = d < 0 ? p === 0 : p >= pages - 1;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ disabled: off }}
                  disabled={off}
                  hitSlop={6}
                  onPress={() => setPage(p + d)}
                  style={({ pressed }) => [
                    styles.arrow,
                    { borderColor: theme.border, backgroundColor: theme.background },
                    off && styles.off,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.arrowText, { color: theme.text }]}>{t}</Text>
                </Pressable>
              );
            })}
          </>
        ) : null}
      </View>
      {shown.length ? (
        <View style={styles.chips}>
          {shown.map((f) => {
            const sp = speciesByCode(f.code)!;
            return (
              <Pressable
                key={f.code}
                accessibilityRole="button"
                accessibilityLabel={`${sp.name}, ${f.seas.join('·')} 어획 많은 달. 자세히`}
                onPress={() => onOpen(sp)}
                style={({ pressed }) => [styles.chip, { backgroundColor: theme.tintSoft }, pressed && styles.pressed]}>
                <SpeciesImage code={sp.code} size={24} />
                <Text style={styles.chipText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {sp.name}
                </Text>
              </Pressable>
            );
          })}
          {/* 마지막 쪽에 하나만 남으면 자리를 비워 칩 크기를 맞춘다 */}
          {shown.length < PER ? <View style={styles.flex} /> : null}
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
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  src: { fontSize: 11 },
  arrow: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 20, lineHeight: 22, fontWeight: '700' },
  off: { opacity: 0.35 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  chipText: { color: Brand.teal, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  pressed: { opacity: 0.7 },
});
