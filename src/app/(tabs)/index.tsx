import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ImageBackground, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDateRange } from '@/api/queries';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { HomeActions, SeaPreview } from '@/components/home-explore';
import { OptionSheet } from '@/components/option-sheet';
import { Card, SectionHeader, TabScreen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { SpeciesImage, SpeciesRail } from '@/components/species';
import { TermSheet } from '@/components/term-sheet';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, IconSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, dayList } from '@/lib/compare';
import { freshnessLine } from '@/lib/criteria';
import { useExplore } from '@/lib/explore';
import type { TermKey } from '@/lib/glossary';
import { matches, PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';
import { type Region, REGIONS } from '@/lib/prefs';
import { josa } from '@/lib/species';
import { SPECIES_IMAGES } from '@/lib/species-images';

// 시간대별 분위기만 바꾼다 (데이터·검색 로직과 무관)
function homeBackgroundSource(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 9) return require('../../../assets/home-backgrounds/dawn.png');
  if (hour >= 9 && hour < 16) return require('../../../assets/home-backgrounds/day.png');
  if (hour >= 16 && hour < 18) return require('../../../assets/home-backgrounds/sunset.png');
  if (hour >= 18 && hour < 21) return require('../../../assets/home-backgrounds/dusk.png');
  return require('../../../assets/home-backgrounds/night.png');
}

/**
 * 홈 (2026-11-11, 사용자 레퍼런스 「오늘은 어떤 낚시를 떠나세요?」 구조 그대로)
 * 바다 배경·검색·날짜 → 어종 카드 → [출조 날짜 | 지역] → [지도에서 찾기] [출조계획] → 오늘의 낚시 정보 4칸.
 * 포인트 목록은 「포인트 보기」 화면에서 (홈에 목록을 나열하지 않는다).
 */
