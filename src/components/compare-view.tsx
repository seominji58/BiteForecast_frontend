import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FishingIndex, FishingIndexLevel, PlaceCompare, Series } from '@/api/types';
import { Card, type IconName } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  findSeries,
  formatValue,
  hourTable,
  KIND_TEXT,
  lowerOf,
  rangeText,
  REASON_TEXT,
  REGULATION_TEXT,
  sourceLine,
  timeLabel,
} from '@/lib/compare';

/** 지수 등급은 색과 함께 항상 텍스트로 표시 (NFR-05) */
export const LEVEL_COLOR: Record<FishingIndexLevel, 'success' | 'text' | 'warning' | 'danger'> = {
  매우좋음: 'success',
  좋음: 'success',
  보통: 'text',
  나쁨: 'warning',
  매우나쁨: 'danger',
};

/**
 * A/B 비교 결과 (SCR-02, FR-02~05, FR-07).
 * - 행마다 왼쪽 라벨 + A/B 두 칸
 * - 예보와 실측은 섞지 않고 각각 표시 (TC-03)
 * - 판정 문구 없이 사실 비교만 (명세 §14)
 */
export function CompareView({ places, disclaimer }: { places: PlaceCompare[]; disclaimer: string }) {
  const [a, b] = places;
  const [showHourly, setShowHourly] = useState(false);
  const theme = useTheme();

  return (
    <>
      <Card style={styles.tableCard}>
        <Row icon="shield-alert-outline" label="규제 정보">
          <RegulationCell p={a} />
          <RegulationCell p={b} />
        </Row>
        <Row icon="fish" label="바다낚시 지수">
          <FishingIndexCell f={a.fishing_index} />
          <FishingIndexCell f={b.fishing_index} />
        </Row>
        <Row icon="waves" label="만조 / 간조">
          <ExtremeCell s={findSeries(a, 'tide_extreme', 'forecast')} />
          <ExtremeCell s={findSeries(b, 'tide_extreme', 'forecast')} />
        </Row>
        <Row icon="chart-bell-curve-cumulative" label="조위">
          <RangeCell series={[findSeries(a, 'tide_level', 'forecast')]} />
          <RangeCell series={[findSeries(b, 'tide_level', 'forecast')]} />
        </Row>
        <Row icon="waves-arrow-up" label="파고">
          <RangeCell series={[findSeries(a, 'wave_height', 'observed'), findSeries(a, 'wave_height', 'forecast')]} />
          <RangeCell series={[findSeries(b, 'wave_height', 'observed'), findSeries(b, 'wave_height', 'forecast')]} />
        </Row>
        <Row icon="weather-windy" label="바람">
          <RangeCell series={[findSeries(a, 'wind_speed', 'observed'), findSeries(a, 'wind_speed', 'forecast')]} />
          <RangeCell series={[findSeries(b, 'wind_speed', 'observed'), findSeries(b, 'wind_speed', 'forecast')]} />
        </Row>
        <Row icon="thermometer" label="수온" last>
          <RangeCell series={[findSeries(a, 'water_temp', 'observed')]} />
          <RangeCell series={[findSeries(b, 'water_temp', 'observed')]} />
        </Row>
      </Card>

      <FactSummary a={a} b={b} />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showHourly }}
        onPress={() => setShowHourly((v) => !v)}
        style={[styles.toggle, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold" themeColor="tint">
          {showHourly ? '시간별 자료 접기' : '시간별 자료 자세히 보기'}
        </ThemedText>
        <MaterialCommunityIcons name={showHourly ? 'chevron-up' : 'chevron-down'} size={20} color={theme.tint} />
      </Pressable>

      {showHourly && (
        <>
          <HourlyBlock title="조위 (예보)" a={findSeries(a, 'tide_level', 'forecast')} b={findSeries(b, 'tide_level', 'forecast')} />
          <HourlyBlock title="파고 (실측)" a={findSeries(a, 'wave_height', 'observed')} b={findSeries(b, 'wave_height', 'observed')} />
          <HourlyBlock title="파고 (예보)" a={findSeries(a, 'wave_height', 'forecast')} b={findSeries(b, 'wave_height', 'forecast')} />
          <HourlyBlock title="풍속 (실측)" a={findSeries(a, 'wind_speed', 'observed')} b={findSeries(b, 'wind_speed', 'observed')} />
          <HourlyBlock title="풍속 (예보)" a={findSeries(a, 'wind_speed', 'forecast')} b={findSeries(b, 'wind_speed', 'forecast')} />
          <HourlyBlock title="수온 (실측)" a={findSeries(a, 'water_temp', 'observed')} b={findSeries(b, 'water_temp', 'observed')} />
        </>
      )}

      <SourceList places={places} />

      <View style={[styles.notice, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <MaterialCommunityIcons name="information-outline" size={18} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {disclaimer}
        </ThemedText>
      </View>
    </>
  );
}

function Row({ icon, label, children, last }: { icon: IconName; label: string; children: ReactNode; last?: boolean }) {
  const theme = useTheme();
  const [left, right] = Array.isArray(children) ? children : [children, null];
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
      <View style={styles.label}>
        <MaterialCommunityIcons name={icon} size={20} color={Brand.onNavy} />
        <ThemedText type="small" style={styles.labelText}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.cell}>{left}</View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <View style={styles.cell}>{right}</View>
    </View>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {children}
    </ThemedText>
  );
}

