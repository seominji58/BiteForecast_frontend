/**
 * 이용자 조황 가로 줄 (서비스 개선 설계 M1·H2·T2): 최근 조황공유 글을 사진 타일로 최대 5개.
 * - 예보·지수와 섞이지 않게 제목에 항상 「이용자 조황」을 쓴다
 * - 글이 없거나 불러오지 못하면 칸 전체를 숨긴다 (가짜 글·예시 글을 만들지 않음)
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { usePosts } from '@/api/queries';
import type { PostFilter, PostSummary } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { AppIcon } from '@/components/app-icon';
import { SectionHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/lib/format';

const MAX = 5;

type Props = {
  title: string;
  filter: PostFilter;
  /** 짧은 설명 (예: 「이용자가 올린 글이에요. 예보가 아니에요」) */
  note?: string;
  /** 「더 보기」를 누르면 (없으면 커뮤니티 탭) */
  onMore?: () => void;
};

export function CatchStrip({ title, filter, note, onMore }: Props) {
  const posts = usePosts('catch', 'latest', filter, MAX);
  if (!posts.isSuccess || posts.data.length === 0) return null;
  return (
    <>
      <SectionHeader title={title} actionLabel="더 보기" onAction={onMore ?? (() => router.push('/community'))} />
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {posts.data.map((p) => (
          <CatchTile key={p.id} p={p} />
        ))}
      </ScrollView>
    </>
  );
}

function CatchTile({ p }: { p: PostSummary }) {
  const theme = useTheme();
  const source = usePhotoSource();
  const src = p.thumb ? source(p.thumb) : null;
  const species = p.catch?.species_name ?? p.species_name;
  const size = p.catch?.max_length_cm != null ? `${p.catch.max_length_cm}cm` : null;
  const where = p.place_name ?? p.region_name;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${species ?? '조황'} ${size ?? ''} ${where ?? ''} 글 보기`}
      onPress={() => router.push({ pathname: '/community/[id]', params: { id: String(p.id) } })}
      style={({ pressed }) => [styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}>
      {src ? (
        <Image source={src} style={styles.photo} contentFit="cover" />
      ) : (
        <View style={[styles.photo, styles.noPhoto, { backgroundColor: theme.background }]}>
          <AppIcon name="total-fish" size={32} />
        </View>
      )}
      <View style={styles.body}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {[species, size].filter(Boolean).join(' · ') || p.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {[timeAgo(p.created_at), where].filter(Boolean).join(' · ')}
        </ThemedText>
        {p.verified ? (
          <ThemedText type="small" themeColor="success">
            ✓ 인증 조황
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingVertical: 2 },
  tile: { width: 148, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  pressed: { opacity: 0.8 },
  photo: { width: '100%', height: 104 },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 8, gap: 2 },
});
