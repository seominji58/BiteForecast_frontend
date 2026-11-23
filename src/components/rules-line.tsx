/**
 * 홈 어종 아래 금어기·금지체장 카드 한 줄 (2026-11-23, 바다 한 줄과 같은 모양: 아이콘 · 내용 · ›).
 * - 어종을 골랐으면: 지금 금어기면 빨간 「지금 금어기」, 아니면 「25cm 이하 놓아주기 · 금어기 5.1~5.31」. 누르면 그 어종 시트
 * - 안 골랐으면: 「오늘 금어기 7종 · 연어·쥐노래미·명태…」 + 곧 시작. 누르면 금어기·금지체장 화면
 * - 자료를 못 받으면 아무것도 그리지 않는다 (홈을 막지 않음)
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useFishingRules } from '@/api/queries';
import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { activeBans, inPeriod, periodText, rulesForSpecies, upcomingBans } from '@/lib/rules';
import type { SpeciesItem } from '@/lib/species';

export function RulesLine({
  species,
  today,
  onOpenSpecies,
  alertOnly,
}: {
  species: SpeciesItem | null;
  today: string | undefined;
  /** 어종을 골랐을 때 누르면: 그 어종 시트(1년 달력·근거). 없으면 금어기 화면으로 */
  onOpenSpecies?: () => void;
  /** 홈: 지금 금어기일 때만 보인다 (평소 금지체장은 어종 시트에서) */
  alertOnly?: boolean;
}) {
  const q = useFishingRules();
  const theme = useTheme();
  if (!q.data || !today) return null;
  const r = q.data;

  let title: string;
  let sub: string | null = null;
  let danger = false;
  let onPress: () => void;

  if (species) {
    const { bans, sizes } = rulesForSpecies(r, species.code);
    const year = Number(today.slice(0, 4));
    const nowBan = bans.find((b) => b.periods.some((p) => inPeriod(p, today)));
    onPress = onOpenSpecies ?? (() => router.push({ pathname: '/rules', params: { name: bans[0]?.name ?? sizes[0]?.name } }));
    if (nowBan) {
      danger = true;
      title = `지금 ${species.name} 금어기예요`;
      sub = nowBan.periods
        .filter((p) => inPeriod(p, today))
        .map(periodText)
        .join(' · ');
    } else if (!bans.length && !sizes.length) {
      title = `${species.name} · 법정 금어기·금지체장 없음`;
      sub = '산란기 등 1년 달력 보기';
    } else {
      title = sizes.length ? `${species.name} · ${sizes.map((s) => s.limit).join('·')}는 놓아주세요` : `${species.name} 금어기`;
      sub = bans.length
        ? `금어기 ${bans
            .map((b) => {
              const ps = b.notice ? b.periods.filter((p) => p.year === year) : b.periods;
              return ps.length ? ps.map(periodText).join('·') : '고시 확인';
            })
            .join(' / ')}`
        : '법정 금어기 없음';
    }
  } else {
    const now = activeBans(r, today);
    const soon = upcomingBans(r, today, 30);
    if (!now.length && !soon.length) return null;
    onPress = () => router.push('/rules');
    danger = now.length > 0;
    title = now.length ? `오늘 금어기 ${now.length}종` : '오늘 금어기 없음';
    sub = [now.length ? now.map((a) => a.rule.name).join('·') : null, soon.length ? `${soon[0].inDays}일 뒤 ${soon[0].rule.name}` : null]
      .filter(Boolean)
      .join(' · ');
  }

  if (alertOnly && !(danger && species)) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${sub ? `, ${sub}` : ''}. 자세히 보기`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: danger ? theme.dangerSoft : theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <AppIcon name="regulation" size={22} />
      <View style={styles.flex}>
        <ThemedText type="smallBold" themeColor={danger ? 'danger' : 'text'} numberOfLines={1}>
          {title}
        </ThemedText>
        {sub ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {sub}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText themeColor="textSecondary">›</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 52,
  },
});
