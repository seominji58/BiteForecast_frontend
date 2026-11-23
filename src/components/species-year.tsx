/**
 * 어종 1년 달력 (2026-11-23). 홈 어종 한 줄을 누르면 시트 안에서 보여준다 (홈에 크게 펼치지 않음).
 * - 칸: 산란기(초록, 성기는 진하게) · 금어기(빨간 테두리·X) · 이번 달(주황 밑줄)
 * - 아래: 금지체장 · 해역별 산란기 근거(누르면 논문·수산과학원 원문) · 「산란기는 잘 잡히는 시기가 아니에요」
 * - 근거가 없으면 칸을 칠하지 않고 「국내 연구 자료 없음」이라고만 쓴다 (지어내지 않음)
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';

import { useCatchSeasons, useFishingRules, useSpeciesSeasons } from '@/api/queries';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { inPeriod, periodText, rulesForSpecies } from '@/lib/rules';
import { yearCells } from '@/lib/seasons';
import { CATCH_DIFFERS } from '@/lib/sea-news';
import type { SpeciesItem } from '@/lib/species';

export function SpeciesYear({
  species,
  today,
  onLeave,
}: {
  species: SpeciesItem;
  today: string | undefined;
  /** 다른 화면으로 가기 전에 (시트 안에서 쓸 때 시트를 닫는다) */
  onLeave?: () => void;
}) {
  const theme = useTheme();
  const seasons = useSpeciesSeasons().data;
  const rules = useFishingRules().data;
  const catches = useCatchSeasons().data;
  const catchS = catches?.species[species.code];
  const [open, setOpen] = useState(false);
  if (!today || (!seasons && !rules)) return null;
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const cells = yearCells(species.code, year, seasons, rules);
  const s = seasons?.species[species.code];
  const { bans, sizes } = rules ? rulesForSpecies(rules, species.code) : { bans: [], sizes: [] };
  const banNow = bans.find((b) => b.periods.some((p) => inPeriod(p, today)));
  const word = s?.kind === 'birth' ? '출산기' : '산란기';

  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {banNow ? (
        <ThemedText type="smallBold" themeColor="danger">
          ⚠ 지금 {species.name} 금어기예요 ·{' '}
          {banNow.periods
            .filter((p) => inPeriod(p, today))
            .map(periodText)
            .join(' · ')}
        </ThemedText>
      ) : null}

      <View style={styles.row} accessibilityLabel={`${species.name} 1년 달력`}>
        {cells.map((c) => (
          <View key={c.month} style={styles.cellWrap}>
            <View
              style={[
                styles.cell,
                { backgroundColor: c.spawn ? (c.peak ? theme.success : `${theme.success}55`) : theme.background },
                c.ban && { borderColor: theme.danger, borderWidth: 2 },
              ]}>
              {c.ban ? <Text style={[styles.x, { color: theme.danger }]}>✕</Text> : null}
            </View>
            <Text style={[styles.m, { color: c.month === month ? Brand.orange : theme.textSecondary }, c.month === month && styles.now]}>
              {c.month}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <Legend color={theme.success} label={`${word}(진할수록 활발)`} />
        <Legend color={theme.danger} label="금어기" outline />
        <ThemedText type="small" style={{ color: Brand.orange }}>
          ● 이번 달
        </ThemedText>
      </View>

      {/* 어획 많은 달 (통계청 어업생산동향조사 · 어선 어획): 바다별 월 막대 */}
      {catchS && Object.keys(catchS.seas).length ? (
        <View style={styles.catch}>
          <ThemedText type="smallBold">어획 많은 달 · 바다별</ThemedText>
          {Object.entries(catchS.seas).map(([sea, v]) => {
            const max = Math.max(...Object.values(v.share), 1);
            return (
              <View key={sea} style={styles.catchRow}>
                <ThemedText type="small" style={styles.catchSea}>
                  {sea}
                </ThemedText>
                <View style={styles.bars}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const h = Math.max(2, Math.round((22 * (v.share[String(m)] ?? 0)) / max));
                    const peak = v.peak.includes(m);
                    return (
                      <View key={m} style={styles.barCell}>
                        <View
                          style={[
                            styles.bar,
                            { height: h, backgroundColor: peak ? Brand.teal : theme.border },
                            m === month && { borderWidth: 1.5, borderColor: Brand.orange },
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <ThemedText type="small" themeColor="textSecondary">
            진한 막대가 어획 많은 달 · {catches?.period} · 통계청 어업생산동향조사(어선 어획)
            {CATCH_DIFFERS.has(species.code) ? ' · 어선 조업 시기라 낚시 시즌과 달라요' : ''}
          </ThemedText>
        </View>
      ) : null}

      {sizes.length ? (
        <ThemedText type="small">📏 {sizes.map((z) => `${z.limit}(${z.measure})`).join(' · ')}는 놓아주세요</ThemedText>
      ) : null}
      {s?.text ? <ThemedText type="small">{s.text}</ThemedText> : null}
      {s?.temps.map((t) => (
        <ThemedText key={t.text} type="small">
          🌡 {t.text}
        </ThemedText>
      ))}
      {/* 자료를 받았는데 그 어종이 없을 때만 「없음」 (못 받았으면 단정하지 않음) */}
      {seasons && !s ? (
        <ThemedText type="small" themeColor="textSecondary">
          {word}: 국내 연구 자료를 찾지 못했어요
        </ThemedText>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)} hitSlop={6} style={styles.link}>
        <ThemedText type="smallBold" themeColor="tint">
          {open ? '근거 접기 ▴' : '근거 보기 ▾'}
        </ThemedText>
      </Pressable>
      {open ? (
        <View style={styles.src}>
          {s?.periods.map((p, i) => (
            <Pressable key={i} accessibilityRole="link" onPress={() => Linking.openURL(p.url).catch(() => {})}>
              <ThemedText type="small">
                {word} {p.months.join('·')}월{p.peak.length ? ` (활발 ${p.peak.join('·')}월)` : ''}
                {p.area ? ` · ${p.area}` : ''}
                {p.note ? ` · ${p.note}` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="tint">
                {p.cite} ›
              </ThemedText>
            </Pressable>
          ))}
          {bans.length ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                onLeave?.();
                router.push({ pathname: '/rules', params: { name: bans[0].name } });
              }}>
              <ThemedText type="small" themeColor="tint">
                금어기·금지체장: 수산자원관리법 시행령·고시 ›
              </ThemedText>
            </Pressable>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            {seasons?.notice ?? '산란기는 잘 잡히는 시기와 같지 않아요.'}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function Legend({ color, label, outline }: { color: string; label: string; outline?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, outline ? { borderColor: color, borderWidth: 2 } : { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** 어선 조업 시기가 낚시 시즌과 크게 다른 어종 (2026-11-23 통계 검토) */

const styles = StyleSheet.create({
  catch: { gap: 4 },
  catchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  catchSea: { width: 30 },
  bars: { flex: 1, flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 24 },
  barCell: { flex: 1, justifyContent: 'flex-end', height: 24 },
  bar: { borderRadius: 2 },
  box: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  row: { flexDirection: 'row', gap: 3 },
  cellWrap: { flex: 1, alignItems: 'center', gap: 2 },
  cell: { alignSelf: 'stretch', height: 22, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  x: { fontSize: 11, fontWeight: '800' },
  m: { fontSize: 11 },
  now: { fontWeight: '800', textDecorationLine: 'underline' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  link: { minHeight: 28, justifyContent: 'center' },
  src: { gap: 6 },
});
