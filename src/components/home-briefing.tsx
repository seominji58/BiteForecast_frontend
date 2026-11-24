/**
 * 홈 「이번 주 낚시 브리핑」 (2026-11-23). 사용자의 결정 순서 「언제 → 무엇 → 어디」대로:
 *   ① 이번 주 날짜 막대 — 날마다 공식 지수 「좋음 이상」 비율, 가장 좋은 날 강조. 누르면 그 날짜로
 *   ② (어종 순위는 홈 어종 카드 줄이 이 날짜 기준으로 정렬·배지)
 *   ③ 그날 가장 좋은 곳 3곳 — 공식 등급 순, 지금 특보 발효 곳 제외, 고른 어종이 있으면 그 어종만
 * 앱이 점수를 지어내지 않고 국립해양조사원 등급을 세고 줄 세운다 (lib/briefing.ts).
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/app-text';

import { api } from '@/api';
import type { FishingIndexDay } from '@/api/types';
import { SpeciesImage } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayStat, speciesRanking, topSpots, weekHeadline } from '@/lib/briefing';
import { dayLabel, tideIsRef, timeLabel } from '@/lib/compare';
import type { useExplore } from '@/lib/explore';
import { goldenSpots, type Golden, type Reason } from '@/lib/golden';
import { placeName } from '@/lib/place';
import { useCriteria } from '@/lib/prefs';
import type { AppIconName } from '@/constants/icons';

import { type SpeciesItem, speciesByIndexName } from '@/lib/species';
import { AppIcon } from '@/components/app-icon';

const W = ['일', '월', '화', '수', '목', '금', '토'];

function useWeekBriefing(
  x: ReturnType<typeof useExplore>,
  dates: string[],
  date: string | undefined,
  today: string | undefined,
  /** 이 어종만 센다 (공식 지수 어종 이름). 없으면 전체 */
  species?: string | null,
) {
  const week = dates.slice(0, 7);
  // 7일치를 한 번에 받는다 (예전 날짜별 7번 요청은 서버가 깨어날 때 20~60초 밀렸다). 서버가 옛 버전이면 날짜별로
  const weekQ = useQuery({
    queryKey: ['fishing-index-week', week[0], week.length],
    queryFn: async () => {
      try {
        return await api.fishingIndexWeek(week[0], week.length);
      } catch {
        // 서버가 아직 옛 버전이면 날짜별로 하나씩 (동시에 몰리지 않게 차례로)
        const out = [];
        for (const d of week) out.push(await api.fishingIndex(d).catch(() => null));
        return out.filter((x): x is FishingIndexDay => !!x);
      }
    },
    enabled: week.length > 0,
    staleTime: 10 * 60_000,
  });
  const qs = week.map((d) => ({ data: weekQ.data?.find((x) => x.date === d), isPending: weekQ.isPending }));
  const inScopeId = useMemo(() => (id: number) => !!x.byId.get(id) && x.inScope(x.byId.get(id)!), [x]);
  const stats = week.map((d, i) => {
    const day = qs[i]?.data as FishingIndexDay | undefined;
    return day && day.points.length ? dayStat(day, inScopeId, species) : null;
  });
  const short = (d: string) => (d === today ? '오늘' : d === week[1] ? '내일' : `${W[new Date(`${d}T00:00:00`).getDay()]}요일`);
  const headline = weekHeadline(
    stats.filter((s): s is NonNullable<typeof s> => !!s),
    (d) => short(d),
  );
  const bestDate = [...stats]
    .filter((s): s is NonNullable<typeof s> => !!s && s.good > 0)
    .sort((a, b) => b.ratio - a.ratio || b.veryGood - a.veryGood)[0]?.date;
  const maxRatio = Math.max(0.01, ...stats.map((s) => s?.ratio ?? 0));
  const dayIdx = week.indexOf(date ?? '');
  const day = (dayIdx >= 0 ? qs[dayIdx]?.data : x.day) as FishingIndexDay | undefined;
  const loading = qs.some((q) => q.isPending);
  return { week, stats, short, headline, bestDate, maxRatio, day, loading, inScopeId };
}