function RegulationCell({ p }: { p: PlaceCompare }) {
  const status = p.regulation.status;
  // FR-20: 미확인 장소는 「합법 여부 미확인」을 명시
  return (
    <ThemedText
      type="small"
      themeColor={status === 'PROHIBITED' ? 'danger' : status === 'UNVERIFIED' ? 'warning' : 'text'}>
      {REGULATION_TEXT[status]}
      {p.regulation.stale ? ' · 최신 여부 미확인' : ''}
    </ThemedText>
  );
}

function FishingIndexCell({ f }: { f: FishingIndex }) {
  if (f.status !== 'ok' || !f.periods) {
    return (
      <View>
        <Muted>{f.reason ? REASON_TEXT[f.reason] : '자료 없음'}</Muted>
        {f.source && (
          <Muted>
            ({f.source.station_name} {f.source.distance_km != null ? `${f.source.distance_km}km` : ''})
          </Muted>
        )}
      </View>
    );
  }
  return (
    <View style={styles.cellStack}>
      {f.periods.map((p) => (
        <View key={p.period}>
          <ThemedText type="small" themeColor="textSecondary">
            {p.period === '일' ? '하루' : p.period}
            {p.tide_phase ? ` · ${p.tide_phase}` : ''}
          </ThemedText>
          {p.items.map((i) => (
            <View key={i.species} style={styles.between}>
              <ThemedText type="small">{i.species}</ThemedText>
              <ThemedText type="smallBold" themeColor={i.index ? LEVEL_COLOR[i.index] : 'textSecondary'}>
                {i.index ?? '자료 없음'}
              </ThemedText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ExtremeCell({ s }: { s: Series | undefined }) {
  const theme = useTheme();
  if (s?.status !== 'ok' || !s.extremes) return <Muted>{s?.reason ? REASON_TEXT[s.reason] : '자료 없음'}</Muted>;
  return (
    <View style={styles.cellStack}>
      {s.extremes.map((e) => (
        <View key={e.t} style={styles.extreme}>
          <View style={[styles.pill, { backgroundColor: e.type === 'high' ? theme.tintSoft : theme.accentSoft }]}>
            <ThemedText type="small" themeColor={e.type === 'high' ? 'tint' : 'accent'} style={styles.pillText}>
              {e.type === 'high' ? '만조' : '간조'}
            </ThemedText>
          </View>
          <ThemedText type="small">
            {timeLabel(e.t)} <ThemedText type="small" themeColor="textSecondary">({formatValue(e.v, 'cm')})</ThemedText>
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** 계열별 하루 범위. 실측/예보를 각각 다른 줄로 (TC-03) */
function RangeCell({ series }: { series: (Series | undefined)[] }) {
  const lines = series.filter((s): s is Series => !!s);
  const ok = lines.filter((s) => s.status === 'ok');
  if (ok.length === 0) {
    const reason = lines.find((s) => s.reason && s.reason !== 'FUTURE_DATE')?.reason ?? lines[0]?.reason;
    return <Muted>{reason ? REASON_TEXT[reason] : '자료 없음'}</Muted>;
  }
  return (
    <View style={styles.cellStack}>
      {ok.map((s) => (
        <View key={s.kind} style={styles.kindLine}>
          <ThemedText type="small" themeColor="textSecondary">
            {KIND_TEXT[s.kind]}
          </ThemedText>
          <ThemedText type="smallBold">{rangeText(s) ?? '자료 없음'}</ThemedText>
        </View>
      ))}
    </View>
  );
}

/** 사실 비교: 하루 최댓값이 낮은 곳 (판정 아님) */
function FactSummary({ a, b }: { a: PlaceCompare; b: PlaceCompare }) {
  const theme = useTheme();
  const items = (
    [
      ['파고', 'wave_height', 'm'],
      ['풍속', 'wind_speed', 'm/s'],
    ] as const
  ).flatMap(([label, metric, unit]) => {
    const r = lowerOf(a, b, metric);
    if (!r) return [];
    const kind = KIND_TEXT[r.kind];
    const vs = `${r.aMax}${unit} vs ${r.bMax}${unit}`;
    if (!r.winner) return [`${label}(${kind} 최대)는 두 곳이 같습니다 (${vs})`];
    const name = r.winner === 'A' ? a.place.name : b.place.name;
    return [`${label}(${kind} 최대)가 더 낮은 곳: ${name} (${vs})`];
  });
  if (items.length === 0) return null;
  return (
    <View style={[styles.fact, { backgroundColor: theme.accentSoft }]}>
      <View style={[styles.factLabel, { backgroundColor: Brand.navy }]}>
        <MaterialCommunityIcons name="scale-balance" size={18} color={Brand.onNavy} />
        <ThemedText type="small" style={styles.labelText}>
          사실 비교
        </ThemedText>
      </View>
      <View style={[styles.flex, styles.cellStack]}>
        {items.map((t) => (
          <ThemedText key={t} type="small">
            {t}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

function HourlyBlock({ title, a, b }: { title: string; a: Series | undefined; b: Series | undefined }) {
  const theme = useTheme();
  const rows = hourTable(a, b);
  const unit = a?.unit ?? b?.unit ?? '';
  return (
    <Card>
      <ThemedText type="smallBold">{title}</ThemedText>
      {rows.length === 0 ? (
        <Muted>
          A: {a?.reason ? REASON_TEXT[a.reason] : '자료 없음'} · B: {b?.reason ? REASON_TEXT[b.reason] : '자료 없음'}
        </Muted>
      ) : (
        <View>
          <View style={[styles.hRow, styles.hHead, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hourCol}>
              시각
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.valCol}>
              A
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.valCol}>
              B
            </ThemedText>
          </View>
          {rows.map((r) => (
            <View key={r.hour} style={styles.hRow}>
              <ThemedText type="small" style={styles.hourCol}>
                {r.hour}
              </ThemedText>
              <ThemedText type="small" themeColor={r.a == null ? 'textSecondary' : 'text'} style={styles.valCol}>
                {a?.status !== 'ok' ? '–' : formatValue(r.a, unit)}
              </ThemedText>
              <ThemedText type="small" themeColor={r.b == null ? 'textSecondary' : 'text'} style={styles.valCol}>
                {b?.status !== 'ok' ? '–' : formatValue(r.b, unit)}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

/** 자료 출처·관측소 거리 (FR-07) */
function SourceList({ places }: { places: PlaceCompare[] }) {
  return (
    <Card>
      <ThemedText type="smallBold">자료 출처</ThemedText>
      {places.map((p, i) => {
        const seen = new Set<string>();
        const lines = [
          ...p.series.map((s) => s.source && `${KIND_TEXT[s.kind]} · ${s.source.dataset} · ${sourceLine(s.source)}`),
          p.fishing_index.source &&
            `${p.fishing_index.source.dataset} · ${p.fishing_index.source.station_name} 지점 · ${p.fishing_index.source.distance_km ?? '?'}km`,
        ].filter((l): l is string => !!l && !seen.has(l) && !!seen.add(l));
        return (
          <View key={p.place.id} style={styles.cellStack}>
            <ThemedText type="small">
              {i === 0 ? 'A' : 'B'} · {p.region_name} {p.place.name}
            </ThemedText>
            {lines.map((l) => (
              <Muted key={l}>{l}</Muted>
            ))}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tableCard: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 56 },
  label: {
    width: 78,
    backgroundColor: Brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.two,
  },
  labelText: { color: Brand.onNavy, fontWeight: '700', textAlign: 'center' },
  cell: { flex: 1, padding: Spacing.two + 2, justifyContent: 'center' },
  divider: { width: StyleSheet.hairlineWidth },
  cellStack: { gap: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.one },
  extreme: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  pillText: { fontWeight: '700', fontSize: 12, lineHeight: 18 },
  kindLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  fact: { flexDirection: 'row', borderRadius: 16, overflow: 'hidden', alignItems: 'stretch' },
  factLabel: { width: 78, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: Spacing.two },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two + 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hRow: { flexDirection: 'row', paddingVertical: 2 },
  hHead: { borderBottomWidth: 1, paddingBottom: Spacing.one, marginBottom: Spacing.one },
  hourCol: { width: 56 },
  valCol: { flex: 1, textAlign: 'right' },
  notice: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
