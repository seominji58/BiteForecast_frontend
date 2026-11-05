import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useConditions, useDateRange, usePlaces } from '@/api/queries';
import type { Place, PlaceCompare } from '@/api/types';
import { LEVEL_COLOR } from '@/components/compare-view';
import { PlacePicker } from '@/components/place-picker';
import { Card, ErrorView, Loading, SectionHeader, TabScreen, type IconName } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  currentIndexPeriod,
  dayLabel,
  findSeries,
  greeting,
  latestPoint,
  nextExtreme,
  rangeText,
  REASON_TEXT,
  sourceLine,
  timeLabel,
} from '@/lib/compare';
import { PLACE_ICON } from '@/lib/place';
import { useHomePlace } from '@/lib/prefs';

// SCR-01 홈: 기준 낚시터의 오늘 조건 요약 + 공식 바다낚시지수 + 빠른 메뉴
export default function HomeScreen() {
  const places = usePlaces();
  const range = useDateRange();
  const [homeId, setHomeId] = useHomePlace();
  const [picker, setPicker] = useState(false);

  const place = places.data?.find((p) => p.id === homeId) ?? places.data?.[0] ?? null;
  const today = range.data?.today;
  const cond = useConditions(place?.id ?? null, today);
  const pc = cond.data?.place;

  return (
    <TabScreen title={`${greeting()}!`} subtitle="오늘도 안전하고 즐거운 낚시 되세요.">
      <Card>
        <View style={styles.between}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="기준 낚시터 변경"
            onPress={() => setPicker(true)}
            style={styles.placeButton}>
            <MaterialCommunityIcons name="map-marker" size={22} color={Brand.orange} />
            <ThemedText type="sectionTitle">{place ? `${pc?.region_name ?? ''} ${place.name}`.trim() : '낚시터 선택'}</ThemedText>
            <MaterialCommunityIcons name="chevron-down" size={22} />
          </Pressable>
          {today ? (
            <ThemedText type="small" themeColor="textSecondary">
              오늘 {dayLabel(today)}
            </ThemedText>
          ) : null}
        </View>
        {places.isError && <ErrorView message={places.error.message} onRetry={() => places.refetch()} />}
        {cond.isPending && place && <Loading />}
        {cond.isError && <ErrorView message={cond.error.message} onRetry={() => cond.refetch()} />}
        {pc && <LatestObservations pc={pc} />}
      </Card>

      <SectionHeader
        icon="fish"
        title="오늘의 바다낚시지수"
        actionLabel="비교하기"
        onAction={() => router.push({ pathname: '/compare', params: place ? { a: String(place.id) } : {} })}
      />
      {pc && <FishingIndexCard pc={pc} />}

      <SectionHeader icon="waves" title="오늘의 주요 해황" />
      {pc && <SeaTiles pc={pc} />}

      <SectionHeader icon="map-marker-radius" title="낚시터" actionLabel="전체보기" onAction={() => setPicker(true)} />
      {places.data && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeRow}>
          {places.data.map((p) => (
            <PlaceCard key={p.id} p={p} selected={p.id === place?.id} onPress={() => setHomeId(p.id)} />
          ))}
        </ScrollView>
      )}

      <SectionHeader icon="lightning-bolt" title="빠른 메뉴" />
      <View style={styles.grid}>
        <MenuButton icon="scale-balance" title="조건 비교" desc="두 낚시터 나란히" onPress={() => router.push('/compare')} />
        <MenuButton icon="pencil-plus" title="일지 작성" desc="조과·당시 조건 기록" onPress={() => router.push('/journal/new')} />
        <MenuButton icon="notebook-outline" title="내 기록" desc="출조 기록 모아보기" onPress={() => router.push('/records')} />
        <MenuButton icon="trophy-outline" title="칭호·포인트" desc="활동 포인트 확인" onPress={() => router.push('/me')} />
      </View>

      {cond.data && (
        <ThemedText type="small" themeColor="textSecondary">
          {cond.data.disclaimer}
        </ThemedText>
      )}

      <PlacePicker
        visible={picker}
        title="기준 낚시터 선택"
        selectedId={place?.id}
        onSelect={(p) => setHomeId(p.id)}
        onClose={() => setPicker(false)}
      />
    </TabScreen>
  );
}

