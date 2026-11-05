import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useConditions, useDateRange, usePlaces } from '@/api/queries';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Chip } from '@/components/form';
import { PlacePicker } from '@/components/place-picker';
import { Card, Loading, TabScreen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { SeaSummaryCard } from '@/components/sea-summary-card';
import { ThemedText } from '@/components/themed-text';
import { matches, PLACE_IMAGE, PLACE_TYPE_LABEL, sidoOf } from '@/lib/place';
import { useHomePlace } from '@/lib/prefs';

// SCR-01 홈 (재설계 v2 §4): 첫 실행이면 지역·낚시터 선택, 아니면 기준 낚시터 요약 카드 한 장.
// 상세(실측·예보 표, 물때, 지수 어종별, 자료 출처, 가까운 낚시터)는 /place/[id] 상세 해황 화면에서 본다.
export default function HomeScreen() {
  const places = usePlaces();
  const range = useDateRange();
  const [homeId, setHomeId, homeLoaded] = useHomePlace();
  const [picker, setPicker] = useState<{ open: boolean; sido: string | null }>({ open: false, sido: null });

  // 링크로 낚시터를 지정해 열 수 있다: /?place=147
  const linkPlace = useLocalSearchParams<{ place?: string }>().place;
  useEffect(() => {
    const id = Number(linkPlace);
    if (linkPlace && homeLoaded && places.data?.some((p) => p.id === id) && id !== homeId) setHomeId(id);
  }, [linkPlace, homeLoaded, places.data, homeId, setHomeId]);

  // 저장된 기준이 없거나 지원하지 않는 장소면 임의로 고르지 않고 선택을 안내 (P0-2)
  const place = places.data?.find((p) => p.id === homeId) ?? null;
  const today = range.data?.today;
  const cond = useConditions(place?.id ?? null, today);

  const choose = (p: Place) => {
    setHomeId(p.id);
    Keyboard.dismiss();
  };

  return (
    <TabScreen title="입질예보" logo>
      {!homeLoaded || places.isPending ? <Loading /> : null}

      {homeLoaded && places.isSuccess && !place ? (
        <FirstRun places={places.data} onChoose={choose} onBrowse={(sido) => setPicker({ open: true, sido })} />
      ) : null}

      {place ? (
        <SeaSummaryCard
          place={place}
          pc={cond.data?.place}
          generatedAt={cond.data?.generated_at}
          today={today}
          loading={cond.isPending}
          error={cond.isError ? { message: cond.error.message, retry: () => cond.refetch() } : null}
          onChangePlace={() => setPicker({ open: true, sido: null })}
          onDetail={() => router.push({ pathname: '/place/[id]', params: { id: String(place.id) } })}
          onCompare={() => router.push({ pathname: '/compare', params: { a: String(place.id) } })}
        />
      ) : null}

      <PlacePicker
        visible={picker.open}
        title="기준 낚시터 선택"
        selectedId={place?.id}
        initialSido={picker.sido}
        onSelect={choose}
        onClose={() => setPicker({ open: false, sido: null })}
      />
    </TabScreen>
  );
}

/** 첫 실행: 질문 + 검색 + 지역 칩을 한 화면에 (단계를 나누지 않음) */
function FirstRun({
  places,
  onChoose,
  onBrowse,
}: {
  places: Place[];
  onChoose: (p: Place) => void;
  onBrowse: (sido: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const results = query.trim() ? places.filter((p) => matches(p, query)).slice(0, 6) : [];
  const sidos = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of places) counts.set(sidoOf(p), (counts.get(sidoOf(p)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [places]);

  return (
    <Card style={styles.firstRun}>
      <ThemedText type="sectionTitle">어느 바다로 나가실 계획인가요?</ThemedText>
      <ThemedText themeColor="textSecondary">
        낚시터를 하나 고르면 그곳 기준으로 특보·파고·바람·물때를 보여드려요. 나중에 언제든 바꿀 수 있어요.
      </ThemedText>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        placeholder="낚시터·지역 검색 (예: 태안, 대천)"
      />
      {query.trim() ? (
        results.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            맞는 낚시터가 없어요. 아래 지역에서 찾아보세요.
          </ThemedText>
        ) : (
          results.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => onChoose(p)}
              style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
              <AppIcon name={PLACE_IMAGE[p.type]} size={28} />
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {p.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {p.region_name} · {PLACE_TYPE_LABEL[p.type]}
                </ThemedText>
              </View>
            </Pressable>
          ))
        )
      ) : null}
      <ThemedText type="smallBold" themeColor="textSecondary">
        지역으로 찾기
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {sidos.map(([s, n]) => (
          <Chip key={s} label={`${s} ${n}`} selected={false} onPress={() => onBrowse(s)} />
        ))}
        <Chip label="전체 보기" selected={false} onPress={() => onBrowse(null)} />
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  firstRun: { gap: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  chips: { gap: 8 },
});
