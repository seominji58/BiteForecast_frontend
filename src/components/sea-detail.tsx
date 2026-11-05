/**
 * 상세 해황 화면의 구성 요소 (재설계 v2 §4-4). 설명문 대신 데이터 표로 보여준다.
 * 데이터: GET /places/{id}/conditions (변경 없음)
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Place, PlaceCompare } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { LEVEL_COLOR } from '@/components/compare-view';
import { Card } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  currentIndexPeriod,
  findSeries,
  KIND_TEXT,
  latestPoint,
  nextExtreme,
  rangeText,
  REASON_TEXT,
  timeLabel,
} from '@/lib/compare';
import { distanceGrade, seaState, windName } from '@/lib/describe';
import { PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';

type MetricKey = 'wave_height' | 'wind_speed' | 'water_temp';
const METRIC_ROWS: { metric: MetricKey; label: string; icon: AppIconName; grade?: (v: number) => string }[] = [
  { metric: 'wave_height', label: '파고', icon: 'wave', grade: seaState },
  { metric: 'wind_speed', label: '풍속', icon: 'wind', grade: (v) => windName(v).name },
  { metric: 'water_temp', label: '수온', icon: 'water-temp' },
];

const f1 = (n: number) => String(Math.round(n * 10) / 10);

export function distText(km: number | null) {
  return km == null ? '거리 확인 불가' : `${km < 1 ? '1km 미만' : `${Math.round(km)}km`}·${distanceGrade(km)}`;
}

/**
 * 지금 바다 표: 항목마다 「최근 실측」과 「오늘 예보 범위」를 다른 칸에 둔다 (실측·예보를 섞지 않음).
 * 각 줄 아래에 기준 지점과 거리를 짧게 표시하고, 자세한 출처는 DataBasis 에서 본다.
 */
