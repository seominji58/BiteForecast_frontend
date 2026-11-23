import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';

import type { Author, PostSummary } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { AppIcon } from '@/components/app-icon';
import { UiIcon } from '@/components/ui-icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY, catchLine, shortDate } from '@/lib/community';
import { timeAgo } from '@/lib/format';

export function AuthorLine({ author, createdAt, right }: { author: Author; createdAt: string; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.author}>
      <View style={[styles.avatar, { backgroundColor: theme.tintSoft }]}>
        <AppIcon name="tab-me-active" size={16} tint={theme.tint} />
      </View>
      <ThemedText type="smallBold">{author.nickname}</ThemedText>
      <View style={[styles.titleBadge, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.badgeText}>
          {author.title}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        · {timeAgo(createdAt)}
      </ThemedText>
      <View style={styles.flex} />
      {right}
    </View>
  );
}

export function Tag({ icon, text }: { icon: 'map-marker' | 'fish'; text: string }) {
  const image = icon === 'fish' ? 'total-fish' : 'place-wharf';
  const theme = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: theme.background }]}>
      <AppIcon name={image} size={16} />
      <ThemedText type="small" style={styles.tagText}>
        {text}
      </ThemedText>
    </View>
  );
}

/**
 * 커뮤니티 글 카드 (2026-11-17 레퍼런스): 작성자·시간 → 제목 → 본문 두 줄 → 사진(있을 때만, 장수 표시) → 지역·어종 꼬리표 + 좋아요·댓글.
 * 사진이 없는 글에 그림을 대신 넣지 않는다.
 */
export function PostCard({ p }: { p: PostSummary }) {
  const theme = useTheme();
  const source = usePhotoSource();
  const src = p.thumb ? source(p.thumb) : null;
  const cat = CATEGORY[p.category];
  const region = p.region_name?.split(' ')[0] ?? null;
  const species = (p.catch?.species_name ?? p.species_name)?.replace(/\(.*\)/, '') ?? null;
  return (
    <View style={[styles.post, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.author}>
        <View style={[styles.avatar, { backgroundColor: theme.tintSoft }]}>
          <AppIcon name="tab-me-active" size={18} tint={theme.tint} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {p.author.nickname}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {timeAgo(p.created_at)} · {cat.label}
          </ThemedText>
        </View>
        {p.popular ? (
          <View style={[styles.pill, styles.hot]}>
            <ThemedText type="small" style={styles.hotText}>
              인기
            </ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText type="bodyBold" numberOfLines={2}>
        {p.title}
      </ThemedText>
      {p.catch ? (
        <ThemedText type="smallBold" themeColor="tint" numberOfLines={1}>
          {catchLine(p.catch)}
          <ThemedText type="small" themeColor="textSecondary">{`  ${shortDate(p.catch.fished_at)} 출조`}</ThemedText>
        </ThemedText>
      ) : null}
      {p.excerpt ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {p.excerpt}
        </ThemedText>
      ) : null}
      {src ? (
        <View>
          <Image source={src} style={styles.photo} contentFit="cover" transition={150} accessibilityLabel="첨부 사진" />
          {p.photo_count > 1 ? (
            <View style={styles.more}>
              <Text style={styles.moreText}>1/{p.photo_count}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.foot}>
        {region ? <Chip2 icon="pin" text={p.place_name ? `${region} · ${p.place_name}` : region} /> : null}
        {species ? <Chip2 icon="fish" text={species} /> : null}
        <View style={styles.flex} />
        <View style={styles.count}>
          <UiIcon name={p.liked ? 'heartOn' : 'heart'} size={17} color={p.liked ? Brand.orange : theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            {p.like_count}
          </ThemedText>
        </View>
        <View style={styles.count}>
          <UiIcon name="chat" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            {p.comment_count}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

function Chip2({ icon, text }: { icon: 'pin' | 'fish'; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip2, { borderColor: theme.border }]}>
      <UiIcon name={icon} size={13} color={theme.textSecondary} />
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.chip2Text}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.45 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  titleBadge: { borderRadius: 999, paddingHorizontal: 8 },
  badgeText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  hot: { backgroundColor: Brand.orange, borderColor: Brand.orange },
  hotText: { color: '#fff', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  main: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 12, lineHeight: 16 },
  counts: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.one },
  // 목록 카드 (레퍼런스)
  post: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginTop: 4 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  chip2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 150,
  },
  chip2Text: { flexShrink: 1 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 6 },
  more: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  moreText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
