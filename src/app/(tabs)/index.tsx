import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';

import { useDateRange } from '@/api/queries';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { OptionSheet } from '@/components/option-sheet';
import { GoldenCard, IndexCarousel, SpotsCard } from '@/components/home-briefing';
import { Button } from '@/components/form';
import { RulesLine } from '@/components/rules-line';
import { BottomSheet } from '@/components/bottom-sheet';
import { SpeciesYear } from '@/components/species-year';
import { Card, SectionHeader, TabScreen } from '@/components/screen';
import { CatchStrip } from '@/components/catch-strip';
import { SeaNews } from '@/components/sea-news';
import { SearchBar } from '@/components/search-bar';
import { SpeciesImage } from '@/components/species';
import { speciesByCode, type SpeciesItem } from '@/lib/species';
import { TACKLE } from '@/lib/tackle';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, IconSize } from '@/constants/theme';
import { dayList } from '@/lib/compare';
import { freshnessLine } from '@/lib/criteria';
import { useExplore } from '@/lib/explore';
import { matches, PLACE_IMAGE, PLACE_TYPE_LABEL, placeName } from '@/lib/place';
import { type Region, REGIONS } from '@/lib/prefs';

const HERO_RATIO = 1672 / 941; // 배경 사진 가로/세로

// 시간대별 분위기만 바꾼다 (데이터·검색 로직과 무관)
function homeBackgroundSource(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 9) return require('../../../assets/home-backgrounds/dawn.jpg');
  if (hour >= 9 && hour < 16) return require('../../../assets/home-backgrounds/day.jpg');
  if (hour >= 16 && hour < 18) return require('../../../assets/home-backgrounds/sunset.jpg');
  if (hour >= 18 && hour < 21) return require('../../../assets/home-backgrounds/dusk.jpg');
  return require('../../../assets/home-backgrounds/night.jpg');
}

