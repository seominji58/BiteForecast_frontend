/**
 * 홈 어종 아래 한 줄: 금어기·금지체장 (2026-11-23).
 * - 어종을 골랐으면: 지금 금어기면 빨간 경고, 아니면 「○cm 이하는 놓아주세요 · 금어기 ○.○~○.○」
 * - 안 골랐으면: 「오늘 금어기 ○○·○○ 외 N종」 + 30일 안에 시작하는 금어기
 * - 누르면 금어기·금지체장 화면. 자료를 못 받으면 아무것도 보이지 않는다 (홈을 막지 않음)
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useFishingRules } from '@/api/queries';
import { ThemedText } from '@/components/themed-text';
import { activeBans, inPeriod, periodText, rulesForSpecies, upcomingBans } from '@/lib/rules';
import type { SpeciesItem } from '@/lib/species';

export function RulesLine({
  species,
  today,
  onOpenSpecies,
}: {
  species: SpeciesItem | null;
  today: string | undefined;
  /** 어종을 골랐을 때 누르면: 그 어종 시트(1년 달력·근거)를 연다. 없으면 금어기 화면으로 */
  onOpenSpecies?: () => void;
}) {
  const q = useFishingRules();
  if (!q.data || !today) return null;
  const r = q.data;
  const open = (name?: string) => router.push({ pathname: '/rules', params: name ? { name } : {} });

  if (species) {
    const { bans, sizes } = rulesForSpecies(r, species.code);
    const tap = onOpenSpecies ?? (() => open(bans[0]?.name ?? sizes[0]?.name));
    if (!bans.length && !sizes.length) {
      // 시행령 금어기·금지체장 대상이 아닌 어종: 규정 없음을 짧게 (산란기 등은 시트에서)
      return (
        <Pressable accessibilityRole="button" onPress={tap} style={styles.line}>
          <ThemedText type="small" themeColor="textSecondary">
            <ThemedText type="smallBold">{species.name}</ThemedText> · 법정 금어기·금지체장 없음 ›
          </ThemedText>
        </Pressable>
      );
    }
    const year = Number(today.slice(0, 4));
    // 고시 어종은 그해 고시된 기간만 (inPeriod 가 year 를 본다)
    const nowBan = bans.find((b) => b.periods.some((p) => inPeriod(p, today)));
    const nowPeriods = nowBan?.periods.filter((p) => inPeriod(p, today)) ?? [];
    const parts = [
      sizes.length ? `${sizes.map((s) => s.limit).join('·')}는 놓아주세요` : null,
      bans.length ? `금어기 ${bans
            .map((b) => {
              const ps = b.notice ? b.periods.filter((p) => p.year === year) : b.periods;
              return ps.length ? ps.map(periodText).join('·') : '고시 확인';
            })
            .join(' / ')}` : null,
    ].filter(Boolean);
    return (
      <Pressable accessibilityRole="button" onPress={tap} style={styles.line}>
        {nowBan ? (
          <ThemedText type="smallBold" themeColor="danger">
            ⚠ 지금 {species.name} 금어기예요 · {nowPeriods.map(periodText).join(' · ')} ›
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            <ThemedText type="smallBold">{species.name}</ThemedText> · {parts.join(' · ')} ›
          </ThemedText>
        )}
      </Pressable>
    );
  }

  const now = activeBans(r, today);
  const soon = upcomingBans(r, today, 30);
  if (!now.length && !soon.length) return null;
  const names = now.map((a) => a.rule.name);
  const head = names.slice(0, 3).join('·') + (names.length > 3 ? ` 외 ${names.length - 3}종` : '');
  return (
    <Pressable accessibilityRole="button" onPress={() => open()} style={styles.line}>
      <ThemedText type="small" themeColor="textSecondary">
        {now.length ? (
          <>
            <ThemedText type="smallBold" themeColor="danger">
              오늘 금어기
            </ThemedText>{' '}
            {head}
          </>
        ) : null}
        {now.length && soon.length ? ' · ' : ''}
        {soon.length ? `${soon[0].inDays}일 뒤 ${soon[0].rule.name} 금어기 시작` : ''} ›
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { minHeight: 32, justifyContent: 'center' },
});
