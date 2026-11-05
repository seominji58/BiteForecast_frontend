import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCompare } from '@/api/queries';
import type { PlaceCompare, Series } from '@/api/types';
import { Card, ErrorView, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  dayLabel,
  findSeries,
  formatValue,
  hourTable,
  KIND_TEXT,
  REASON_TEXT,
  REGULATION_TEXT,
  sourceLine,
  timeLabel,
} from '@/lib/compare';

// SCR-02 A/B 환경 비교 (FR-02~05, FR-07)
export default function CompareScreen() {
  const params = useLocalSearchParams<{ a: string; b: string; date: string }>();
  const q = useCompare(Number(params.a), Number(params.b), params.date ?? '');

  return (
    <StackScreen>
      <Stack.Screen options={{ title: params.date ? `${dayLabel(params.date)} 비교` : '환경 비교' }} />
      {q.isPending && <Loading />}
      {q.isError && <ErrorView message={q.error.message} onRetry={() => q.refetch()} />}
      {q.isSuccess && <CompareBody places={q.data.places} disclaimer={q.data.disclaimer} />}
    </StackScreen>
  );
}

function CompareBody({ places, disclaimer }: { places: PlaceCompare[]; disclaimer: string }) {
  const [a, b] = places;
  return (
    <>
      <View style={styles.row}>
        <View style={styles.flex}>
          <PlaceHeader label="A" p={a} />
        </View>
        <View style={styles.flex}>
          <PlaceHeader label="B" p={b} />
        </View>
      </View>

      <Section title="물때 (만조·간조)">
        <View style={styles.row}>
          <View style={styles.flex}>
            <ExtremeColumn s={findSeries(a, 'tide_extreme', 'forecast')} />
          </View>
          <View style={styles.flex}>
            <ExtremeColumn s={findSeries(b, 'tide_extreme', 'forecast')} />
          </View>
        </View>
      </Section>

      <Section title="조위 (시간별 예보)">
        <HourlyTable a={findSeries(a, 'tide_level', 'forecast')} b={findSeries(b, 'tide_level', 'forecast')} />
      </Section>

      <Section title="파고">
        <ObservedAndForecast a={a} b={b} metric="wave_height" />
      </Section>

      <Section title="풍속">
        <ObservedAndForecast a={a} b={b} metric="wind_speed" />
      </Section>

      <Section title="수온">
        <HourlyTable a={findSeries(a, 'water_temp', 'observed')} b={findSeries(b, 'water_temp', 'observed')} />
      </Section>

      <ThemedText type="small" themeColor="textSecondary">
        {disclaimer}
      </ThemedText>
    </>
  );
}

