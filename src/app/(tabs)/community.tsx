import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { usePlaces, usePostPages, useSpecies } from '@/api/queries';
import type { PostCategory } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { PostCard } from '@/components/post-card';
import { Button } from '@/components/form';
import { OptionSheet } from '@/components/option-sheet';
import { ErrorView, Loading, TabScreen } from '@/components/screen';
import { UiIcon } from '@/components/ui-icon';
import type { AppIconName } from '@/constants/icons';
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

const CAT_TABS: { value: CatFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'catch', label: '조황' },
  { value: 'question', label: '질문' },
  { value: 'tip', label: '정보·팁' },
  { value: 'free', label: '자유' },
];

/**
 * 커뮤니티 (2026-11-17 레퍼런스): [카테고리 탭] → [지역·어종 필터 ▾ · 최신순 ▾] → 글 카드 → 글쓰기(둥근 버튼).
 * 처음에는 전체 글(관심 어종·지역을 자동으로 걸지 않는다). 필터를 고르면 그 조건만, 초기화로 전체.
 * 빈 화면을 구분: 글이 아예 없음 / 필터 결과 없음 / 인기글 없음 — 가짜 글은 만들지 않는다.
 * 다른 화면에서 ?category=tip 으로 카테고리를 정해 들어올 수 있다.
 */
