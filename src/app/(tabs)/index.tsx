import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCatchSummary, useDateRange, useFishingRules, useSpeciesSeasons } from '@/api/queries';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { HomeActions, SeaLine } from '@/components/home-explore';
import { OptionSheet } from '@/components/option-sheet';
import { RulesLine } from '@/components/rules-line';
import { SpeciesYear } from '@/components/species-year';
import { railBadge } from '@/lib/seasons';
import { Card, SectionHeader, TabScreen } from '@/components/screen';
import { CatchStrip } from '@/components/catch-strip';
import { SearchBar } from '@/components/search-bar';
import { SpeciesImage, SpeciesRail } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, IconSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, dayList } from '@/lib/compare';
import { freshnessLine } from '@/lib/criteria';
import { useExplore } from '@/lib/explore';
import { matches, PLACE_IMAGE, PLACE_TYPE_LABEL, placeName, usableForLocation } from '@/lib/place';
import { sortByCount, speciesPlaceCounts } from '@/lib/species-rank';
import { type Region, REGIONS, SEA_GROUPS } from '@/lib/prefs';
import { josa } from '@/lib/species';
import { SPECIES_IMAGES } from '@/lib/species-images';

const HERO_RATIO = 1672 / 941; // 배경 사진 가로/세로

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
 * 낚시터 목록은 「추천 낚시터」 화면에서 (홈에 목록을 나열하지 않는다). 맨 아래 「최근 이용자 조황」은 글이 있을 때만.
 */
