/**
 * 상세 해황 화면의 구성 요소 (재설계 v2 §4-4). 설명문 대신 데이터 표로 보여준다.
 * 데이터: GET /places/{id}/conditions (변경 없음)
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { FishingIndex, PlaceCompare } from '@/api/types';
import { LEVEL_COLOR } from '@/components/compare-view';
import { Card } from '@/components/screen';
import { SpeciesImage } from '@/components/species';
import { TermLinks } from '@/components/term-sheet';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { KIND_TEXT, REASON_TEXT, timeLabel } from '@/lib/compare';
import { distanceGrade } from '@/lib/describe';
import { useHomeSpecies } from '@/lib/prefs';
import { speciesByCode, speciesByIndexName } from '@/lib/species';

export function distText(km: number | null) {
  return km == null ? '거리 확인 불가' : `${km < 1 ? '1km 미만' : `${Math.round(km)}km`}·${distanceGrade(km)}`;
}

/** 자료 기준: 어떤 지점의 어떤 종류 자료를 언제 기준으로 쓰는지 (P0-5) */
export function DataBasis({ pc, initiallyOpen = false }: { pc: PlaceCompare; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const rows = new Map<string, string>();
  for (const s of pc.series) {
    if (!s.source || s.status !== 'ok') continue;
    const d = s.source.distance_km;
    const dist = d != null ? `${d}km · ${distanceGrade(d)}` : '거리 확인 불가';
    const when =
      s.kind === 'observed' && s.issued_at
        ? `${timeLabel(s.issued_at)} 관측`
        : s.kind === 'forecast' && s.issued_at && s.source.agency === '기상청'
          ? `${timeLabel(s.issued_at)} 발표`
          : '';
    rows.set(
      `${s.kind}|${s.source.dataset}|${s.source.station_name}`,
      `${KIND_TEXT[s.kind]} · ${s.source.agency} ${s.source.dataset} · ${s.source.station_name} (${dist})${when ? ` · ${when}` : ''}`,
    );
  }
  const f = pc.fishing_index.source;
  if (f) rows.set('index', `발표 · ${f.agency} ${f.dataset} · ${f.station_name} (${f.distance_km ?? '?'}km)`);
  rows.set('warning', `발표 · ${pc.warning.source}${pc.warning.seas.length ? ` · ${pc.warning.seas.join('·')} 해역 기준` : ''}`);
  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)}>
        <ThemedText type="smallBold" themeColor="tint">
          자료 기준·출처 {open ? '▴' : '▾'}
        </ThemedText>
      </Pressable>
      {open
        ? [...rows.values()].map((r) => (
            <ThemedText key={r} type="small" themeColor="textSecondary">
              • {r}
            </ThemedText>
          ))
        : null}
      <TermLinks items={[['tide', '물때·사리·조금이란?']]} />
    </Card>
  );
}

/** 공식 바다낚시지수 (시간대·어종별) */
type FishingItem = NonNullable<FishingIndex['periods']>[number]['items'][number];

function envRangeText(min: number | null, max: number | null, unit: string): string | null {
  if (min == null || max == null) return null;
  return min === max ? `${min}${unit}` : `${min}~${max}${unit}`;
}

