import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { useDateRange } from '@/api/queries';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { OptionSheet } from '@/components/option-sheet';
import { IndexGrid, SpotsCard } from '@/components/home-briefing';
import { RulesLine } from '@/components/rules-line';
import { BottomSheet } from '@/components/bottom-sheet';
import { SpeciesYear } from '@/components/species-year';
import { Card, SectionHeader, TabScreen } from '@/components/screen';
import { CatchStrip } from '@/components/catch-strip';
import { SearchBar } from '@/components/search-bar';
import { SpeciesImage } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, IconSize } from '@/constants/theme';
import { dayLabel, dayList } from '@/lib/compare';
import { freshnessLine } from '@/lib/criteria';
import { useExplore } from '@/lib/explore';
import { matches, PLACE_IMAGE, PLACE_TYPE_LABEL, placeName } from '@/lib/place';
import { type Region, REGIONS } from '@/lib/prefs';

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

  const [yearOpen, setYearOpen] = useState(false);
  const results = query.trim() ? (x.places.data ?? []).filter((p) => matches(p, query)).slice(0, 5) : [];
  const speciesHits = query.trim()
    ? x.allSpecies.filter((s) => s.name.includes(query.trim()) || (s.alias ?? '').includes(query.trim())).slice(0, 3)
    : [];

  const dates = range.data ? dayList(range.data.today, range.data.max) : [];
  const beyond = (d: string) => !!x.lastForecastDay && d > x.lastForecastDay;

  const openPlace = (p: Place) => {
    setQuery('');
    Keyboard.dismiss();
    router.push({ pathname: '/place/[id]', params: { id: String(p.id) } });
  };
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

  return (
    <TabScreen title="" immersive onRefresh={refresh}>
      {/* 상단: 바다 배경 · 검색 · 내 주변 · 지도 탐색 · 날짜 */}
      <View onLayout={(e) => setHero({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={styles.hero}>
        {hero.h > 0 ? (
          <Image
            source={homeBackgroundSource()}
            resizeMode="cover"
            style={[styles.heroImage, { width: Math.max(hero.w, hero.h * HERO_RATIO), height: Math.max(hero.h, hero.w / HERO_RATIO) }]}
          />
        ) : null}
        <View pointerEvents="none" style={styles.heroShade} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>오늘은 어떤 낚시를 떠나세요?</Text>
          <Text style={styles.heroSubtitle}>오늘 바다낚시지수로 어종과 낚시터를 골라 드려요.</Text>
        </View>
        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder="어종·지역·낚시터 검색" />
        <View style={styles.heroActions}>
          <HeroButton
            icon="find-gps"
            label={`${x.near ? (x.nearArea ? `내 주변 · ${x.nearArea.area}` : '내 주변') : x.region} ▾`}
            onPress={() => setSheet('region')}
          />
        </View>
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
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => openPlace(p)}
              style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
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

      {/* 메인의 핵심: 오늘 어종별 공식 바다낚시지수 (좋음 이상 많은 순). 날짜별 비교는 출조계획 탭에서 */}
      <SectionHeader title="오늘 어종별 낚시지수" actionLabel="전체 어종" onAction={() => router.push('/species')} />
      <IndexGrid x={x} selected={x.speciesCode} onSelect={x.setSpeciesCode} />
      {/* 지금 금어기인 어종을 골랐을 때만 경고 (평소 금지체장은 어종 시트에서) */}
      <RulesLine species={x.species} today={range.data?.today} onOpenSpecies={x.species ? () => setYearOpen(true) : undefined} alertOnly />
      {x.species ? (
        <BottomSheet open={yearOpen} title={`${x.species.name} · 1년 달력`} onClose={() => setYearOpen(false)}>
          <SpeciesYear species={x.species} today={range.data?.today} onLeave={() => setYearOpen(false)} />
        </BottomSheet>
      ) : null}

      {/* 어디로 갈까: 오늘 가장 좋은 곳 (고른 어종 기준, 없으면 전체) · 지도로 펼쳐 보기 */}
      <SectionHeader title={`어디로 갈까${x.species ? ` · ${x.species.name}` : ''}`} actionLabel="지도" onAction={openMap} />
      <SpotsCard x={x} dates={dates} date={today} today={today} />

      {x.summary.isSuccess && x.summary.data.data_status.stale ? (
        <ThemedText type="small" themeColor="warning">
          {freshnessLine(x.summary.data.data_status)}
        </ThemedText>
      ) : null}

      {/* 이번 주 조황 (서비스 개선 v2 H-A): 이용자가 올린 글. 예보와 구분, 글이 없으면 칸을 숨긴다 */}
      <CatchStrip
        title={x.species ? `요즘 ${x.species.name} 조황` : '요즘 이용자 조황'}
        filter={{ species: x.species ? (x.species.speciesCode ?? x.species.name) : null }}
      />

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

function HeroButton({ icon, label, onPress, active }: { icon: AppIconName; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.heroBtn, active && styles.heroBtnOn, pressed && styles.pressed]}>
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
  hero: {
    backgroundColor: Brand.navy,
    marginTop: -16,
    marginHorizontal: -16,
    paddingTop: 104,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
    overflow: 'hidden',
  },
  heroImage: { position: 'absolute', top: 0, right: 0 },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(5, 30, 58, 0.42)' },
  heroActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  heroCopy: { paddingHorizontal: 4, paddingTop: 8, gap: 4 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 32, fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  heroBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroBtnOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  heroIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F6F9', alignItems: 'center', justifyContent: 'center' },
  heroBtnText: { color: Brand.onNavy, fontSize: 15, fontWeight: '700' },
  dateRow: { gap: 6 },
  datePill: {
    minHeight: 36,
    minWidth: 52,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  datePillOn: { backgroundColor: Brand.orange, borderColor: Brand.orange },
  dateText: { color: Brand.onNavySecondary, fontSize: 14, fontWeight: '600' },
  dateTextPending: { opacity: 0.6 },
  dateTextOn: { color: '#fff', fontWeight: '800' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  condLine: { width: 1, marginVertical: 14 },
});
