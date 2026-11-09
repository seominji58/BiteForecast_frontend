import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useAddComment, useDeleteComment, useDeletePost, usePost, useSetLike } from '@/api/queries';
import type { PostComment } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { AppIcon } from '@/components/app-icon';
import { Button, TextField } from '@/components/form';
import { AuthorLine, Tag, VerifiedBadge } from '@/components/post-card';
import { ReportSheet } from '@/components/report-sheet';
import { Card, ErrorView, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { CATEGORY } from '@/lib/community';
import { formatDateTime } from '@/lib/format';

// 커뮤니티 글 상세: 본문, 좋아요, 댓글, 신고, 내 글 삭제
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);
  const post = usePost(postId);
  const like = useSetLike(postId);
  const addComment = useAddComment(postId);
  const deletePost = useDeletePost();
  const deleteComment = useDeleteComment();
  const theme = useTheme();
  const source = usePhotoSource();
  const { signedIn } = useAuth();
  const needLogin = () => router.push('/login');

  const [comment, setComment] = useState('');
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: number } | null>(null);

  if (post.isPending) return <StackScreen><Loading /></StackScreen>;
  if (post.isError) {
    return (
      <StackScreen>
        <ErrorView message={post.error.message} onRetry={() => post.refetch()} />
      </StackScreen>
    );
  }
  const p = post.data;

  const confirmDeletePost = () =>
    Alert.alert('글 삭제', '이 글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => deletePost.mutate(p.id, { onSuccess: () => router.back() }),
      },
    ]);

  const confirmDeleteComment = (c: PostComment) =>
    Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteComment.mutate(c.id) },
    ]);

  const sendComment = () => {
    if (!comment.trim()) return;
    addComment.mutate(comment.trim(), {
      onSuccess: () => setComment(''),
      onError: (e) => Alert.alert('댓글을 등록하지 못했습니다', e.message),
    });
  };

  return (
    <StackScreen>
      <Card>
        <View style={styles.badges}>
          {p.verified ? <VerifiedBadge /> : null}
          <AppIcon name={CATEGORY[p.category].icon} size={16} />
          <ThemedText type="small" themeColor="tint" style={styles.bold}>
            {CATEGORY[p.category].label}
          </ThemedText>
        </View>
        <ThemedText type="sectionTitle">{p.title}</ThemedText>
        <AuthorLine
          author={p.author}
          createdAt={p.created_at}
          right={
            p.mine ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={confirmDeletePost}>
                <ThemedText type="small" themeColor="danger">
                  삭제
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="글 신고"
                hitSlop={8}
                onPress={() => (signedIn ? setReportTarget({ type: 'post', id: p.id }) : needLogin())}>
                <AppIcon name="report" size={22} />
              </Pressable>
            )
          }
        />
        {p.catch ? (
          <View style={[styles.catch, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold">
              {p.catch.species_name ?? '어종 미기록'}
              {p.catch.count != null ? ` · ${p.catch.count}마리` : ''}
              {p.catch.max_length_cm != null ? ` · 최대 ${p.catch.max_length_cm}cm` : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(p.catch.fished_at)} · 관리자가 사진을 확인한 기록이에요
            </ThemedText>
          </View>
        ) : null}
        <ThemedText style={styles.body}>{p.body}</ThemedText>
        {p.photos.map((ph) => {
          const src = source(ph);
          return src ? (
            <Image
              key={ph.id}
              source={src}
              style={[styles.photo, { aspectRatio: ph.width / ph.height }]}
              contentFit="cover"
              accessibilityLabel="첨부 사진"
            />
          ) : null;
        })}
        {p.place_name || p.species_name ? (
          <View style={styles.tags}>
            {p.place_name ? <Tag icon="map-marker" text={p.place_name} /> : null}
            {p.species_name ? <Tag icon="fish" text={p.species_name} /> : null}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: p.liked }}
          disabled={like.isPending}
          onPress={() => (signedIn ? like.mutate(!p.liked) : needLogin())}
          style={[styles.like, { borderColor: p.liked ? Brand.orange : theme.border }]}>
          <AppIcon name="like" size={20} style={p.liked ? undefined : styles.dim} />
          <ThemedText type="smallBold" themeColor={p.liked ? 'accent' : 'textSecondary'}>
            좋아요 {p.like_count}
          </ThemedText>
        </Pressable>
      </Card>

      <ThemedText type="sectionTitle">댓글 {p.comment_count}</ThemedText>
      {p.comments.map((c) => (
        <Card key={c.id}>
          <AuthorLine
            author={c.author}
            createdAt={c.created_at}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.mine ? '댓글 삭제' : '댓글 신고'}
                hitSlop={8}
                onPress={() =>
                  c.mine
                    ? confirmDeleteComment(c)
                    : signedIn
                      ? setReportTarget({ type: 'comment', id: c.id })
                      : needLogin()
                }>
                {c.mine ? (
                  <ThemedText type="small" themeColor="danger">
                    삭제
                  </ThemedText>
                ) : (
                  <AppIcon name="report" size={20} />
                )}
              </Pressable>
            }
          />
          <ThemedText>{c.body}</ThemedText>
        </Card>
      ))}

      {signedIn ? (
        <Card>
          <TextField value={comment} onChangeText={setComment} placeholder="댓글을 입력하세요" maxLength={500} multiline />
          <Button
            label={addComment.isPending ? '등록 중…' : '댓글 등록'}
            variant="secondary"
            onPress={sendComment}
            disabled={addComment.isPending || !comment.trim()}
          />
        </Card>
      ) : (
        <Button label="로그인하고 댓글 쓰기" variant="secondary" onPress={needLogin} />
      )}

      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  dim: { opacity: 0.45 },
  body: { marginVertical: Spacing.two },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catch: { borderRadius: 10, padding: 10, gap: 2 },
  photo: { width: '100%', borderRadius: 10 },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  like: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    marginTop: Spacing.two,
  },
});