function indexConditionText(item: FishingItem): string | null {
  const parts = [
    envRangeText(item.min_wave_m, item.max_wave_m, 'm') ? `파고 ${envRangeText(item.min_wave_m, item.max_wave_m, 'm')}` : null,
    envRangeText(item.min_water_temp, item.max_water_temp, '°C')
      ? `수온 ${envRangeText(item.min_water_temp, item.max_water_temp, '°C')}`
      : null,
    envRangeText(item.min_wind_ms, item.max_wind_ms, 'm/s') ? `풍속 ${envRangeText(item.min_wind_ms, item.max_wind_ms, 'm/s')}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function FishingIndexCard({ pc }: { pc: PlaceCompare }) {
  const f = pc.fishing_index;
  const [homeSpecies] = useHomeSpecies();
  const want = speciesByCode(homeSpecies)?.indexName ?? null;
  // 홈에서 고른 어종을 맨 위로 (나머지 순서는 그대로)
  const ordered = (items: FishingItem[]) =>
    want ? [...items.filter((i) => i.species === want), ...items.filter((i) => i.species !== want)] : items;
  const periods = f.status === 'ok' ? (f.periods ?? []) : [];
  if (periods.length === 0) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">
          {f.reason ? REASON_TEXT[f.reason] : '자료 없음'}
          {f.source ? ` (가장 가까운 지점: ${f.source.station_name} ${f.source.distance_km ?? '?'}km)` : ''}
        </ThemedText>
      </Card>
    );
  }
  return (
    <Card>
      {periods.map((p) => (
        <View key={p.period} style={styles.indexBlock}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {p.period === '일' ? '하루' : p.period}
            {p.tide_phase ? ` · ${p.tide_phase}` : ''}
          </ThemedText>
          {p.items[0] && p.items.every((item) => indexConditionText(item) === indexConditionText(p.items[0])) ? (
            <ThemedText type="small" themeColor="textSecondary">
              공식 발표 환경 범위 · {indexConditionText(p.items[0]) ?? '자료 없음'}
            </ThemedText>
          ) : null}
          <View style={styles.indexGrid}>
            {ordered(p.items).map((i) => (
              <View key={i.species} style={styles.indexItem}>
                {speciesByIndexName(i.species) ? <SpeciesImage code={speciesByIndexName(i.species)!.code} size={28} /> : null}
                <View style={styles.flex}>
                  <ThemedText type="small" numberOfLines={1}>
                    {i.species}
                  </ThemedText>
                  {p.items.some((item) => indexConditionText(item) !== indexConditionText(p.items[0])) ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {indexConditionText(i) ?? '환경 범위 자료 없음'}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="smallBold" themeColor={i.index ? LEVEL_COLOR[i.index] : 'textSecondary'}>
                  {i.index ?? '자료 없음'}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        국립해양조사원 발표{f.fetched_at ? ` · ${timeLabel(f.fetched_at)} 받음` : ''} ·{' '}
        {f.source && f.source.distance_km != null && f.source.distance_km >= 1
          ? `${f.source.station_name} 지점 ${f.source.distance_km}km`
          : '이 지점 발표'}{' '}
        · 지수와 환경 범위 모두 기관 발표값이며 앱이 판정한 값이 아닙니다
      </ThemedText>
      <TermLinks
        items={[
          ['index', '공식 낚시지수란?'],
          ['tide', '물때란?'],
        ]}
      />
    </Card>
  );
}

/**
 * 공식 바다낚시지수 한 줄 (2026-11-23): 어종마다 오늘 오전·오후 중 더 좋은 등급을 칩으로, 좋은 순.
 * 누르면 시간대·환경 범위가 있는 전체 카드(시트)
 */
const RANK: Record<string, number> = { 매우좋음: 5, 좋음: 4, 보통: 3, 나쁨: 2, 매우나쁨: 1 };
export function IndexChips({ pc, onMore }: { pc: PlaceCompare; onMore: () => void }) {
  const theme = useTheme();
  const f = pc.fishing_index;
  const periods = f.status === 'ok' ? (f.periods ?? []) : [];
  const best = new Map<string, string>();
  for (const p of periods)
    for (const i of p.items) if (i.index && (RANK[i.index] ?? 0) > (RANK[best.get(i.species) ?? ''] ?? 0)) best.set(i.species, i.index);
  const items = [...best.entries()]
    .filter(([sp]) => !['기타어종', '어종 공통', '-'].includes(sp))
    .sort((a, b) => (RANK[b[1]] ?? 0) - (RANK[a[1]] ?? 0));
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onMore}
      style={({ pressed }) => [
        styles.chipCard,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && { opacity: 0.85 },
      ]}>
      <View style={styles.chipHead}>
        <ThemedText type="smallBold">공식 낚시지수 · 오늘</ThemedText>
        <ThemedText type="smallBold" themeColor="tint">
          자세히 ›
        </ThemedText>
      </View>
      {items.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {items.map(([sp, g]) => {
            const good = (RANK[g] ?? 0) >= 4;
            return (
              <View
                key={sp}
                style={[
                  styles.chip,
                  { backgroundColor: g === '매우좋음' ? Brand.teal : good ? theme.tintSoft : theme.background, borderColor: theme.border },
                ]}>
                {speciesByIndexName(sp) ? <SpeciesImage code={speciesByIndexName(sp)!.code} size={18} /> : null}
                <ThemedText type="small" style={g === '매우좋음' ? styles.onTeal : undefined}>
                  {sp}{' '}
                  <ThemedText
                    type="smallBold"
                    themeColor={g === '매우좋음' ? undefined : LEVEL_COLOR[g as keyof typeof LEVEL_COLOR]}
                    style={g === '매우좋음' ? styles.onTeal : undefined}>
                    {g}
                  </ThemedText>
                </ThemedText>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {f.reason ? REASON_TEXT[f.reason] : '오늘 발표 없음'}
          {f.source ? ` · 가장 가까운 지점 ${f.source.station_name} ${f.source.distance_km ?? '?'}km` : ''}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  table: { gap: 0, paddingVertical: 6 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thead: { paddingBottom: 6 },
  tbody: { paddingVertical: 8, gap: 2 },
  colLabel: { width: 60 },
  col: { flex: 1 },
  num: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  srcFoot: { paddingTop: 6 },
  weatherRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  tideRow: { flexDirection: 'row', gap: 6 },
  tideCell: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 6, alignItems: 'center' },
  past: { opacity: 0.45 },
  indexBlock: { gap: 4 },
  indexGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 2 },
  indexItem: { flexDirection: 'row', width: '46%', gap: 6 },
  chipCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  chipHead: { flexDirection: 'row', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  onTeal: { color: '#FFFFFF' },
});