/** 부이 실측 최신값 (예보와 섞지 않음) */
function LatestObservations({ pc }: { pc: PlaceCompare }) {
  const theme = useTheme();
  const items = [
    { icon: 'waves-arrow-up' as const, label: '파고', s: findSeries(pc, 'wave_height', 'observed') },
    { icon: 'weather-windy' as const, label: '바람', s: findSeries(pc, 'wind_speed', 'observed') },
    { icon: 'thermometer' as const, label: '수온', s: findSeries(pc, 'water_temp', 'observed') },
  ];
  const src = items.find((i) => i.s?.source)?.s?.source ?? null;
  return (
    <>
      <View style={styles.stats}>
        {items.map(({ icon, label, s }) => {
          const p = latestPoint(s);
          return (
            <View key={label} style={styles.stat}>
              <View style={styles.statLabel}>
                <MaterialCommunityIcons name={icon} size={18} color={theme.tint} />
                <ThemedText type="small" themeColor="textSecondary">
                  {label}
                </ThemedText>
              </View>
              <ThemedText type="value">{p ? `${p.v}${s!.unit === '°C' ? '°C' : ` ${s!.unit}`}` : '–'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {p ? `${timeLabel(p.t)} 실측` : '자료 없음'}
              </ThemedText>
            </View>
          );
        })}
      </View>
      {src && (
        <ThemedText type="small" themeColor="textSecondary">
          {sourceLine(src)}
        </ThemedText>
      )}
    </>
  );
}

function FishingIndexCard({ pc }: { pc: PlaceCompare }) {
  const theme = useTheme();
  const f = pc.fishing_index;
  const period = currentIndexPeriod(f);
  if (!period) {
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
    <View style={[styles.indexCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.indexBadge, { backgroundColor: Brand.teal }]}>
        <MaterialCommunityIcons name="fish" size={30} color={Brand.onNavy} />
        <ThemedText type="small" style={styles.onNavy}>
          {period.period === '일' ? '하루' : period.period}
        </ThemedText>
        {period.tide_phase ? (
          <ThemedText type="small" style={styles.onNavySecondary}>
            {period.tide_phase}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.indexBody}>
        {period.items.map((i) => (
          <View key={i.species} style={styles.between}>
            <ThemedText>{i.species}</ThemedText>
            <ThemedText type="smallBold" themeColor={i.index ? LEVEL_COLOR[i.index] : 'textSecondary'}>
              {i.index ?? '자료 없음'}
            </ThemedText>
          </View>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          국립해양조사원 발표 · {f.source?.station_name} 지점 {f.source?.distance_km}km{'\n'}앱이 판정한 값이 아닙니다
        </ThemedText>
      </View>
    </View>
  );
}

function SeaTiles({ pc }: { pc: PlaceCompare }) {
  const ext = nextExtreme(findSeries(pc, 'tide_extreme', 'forecast'));
  const range = (metric: 'wave_height' | 'wind_speed') => {
    const fc = rangeText(findSeries(pc, metric, 'forecast'));
    const ob = rangeText(findSeries(pc, metric, 'observed'));
    return fc ? { v: fc, k: '오늘 예보' } : ob ? { v: ob, k: '오늘 실측' } : null;
  };
  const wave = range('wave_height');
  const wind = range('wind_speed');
  const temp = rangeText(findSeries(pc, 'water_temp', 'observed'));
  return (
    <View style={styles.grid}>
      <Tile icon="waves" title="물때" value={ext ? `${ext.type === 'high' ? '만조' : '간조'} ${timeLabel(ext.t)}` : '–'} note={ext ? `다음 ${ext.v ?? '?'}cm` : '자료 없음'} />
      <Tile icon="waves-arrow-up" title="파고" value={wave?.v ?? '–'} note={wave?.k ?? '자료 없음'} />
      <Tile icon="weather-windy" title="바람" value={wind?.v ?? '–'} note={wind?.k ?? '자료 없음'} />
      <Tile icon="thermometer" title="수온" value={temp ?? '–'} note={temp ? '오늘 실측' : '자료 없음'} />
    </View>
  );
}

function Tile({ icon, title, value, note }: { icon: IconName; title: string; value: string; note: string }) {
  const theme = useTheme();
  return (
    <Card style={styles.tile}>
      <View style={styles.statLabel}>
        <MaterialCommunityIcons name={icon} size={20} color={theme.tint} />
        <ThemedText type="smallBold">{title}</ThemedText>
      </View>
      <ThemedText type="value" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {note}
      </ThemedText>
    </Card>
  );
}

function PlaceCard({ p, selected, onPress }: { p: Place; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${p.name}${selected ? ', 기준 낚시터' : ''}`}
      onPress={onPress}
      style={[styles.placeCard, { borderColor: selected ? Brand.orange : theme.border, backgroundColor: theme.backgroundElement }]}>
      <LinearGradient colors={[Brand.teal, Brand.navy]} style={styles.placeArt}>
        <MaterialCommunityIcons name={PLACE_ICON[p.type]} size={34} color="rgba(255,255,255,0.9)" />
        {selected ? <MaterialCommunityIcons name="star" size={18} color={Brand.orange} style={styles.star} /> : null}
      </LinearGradient>
      <View style={styles.placeInfo}>
        <ThemedText type="smallBold">{p.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {selected ? '기준 낚시터' : '눌러서 기준으로'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function MenuButton({ icon, title, desc, onPress }: { icon: IconName; title: string; desc: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]}>
      <Card style={styles.menu}>
        <MaterialCommunityIcons name={icon} size={28} color={theme.tint} />
        <View style={styles.flex}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {desc}
          </ThemedText>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  placeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  stats: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  stat: { flex: 1, gap: 2 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  indexCard: { flexDirection: 'row', borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  indexBadge: { width: 96, alignItems: 'center', justifyContent: 'center', gap: 2, padding: Spacing.two },
  indexBody: { flex: 1, padding: Spacing.three, gap: 4 },
  onNavy: { color: Brand.onNavy, fontWeight: '700' },
  onNavySecondary: { color: Brand.onNavySecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: { width: '48.5%', flexGrow: 1, gap: 4 },
  tileWrap: { width: '48.5%', flexGrow: 1 },
  menu: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  placeRow: { gap: Spacing.two, paddingRight: Spacing.three },
  placeCard: { width: 140, borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  placeArt: { height: 76, alignItems: 'center', justifyContent: 'center' },
  star: { position: 'absolute', top: 6, right: 8 },
  placeInfo: { padding: Spacing.two, gap: 2 },
});
