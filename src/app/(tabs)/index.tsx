import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useConditions, useDateRange, usePlaces } from '@/api/queries';
import type { Place, PlaceCompare } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { LEVEL_COLOR } from '@/components/compare-view';
import { PlacePicker } from '@/components/place-picker';
import { SearchBar } from '@/components/search-bar';
import { Card, ErrorView, Loading, SectionHeader, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  currentIndexPeriod,
  dayLabel,
  findSeries,
  greeting,
  nextExtreme,
  rangeText,
  REASON_TEXT,
  timeLabel,
} from '@/lib/compare';
import { describeToday } from '@/lib/describe';
import { matches, nearby, PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';
import { useHomePlace } from '@/lib/prefs';

// SCR-01 홈: 기준 낚시터의 오늘 조건 요약 + 공식 바다낚시지수 + 낚시터 선택
export default function HomeScreen() {
  const places = usePlaces();
  const range = useDateRange();
  const [homeId, setHomeId] = useHomePlace();
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState('');

  const place = places.data?.find((p) => p.id === homeId) ?? places.data?.[0] ?? null;
  const results = query.trim() ? (places.data ?? []).filter((p) => matches(p, query)).slice(0, 8) : [];
  const choose = (p: Place) => {
    setHomeId(p.id);
    setQuery('');
    Keyboard.dismiss();
  };
  const today = range.data?.today;
  const cond = useConditions(place?.id ?? null, today);
  const pc = cond.data?.place;

  return (
    <TabScreen title={`${greeting()}!`} subtitle="오늘도 안전하고 즐거운 낚시 되세요.">
      <SearchBar
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        placeholder="낚시터·지역 검색 (예: 태안, 대천, 좌대)"
      />
      {query.trim() ? (
        <Card style={styles.results}>
          {results.length === 0 ? (
            <ThemedText themeColor="textSecondary">검색 결과가 없어요. 지원 지역이 아닐 수 있어요.</ThemedText>
          ) : (
            results.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => choose(p)}
                style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
                <AppIcon name={PLACE_IMAGE[p.type]} size={30} />
                <View style={styles.shrink}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {p.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {p.region_name} · {PLACE_TYPE_LABEL[p.type]}
                  </ThemedText>
                </View>
              </Pressable>
            ))
          )}
          <Pressable accessibilityRole="button" onPress={() => setPicker(true)}>
            <ThemedText type="small" themeColor="tint" style={styles.more}>
              지역별 전체 목록 보기 ›
            </ThemedText>
          </Pressable>
        </Card>
      ) : null}

      <Card>
        <View style={styles.between}>
          <View style={styles.placeButton}>
            <AppIcon name={place ? PLACE_IMAGE[place.type] : 'place-wharf'} size={26} />
            <ThemedText type="sectionTitle" numberOfLines={1} style={styles.shrink}>
              {place ? place.name : '낚시터를 검색하세요'}
            </ThemedText>
          </View>
          {today ? (
            <ThemedText type="small" themeColor="textSecondary">
              오늘 {dayLabel(today)}
            </ThemedText>
          ) : null}
        </View>
        {place ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {place.region_name} · {PLACE_TYPE_LABEL[place.type]}
            {place.address ? ` · ${place.address}` : ''}
          </ThemedText>
        ) : null}
        {places.isError && <ErrorView message={places.error.message} onRetry={() => places.refetch()} />}
        {cond.isPending && place && <Loading />}
        {cond.isError && <ErrorView message={cond.error.message} onRetry={() => cond.refetch()} />}
        {pc && <SeaStory pc={pc} />}
      </Card>

      <SectionHeader
        image="fishing-index"
        title="오늘의 바다낚시지수"
        actionLabel="비교하기"
        onAction={() => router.push({ pathname: '/compare', params: place ? { a: String(place.id) } : {} })}
      />
      {pc && <FishingIndexCard pc={pc} />}

      <SectionHeader image="wave" title="오늘의 주요 해황" />
      {pc && <SeaTiles pc={pc} />}

      <SectionHeader image="place-wharf" title="가까운 낚시터" actionLabel="검색" onAction={() => setPicker(true)} />
      {places.data && place && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeRow}>
          {nearby(place, places.data, 10).map(({ place: p, km }) => (
            <PlaceCard key={p.id} p={p} km={km} selected={p.id === place.id} onPress={() => setHomeId(p.id)} />
          ))}
        </ScrollView>
      )}

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