function PlaceHeader({ label, p }: { label: string; p: PlaceCompare }) {
  const unverified = p.regulation.status === 'UNVERIFIED';
  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">
        {label} · {p.region_name}
      </ThemedText>
      <ThemedText type="smallBold">{p.place.name}</ThemedText>
      {/* FR-20: 미확인 장소는 「합법 여부 미확인」을 명시 */}
      <ThemedText
        type="small"
        themeColor={p.regulation.status === 'PROHIBITED' ? 'danger' : unverified ? 'warning' : 'text'}>
        {REGULATION_TEXT[p.regulation.status]}
        {p.regulation.stale ? ' · 최신 여부 미확인' : ''}
      </ThemedText>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function ExtremeColumn({ s }: { s: Series | undefined }) {
  return (
    <Card>
      {s?.status === 'ok' && s.extremes ? (
        s.extremes.map((e) => (
          <View key={e.t} style={styles.extremeRow}>
            <ThemedText type="small">{timeLabel(e.t)}</ThemedText>
            <ThemedText type="small" themeColor={e.type === 'high' ? 'tint' : 'textSecondary'}>
              {e.type === 'high' ? '만조' : '간조'}
            </ThemedText>
            <ThemedText type="small">{formatValue(e.v, 'cm')}</ThemedText>
          </View>
        ))
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {s?.reason ? REASON_TEXT[s.reason] : '자료 없음'}
        </ThemedText>
      )}
      <SourceText s={s} />
    </Card>
  );
}

/** 두 장소를 같은 시간축으로 나란히 (보간 없음). 계열마다 출처·예보/실측 표시 */
function HourlyTable({ a, b }: { a: Series | undefined; b: Series | undefined }) {
  const theme = useTheme();
  const rows = hourTable(a, b);
  const unit = a?.unit ?? b?.unit ?? '';

  if (rows.length === 0) {
    return (
      <Card>
        <View style={styles.row}>
          <Unavailable s={a} />
          <Unavailable s={b} />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={[styles.tableRow, styles.tableHead, { borderColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hourCol}>
          시각
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.valCol}>
          A {a?.status === 'ok' ? `(${KIND_TEXT[a.kind]})` : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.valCol}>
          B {b?.status === 'ok' ? `(${KIND_TEXT[b.kind]})` : ''}
        </ThemedText>
      </View>
      {rows.map((r) => (
        <View key={r.hour} style={styles.tableRow}>
          <ThemedText type="small" style={styles.hourCol}>
            {r.hour}
          </ThemedText>
          <Cell v={r.a} unit={unit} s={a} />
          <Cell v={r.b} unit={unit} s={b} />
        </View>
      ))}
      <SourceText s={a} prefix="A" />
      <SourceText s={b} prefix="B" />
    </Card>
  );
}

function Cell({ v, unit, s }: { v: number | null | undefined; unit: string; s: Series | undefined }) {
  // 계열 자체가 없으면 사유를, 그 시각 값만 없으면 「자료 없음」/「–」
  const text = s?.status !== 'ok' ? '–' : formatValue(v, unit);
  return (
    <ThemedText type="small" themeColor={v == null ? 'textSecondary' : 'text'} style={styles.valCol}>
      {text}
    </ThemedText>
  );
}

function Unavailable({ s }: { s: Series | undefined }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
      {s?.reason ? REASON_TEXT[s.reason] : '자료 없음'}
    </ThemedText>
  );
}

function SourceText({ s, prefix }: { s: Series | undefined; prefix?: string }) {
  if (!s?.source) return null;
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {prefix ? `${prefix}: ` : ''}
      {KIND_TEXT[s.kind]} · {sourceLine(s.source)}
      {s.status !== 'ok' && s.reason ? ` · ${REASON_TEXT[s.reason]}` : ''}
    </ThemedText>
  );
}

/**
 * 실측 표와 예보 표를 따로 보여준다 (한 표에 섞지 않음, TC-03).
 * 오늘: 지난 시간 실측 + 예보 / 미래 날짜: 예보만 / 둘 다 없으면 사유 표시
 */
function ObservedAndForecast({ a, b, metric }: { a: PlaceCompare; b: PlaceCompare; metric: Series['metric'] }) {
  const oa = findSeries(a, metric, 'observed');
  const ob = findSeries(b, metric, 'observed');
  const fa = findSeries(a, metric, 'forecast');
  const fb = findSeries(b, metric, 'forecast');
  const hasObs = oa?.status === 'ok' || ob?.status === 'ok';
  const hasFc = fa?.status === 'ok' || fb?.status === 'ok';

  if (!hasObs && !hasFc) return <HourlyTable a={oa} b={ob} />;
  return (
    <>
      {hasObs && <HourlyTable a={oa} b={ob} />}
      {hasFc && <HourlyTable a={fa} b={fb} />}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  section: { gap: Spacing.two },
  extremeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.one },
  tableRow: { flexDirection: 'row', paddingVertical: 2 },
  tableHead: { borderBottomWidth: 1, paddingBottom: Spacing.one, marginBottom: Spacing.one },
  hourCol: { width: 56 },
  valCol: { flex: 1, textAlign: 'right' },
});