export default function CommunityScreen() {
  const theme = useTheme();
  const paramCat = useLocalSearchParams<{ category?: string }>().category;
  const [filter, setFilter] = useState<CatFilter>('all');
  const [lastParam, setLastParam] = useState<string | undefined>(undefined);
  if (paramCat !== lastParam) {
    setLastParam(paramCat);
    if (paramCat && FILTER_OPTIONS.some((o) => o.value === paramCat)) setFilter(paramCat as CatFilter);
  }
  const [sort, setSort] = useState<Sort>('latest');
  const [sido, setSido] = useState('all');
  const [speciesCode, setSpeciesCode] = useState('all');
  const [sheet, setSheet] = useState<'filter' | 'sort' | null>(null);
  const category = filter === 'all' ? null : filter;
  const pages = usePostPages(category, sort, {
    sido: sido === 'all' ? null : sido,
    species: speciesCode === 'all' ? null : speciesCode,
  });
  const posts = { ...pages, data: pages.data?.pages.flat() };
  const { signedIn } = useAuth();
  const places = usePlaces();
  const species = useSpecies();
  const write = () => router.push(signedIn ? '/community/new' : '/login');

  // 지역 선택지: 낚시터가 많은 시·도 순
  const sidoOptions = useMemo<DropdownOption<string>[]>(() => {
    const counts = new Map<string, number>();
    for (const p of places.data ?? []) counts.set(sidoOf(p), (counts.get(sidoOf(p)) ?? 0) + 1);
    const list = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => ({ value: s, label: s }));
    return [{ value: 'all', label: '전체 지역' }, ...list];
  }, [places.data]);
  const speciesOptions = useMemo<DropdownOption<string>[]>(() => {
    const list = (species.data ?? []).map((sp) => ({ value: sp.code, label: sp.name_ko.replace(/\(.*\)/, '') }));
    return [{ value: 'all', label: '전체 어종' }, ...list];
  }, [species.data]);
  const filtered = sido !== 'all' || speciesCode !== 'all';
  const filterText = filtered
    ? [sido !== 'all' ? sido : null, speciesCode !== 'all' ? (speciesOptions.find((o) => o.value === speciesCode)?.label ?? speciesCode) : null]
        .filter(Boolean)
        .join(' · ')
    : '지역·어종 전체';
  const reset = () => {
    setSido('all');
    setSpeciesCode('all');
  };

  return (
    <View style={styles.flex}>
      <TabScreen title="커뮤니티" right={<View />} onRefresh={() => pages.refetch()}>
        <View style={[styles.tabs, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {CAT_TABS.map((c) => {
            const on = filter === c.value;
            return (
              <Pressable
                key={c.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setFilter(c.value)}
                style={[styles.tab, on && { backgroundColor: Brand.navy }]}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={on ? styles.onNavy : undefined} numberOfLines={1}>
                  {c.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`필터: ${filterText}, 바꾸기`}
            onPress={() => setSheet('filter')}
            style={({ pressed }) => [
              styles.filterBtn,
              { backgroundColor: filtered ? theme.tintSoft : theme.backgroundElement, borderColor: filtered ? theme.tint : theme.border },
              pressed && styles.pressed,
            ]}>
            <UiIcon name="filter" size={16} color={filtered ? theme.tint : theme.text} />
            <ThemedText type="smallBold" themeColor={filtered ? 'tint' : 'text'} numberOfLines={1} style={styles.shrink}>
              {filterText}
            </ThemedText>
            <UiIcon name="down" size={14} color={theme.textSecondary} />
          </Pressable>
          {filtered ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={reset} style={styles.reset}>
              <ThemedText type="small" themeColor="textSecondary">
                초기화
              </ThemedText>
            </Pressable>
          ) : null}
          <View style={styles.flex} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`정렬: ${sort === 'latest' ? '최신순' : '인기순'}, 바꾸기`}
            onPress={() => setSheet('sort')}
            style={({ pressed }) => [styles.filterBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}>
            <ThemedText type="smallBold">{sort === 'latest' ? '최신순' : '인기순'}</ThemedText>
            <UiIcon name="down" size={14} color={theme.textSecondary} />
          </Pressable>
        </View>

        {posts.isPending && <Loading />}
        {posts.isError && <ErrorView message={posts.error.message} onRetry={() => posts.refetch()} />}
        {posts.isSuccess &&
          (posts.data!.length === 0 ? (
            filtered ? (
              <EmptyBox
                icon="find-map"
                title="조건에 맞는 글이 없어요."
                message={`${filterText}${category ? ` · ${CATEGORY[category].label}` : ''} 글이 아직 없어요.`}
                action={{ label: '필터 초기화', onPress: reset, outline: true }}
              />
            ) : sort === 'popular' ? (
              <EmptyBox
                icon="like"
                title="최근 30일 인기글이 없어요."
                message="좋아요·댓글이 모이면 여기에 보여요."
                action={{ label: '최신순 보기', onPress: () => setSort('latest'), outline: true }}
              />
            ) : (
              <EmptyBox
                icon="cat-catch"
                title={category ? `${CATEGORY[category].label} 글이 아직 없어요.` : '아직 등록된 이야기가 없어요.'}
                message={'첫 글을 작성해\n낚시 이야기를 공유해 보세요!'}
                action={{ label: '글쓰기', onPress: write }}
              />
            )
          ) : (
            posts.data!.map((p) => (
              <Link key={p.id} href={{ pathname: '/community/[id]', params: { id: String(p.id) } }} asChild>
                <Pressable accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
                  <PostCard p={p} />
                </Pressable>
              </Link>
            ))
          ))}
        {pages.hasNextPage ? (
          <Button
            label={pages.isFetchingNextPage ? '불러오는 중…' : '글 더 보기'}
            variant="secondary"
            onPress={() => pages.fetchNextPage()}
            disabled={pages.isFetchingNextPage}
          />
        ) : null}
        <View style={styles.fabSpace} />
      </TabScreen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="글쓰기"
        onPress={write}
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}>
        <UiIcon name="pencil" size={24} color="#FFFFFF" />
      </Pressable>

      {/* 지역·어종 필터 시트 */}
      <Modal visible={sheet === 'filter'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <ThemedText type="sectionTitle">필터</ThemedText>
          <ThemedText type="smallBold">지역</ThemedText>
          <Dropdown label="지역" value={sido} options={sidoOptions} onChange={setSido} />
          <ThemedText type="smallBold">어종</ThemedText>
          <Dropdown label="어종" value={speciesCode} options={speciesOptions} onChange={setSpeciesCode} />
          <View style={styles.sheetActions}>
            <View style={styles.flex}>
              <Button label="초기화" variant="secondary" onPress={reset} />
            </View>
            <View style={styles.flex}>
              <Button label="적용" onPress={() => setSheet(null)} />
            </View>
          </View>
        </View>
      </Modal>
      <OptionSheet<Sort>
        open={sheet === 'sort'}
        title="정렬"
        value={sort}
        options={[
          { value: 'latest', label: '최신순' },
          { value: 'popular', label: '인기순', sub: '최근 30일 좋아요·댓글이 많은 글' },
        ]}
        onPick={setSort}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

/** 빈 상태 (레퍼런스: 그림 · 두 줄 · 주황 버튼) */
function EmptyBox({
  icon,
  title,
  message,
  action,
}: {
  icon: AppIconName;
  title: string;
  message: string;
  action: { label: string; onPress: () => void; outline?: boolean };
}) {
  const theme = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={[styles.emptyArt, { backgroundColor: theme.tintSoft }]}>
        <AppIcon name={icon} size={44} />
      </View>
      <ThemedText type="smallBold" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={action.onPress}
        style={({ pressed }) => [
          styles.emptyBtn,
          action.outline ? { borderWidth: 1.5, borderColor: theme.tint } : { backgroundColor: Brand.orange },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={action.outline ? { color: theme.tint } : styles.onNavy}>
          {action.label}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.8 },
  onNavy: { color: '#FFFFFF' },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, gap: 2 },
  tab: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 38, maxWidth: 220 },
  reset: { minHeight: 38, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 16, paddingVertical: 28, paddingHorizontal: 16 },
  emptyArt: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyBtn: { borderRadius: 999, paddingHorizontal: 20, minHeight: 40, justifyContent: 'center', marginTop: 6 },
  fabSpace: { height: 64 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.orange,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(5,20,40,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 10 },
  sheetActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
