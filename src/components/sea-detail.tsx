/**
 * 상세 해황 화면의 구성 요소 (재설계 v2 §4-4). 기존 홈에 있던 내용을 그대로 옮겼다.
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
import { findSeries, KIND_TEXT, nextExtreme, rangeText, REASON_TEXT, timeLabel } from '@/lib/compare';
import { describeToday, distanceGrade } from '@/lib/describe';
import { PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';

/** 지금 바다 이야기: 수치를 공인 등급표 기준의 문장으로 */
export function SeaStory({ pc }: { pc: PlaceCompare }) {
  const icon: Record<string, AppIconName> = {
    wave: 'wave',
    wind: 'wind',
    temp: 'water-temp',
    tide: 'tide',
    index: 'fishing-index',
    distance: 'cat-tip',
    none: 'cat-tip',
  };
  return (
    <Card>
      {describeToday(pc).map((s, i) => (
        <View key={`${s.key}-${i}`} style={styles.storyLine}>
          <AppIcon name={icon[s.key]} size={18} />
          <ThemedText style={styles.flex}>{s.text}</ThemedText>
        </View>
      ))}
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

/** 공식 바다낚시지수 (현재 시간대, 어종별) */
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
          {p.items.map((i) => (
            <View key={i.species} style={styles.between}>
              <ThemedText>{i.species}</ThemedText>
              <ThemedText type="smallBold" themeColor={i.index ? LEVEL_COLOR[i.index] : 'textSecondary'}>
                {i.index ?? '자료 없음'}
              </ThemedText>
            </View>
          ))}
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

/** 오늘 범위: 물때 다음 이벤트, 파고·풍속(예보 우선), 수온(실측) */
export function SeaTiles({ pc }: { pc: PlaceCompare }) {
  const ext = nextExtreme(findSeries(pc, 'tide_extreme', 'forecast'));
  const range = (metric: 'wave_height' | 'wind_speed') => {
    const fc = rangeText(findSeries(pc, metric, 'forecast'));
    const ob = rangeText(findSeries(pc, metric, 'observed'));
    return fc ? { v: fc, k: '오늘 예보 범위' } : ob ? { v: ob, k: '오늘 실측 범위' } : null;
  };
  const wave = range('wave_height');
  const wind = range('wind_speed');
  const temp = rangeText(findSeries(pc, 'water_temp', 'observed'));
  const rows: [AppIconName, string, string, string][] = [
    ['tide', '물때', ext ? `${ext.type === 'high' ? '만조' : '간조'} ${timeLabel(ext.t)} (${ext.v ?? '?'}cm)` : '자료 없음', '다음 이벤트'],
    ['wave', '파고', wave?.v ?? '자료 없음', wave?.k ?? ''],
    ['wind', '바람', wind?.v ?? '자료 없음', wind?.k ?? ''],
    ['water-temp', '수온', temp ?? '자료 없음', temp ? '오늘 실측 범위' : ''],
  ];
  return (
    <Card>
      {rows.map(([icon, label, value, note]) => (
        <View key={label} style={styles.between}>
          <View style={styles.inline}>
            <AppIcon name={icon} size={18} />
            <ThemedText>{label}</ThemedText>
          </View>
          <View style={styles.right}>
            <ThemedText type="smallBold">{value}</ThemedText>
            {note ? (
              <ThemedText type="small" themeColor="textSecondary">
                {note}
              </ThemedText>
            ) : null}
          </View>
        </View>
      ))}
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
              <AppIcon name={PLACE_IMAGE[p.type]} size={48} />
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
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  right: { alignItems: 'flex-end', flexShrink: 1 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  storyLine: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  indexBlock: { gap: 2 },
  placeRow: { gap: 8, paddingRight: Layout.screenPadding },
  placeCard: { width: 112, borderRadius: Layout.cardRadius, borderWidth: 1.5, overflow: 'hidden' },
  placeArt: { height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6F9' },
  placeInfo: { padding: 8, gap: 2 },
});
