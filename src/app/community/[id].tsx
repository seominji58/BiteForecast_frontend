import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useAddComment, useDeleteComment, useDeletePost, usePost, useSetLike } from '@/api/queries';
import type { PostComment } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Button, TextField } from '@/components/form';
import { AuthorLine, Tag } from '@/components/post-card';
import { ReportSheet } from '@/components/report-sheet';
import { Card, ErrorView, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY } from '@/lib/community';

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
        <ThemedText type="small" themeColor="tint" style={styles.bold}>
          {CATEGORY[p.category].label}
        </ThemedText>
        <ThemedText type="sectionTitle">{p.title}</ThemedText>
        <AuthorLine
          author={p.author}
          createdAt={p.created_at}
          right={
            p.mine ? (
              <Pressable accessibilityRole="button" accessibilityLabel="글 삭제" hitSlop={8} onPress={confirmDeletePost}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.textSecondary} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="글 신고"
                hitSlop={8}
                onPress={() => setReportTarget({ type: 'post', id: p.id })}>
                <AppIcon name="report" size={22} />
              </Pressable>
            )
          }
        />
        <ThemedText style={styles.body}>{p.body}</ThemedText>
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
          onPress={() => like.mutate(!p.liked)}
          style={[styles.like, { borderColor: p.liked ? Brand.orange : theme.border }]}>
          <MaterialCommunityIcons
            name={p.liked ? 'thumb-up' : 'thumb-up-outline'}
            size={18}
            color={p.liked ? Brand.orange : theme.textSecondary}
          />
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
                onPress={() => (c.mine ? confirmDeleteComment(c) : setReportTarget({ type: 'comment', id: c.id }))}>
                {c.mine ? (
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.textSecondary} />
                ) : (
                  <AppIcon name="report" size={20} />
                )}
              </Pressable>
            }
          />
          <ThemedText>{c.body}</ThemedText>
        </Card>
      ))}

      <Card>
        <TextField value={comment} onChangeText={setComment} placeholder="댓글을 입력하세요" maxLength={500} multiline />
        <Button
          label={addComment.isPending ? '등록 중…' : '댓글 등록'}
          variant="secondary"
          onPress={sendComment}
          disabled={addComment.isPending || !comment.trim()}
        />
      </Card>

      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  body: { marginVertical: Spacing.two },
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