export default function HomeScreen() {
  const range = useDateRange();
  const today = range.data?.today;
  const [dateSel, setDate] = useState<string | null>(null);
  const date = dateSel ?? today;
  const x = useExplore(date, today);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<'date' | 'region' | null>(null);
  const [term, setTerm] = useState<TermKey | null>(null);

  const railSpecies = useMemo(() => x.allSpecies.filter((s) => SPECIES_IMAGES[s.code]), [x.allSpecies]);
  const results = query.trim() ? (x.places.data ?? []).filter((p) => matches(p, query)).slice(0, 5) : [];
  const speciesHits = query.trim()
    ? x.allSpecies.filter((s) => s.name.includes(query.trim()) || (s.alias ?? '').includes(query.trim())).slice(0, 3)
    : [];

  const dates = range.data ? dayList(range.data.today, range.data.max) : [];
  const shortDay = (d: string) => (d === today ? '오늘' : dates[1] === d ? '내일' : dayLabel(d).replace(' ', ''));
  const dateText = date ? dayLabel(date) : '';
  const beyond = (d: string) => !!x.lastForecastDay && d > x.lastForecastDay;

  const openPlace = (p: Place) => {
    setQuery('');
    Keyboard.dismiss();
    router.push({ pathname: '/place/[id]', params: { id: String(p.id) } });
  };
  const plan = () =>
    router.push({ pathname: '/trip/new', params: { ...(date ? { date } : {}), ...(x.species ? { species: x.species.code } : {}) } });
  const points = () => router.push({ pathname: '/points', params: date ? { date } : {} });

  const qc = useQueryClient();
  const refresh = () =>
    Promise.all(['places-summary', 'fishing-index', 'conditions', 'meta'].map((k) => qc.invalidateQueries({ queryKey: [k] })));

  // 미리보기 아래 한 줄: 고른 어종의 공식 지수 제공 여부 (등급은 포인트 보기에서)
  const n = x.species?.indexName ? x.indexCount(x.species.indexName) : null;
  const speciesLine = !x.species
    ? null
    : x.species.indexName
      ? n
        ? `${x.species.name} 공식 낚시지수 · ${x.scopeName} ${n}곳 발표`
        : `${x.scopeName}에는 ${dateText} ${x.species.name} 공식 지수 지점이 없어요`
      : `${josa(x.species.name, '은', '는')} 공식 낚시지수가 없는 어종이에요`;

  return (
    <TabScreen title="" immersive onRefresh={refresh}>
      {/* 상단: 바다 배경 · 검색 · 내 주변 · 지도 탐색 · 날짜 */}
      <ImageBackground source={homeBackgroundSource()} imageStyle={styles.heroImage} style={styles.hero}>
        <View pointerEvents="none" style={styles.heroShade} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>오늘은 어떤 낚시를 떠나세요?</Text>
          <Text style={styles.heroSubtitle}>원하는 어종과 지역을 선택하고{'\n'}오늘의 낚시 조건을 확인해 보세요.</Text>
        </View>
        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder="어종·지역·낚시터 검색" />
        <View style={styles.heroActions}>
          <HeroButton icon="find-gps" label="내 주변" active={x.near} onPress={x.locate} />
          <HeroButton icon="find-map" label="지도 탐색" onPress={() => router.push('/explore')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {dates.map((d) => {
            const on = d === date;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${dayLabel(d)}${beyond(d) ? ', 예보 발표 전' : ''}`}
                onPress={() => setDate(d)}
                style={({ pressed }) => [styles.datePill, on && styles.datePillOn, pressed && styles.pressed]}>
                <Text style={[styles.dateText, !on && beyond(d) && styles.dateTextPending, on && styles.dateTextOn]}>{shortDay(d)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </ImageBackground>

      {query.trim() ? (
        <Card>
          {speciesHits.map((s) => (
            <Pressable
              key={s.code}
              accessibilityRole="button"
              onPress={() => {
                x.setSpeciesCode(s.code);
                setQuery('');
                Keyboard.dismiss();
              }}
              style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
              <SpeciesImage code={s.code} size={36} />
              <View style={styles.flex}>
                <ThemedText type="smallBold">{s.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  어종 · {s.indexName ? '공식 낚시지수 제공' : '공식 낚시지수 없음'}
                </ThemedText>
              </View>
            </Pressable>
          ))}
          {results.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" onPress={() => openPlace(p)} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
              <AppIcon name={PLACE_IMAGE[p.type]} size={IconSize.row} />
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {p.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {p.region_name} · {PLACE_TYPE_LABEL[p.type]}
                </ThemedText>
              </View>
            </Pressable>
          ))}
          {speciesHits.length === 0 && results.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              맞는 어종·낚시터가 없어요. 「지도 탐색」에서 지역별로 둘러보세요.
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      {/* 어종 */}
      <SectionHeader title="어떤 어종을 잡으러 가세요?" actionLabel="전체 어종 보기" onAction={() => router.push('/species')} />
      <SpeciesRail items={railSpecies} selected={x.speciesCode} onSelect={x.setSpeciesCode} />

      {/* 출조 날짜 | 지역 */}
      <ConditionBox
        dateText={dateText}
        regionText={x.near ? (x.gps.loading ? '내 주변 · 위치 확인 중' : x.gps.error ? '내 주변 · 위치 확인 안 됨' : x.nearArea ? `내 주변 · ${x.nearArea.area} 부근` : x.scopeName) : x.region}
        onDate={() => setSheet('date')}
        onRegion={() => setSheet('region')}
      />

      {/* 지도 · 출조계획 */}
      <HomeActions onMap={() => router.push('/explore')} onPlan={plan} />

      {/* 오늘의 낚시 정보 미리보기 */}
      <SectionHeader title={date === today ? '오늘의 낚시 정보 미리보기' : `${dateText} 낚시 정보 미리보기`} actionLabel="포인트 보기" onAction={points} />
      {x.near && (x.gps.loading || x.gps.error) ? (
        // 위치를 기다리는 동안 「자료 없음」으로 보이지 않게
        <ThemedText type="small" themeColor={x.gps.error ? 'warning' : 'textSecondary'}>
          {x.gps.error ?? '현재 위치를 확인하는 중이에요… 위치 권한을 허용하면 내 주변 60km 바다 정보를 보여드려요.'}
        </ThemedText>
      ) : x.summary.isSuccess ? (
        <SeaPreview list={x.scoped} tide={x.tide} future={x.future} pending={x.pending} onInfo={setTerm} />
      ) : (
        <ThemedText type="small" themeColor={x.summary.isError ? 'warning' : 'textSecondary'}>
          {x.summary.isError ? '해황 자료를 잠시 확인할 수 없어요.' : '바다 정보를 불러오는 중이에요…'}
        </ThemedText>
      )}
      {speciesLine ? (
        <Pressable accessibilityRole="button" onPress={points}>
          <ThemedText type="small" themeColor="tint" style={styles.bold}>
            {speciesLine} ›
          </ThemedText>
        </Pressable>
      ) : null}
      {x.summary.isSuccess ? (
        <ThemedText type="small" themeColor={x.summary.data.data_status.stale ? 'warning' : 'textSecondary'}>
          {x.scopeName} 기준 · {freshnessLine(x.summary.data.data_status)}
        </ThemedText>
      ) : null}

      <TermSheet term={term} onClose={() => setTerm(null)} />
      <OptionSheet
        open={sheet === 'date'}
        title="출조 날짜"
        value={date ?? null}
        options={dates.map((d) => ({ value: d, label: dayLabel(d), sub: beyond(d) ? '파고·풍속 예보 발표 전' : undefined }))}
        onPick={(d) => setDate(d)}
        onClose={() => setSheet(null)}
      />
      <OptionSheet<Region>
        open={sheet === 'region'}
        title="지역"
        value={x.region}
        options={REGIONS.map((r) => ({ value: r, label: r, sub: r === '내 주변' ? '현재 위치에서 60km 안 (위치 권한 필요)' : undefined }))}
        onPick={(r) => (r === '내 주변' ? x.locate() : x.setRegion(r))}
        onClose={() => setSheet(null)}
      />
    </TabScreen>
  );
}

function ConditionBox({ dateText, regionText, onDate, onRegion }: { dateText: string; regionText: string; onDate: () => void; onRegion: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.cond, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`출조 날짜 ${dateText}, 바꾸기`} onPress={onDate} style={({ pressed }) => [styles.condHalf, pressed && styles.pressed]}>
        <AppIcon name="trips" size={26} />
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            출조 날짜
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1}>
            {dateText}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary">›</ThemedText>
      </Pressable>
      <View style={[styles.condLine, { backgroundColor: theme.border }]} />
      <Pressable accessibilityRole="button" accessibilityLabel={`지역 ${regionText}, 바꾸기`} onPress={onRegion} style={({ pressed }) => [styles.condHalf, pressed && styles.pressed]}>
        <AppIcon name="find-gps" size={26} />
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            지역
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1}>
            {regionText}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary">›</ThemedText>
      </Pressable>
    </View>
  );
}

function HeroButton({ icon, label, onPress, active }: { icon: AppIconName; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.heroBtn, active && styles.heroBtnOn, pressed && styles.pressed]}>
      <View style={styles.heroIcon}>
        <AppIcon name={icon} size={18} />
      </View>
      <Text style={styles.heroBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  bold: { fontWeight: '700' },
  hero: { backgroundColor: Brand.navy, marginTop: -16, marginHorizontal: -16, paddingTop: 104, paddingHorizontal: 16, paddingBottom: 14, gap: 10, overflow: 'hidden' },
  heroImage: { borderRadius: 0 },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(5, 30, 58, 0.42)' },
  heroCopy: { paddingHorizontal: 4, paddingTop: 8, gap: 4 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 32, fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  heroActions: { flexDirection: 'row', gap: 8 },
  heroBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroBtnOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  heroIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F6F9', alignItems: 'center', justifyContent: 'center' },
  heroBtnText: { color: Brand.onNavy, fontSize: 15, fontWeight: '700' },
  dateRow: { gap: 6 },
  datePill: { minHeight: 36, minWidth: 52, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  datePillOn: { backgroundColor: Brand.orange, borderColor: Brand.orange },
  dateText: { color: Brand.onNavySecondary, fontSize: 14, fontWeight: '600' },
  dateTextPending: { opacity: 0.6 },
  dateTextOn: { color: '#fff', fontWeight: '800' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  cond: { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderRadius: 16, minHeight: 68 },
  condHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  condLine: { width: 1, marginVertical: 14 },
});