/**
 * 홈 (2026-11-11, 사용자 레퍼런스 「오늘은 어떤 낚시를 떠나세요?」 구조 그대로)
 * 바다 배경·검색·날짜 → 어종 카드 → [출조 날짜 | 지역] → [지도에서 찾기] [출조계획] → 오늘의 낚시 정보 4칸.
 * 낚시터 목록은 「추천 낚시터」 화면에서 (홈에 목록을 나열하지 않는다). 맨 아래 「최근 이용자 조황」은 글이 있을 때만.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const range = useDateRange();
  const today = range.data?.today;
  const date = today;
  const x = useExplore(date, today);
  const [query, setQuery] = useState('');
  // 배경 사진(16:9)의 낚시꾼이 오른쪽 끝에 있어서, 가운데 맞춤(cover) 대신 오른쪽에 붙여 잘리지 않게 한다
  const [hero, setHero] = useState({ w: 0, h: 0 });
  const [sheet, setSheet] = useState<'region' | null>(null);

  const [yearOpen, setYearOpen] = useState(false);
  // 어종 카드를 누르면 그 어종 오늘 시트
  const [fish, setFish] = useState<SpeciesItem | null>(null);
  // 「전체 어종」에서 고르고 돌아오면 (?fish=code) 그 어종 시트를 연다
  const params = useLocalSearchParams<{ fish?: string; t?: string }>();
  const req = params.fish ? `${params.fish}:${params.t ?? ''}` : undefined;
  const [seenFish, setSeenFish] = useState<string | undefined>();
  if (req !== seenFish) {
    setSeenFish(req);
    const sp = speciesByCode(params.fish);
    if (sp) setFish(sp);
  }
  const results = query.trim() ? (x.places.data ?? []).filter((p) => matches(p, query)).slice(0, 5) : [];
  const speciesHits = query.trim()
    ? x.allSpecies.filter((s) => s.name.includes(query.trim()) || (s.alias ?? '').includes(query.trim())).slice(0, 3)
    : [];

  const dates = range.data ? dayList(range.data.today, range.data.max) : [];

  const openPlace = (p: Place) => {
    setQuery('');
    Keyboard.dismiss();
    router.push({ pathname: '/place/[id]', params: { id: String(p.id) } });
  };
  // 지도는 홈에서 고른 지역 그대로 연다: 내 주변 → 현재 위치, 해역 → 그 해역 전체, 전국 → 전국
  // 고른 어종이 있으면 지도도 그 어종 관련 낚시터만 보여준다 (?fish=), 날짜는 「출조계획에 추가」로 이어진다
  const openMap = (o: { fish?: SpeciesItem | null; near?: boolean; ports?: boolean } = {}) =>
    router.push({
      pathname: '/explore',
      params: {
        ...(o.near || x.region === '내 주변' ? { near: '1' } : { region: x.region === '전국' ? 'all' : `sea:${x.region}` }),
        ...(o.fish ? { fish: o.fish.name } : {}),
        ...(o.ports ? { ports: '1' } : {}),
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`지역 ${x.region}, 바꾸기`}
          hitSlop={6}
          onPress={() => setSheet('region')}
          style={({ pressed }) => [styles.regionPill, pressed && styles.pressed]}>
          <AppIcon name="find-gps" size={16} />
          <Text style={styles.regionText}>{x.near ? (x.nearArea ? `내 주변 · ${x.nearArea.area}` : '내 주변') : x.region}</Text>
          <AppIcon name="arrow-down" size={12} tint="#FFFFFF" />
        </Pressable>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>오늘은 어떤 낚시를 떠나세요?</Text>
          <Text style={styles.heroSubtitle}>오늘 바다낚시지수로 어종과 낚시터를 골라 드려요.</Text>
        </View>
        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder="어종·지역·낚시터 검색" />
        {/* 이름을 몰라도 바로 찾게: 지도 · 내 주변 · 배낚시 항구 (낚시앱 공통 — 지도에서 고르기) */}
        <View style={styles.heroActions}>
          <HeroButton icon="find-map" label="지도로 찾기" onPress={() => openMap()} />
          <HeroButton icon="find-gps" label="내 주변" onPress={() => openMap({ near: true })} />
          <HeroButton icon="place-wharf" label="배낚시 항구" onPress={() => openMap({ ports: true })} />
        </View>
      </View>

      {query.trim() ? (
        <Card>
          {speciesHits.map((s) => (
            <Pressable
              key={s.code}
              accessibilityRole="button"
              onPress={() => {
                setFish(s);
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
              맞는 어종·낚시터가 없어요. 「지도로 찾기」에서 지역별로 둘러보세요.
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      {/* 메인의 핵심: 오늘 어종별 공식 바다낚시지수 (좋음 이상 많은 순, 옆으로 넘김). 날짜별 비교는 출조계획 탭에서 */}
      {/* 이번 달 제철(통계청 어획 많은 달)·금어기 소식 — 매달·매주 내용이 바뀌는 한 줄 */}
      <SeaNews today={today} region={x.near ? '내 주변' : x.region} onOpen={setFish} />
      <IndexCarousel x={x} onOpen={setFish} onAll={() => router.push('/species')} />

      {/* 어디로 갈까: 오늘 가장 좋은 곳 (전체 어종 기준) · 지도로 펼쳐 보기 */}
      <SectionHeader title="오늘 어디로 갈까" actionLabel="지도" onAction={() => openMap()} />
      <GoldenCard x={x} dates={dates} today={today} />

      {/* 어종 카드 → 그 어종 오늘: 좋은 곳 5 · 금어기·체장 · [지도에서 보기] [이 어종으로 계획] */}
      <BottomSheet
        open={!!fish}
        title={fish ? (fish.indexName ? `오늘 ${fish.name} 좋은 곳` : `${fish.name} · 금어기·채비`) : ''}
        onClose={() => setFish(null)}>
        {fish ? (
          <View style={styles.sheet}>
            {fish.indexName ? (
              <SpotsCard x={x} dates={dates} date={today} today={today} species={fish} limit={5} onOpen={() => setFish(null)} />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                공식 낚시지수가 없는 어종이라 「좋은 곳」 순위는 없어요. 「지도에서 보기」로 이 어종을 대상 어종으로 알린 낚시터를 볼 수
                있어요.
              </ThemedText>
            )}
            {TACKLE[fish.code] ? (
              <View style={[styles.tackle, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <View style={styles.tackleHead}>
                  <AppIcon name="rod" size={20} />
                  <ThemedText type="smallBold" style={styles.flex}>
                    {TACKLE[fish.code].how}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  미끼 {TACKLE[fish.code].bait} · 흔히 쓰는 방법(참고), 지역·시기마다 달라요
                </ThemedText>
              </View>
            ) : null}
            <RulesLine species={fish} today={today} onOpenSpecies={() => setYearOpen(true)} />
            <View style={styles.sheetActions}>
              <View style={styles.flex}>
                <Button
                  label="지도에서 보기"
                  variant="navy"
                  onPress={() => {
                    const f = fish;
                    setFish(null);
                    openMap({ fish: f });
                  }}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="이 어종으로 계획"
                  onPress={() => {
                    const f = fish;
                    setFish(null);
                    router.push({ pathname: '/trip/new', params: { species: f.code } });
                  }}
                />
              </View>
            </View>
          </View>
        ) : null}
      </BottomSheet>
      {fish ? (
        <BottomSheet open={yearOpen} title={`${fish.name} · 1년 달력`} onClose={() => setYearOpen(false)}>
          <SpeciesYear
            species={fish}
            today={today}
            onLeave={() => {
              setYearOpen(false);
              setFish(null);
            }}
          />
        </BottomSheet>
      ) : null}

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

function HeroButton({ icon, label, onPress }: { icon: AppIconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}>
      <View style={styles.heroIcon}>
        <AppIcon name={icon} size={18} />
      </View>
      <Text style={styles.heroBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  hero: {
    backgroundColor: Brand.navy,
    marginTop: -16,
    marginHorizontal: -16,
    paddingTop: 96,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
    overflow: 'hidden',
  },
  heroImage: { position: 'absolute', top: 0, right: 0 },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(5, 30, 58, 0.42)' },
  heroActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  regionPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  regionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sheet: { gap: 10 },
  tackleHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tackle: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  sheetActions: { flexDirection: 'row', gap: 8 },
  heroCopy: { paddingHorizontal: 4, paddingTop: 8, gap: 4 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 32, fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  heroBtn: {
    flex: 1,
    flexDirection: 'column',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F6F9', alignItems: 'center', justifyContent: 'center' },
  heroBtnText: { color: Brand.onNavy, fontSize: 13, fontWeight: '700' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
});
