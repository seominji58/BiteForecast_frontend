import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Author, PostSummary } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { AppIcon } from '@/components/app-icon';
import { Card } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, IconSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY, catchLine, shortDate, whereLine } from '@/lib/community';
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

/** 「인증 조황」 배지: 관리자 승인을 받은 낚시 기록을 공유한 글 */
export function VerifiedBadge() {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { borderColor: theme.success }]}>
      <ThemedText type="small" themeColor="success" style={styles.badgeText}>
        ✓ 인증 조황
      </ThemedText>
    </View>
  );
}

/**
 * 커뮤니티 글 카드. 사진이 있는 조황 글은 사진을 크게, 질문·팁·사진 없는 글은 글 중심으로 짧게.
 * 사진이 없는 글에 그림을 대신 넣지 않는다.
 */
export function PostCard({ p }: { p: PostSummary }) {
  return p.thumb && p.category === 'catch' ? <PhotoPostCard p={p} /> : <TextPostCard p={p} />;
}

function PhotoPostCard({ p }: { p: PostSummary }) {
  const theme = useTheme();
  const source = usePhotoSource();
  const src = p.thumb ? source(p.thumb) : null;
  const where = whereLine(p);
  const ratio = p.thumb ? Math.max(0.75, Math.min(1.33, p.thumb.width / p.thumb.height)) : 4 / 3;
  return (
    <View style={[styles.photoCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View>
        {src ? <Image source={src} style={[styles.photo, { aspectRatio: ratio }]} contentFit="cover" transition={150} /> : null}
        <View style={styles.overlayBadges}>
          {p.verified ? (
            <View style={[styles.overlayPill, styles.verifiedPill]}>
              <Text style={styles.overlayText}>✓ 인증 조황</Text>
            </View>
          ) : null}
          {p.popular ? (
            <View style={[styles.overlayPill, { backgroundColor: Brand.orange }]}>
              <Text style={styles.overlayText}>인기글</Text>
            </View>
          ) : null}
        </View>
        {p.photo_count > 1 ? (
          <View style={styles.more}>
            <Text style={styles.moreText}>사진 {p.photo_count}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.photoBody}>
        <ThemedText type="sectionTitle" numberOfLines={2}>
          {p.title}
        </ThemedText>
        {p.catch ? (
          <ThemedText type="smallBold" themeColor="tint">
            {catchLine(p.catch)}
            <ThemedText type="small" themeColor="textSecondary">{`  ${shortDate(p.catch.fished_at)} 출조`}</ThemedText>
          </ThemedText>
        ) : p.species_name ? (
          <ThemedText type="smallBold" themeColor="tint">
            {p.species_name}
          </ThemedText>
        ) : null}
        {where ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {where}
          </ThemedText>
        ) : null}
        <AuthorLine author={p.author} createdAt={p.created_at} />
        <Counts p={p} />
      </View>
    </View>
  );
}

function TextPostCard({ p }: { p: PostSummary }) {
  const theme = useTheme();
  const cat = CATEGORY[p.category];
  const source = usePhotoSource();
  const thumb = p.thumb ? source(p.thumb) : null;
  const where = whereLine(p);
  return (
    <Card>
      <View style={styles.badges}>
        {p.verified ? <VerifiedBadge /> : null}
        {p.popular ? (
          <View style={[styles.pill, styles.hot]}>
            <ThemedText type="small" style={styles.hotText}>
              인기글
            </ThemedText>
          </View>
        ) : null}
        <View style={[styles.pill, { backgroundColor: theme.tintSoft, borderColor: theme.tintSoft }]}>
          <AppIcon name={cat.icon} size={IconSize.inline} />
          <ThemedText type="small" themeColor="tint" style={styles.badgeText}>
            {cat.label}
          </ThemedText>
        </View>
      </View>
      <View style={styles.main}>
        <View style={styles.flex}>
          <ThemedText type="sectionTitle" numberOfLines={2}>
            {p.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {p.excerpt}
          </ThemedText>
        </View>
        {thumb ? <Image source={thumb} style={styles.thumb} contentFit="cover" accessibilityLabel="첨부 사진" /> : null}
      </View>
      {where || p.species_name ? (
        <View style={styles.tags}>
          {where ? <Tag icon="map-marker" text={where} /> : null}
          {p.species_name ? <Tag icon="fish" text={p.species_name} /> : null}
        </View>
      ) : null}
      <AuthorLine author={p.author} createdAt={p.created_at} />
      <Counts p={p} />
    </Card>
  );
}

function Counts({ p }: { p: PostSummary }) {
  return (
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
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.45 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
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
  // 사진 조황 카드
  photoCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  photo: { width: '100%' },
  photoBody: { padding: 12, gap: 6 },
  overlayBadges: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6 },
  overlayPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  verifiedPill: { backgroundColor: 'rgba(46,125,50,0.92)' },
  overlayText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