/** ① 언제 갈까: 이번 주 날짜 막대 (날짜 고르기도 여기서) */
export function WeekCard({
  x,
  dates,
  date,
  today,
  onDate,
  species,
}: {
  x: ReturnType<typeof useExplore>;
  dates: string[];
  date: string | undefined;
  today: string | undefined;
  onDate: (d: string) => void;
  /** 이 어종 기준 막대 (null = 전체) */
  species?: SpeciesItem | null;
}) {
  const theme = useTheme();
  const { week, stats, short, headline, bestDate, maxRatio, loading } = useWeekBriefing(x, dates, date, today, species?.indexName);
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {/* 결론 한 줄이 곧 제목 (「언제 갈까」) */}
      <ThemedText type="smallBold" themeColor={headline ? 'tint' : 'textSecondary'} numberOfLines={1} accessibilityRole="header">
        {headline ?? (loading ? '공식 낚시지수를 불러오는 중이에요…' : '이 범위에는 공식 낚시지수 지점이 없어요')}
      </ThemedText>

      {/* ① 날짜 막대: 좋음 이상 비율 */}
      <View style={styles.week}>
        {week.map((d, i) => {
          const s = stats[i];
          const on = d === date;
          const best = d === bestDate;
          // 그 주 가장 좋은 날을 꽉 찬 막대로 (날짜끼리 비교가 잘 보이게)
          const h = s ? Math.max(4, Math.round(30 * (s.ratio / maxRatio))) : 4;
          const color = !s
            ? theme.border
            : s.ratio >= 0.5
              ? Brand.teal
              : s.ratio >= 0.25
                ? '#5EAAA0'
                : s.bad / Math.max(1, s.total) >= 0.6
                  ? '#E57373'
                  : '#B7C3CF';
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${dayLabel(d)}${s ? `, 공식 지수 좋음 이상 ${s.good}곳` : ', 지수 없음'}`}
              onPress={() => onDate(d)}
              style={[styles.dayCol, on && { backgroundColor: theme.background, borderColor: Brand.teal }]}>
              <View style={[styles.bestBox, { opacity: best ? 1 : 0 }]}>
                <AppIcon name="star-on" size={12} />
              </View>
              <View style={styles.barBox}>
                <View style={[styles.bar, { height: h, backgroundColor: color }]} />
              </View>
              <ThemedText type="small" themeColor={on ? 'text' : 'textSecondary'} style={on && styles.bold}>
                {short(d).replace('요일', '')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
                {s ? s.good : '–'}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * ③ 어디로 갈까: 그날 가장 좋은 곳 3곳. 어종을 골랐으면 그 어종 등급 기준, 안 골랐으면 전체.
 * 지금 특보 발효 곳은 오늘 날짜에만 뺀다
 */
export function SpotsCard({
  x,
  dates,
  date,
  today,
  species: speciesProp,
  limit,
  onOpen,
}: {
  x: ReturnType<typeof useExplore>;
  dates: string[];
  date: string | undefined;
  today: string | undefined;
  /** 이 어종 기준 (null = 전체). 안 주면 x 에서 고른 어종 */
  species?: SpeciesItem | null;
  limit?: number;
  /** 낚시터로 넘어가기 직전 (시트 안에서 쓰면 시트를 닫는다) */
  onOpen?: () => void;
}) {
  const theme = useTheme();
  const sel = speciesProp === undefined ? x.species : speciesProp;
  const { day, loading, inScopeId, stats, short, week } = useWeekBriefing(x, dates, date, today, sel?.indexName);
  const isToday = date === today;
  const opts = {
    species: sel?.indexName ?? null,
    excluded: (id: number) => isToday && x.summaryById.get(id)?.warning_level === 'warning',
    dist: x.distOf,
    limit,
  };
  const good = topSpots(day, inScopeId, opts);
  // 좋음 이상이 한 곳도 없는 날: 지어내지 않고 그대로 말한다 → 그나마 「보통」인 곳 · 이번 주 좋은 날 · 범위 넓히기
  const noGood = !loading && good.length === 0 && !(sel && !sel.indexName) && !!day?.points.length;
  const spots = noGood ? topSpots(day, inScopeId, { ...opts, minRank: 3 }) : good;
  // 이번 주 다른 날 중 좋음 이상이 가장 많은 날 (전체 기준 — 어종을 고른 시트에선 범위가 달라 생략)
  const better =
    noGood && !sel
      ? week
          .map((d, i) => ({ d, s: stats[i] }))
          .filter((v) => v.d !== date && v.s && v.s.good > 0)
          .sort((a, b) => b.s!.good - a.s!.good)[0]
      : undefined;
  const wide = noGood && !x.near && x.region !== '전국';
  return (
    <View style={[styles.listCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {/* ③ 그날 가장 좋은 곳: 한 곳에 한 줄 (이름 · 최고 등급 칩), 아래 작은 글씨로 지역·물때 */}
      {noGood ? (
        <View style={styles.noGood}>
          <ThemedText type="smallBold">
            {isToday ? '오늘' : '이날'} {x.scopeName}에는 「좋음」 이상인 곳이 없어요
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {spots.length
              ? '아래는 그나마 「보통」인 곳이에요.'
              : '모든 지점이 「나쁨」 이하예요. 무리한 출조는 쉬어 가는 것도 방법이에요.'}
          </ThemedText>
        </View>
      ) : null}
      {spots.length === 0 ? (
        noGood ? null : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            {loading
              ? '불러오는 중…'
              : sel && !sel.indexName
                ? `${sel.name}은 공식 지수가 없는 어종이에요`
                : '이날 공식 낚시지수 자료가 없어요'}
          </ThemedText>
        )
      ) : (
        spots.map((sp, i) => {
          const place = x.byId.get(sp.placeId);
          const s = x.summaryById.get(sp.placeId);
          const p0 = sp.picks[0];
          const very = p0.grade === '매우좋음';
          return (
            <Pressable
              key={sp.point.station_id}
              accessibilityRole="button"
              onPress={() => {
                onOpen?.();
                router.push({ pathname: '/place/[id]', params: { id: String(sp.placeId) } });
              }}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.rank, { color: i === 0 ? Brand.orange : theme.textSecondary }]}>{i + 1}</Text>
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {place ? placeName(place) : sp.point.station_name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {[
                    place?.region_name,
                    // 다음 만조·간조 (같은 바다 조위관측소 예보일 때만, 오늘만) — 물 돌이 전후가 입질 시간
                    isToday && s?.next_tide
                      ? `${s.next_tide.type === 'high' ? '만조' : '간조'} ${timeLabel(s.next_tide.t)}${tideIsRef(s.next_tide.station_km) ? '(참고)' : ''}`
                      : sp.tide,
                    isToday && s?.wave_fc_max ? `파고 ${s.wave_fc_max.v}m` : null,
                    sp.picks.length > 1 ? `외 ${sp.picks.length - 1}종 ${noGood ? '보통' : '좋음'}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
              <View style={[styles.pick, { backgroundColor: very ? Brand.teal : noGood ? theme.backgroundSelected : theme.tintSoft }]}>
                {speciesByIndexName(p0.species) ? <SpeciesImage code={speciesByIndexName(p0.species)!.code} size={18} /> : null}
                <Text
                  numberOfLines={1}
                  style={[styles.pickText, { flexShrink: 1, color: very ? '#FFFFFF' : noGood ? theme.textSecondary : Brand.teal }]}>
                  {sel ? p0.grade : `${p0.species} ${p0.grade}`}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
      {better || wide ? (
        <View style={styles.alts}>
          {better ? (
            <Pressable accessibilityRole="button" hitSlop={6} onPress={() => router.push('/trips')}>
              <ThemedText type="smallBold" themeColor="tint">
                {short(better.d)}에는 좋음 이상 {better.s!.good}곳 · 날짜별 보기 ›
              </ThemedText>
            </Pressable>
          ) : null}
          {wide ? (
            <Pressable accessibilityRole="button" hitSlop={6} onPress={() => x.setRegion('전국')}>
              <ThemedText type="smallBold" themeColor="tint">
                전국으로 넓혀 보기 ›
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary" style={styles.foot}>
        공식 바다낚시지수 기준{isToday ? ' · 지금 특보 발효 곳 제외' : ' · 그날 특보는 발표 전'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.8 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  week: { flexDirection: 'row', gap: 4 },
  dayCol: { flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent', paddingVertical: 2, gap: 1 },
  bestBox: { height: 14, justifyContent: 'center' },
  barBox: { height: 30, justifyContent: 'flex-end' },
  bar: { width: 20, borderRadius: 5 },
  count: { fontSize: 11, lineHeight: 14 },
  rank: { fontSize: 20, fontWeight: '800', width: 18, textAlign: 'center' },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: '52%',
  },
  pickText: { fontSize: 12, fontWeight: '700' },
  carHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  arrow: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 22, lineHeight: 24, fontWeight: '700' },
  off: { opacity: 0.35 },
  bleed: { marginHorizontal: -16 },
  carRow: { paddingHorizontal: 16, gap: 10 },
  fishCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  fishArt: { alignItems: 'center', justifyContent: 'center', height: 64 },
  fishName: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  fishFoot: { flexDirection: 'row', alignItems: 'center' },
  allCard: { alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  word: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  dist: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  listCard: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  empty: { paddingVertical: 10 },
  goldHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 4 },
  goldRow: { paddingVertical: 10, gap: 6 },
  goldTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingLeft: 28 },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  reasonText: { fontSize: 12, fontWeight: '600' },
  noGood: { paddingTop: 10, paddingBottom: 4, gap: 2 },
  alts: { gap: 8, paddingVertical: 8 },
  foot: { paddingVertical: 6, fontSize: 11 },
});
/**
 * 메인의 핵심: 오늘 어종별 공식 바다낚시지수 (2026-11-23 사용자 방향 — 「시원한 바다 + 여러 물고기의 지수」).
 * 옆으로 넘기는 카드 (한 화면에 2장, < > 화살표·스와이프). 어종마다 그림 · 대표 등급 · 등급 분포 · 좋음 이상 n/전체 곳.
 * 좋음 이상이 많은 순. 누르면 onOpen → 그 어종 오늘 시트(좋은 곳·금어기·지도·계획)
 */
export function IndexCarousel({
  x,
  onOpen,
  onAll,
}: {
  x: ReturnType<typeof useExplore>;
  onOpen: (sp: SpeciesItem) => void;
  onAll: () => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const inScopeId = useMemo(() => (id: number) => !!x.byId.get(id) && x.inScope(x.byId.get(id)!), [x]);
  const ranks = speciesRanking(x.day, inScopeId).filter((r) => speciesByIndexName(r.species));
  const GAP = 10;
  const cardW = Math.floor((width - 32 - GAP) / 2);
  const step = cardW + GAP;
  const count = ranks.length + 1; // 마지막 「전체 어종」 카드
  const pages = Math.max(1, Math.ceil(count / 2));
  const go = (p: number) => {
    const n = Math.max(0, Math.min(pages - 1, p));
    ref.current?.scrollTo({ x: n * step * 2, animated: true });
    setPage(n);
  };

  const header = (
    <View style={styles.carHead}>
      <ThemedText type="sectionTitle" style={styles.flex} numberOfLines={1}>
        오늘 어종별 낚시지수
      </ThemedText>
      {ranks.length ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {page + 1}/{pages}
          </ThemedText>
          {(
            [
              ['arrow-left', -1, '이전 어종'],
              ['arrow-right', 1, '다음 어종'],
            ] as const
          ).map(([t, d, label]) => {
            const off = d < 0 ? page === 0 : page >= pages - 1;
            return (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ disabled: off }}
                disabled={off}
                hitSlop={6}
                onPress={() => go(page + d)}
                style={({ pressed }) => [
                  styles.arrow,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  off && styles.off,
                  pressed && styles.pressed,
                ]}>
                <AppIcon name={t} size={14} />
              </Pressable>
            );
          })}
        </>
      ) : null}
    </View>
  );

  if (x.fi.isError) {
    // 받지 못한 것과 「지점이 없음」을 구분한다 (출시 빌드 첫 실행에서 시간 초과가 「지점 없음」으로 보였다)
    return (
      <>
        {header}
        <Pressable accessibilityRole="button" onPress={() => x.fi.refetch()} hitSlop={6}>
          <ThemedText type="small" themeColor="textSecondary">
            오늘 공식 낚시지수를 불러오지 못했어요.{' '}
            <ThemedText type="smallBold" themeColor="tint">
              다시 시도 ›
            </ThemedText>
          </ThemedText>
        </Pressable>
      </>
    );
  }
  if (x.fi.isPending || !ranks.length) {
    return (
      <>
        {header}
        <ThemedText type="small" themeColor="textSecondary">
          {x.fi.isPending
            ? '오늘 공식 낚시지수를 불러오는 중이에요…'
            : `${x.scopeName}에는 오늘 공식 낚시지수 지점이 없어요. 지역을 넓혀 보세요.`}
        </ThemedText>
      </>
    );
  }
  return (
    <>
      {header}
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step * 2}
        decelerationRate="fast"
        style={styles.bleed}
        contentContainerStyle={styles.carRow}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (step * 2)))}>
        {ranks.map((r) => {
          const sp = speciesByIndexName(r.species)!;
          const ratio = r.total ? r.good / r.total : 0;
          const word =
            r.veryGood > 0 && ratio >= 0.5 ? '매우좋음' : ratio >= 0.4 ? '좋음' : r.total && r.bad / r.total >= 0.5 ? '나쁨' : '보통';
          const tone = word === '매우좋음' ? Brand.teal : word === '좋음' ? '#2E8B7A' : word === '나쁨' ? '#D9534F' : '#7A8794';
          const mid = r.total - r.good - r.bad;
          return (
            <Pressable
              key={r.species}
              accessibilityRole="button"
              accessibilityLabel={`${r.species}, 오늘 ${word}, 좋음 이상 ${r.good}곳 / ${r.total}곳. 좋은 낚시터 보기`}
              onPress={() => onOpen(sp)}
              style={({ pressed }) => [
                styles.fishCard,
                { width: cardW, backgroundColor: theme.backgroundElement, borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <View style={styles.fishArt}>
                <SpeciesImage code={sp.code} size={84} />
              </View>
              <View style={styles.fishName}>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
                  {r.species}
                </ThemedText>
                <Text style={[styles.word, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {word}
                </Text>
              </View>
              {/* 등급 분포: 좋음 이상 · 보통 · 나쁨 이하 */}
              <View style={[styles.dist, { backgroundColor: theme.border }]}>
                <View style={{ flex: r.good, backgroundColor: Brand.teal }} />
                <View style={{ flex: mid, backgroundColor: '#B7C3CF' }} />
                <View style={{ flex: r.bad, backgroundColor: '#E57373' }} />
              </View>
              <View style={styles.fishFoot}>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
                  좋음 이상 {r.good}/{r.total}곳
                </ThemedText>
                <ThemedText type="smallBold" themeColor="tint">
                  ›
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={onAll}
          style={({ pressed }) => [
            styles.fishCard,
            styles.allCard,
            { width: cardW, backgroundColor: theme.tintSoft, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold" themeColor="tint">
            전체 어종 보기 ›
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            공식 지수 없는 어종도{'\n'}제철·금어기를 볼 수 있어요
          </ThemedText>
        </Pressable>
      </ScrollView>
    </>
  );
}

/**
 * 오늘의 황금 포인트 (홈 「어디로 갈까」, 2026-11-23): 공식 등급 + 특보 없음 + 내 파고·풍속 기준 안에서,
 * 확인 가능한 ✓(파도 잔잔·물 돌이가 해 뜰·질 무렵)가 많은 순. 이유를 칩으로 보여준다 (lib/golden).
 * 좋음 이상이 아예 없으면 SpotsCard 의 안내(보통인 곳·좋은 날·전국)로 넘긴다
 */
const REASON_ICON: Record<Reason['key'], AppIconName> = {
  calm: 'wave',
  wave: 'wave',
  tide: 'tide',
  temp: 'water-temp',
  when: 'star-on',
  over: 'wind',
  heat: 'water-temp',
};

export function GoldenCard({ x, dates, today }: { x: ReturnType<typeof useExplore>; dates: string[]; today: string | undefined }) {
  const theme = useTheme();
  const [criteria] = useCriteria();
  const { day, loading, inScopeId } = useWeekBriefing(x, dates, today, today);
  const good = topSpots(day, inScopeId, { dist: x.distOf, limit: 60 });
  if (!loading && good.length === 0) return <SpotsCard x={x} dates={dates} date={today} today={today} species={null} />;
  const gold = goldenSpots(good, (id) => x.summaryById.get(id), criteria, { today: true, limit: 3 });
  return (
    <View style={[styles.listCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.goldHead}>
        <AppIcon name="best" size={22} />
        <ThemedText type="smallBold" style={styles.flex}>
          오늘의 황금 포인트
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          내 기준 파고 {criteria.maxWave}m · 바람 {criteria.maxWind}m/s
        </ThemedText>
      </View>
      {loading ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          불러오는 중…
        </ThemedText>
      ) : gold.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          「좋음」 이상인 곳이 모두 지금 해상 특보 중이에요. 출조를 미루는 걸 권해요.
        </ThemedText>
      ) : (
        <>
          {gold.every((g) => g.over) ? (
            <ThemedText type="small" themeColor="warning">
              오늘은 내 기준을 넘는 곳뿐이에요. 등급이 좋은 곳을 참고로 보여드려요 — 현장 바다 상태를 꼭 확인하세요.
            </ThemedText>
          ) : null}
          {gold.map((g, i) => (
            <GoldenRow key={g.point.station_id} g={g} i={i} x={x} />
          ))}
        </>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.foot}>
        공식 바다낚시지수 등급 순 · 같은 등급이면 ✓ 많은 곳 · 수온은 참고(판단에 쓰지 않음)
      </ThemedText>
    </View>
  );
}

function GoldenRow({ g, i, x }: { g: Golden; i: number; x: ReturnType<typeof useExplore> }) {
  const theme = useTheme();
  const place = x.byId.get(g.placeId);
  const p0 = g.picks[0];
  const very = p0.grade === '매우좋음';
  const sp = speciesByIndexName(p0.species);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(g.placeId) } })}
      style={({ pressed }) => [
        styles.goldRow,
        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.goldTop}>
        <Text style={[styles.rank, { color: i === 0 ? Brand.orange : theme.textSecondary }]}>{i + 1}</Text>
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {place ? placeName(place) : g.point.station_name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {[place?.region_name, g.picks.length > 1 ? `외 ${g.picks.length - 1}종 좋음` : null].filter(Boolean).join(' · ')}
          </ThemedText>
        </View>
        <View style={[styles.pick, { backgroundColor: very ? Brand.teal : theme.tintSoft }]}>
          {sp ? <SpeciesImage code={sp.code} size={18} /> : null}
          <Text numberOfLines={1} style={[styles.pickText, { flexShrink: 1, color: very ? '#FFFFFF' : Brand.teal }]}>
            {p0.species} {p0.grade}
          </Text>
        </View>
      </View>
      {g.reasons.length ? (
        <View style={styles.reasons}>
          {g.reasons.map((r) => {
            const over = r.key === 'over';
            return (
              <View
                key={r.key}
                style={[
                  styles.reason,
                  {
                    backgroundColor: r.check ? theme.tintSoft : over || r.key === 'heat' ? theme.warningSoft : theme.background,
                    borderColor: theme.border,
                  },
                ]}>
                <AppIcon name={REASON_ICON[r.key]} size={14} />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.reasonText,
                    { color: r.check ? Brand.teal : over || r.key === 'heat' ? theme.warning : theme.textSecondary },
                  ]}>
                  {r.check ? '✓ ' : over ? '⚠ ' : ''}
                  {r.text}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Pressable>
  );
}