/** 오늘 바다 이야기: 수치를 공인 등급표 기준의 문장으로 */
function SeaStory({ pc }: { pc: PlaceCompare }) {
  const theme = useTheme();
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
    <View style={[styles.story, { backgroundColor: theme.background }]}>
      {describeToday(pc).map((s) => (
        <View key={s.key} style={styles.storyLine}>
          <AppIcon name={icon[s.key]} size={20} />
          <ThemedText style={styles.storyText}>{s.text}</ThemedText>
        </View>
      ))}
    </View>
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
        <AppIcon name="fishing-index" size={28} badge />
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
          국립해양조사원 발표 ·{' '}
{f.source && f.source.distance_km != null && f.source.distance_km >= 1
  ? `${f.source.station_name} 지점 ${f.source.distance_km}km`
  : '이 지점 발표'}
{'\n'}앱이 판정한 값이 아닙니다
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
      <Tile icon="tide" title="물때" value={ext ? `${ext.type === 'high' ? '만조' : '간조'} ${timeLabel(ext.t)}` : '–'} note={ext ? `다음 ${ext.v ?? '?'}cm` : '자료 없음'} />
      <Tile icon="wave" title="파고" value={wave?.v ?? '–'} note={wave?.k ?? '자료 없음'} />
      <Tile icon="wind" title="바람" value={wind?.v ?? '–'} note={wind?.k ?? '자료 없음'} />
      <Tile icon="water-temp" title="수온" value={temp ?? '–'} note={temp ? '오늘 실측' : '자료 없음'} />
    </View>
  );
}

function Tile({ icon, title, value, note }: { icon: AppIconName; title: string; value: string; note: string }) {
  return (
    <Card style={styles.tile}>
      <View style={styles.statLabel}>
        <AppIcon name={icon} size={24} />
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

function PlaceCard({ p, km, selected, onPress }: { p: Place; km: number; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${p.name}${selected ? ', 기준 낚시터' : ''}`}
      onPress={onPress}
      style={[styles.placeCard, { borderColor: selected ? Brand.orange : theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={styles.placeArt}>
        <AppIcon name={PLACE_IMAGE[p.type]} size={60} />
        {selected ? (
  <View style={styles.star}>
    <AppIcon name="medal" size={16} badge />
  </View>
) : null}
      </View>
      <View style={styles.placeInfo}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {p.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {selected ? '기준 낚시터' : `${PLACE_TYPE_LABEL[p.type]} · ${km < 1 ? '1km 미만' : `${Math.round(km)}km`}`}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  placeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
  results: { gap: 2, paddingVertical: Spacing.two },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 },
  more: { paddingTop: Spacing.one },
  story: { borderRadius: 12, padding: Spacing.three - 2, gap: Spacing.two, marginTop: Spacing.one },
  storyLine: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  storyText: { flex: 1, lineHeight: 22 },
  stats: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  stat: { flex: 1, gap: 2 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  indexCard: { flexDirection: 'row', borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  indexBadge: { width: 80, alignItems: 'center', justifyContent: 'center', gap: 2, padding: Spacing.two },
  indexBody: { flex: 1, padding: Spacing.three, gap: 4 },
  onNavy: { color: Brand.onNavy, fontWeight: '700' },
  onNavySecondary: { color: Brand.onNavySecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: { width: '48.5%', flexGrow: 1, gap: 4 },
  placeRow: { gap: Spacing.two, paddingRight: Spacing.three },
  placeCard: { width: 120, borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  placeArt: { height: 68, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6F9' },
  star: { position: 'absolute', top: 6, right: 8 },
  placeInfo: { padding: Spacing.two, gap: 2 },
});
