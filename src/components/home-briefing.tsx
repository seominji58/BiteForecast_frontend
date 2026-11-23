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
import { dayStat, topSpots, weekHeadline } from '@/lib/briefing';
import { dayLabel } from '@/lib/compare';
import type { useExplore } from '@/lib/explore';
import { PLACE_TYPE_LABEL, placeName } from '@/lib/place';
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
      <View style={styles.head}>
        <ThemedText type="sectionTitle">언제 갈까</ThemedText>
      </View>
      <ThemedText type="smallBold" themeColor={headline ? 'tint' : 'textSecondary'}>
        {headline ?? (loading ? '공식 낚시지수를 불러오는 중이에요…' : '이 범위에는 공식 낚시지수 지점이 없어요')}
      </ThemedText>

      {/* ① 날짜 막대: 좋음 이상 비율 */}
      <View style={styles.week}>
        {week.map((d, i) => {
          const s = stats[i];
          const on = d === date;
          const best = d === bestDate;
          // 그 주 가장 좋은 날을 꽉 찬 막대로 (날짜끼리 비교가 잘 보이게)
          const h = s ? Math.max(4, Math.round(44 * (s.ratio / maxRatio))) : 4;
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
      <ThemedText type="small" themeColor="textSecondary">
        숫자 = 공식 지수 「좋음」 이상 개수 · ★ 가장 좋은 날
      </ThemedText>

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
    <View style={styles.list}>
      {/* ③ 그날 가장 좋은 곳 */}
      {spots.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {loading ? '불러오는 중…' : x.species && !x.species.indexName ? `${x.species.name}은 공식 지수가 없는 어종이에요` : '이날 「좋음」 이상인 곳이 없어요'}
        </ThemedText>
      ) : (
        spots.map((sp, i) => {
          const place = x.byId.get(sp.placeId);
          const s = x.summaryById.get(sp.placeId);
          return (
            <Pressable
              key={sp.point.station_id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(sp.placeId) } })}
              style={({ pressed }) => [styles.spot, { borderColor: theme.border, backgroundColor: theme.background }, pressed && styles.pressed]}>
              <Text style={[styles.rank, { color: i === 0 ? Brand.orange : theme.textSecondary }]}>{i + 1}</Text>
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {place ? placeName(place) : sp.point.station_name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {[place?.region_name, place ? PLACE_TYPE_LABEL[place.type] : null, sp.tide, isToday && s?.wave_fc_max ? `파고 최대 ${s.wave_fc_max.v}m` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
                <View style={styles.picks}>
                  {sp.picks.slice(0, 3).map((p) => (
                    <View key={p.species} style={[styles.pick, { backgroundColor: p.grade === '매우좋음' ? Brand.teal : theme.tintSoft }]}>
                      {speciesByIndexName(p.species) ? <SpeciesImage code={speciesByIndexName(p.species)!.code} size={18} /> : null}
                      <Text style={[styles.pickText, { color: p.grade === '매우좋음' ? '#FFFFFF' : Brand.teal }]}>
                        {p.species} {p.grade}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
          );
        })
      )}
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/points', params: date ? { date } : {} })} style={styles.more}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          국립해양조사원 바다낚시지수 기준{isToday ? ' · 지금 특보 발효 곳 제외' : ' · 그날 특보는 발표 전'}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="tint">
          더 보기 ›
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  week: { flexDirection: 'row', gap: 4 },
  dayCol: { flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent', paddingVertical: 4, gap: 2 },
  best: { color: Brand.orange, fontSize: 12, lineHeight: 14 },
  barBox: { height: 44, justifyContent: 'flex-end' },
  bar: { width: 20, borderRadius: 5 },
  count: { fontSize: 11, lineHeight: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  spot: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  rank: { fontSize: 20, fontWeight: '800', width: 18, textAlign: 'center' },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pickText: { fontSize: 12, fontWeight: '700' },
  more: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  list: { gap: 8 },
});