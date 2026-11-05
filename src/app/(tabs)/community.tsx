import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePosts } from '@/api/queries';
import type { PostCategory } from '@/api/types';
import { PostCard } from '@/components/post-card';
import { EmptyView, ErrorView, Loading, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY } from '@/lib/community';

type Sort = 'popular' | 'latest';

// 커뮤니티 (명세 §15): 카테고리·정렬별 글 목록 + 글쓰기
export default function CommunityScreen() {
  const theme = useTheme();
  const [category, setCategory] = useState<PostCategory | null>(null);
  const [sort, setSort] = useState<Sort>('latest');
  const posts = usePosts(category, sort);

  const cats: { key: PostCategory | null; label: string; icon: (typeof CATEGORY)[PostCategory]['icon'] }[] = [
    { key: null, label: '전체글', icon: 'forum-outline' },
    ...(Object.keys(CATEGORY) as PostCategory[]).map((k) => ({ key: k, ...CATEGORY[k] })),
  ];

  return (
    <View style={styles.flex}>
      <TabScreen title="커뮤니티" subtitle="조황 소식과 낚시 정보를 함께 나눠요.">
        <View style={styles.cats}>
          {cats.map((c) => {
            const on = c.key === category;
            return (
              <Pressable
                key={c.label}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setCategory(c.key)}
                style={[
                  styles.cat,
                  {
                    backgroundColor: on ? Brand.navy : theme.backgroundElement,
                    borderColor: on ? Brand.orange : theme.border,
                  },
                ]}>
                <MaterialCommunityIcons name={c.icon} size={22} color={on ? Brand.onNavy : theme.tint} />
                <ThemedText type="small" style={[styles.catText, on && { color: Brand.onNavy }]}>
                  {c.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.segment, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {(
            [
              ['latest', '최신', 'clock-outline'],
              ['popular', '인기', 'fire'],
            ] as const
          ).map(([key, label, icon]) => {
            const on = sort === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setSort(key)}
                style={[styles.segItem, on && { backgroundColor: Brand.navy }]}>
                <MaterialCommunityIcons name={icon} size={16} color={on ? Brand.orange : theme.textSecondary} />
                <ThemedText type="smallBold" style={on ? { color: Brand.onNavy } : undefined} themeColor="textSecondary">
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {posts.isPending && <Loading />}
        {posts.isError && <ErrorView message={posts.error.message} onRetry={() => posts.refetch()} />}
        {posts.isSuccess &&
          (posts.data.length === 0 ? (
            <EmptyView message={sort === 'popular' ? '최근 30일 인기글이 없습니다.' : '아직 글이 없습니다. 첫 글을 남겨보세요!'} />
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
        onPress={() => router.push('/community/new')}
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}>
        <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
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
  cats: { flexDirection: 'row', gap: Spacing.two },
  cat: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.two + 2, borderRadius: 14, borderWidth: 1.5 },
  catText: { fontWeight: '700', fontSize: 12 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, borderWidth: StyleSheet.hairlineWidth },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  fabSpace: { height: 56 },
  fab: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.orange,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.three - 2,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: '#fff' },
});
