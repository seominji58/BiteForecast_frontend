/**
 * 홈 「이번 주 낚시 브리핑」 (2026-11-23). 사용자의 결정 순서 「언제 → 무엇 → 어디」대로:
 *   ① 이번 주 날짜 막대 — 날마다 공식 지수 「좋음 이상」 비율, 가장 좋은 날 강조. 누르면 그 날짜로
 *   ② (어종 순위는 홈 어종 카드 줄이 이 날짜 기준으로 정렬·배지)
 *   ③ 그날 가장 좋은 곳 3곳 — 공식 등급 순, 지금 특보 발효 곳 제외, 고른 어종이 있으면 그 어종만
 * 앱이 점수를 지어내지 않고 국립해양조사원 등급을 세고 줄 세운다 (lib/briefing.ts).
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import type { FishingIndexDay } from '@/api/types';
import { SpeciesImage } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayStat, speciesRanking, topSpots, weekHeadline } from '@/lib/briefing';
import { dayLabel } from '@/lib/compare';
import type { useExplore } from '@/lib/explore';
import { placeName } from '@/lib/place';
import { speciesByIndexName } from '@/lib/species';

const W = ['일', '월', '화', '수', '목', '금', '토'];

export function useWeekBriefing(x: ReturnType<typeof useExplore>, dates: string[], date: string | undefined, today: string | undefined) {
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
    return day && day.points.length ? dayStat(day, inScopeId) : null;
  });
  const short = (d: string) => (d === today ? '오늘' : d === week[1] ? '내일' : `${W[new Date(`${d}T00:00:00`).getDay()]}요일`);
  const headline = weekHeadline(stats.filter((s): s is NonNullable<typeof s> => !!s), (d) => short(d));
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
}: {
  x: ReturnType<typeof useExplore>;
  dates: string[];
  date: string | undefined;
  today: string | undefined;
  onDate: (d: string) => void;
}) {
  const theme = useTheme();
  const { week, stats, short, headline, bestDate, maxRatio, loading } = useWeekBriefing(x, dates, date, today);
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
          const color = !s ? theme.border : s.ratio >= 0.5 ? Brand.teal : s.ratio >= 0.25 ? '#5EAAA0' : s.bad / Math.max(1, s.total) >= 0.6 ? '#E57373' : '#B7C3CF';
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${dayLabel(d)}${s ? `, 공식 지수 좋음 이상 ${s.good}곳` : ', 지수 없음'}`}
              onPress={() => onDate(d)}
              style={[styles.dayCol, on && { backgroundColor: theme.background, borderColor: Brand.teal }]}>
              <Text style={[styles.best, { opacity: best ? 1 : 0 }]}>★</Text>
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
}: {
  x: ReturnType<typeof useExplore>;
  dates: string[];
  date: string | undefined;
  today: string | undefined;
}) {
  const theme = useTheme();
  const { day, loading, inScopeId } = useWeekBriefing(x, dates, date, today);
  const isToday = date === today;
  const spots = topSpots(day, inScopeId, {
    species: x.species?.indexName ?? null,
    excluded: (id) => isToday && x.summaryById.get(id)?.warning_level === 'warning',
    dist: x.distOf,
  });
  return (
    <View style={[styles.listCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {/* ③ 그날 가장 좋은 곳: 한 곳에 한 줄 (이름 · 최고 등급 칩), 아래 작은 글씨로 지역·물때 */}
      {spots.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          {loading ? '불러오는 중…' : x.species && !x.species.indexName ? `${x.species.name}은 공식 지수가 없는 어종이에요` : '이날 「좋음」 이상인 곳이 없어요'}
        </ThemedText>
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
              onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(sp.placeId) } })}
              style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border }, pressed && styles.pressed]}>
              <Text style={[styles.rank, { color: i === 0 ? Brand.orange : theme.textSecondary }]}>{i + 1}</Text>
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {place ? placeName(place) : sp.point.station_name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {[place?.region_name, sp.tide, isToday && s?.wave_fc_max ? `파고 ${s.wave_fc_max.v}m` : null, sp.picks.length > 1 ? `외 ${sp.picks.length - 1}종 좋음` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
              <View style={[styles.pick, { backgroundColor: very ? Brand.teal : theme.tintSoft }]}>
                {speciesByIndexName(p0.species) ? <SpeciesImage code={speciesByIndexName(p0.species)!.code} size={18} /> : null}
                <Text style={[styles.pickText, { color: very ? '#FFFFFF' : Brand.teal }]}>
                  {x.species ? p0.grade : `${p0.species} ${p0.grade}`}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
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
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  week: { flexDirection: 'row', gap: 4 },
  dayCol: { flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent', paddingVertical: 2, gap: 1 },
  best: { color: Brand.orange, fontSize: 12, lineHeight: 14 },
  barBox: { height: 30, justifyContent: 'flex-end' },
  bar: { width: 20, borderRadius: 5 },
  count: { fontSize: 11, lineHeight: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  spot: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  rank: { fontSize: 20, fontWeight: '800', width: 18, textAlign: 'center' },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pickText: { fontSize: 12, fontWeight: '700' },
  more: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fishCard: { width: '48.5%', borderWidth: 1.5, borderRadius: 14, padding: 10, gap: 6 },
  fishCardOn: { borderWidth: 2.5 },
  fishTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  dist: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  listCard: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  empty: { paddingVertical: 10 },
  foot: { paddingVertical: 6, fontSize: 11 },
});
/**
 * 메인의 핵심: 오늘 어종별 공식 바다낚시지수 (2026-11-23 사용자 방향 — 「시원한 바다 + 여러 물고기의 지수」).
 * 어종마다 그림 · 그날 대표 등급(좋음 이상 비율로) · 좋음 이상 n/전체 곳 · 등급 분포 막대.
 * 좋음 이상이 많은 순. 누르면 그 어종을 고르고 아래 「어디로 갈까」가 그 어종 기준으로 바뀐다
 */
export function IndexGrid({
  x,
  selected,
  onSelect,
}: {
  x: ReturnType<typeof useExplore>;
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const theme = useTheme();
  const inScopeId = useMemo(() => (id: number) => !!x.byId.get(id) && x.inScope(x.byId.get(id)!), [x]);
  const ranks = speciesRanking(x.day, inScopeId);
  if (x.fi.isPending) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        오늘 공식 낚시지수를 불러오는 중이에요…
      </ThemedText>
    );
  }
  if (!ranks.length) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {x.scopeName}에는 오늘 공식 낚시지수 지점이 없어요. 지역을 넓혀 보세요.
      </ThemedText>
    );
  }
  return (
    <View style={styles.grid}>
      {ranks.map((r) => {
        const sp = speciesByIndexName(r.species);
        const ratio = r.total ? r.good / r.total : 0;
        const word = r.veryGood > 0 && ratio >= 0.5 ? '매우좋음' : ratio >= 0.4 ? '좋음' : r.total && r.bad / r.total >= 0.5 ? '나쁨' : '보통';
        const tone = word === '매우좋음' ? Brand.teal : word === '좋음' ? '#2E8B7A' : word === '나쁨' ? '#D9534F' : '#7A8794';
        const on = !!sp && sp.code === selected;
        const mid = r.total - r.good - r.bad;
        return (
          <Pressable
            key={r.species}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${r.species}, 오늘 ${word}, 좋음 이상 ${r.good}곳 / ${r.total}곳`}
            onPress={() => sp && onSelect(on ? null : sp.code)}
            style={({ pressed }) => [
              styles.fishCard,
              { backgroundColor: theme.backgroundElement, borderColor: on ? Brand.orange : theme.border },
              on && styles.fishCardOn,
              pressed && styles.pressed,
            ]}>
            <View style={styles.fishTop}>
              {sp ? <SpeciesImage code={sp.code} size={52} /> : null}
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {r.species}
                </ThemedText>
                <Text style={[styles.word, { color: tone }]}>{word}</Text>
              </View>
            </View>
            {/* 등급 분포: 좋음 이상 · 보통 · 나쁨 이하 */}
            <View style={[styles.dist, { backgroundColor: theme.border }]}>
              <View style={{ flex: r.good, backgroundColor: Brand.teal }} />
              <View style={{ flex: mid, backgroundColor: '#B7C3CF' }} />
              <View style={{ flex: r.bad, backgroundColor: '#E57373' }} />
            </View>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              좋음 이상 {r.good}/{r.total}곳
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