export function MetricTable({ pc }: { pc: PlaceCompare }) {
  const theme = useTheme();
  const line = { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border };
  return (
    <Card style={styles.table}>
      <View style={[styles.tr, styles.thead, line]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.colLabel}>
          항목
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.col}>
          최근 실측
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.col}>
          오늘 예보 범위
        </ThemedText>
      </View>
      {METRIC_ROWS.map((r, i) => {
        const obsS = findSeries(pc, r.metric, 'observed');
        const fcS = findSeries(pc, r.metric, 'forecast');
        const obs = latestPoint(obsS);
        const fc = rangeText(fcS);
        const src = [
          obsS?.source ? `실측 ${obsS.source.station_name} ${distText(obsS.source.distance_km)}` : null,
          fcS?.source ? `예보 ${fcS.source.agency}` : null,
        ].filter(Boolean);
        return (
          <View key={r.metric} style={[styles.tbody, i < METRIC_ROWS.length - 1 && line]}>
            <View style={styles.tr}>
              <View style={[styles.colLabel, styles.inline]}>
                <AppIcon name={r.icon} size={16} />
                <ThemedText type="smallBold">{r.label}</ThemedText>
              </View>
              <View style={styles.col}>
                {obs?.v != null ? (
                  <>
                    <ThemedText style={styles.num}>
                      {f1(obs.v)}
                      {obsS!.unit}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {timeLabel(obs.t)}
                      {r.grade ? ` · ${r.grade(obs.v)}` : ''}
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    {obsS?.reason && obsS.reason !== 'NO_DATA' ? REASON_TEXT[obsS.reason] : '실측 없음'}
                  </ThemedText>
                )}
              </View>
              <View style={styles.col}>
                {fc ? (
                  <ThemedText style={styles.num}>{fc}</ThemedText>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    {r.metric === 'water_temp' ? '예보 제공 안 됨' : '예보 없음'}
                  </ThemedText>
                )}
              </View>
            </View>
            {src.length ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.srcLine}>
                기준: {src.join(' · ')}
              </ThemedText>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

/** 물때: 오늘 만조·간조 시각과 높이, 다음 이벤트 강조, 물때(사리·조금) */
export function TideCard({ pc }: { pc: PlaceCompare }) {
  const theme = useTheme();
  const now = new Date();
  const s = findSeries(pc, 'tide_extreme', 'forecast');
  const next = nextExtreme(s, now);
  const phase = currentIndexPeriod(pc.fishing_index, now)?.tide_phase;
  const ex = s?.status === 'ok' ? (s.extremes ?? []) : [];
  return (
    <Card>
      {ex.length === 0 ? (
        <ThemedText themeColor="textSecondary">{s?.reason ? REASON_TEXT[s.reason] : '자료 없음'}</ThemedText>
      ) : (
        <View style={styles.tideRow}>
          {ex.map((e) => {
            const isNext = next?.t === e.t;
            return (
              <View
                key={e.t}
                style={[
                  styles.tideCell,
                  { borderColor: isNext ? theme.tint : theme.border },
                  new Date(e.t) < now && styles.past,
                ]}>
                <ThemedText type="small" themeColor={e.type === 'high' ? 'tint' : 'accent'} style={styles.bold}>
                  {e.type === 'high' ? '만조' : '간조'}
                  {isNext ? ' 다음' : ''}
                </ThemedText>
                <ThemedText type="smallBold">{timeLabel(e.t)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {e.v != null ? `${e.v}cm` : '높이 없음'}
                </ThemedText>
              </View>
            );
          })}
        </View>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        예보 · {s?.source ? `${s.source.agency} ${s.source.station_name} ${distText(s.source.distance_km)}` : '기준 지점 없음'}
        {phase ? ` · 물때 ${phase}` : ''}
      </ThemedText>
    </Card>
  );
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
    </Card>
  );
}

/** 공식 바다낚시지수 (시간대·어종별) */
export function FishingIndexCard({ pc }: { pc: PlaceCompare }) {
  const f = pc.fishing_index;
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
          <View style={styles.indexGrid}>
            {p.items.map((i) => (
              <View key={i.species} style={styles.indexItem}>
                <ThemedText type="small" numberOfLines={1} style={styles.flex}>
                  {i.species}
                </ThemedText>
                <ThemedText type="smallBold" themeColor={i.index ? LEVEL_COLOR[i.index] : 'textSecondary'}>
                  {i.index ?? '자료 없음'}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        국립해양조사원 발표 ·{' '}
        {f.source && f.source.distance_km != null && f.source.distance_km >= 1
          ? `${f.source.station_name} 지점 ${f.source.distance_km}km`
          : '이 지점 발표'}{' '}
        · 앱이 판정한 값이 아닙니다
      </ThemedText>
    </Card>
  );
}

/** 가까운 낚시터 가로 목록 */
export function NearbyPlaces({
  items,
  currentId,
  onPress,
}: {
  items: { place: Place; km: number }[];
  currentId: number;
  onPress: (p: Place) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeRow}>
      {items.map(({ place: p, km }) => {
        const current = p.id === currentId;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}${current ? ', 현재 보는 낚시터' : ''}`}
            onPress={() => onPress(p)}
            style={[
              styles.placeCard,
              { borderColor: current ? Brand.orange : theme.border, backgroundColor: theme.backgroundElement },
            ]}>
            <View style={styles.placeArt}>
              <AppIcon name={PLACE_IMAGE[p.type]} size={40} />
            </View>
            <View style={styles.placeInfo}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {p.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {current ? '현재 낚시터' : `${PLACE_TYPE_LABEL[p.type]} · ${km < 1 ? '1km 미만' : `${Math.round(km)}km`}`}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
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
  srcLine: { paddingLeft: 68 },
  tideRow: { flexDirection: 'row', gap: 6 },
  tideCell: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 6, alignItems: 'center' },
  past: { opacity: 0.45 },
  indexBlock: { gap: 4 },
  indexGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 2 },
  indexItem: { flexDirection: 'row', width: '46%', gap: 6 },
  placeRow: { gap: 8, paddingRight: Layout.screenPadding },
  placeCard: { width: 112, borderRadius: Layout.cardRadius, borderWidth: 1.5, overflow: 'hidden' },
  placeArt: { height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6F9' },
  placeInfo: { padding: 8, gap: 2 },
});
