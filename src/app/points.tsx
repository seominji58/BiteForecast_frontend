/**
 * 포인트 보기 (홈 「오늘의 낚시 정보 미리보기 › 포인트 보기」).
 * 홈에서 고른 어종·지역·날짜 그대로. 앱이 순위 점수를 만들지 않는다.
 * - 공식 지수 어종: [공식 지수 지점] / [근처 일반 낚시터 · 참고]
 * - 어종 상관없음·공식 지수 없는 어종: 일반 낚시터 (가까운 순 또는 자료 연결 많은 곳 → 이름순)
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useDateRange, usePosts } from '@/api/queries';
import { GeneralResults, IndexResults, methodOk, METHODS, NoIndexNotice, sortGeneral } from '@/components/home-explore';
import { Loading, StackScreen } from '@/components/screen';
import { SpeciesImage } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel } from '@/lib/compare';
import { freshnessLine } from '@/lib/criteria';
import { useExplore } from '@/lib/explore';

export default function PointsScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const range = useDateRange();
  const today = range.data?.today;
  const date = params.date ?? today;
  const x = useExplore(date, today);
  const [method, setMethod] = useState('all');
  const [periodSel, setPeriod] = useState<string | null>(null);
  const period = periodSel && x.periods.includes(periodSel) ? periodSel : (x.periods[0] ?? '');
  const scope = useMemo(() => (p: Parameters<typeof x.inScope>[0]) => methodOk(method, p) && x.inScope(p), [method, x.inScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const general = useMemo(
    () => sortGeneral(x.scoped.filter((s) => methodOk(method, x.byId.get(s.place_id)!)), x.byId, (s) => x.distOf(s.place_id)),
    [x.scoped, method, x.byId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const catches = usePosts('catch', 'latest', { species: x.species ? (x.species.speciesCode ?? x.species.name) : null });
  const dateText = date ? dayLabel(date) : '';
  const plan = (placeId: number) =>
    router.push({ pathname: '/trip/new', params: { place: String(placeId), ...(date ? { date } : {}), ...(x.species ? { species: x.species.code } : {}) } });

  if (!date || x.places.isPending || x.summary.isPending) return <Loading />;
  const indexed = !!x.species?.indexName;
  return (
    <StackScreen>
      <Stack.Screen options={{ title: x.species ? `${x.species.name} 포인트` : '포인트 보기' }} />
      <View style={styles.head}>
        {x.species ? <SpeciesImage code={x.species.code} size={48} /> : null}
        <View style={styles.flex}>
          <ThemedText type="smallBold">
            {x.species ? x.species.name : '어종 상관없음'} · {x.scopeName} · {dateText}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            어종·지역·날짜는 홈에서 바꿀 수 있어요
          </ThemedText>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {indexed && x.periods.length > 1
          ? x.periods.map((p) => <Chip key={p} label={p} on={p === period} accent onPress={() => setPeriod(p)} />)
          : null}
        {METHODS.map((m) => (
          <Chip key={m.key} label={m.label} on={method === m.key} onPress={() => setMethod(m.key)} />
        ))}
      </ScrollView>

      {x.near && x.gps.loading ? (
        <ThemedText themeColor="textSecondary">현재 위치를 확인하는 중이에요…</ThemedText>
      ) : x.near && x.gps.error ? (
        <ThemedText themeColor="warning">{x.gps.error} 홈에서 다른 지역을 골라 주세요.</ThemedText>
      ) : indexed ? (
        x.fi.isPending ? (
          <Loading />
        ) : !x.day || x.day.points.length === 0 ? (
          <ThemedText themeColor="textSecondary">{dateText} {x.species!.name} 공식 지수는 아직 발표 전이에요.</ThemedText>
        ) : (
          <IndexResults
            species={x.species!}
            day={x.day}
            scope={scope}
            byId={x.byId}
            summaryById={x.summaryById}
            dist={x.distOf}
            period={period}
            pending={x.pending}
            future={x.future}
            scopeName={x.scopeName}
            onPlan={plan}
            onMore={() => router.push('/explore')}
          />
        )
      ) : (
        <View style={styles.col}>
          {x.species ? (
            <NoIndexNotice
              species={x.species}
              catchCount={catches.data?.length ?? null}
              scopeName={x.scopeName}
              onCatches={() => router.push((catches.data?.length ?? 0) === 0 ? '/community/new' : '/community')}
            />
          ) : null}
          <GeneralResults
            list={general}
            byId={x.byId}
            dist={(s) => x.distOf(s.place_id)}
            pending={x.pending}
            future={x.future}
            sortLabel={x.near && x.gps.coords ? '가까운 순' : '자료가 많이 연결된 곳 먼저 · 이름순'}
            onPlan={plan}
            onMore={() => router.push('/explore')}
          />
        </View>
      )}
      {x.summary.isSuccess ? (
        <ThemedText type="small" themeColor={x.summary.data.data_status.stale ? 'warning' : 'textSecondary'}>
          {freshnessLine(x.summary.data.data_status)}
          {x.future ? ' · 특보는 지금 발효 상태 기준' : ''}
        </ThemedText>
      ) : null}
    </StackScreen>
  );
}

function Chip({ label, on, onPress, accent }: { label: string; on: boolean; onPress: () => void; accent?: boolean }) {
  const theme = useTheme();
  const bg = on ? (accent ? Brand.orange : theme.tint) : theme.backgroundElement;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: bg, borderColor: on ? bg : theme.border }, pressed && styles.pressed]}>
      <ThemedText type="small" style={[styles.bold, { color: on ? '#fff' : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  col: { gap: 8 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.75 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { gap: 6, paddingRight: 16 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