export default function HomeScreen() {
  const range = useDateRange();
  const today = range.data?.today;
  const [dateSel, setDate] = useState<string | null>(null);
  const date = dateSel ?? today;
  const x = useExplore(date, today);
  const [query, setQuery] = useState('');
  // 배경 사진(16:9)의 낚시꾼이 오른쪽 끝에 있어서, 가운데 맞춤(cover) 대신 오른쪽에 붙여 잘리지 않게 한다
  const [hero, setHero] = useState({ w: 0, h: 0 });
  const [sheet, setSheet] = useState<'date' | 'region' | null>(null);

  // 어종 순서: 지금 고른 지역·날짜에서 지도에 많이 찍히는 어종 먼저 (공식 지수 지점 · 이용자 조황 · 공공데이터 대상 어종 낚시터 수).
  // 공식 지수가 없는 어종도 자료가 많으면 앞에 온다. 앱이 점수를 만들지 않고 낚시터 수만 센다
  const catches = useCatchSummary(14);
  const speciesCounts = useMemo(
    () =>
      x.places.data && x.summary.isSuccess && !(x.near && !x.gps.coords)
        ? speciesPlaceCounts(x.allSpecies, {
            places: x.places.data.filter(usableForLocation),
            day: x.day,
            catches: catches.data,
            scope: x.inScope,
          })
        : null,
    [x.places.data, x.summary.isSuccess, x.near, x.gps.coords, x.allSpecies, x.day, catches.data, x.inScope],
  );
  const railSpecies = useMemo(
    () => sortByCount(x.allSpecies.filter((s) => SPECIES_IMAGES[s.code]), speciesCounts),
    [x.allSpecies, speciesCounts],
  );
  // 어종 카드 배지: 지금 금어기 > 이번 달 산란기 (법령·수산과학원·논문 근거)
  const seasonsQ = useSpeciesSeasons();
  const rulesQ = useFishingRules();
  const railBadges = useMemo(() => {
    const t = range.data?.today;
    if (!t) return undefined;
    return Object.fromEntries(railSpecies.map((s) => [s.code, railBadge(s.code, t, seasonsQ.data, rulesQ.data)]));
  }, [railSpecies, range.data?.today, seasonsQ.data, rulesQ.data]);
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
  // 홈에서 고른 날짜·해역·어종을 출조계획에 그대로 넘긴다 (내 주변·전국은 해역이 아니라 넘기지 않음)
  const sea = (SEA_GROUPS as readonly string[]).includes(x.region) ? x.region : null;
  const plan = () =>
    router.push({
      pathname: '/trip/new',
      params: { ...(date ? { date } : {}), ...(x.species ? { species: x.species.code } : {}), ...(sea ? { region: sea } : {}) },
    });
  const points = () => router.push({ pathname: '/points', params: date ? { date } : {} });
  // 지도는 홈에서 고른 지역 그대로 연다: 내 주변 → 현재 위치, 해역 → 그 해역 전체, 전국 → 전국
  // 고른 어종이 있으면 지도도 그 어종 관련 낚시터만 보여준다 (?fish=), 날짜는 「출조계획에 추가」로 이어진다
  const openMap = () =>
    router.push({
      pathname: '/explore',
      params: {
        ...(x.region === '내 주변' ? { near: '1' } : { region: x.region === '전국' ? 'all' : `sea:${x.region}` }),
        ...(x.species ? { fish: x.species.name } : {}),
        ...(date ? { date } : {}),
      },
    });

  const qc = useQueryClient();
  const refresh = () =>
    Promise.all(['places-summary', 'fishing-index', 'conditions', 'meta'].map((k) => qc.invalidateQueries({ queryKey: [k] })));

  // 미리보기 아래 한 줄: 고른 어종의 공식 지수 제공 여부 (등급은 추천 낚시터에서)
  const n = x.species?.indexName ? x.indexCount(x.species.indexName) : null;
  // 자료(해황 요약·공식 지수)를 다 불러오기 전에는 「지점이 없어요」로 단정하지 않는다
  const ready = x.summary.isSuccess && (!x.species?.indexName || x.fi.isSuccess);
  const speciesLine = !x.species
    ? null
    : !ready
      ? `${x.species.name} 정보를 불러오는 중이에요…`
    : x.species.indexName
      ? n
        ? `${x.species.name} 공식 낚시지수 · ${x.scopeName} ${n}곳 발표`
        : `${x.scopeName}에는 ${dateText} ${x.species.name} 공식 지수 지점이 없어요`
      : `${josa(x.species.name, '은', '는')} 공식 낚시지수가 없는 어종이에요`;

  return (
    <TabScreen title="" immersive onRefresh={refresh}>
      {/* 상단: 바다 배경 · 검색 · 내 주변 · 지도 탐색 · 날짜 */}
      <View onLayout={(e) => setHero({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={styles.hero}>
        {hero.h > 0 ? (
          <Image
            source={homeBackgroundSource()}
            resizeMode="cover"
            style={[
              styles.heroImage,
              { width: Math.max(hero.w, hero.h * HERO_RATIO), height: Math.max(hero.h, hero.w / HERO_RATIO) },
            ]}
          />
        ) : null}
        <View pointerEvents="none" style={styles.heroShade} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>오늘은 어떤 낚시를 떠나세요?</Text>
          <Text style={styles.heroSubtitle}>어종과 지역을 고르고 바다 조건을 확인해 보세요.</Text>
        </View>
        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder="어종·지역·낚시터 검색" />
        <View style={styles.heroActions}>
          {/* 지도는 아래 「지도에서 찾기」 버튼 하나로 (중복 정리) */}
          <HeroButton
            icon="find-gps"
            label="내 주변"
            onPress={() => router.push({ pathname: '/explore', params: { near: '1' } })}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {dates.map((d) => {
            const on = d === date;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${dayLabel(d)}${beyond(d) ? ', 해역 예보만' : ''}`}
                onPress={() => setDate(d)}
                style={({ pressed }) => [styles.datePill, on && styles.datePillOn, pressed && styles.pressed]}>
                <Text style={[styles.dateText, !on && beyond(d) && styles.dateTextPending, on && styles.dateTextOn]}>{shortDay(d)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

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
                  {placeName(p)}
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

      {/* ① 이번 주 조황 (서비스 개선 v2 H-A): 이용자가 올린 글. 예보와 구분, 글이 없으면 칸을 숨긴다 */}
      <CatchStrip
        title={x.species ? `요즘 ${x.species.name} 조황` : '요즘 이용자 조황'}
        filter={{ species: x.species ? (x.species.speciesCode ?? x.species.name) : null }}
      />

      {/* 어종 */}
      <SectionHeader title="어떤 어종을 잡으러 가세요?" actionLabel="전체 어종 보기" onAction={() => router.push('/species')} />
      <SpeciesRail items={railSpecies} selected={x.speciesCode} onSelect={x.setSpeciesCode} badges={railBadges} />
      {/* 고른 어종: 1년 달력(산란기·금어기·금지체장) / 안 골랐으면 오늘 금어기 한 줄 */}
      {x.species ? <SpeciesYear species={x.species} today={range.data?.today} /> : <RulesLine species={null} today={range.data?.today} />}

      {/* 출조 날짜 | 지역 */}
      <ConditionBox
        dateText={dateText}
        regionText={x.near ? (x.gps.loading ? '내 주변 · 위치 확인 중' : x.gps.error ? '내 주변 · 위치 확인 안 됨' : x.nearArea ? `내 주변 · ${x.nearArea.area} 부근` : x.scopeName) : x.region}
        onDate={() => setSheet('date')}
        onRegion={() => setSheet('region')}
      />

      {/* 지도 · 출조계획 */}
      <HomeActions
        onMap={openMap}
        onPlan={plan}
        speciesName={x.species?.name}
        summary={[date ? dayLabel(date) : null, x.near ? '내 주변' : x.region, x.species?.name].filter(Boolean).join(' · ')}
      />

      {/* 바다 한 줄 (4칸 → 1줄, 서비스 개선 v2 H-B). 누르면 지도 */}
      {x.near && (x.gps.loading || x.gps.error) ? (
        // 위치를 기다리는 동안 「자료 없음」으로 보이지 않게
        <ThemedText type="small" themeColor={x.gps.error ? 'warning' : 'textSecondary'}>
          {x.gps.error ?? '현재 위치를 확인하는 중이에요… 위치 권한을 허용하면 내 주변 60km 바다 정보를 보여드려요.'}
        </ThemedText>
      ) : x.summary.isSuccess ? (
        <SeaLine list={x.scoped} tide={x.tide} future={x.future} pending={x.pending} scopeName={x.scopeName} onPress={openMap} />
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
      {x.summary.isSuccess && x.summary.data.data_status.stale ? (
        <ThemedText type="small" themeColor="warning">
          {freshnessLine(x.summary.data.data_status)}
        </ThemedText>
      ) : null}

      <OptionSheet
        open={sheet === 'date'}
        title="출조 날짜"
        value={date ?? null}
        options={dates.map((d) => ({ value: d, label: dayLabel(d), sub: beyond(d) ? '해역 파고 예보(참고)·물때만' : undefined }))}
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
  heroImage: { position: 'absolute', top: 0, right: 0 },
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
