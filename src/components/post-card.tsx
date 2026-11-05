import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Author, PostSummary } from '@/api/types';
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
        <MaterialCommunityIcons name="account" size={20} color={theme.tint} />
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
  const theme = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: theme.background }]}>
      <MaterialCommunityIcons name={icon} size={13} color={theme.tint} />
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
            <MaterialCommunityIcons name="crown" size={12} color="#fff" />
            <ThemedText type="small" style={styles.hotText}>
              인기글
            </ThemedText>
          </View>
        ) : null}
        <View style={[styles.cat, { backgroundColor: theme.tintSoft }]}>
          <MaterialCommunityIcons name={cat.icon} size={12} color={theme.tint} />
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
        <MaterialCommunityIcons name="comment-outline" size={16} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          댓글 {p.comment_count}
        </ThemedText>
        <MaterialCommunityIcons
          name={p.liked ? 'thumb-up' : 'thumb-up-outline'}
          size={16}
          color={p.liked ? Brand.orange : theme.textSecondary}
        />
        <ThemedText type="small" themeColor="textSecondary">
          좋아요 {p.like_count}
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
