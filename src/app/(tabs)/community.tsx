import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePlaces, usePosts, useSpecies } from '@/api/queries';
import type { PostCategory } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { PostCard } from '@/components/post-card';
import { EmptyView, ErrorView, Loading, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { CATEGORY } from '@/lib/community';
import { sidoOf } from '@/lib/place';

type Sort = 'popular' | 'latest';
type CatFilter = PostCategory | 'all';

const FILTER_OPTIONS: DropdownOption<CatFilter>[] = [
  { value: 'all', label: '전체 글', icon: 'cat-all' },
  ...(Object.keys(CATEGORY) as PostCategory[]).map((k) => ({
    value: k as CatFilter,
    label: CATEGORY[k].label,
    icon: CATEGORY[k].icon,
  })),
];

// 커뮤니티 (재설계 v2 §7): [카테고리 ▾] [최신 · 인기] 한 줄 + 글 목록 + 글쓰기
export default function CommunityScreen() {
  const theme = useTheme();
  // 홈 「시즌별 어종과 낚시 팁」 등에서 카테고리를 지정해 들어올 수 있다: /community?category=tip
  const paramCat = useLocalSearchParams<{ category?: string }>().category;
  const [filter, setFilter] = useState<CatFilter>('all');
  const [lastParam, setLastParam] = useState<string | undefined>(undefined);
  if (paramCat !== lastParam) {
    setLastParam(paramCat);
    if (paramCat && FILTER_OPTIONS.some((o) => o.value === paramCat)) setFilter(paramCat as CatFilter);
  }
  const [sort, setSort] = useState<Sort>('latest');
  const [sido, setSido] = useState<string>('all');
  const [speciesCode, setSpeciesCode] = useState<string>('all');
  const category = filter === 'all' ? null : filter;
  const posts = usePosts(category, sort, {
    sido: sido === 'all' ? null : sido,
    species: speciesCode === 'all' ? null : speciesCode,
  });
  const { signedIn } = useAuth();
  const places = usePlaces();
  const species = useSpecies();

  // 지역 선택지: 낚시터가 많은 시·도 순
  const sidoOptions = useMemo<DropdownOption<string>[]>(() => {
    const counts = new Map<string, number>();
    for (const p of places.data ?? []) counts.set(sidoOf(p), (counts.get(sidoOf(p)) ?? 0) + 1);
    return [
      { value: 'all', label: '전체 지역' },
      ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => ({ value: s, label: s })),
    ];
  }, [places.data]);
  const speciesOptions = useMemo<DropdownOption<string>[]>(
    () => [
      { value: 'all', label: '전체 어종' },
      ...(species.data ?? []).map((sp) => ({ value: sp.code, label: sp.name_ko.replace(/\(.*\)/, '') })),
    ],
    [species.data],
  );
  const filtered = sido !== 'all' || speciesCode !== 'all';

  return (
    <View style={styles.flex}>
      <TabScreen title="커뮤니티">
        <View style={styles.filters}>
          <Dropdown label="카테고리" value={filter} options={FILTER_OPTIONS} onChange={setFilter} compact />
          <Dropdown label="지역" value={sido} options={sidoOptions} onChange={setSido} compact />
          <Dropdown label="어종" value={speciesCode} options={speciesOptions} onChange={setSpeciesCode} compact />
        </View>
        <View style={styles.toolbar}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {posts.isSuccess ? `글 ${posts.data.length}개` : ''}
            {filtered ? ' · 필터 적용 중' : ''}
          </ThemedText>
          {filtered ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setSido('all');
                setSpeciesCode('all');
              }}>
              <ThemedText type="smallBold" themeColor="tint">
                필터 해제
              </ThemedText>
            </Pressable>
          ) : null}
          <View style={[styles.segment, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            {(
              [
                ['latest', '최신'],
                ['popular', '인기'],
              ] as const
            ).map(([key, label]) => {
              const on = sort === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setSort(key)}
                  style={[styles.segItem, on && { backgroundColor: Brand.navy }]}>
                  <ThemedText type="smallBold" style={on ? { color: Brand.onNavy } : undefined} themeColor="textSecondary">
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {posts.isPending && <Loading />}
        {posts.isError && <ErrorView message={posts.error.message} onRetry={() => posts.refetch()} />}
        {posts.isSuccess &&
          (posts.data.length === 0 ? (
            <EmptyView
              message={
                sort === 'popular'
                  ? '최근 30일 인기글이 없어요.'
                  : filtered
                    ? '조건에 맞는 글이 없어요. 지역·어종 필터를 바꿔 보세요.'
                    : category
                      ? `${CATEGORY[category].label} 글이 아직 없어요.`
                      : '아직 글이 없어요. 첫 글을 남겨보세요!'
              }
            />
          ) : (
            posts.data.map((p) => (
              <Link key={p.id} href={{ pathname: '/community/[id]', params: { id: String(p.id) } }} asChild>
                <Pressable accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
                  <PostCard p={p} />
                </Pressable>
              </Link>
            ))
          ))}
        <View style={styles.fabSpace} />
      </TabScreen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="글쓰기"
        onPress={() => router.push(signedIn ? '/community/new' : '/login')}
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}>
        <AppIcon name="comment" size={20} badge />
        <ThemedText type="smallBold" style={styles.fabText}>
          글쓰기
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 3, borderWidth: StyleSheet.hairlineWidth },
  segItem: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999 },
  fabSpace: { height: 56 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.orange,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: '#fff' },
});
