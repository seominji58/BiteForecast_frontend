import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Author, PostSummary } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Card } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY } from '@/lib/community';
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

export function PostCard({ p }: { p: PostSummary }) {
  const theme = useTheme();
  const cat = CATEGORY[p.category];
  return (
    <Card>
      <View style={styles.badges}>
        {p.popular ? (
          <View style={[styles.hot, { backgroundColor: Brand.orange }]}>
            <AppIcon name="medal" size={12} badge />
            <ThemedText type="small" style={styles.hotText}>
              인기글
            </ThemedText>
          </View>
        ) : null}
        <View style={[styles.cat, { backgroundColor: theme.tintSoft }]}>
          <AppIcon name={cat.icon} size={14} />
          <ThemedText type="small" themeColor="tint" style={styles.badgeText}>
            {cat.label}
          </ThemedText>
        </View>
      </View>
      <AuthorLine author={p.author} createdAt={p.created_at} />
      <ThemedText type="sectionTitle" numberOfLines={1}>
        {p.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
        {p.excerpt}
      </ThemedText>
      {p.place_name || p.species_name ? (
        <View style={styles.tags}>
          {p.place_name ? <Tag icon="map-marker" text={p.place_name} /> : null}
          {p.species_name ? <Tag icon="fish" text={p.species_name} /> : null}
        </View>
      ) : null}
      <View style={styles.counts}>
        <AppIcon name="comment" size={18} />
        <ThemedText type="small" themeColor="textSecondary">
          댓글 {p.comment_count}
        </ThemedText>
        <AppIcon name="like" size={18} style={p.liked ? undefined : styles.dim} />
        <ThemedText type="small" themeColor={p.liked ? 'accent' : 'textSecondary'}>
          좋아요 {p.like_count}
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.45 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titleBadge: { borderRadius: 999, paddingHorizontal: 8 },
  badgeText: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  badges: { flexDirection: 'row', gap: 6 },
  hot: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  hotText: { color: '#fff', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 12, lineHeight: 16 },
  counts: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.one },
});
