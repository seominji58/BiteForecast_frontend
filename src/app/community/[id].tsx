import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAddComment, useDeleteComment, useDeletePost, usePost, useSetLike } from '@/api/queries';
import type { PostComment } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { AppIcon } from '@/components/app-icon';
import { AuthorLine, Tag, VerifiedBadge } from '@/components/post-card';
import { ReportSheet } from '@/components/report-sheet';
import { Card, ErrorView, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UiIcon } from '@/components/ui-icon';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { CATEGORY } from '@/lib/community';
import { formatDateTime, timeAgo } from '@/lib/format';

// 커뮤니티 글 상세: 본문, 좋아요, 댓글, 신고, 내 글 수정·삭제
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
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const needLogin = () => router.push('/login');

  const [comment, setComment] = useState('');
  // 답글 쓰는 중이면 그 원댓글 (입력줄 위에 「○○님에게 답글」)
  const [replyTo, setReplyTo] = useState<{ id: number; nickname: string } | null>(null);
  const inputRef = useRef<TextInputInstance>(null);
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
    addComment.mutate(replyTo ? { body: comment.trim(), parentId: replyTo.id } : comment.trim(), {
      onSuccess: () => {
        setComment('');
        setReplyTo(null);
      },
      onError: (e) => Alert.alert('댓글을 등록하지 못했습니다', e.message),
    });
  };

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
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
              <View style={styles.mineActions}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.push({ pathname: '/community/edit', params: { id: String(p.id) } })}>
                  <ThemedText type="small" themeColor="tint">
                    수정
                  </ThemedText>
                </Pressable>
                <Pressable accessibilityRole="button" hitSlop={8} onPress={confirmDeletePost}>
                  <ThemedText type="small" themeColor="danger">
                    삭제
                  </ThemedText>
                </Pressable>
              </View>
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
            {p.catch.bait || p.catch.rig ? (
              <ThemedText type="small">
                {[p.catch.bait ? `미끼 ${p.catch.bait}` : null, p.catch.rig ? `채비 ${p.catch.rig}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(p.catch.fished_at)} ·{' '}
              {p.verified ? '관리자가 사진을 확인한 기록이에요' : '작성자의 낚시 기록이에요 (인증 전)'}
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

      {/* 댓글: 글(카드)과 구분되게 — 작은 프로필 · 이름·시간 한 줄 · 본문, 구분선으로 이어지는 목록 */}
      <View style={[styles.comments, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.commentsHead}>
          <UiIcon name="chat" size={18} color={theme.text} />
          <ThemedText type="smallBold">댓글 {p.comment_count}</ThemedText>
        </View>
        {p.comments.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.noComment}>
            아직 댓글이 없어요. 첫 댓글을 남겨 보세요.
          </ThemedText>
        ) : (
          // 원댓글 → 그 아래 답글(들여쓰기). 답글은 원댓글에만 한 단계
          p.comments
            .filter((c) => !c.parent_id)
            .map((root) => (
              <View key={root.id} style={[styles.thread, { borderTopColor: theme.border }]}>
                <CommentRow
                  c={root}
                  isWriter={root.author.nickname === p.author.nickname}
                  onReply={
                    root.deleted
                      ? undefined
                      : () => {
                          if (!signedIn) return needLogin();
                          setReplyTo({ id: root.id, nickname: root.author.nickname });
                          setTimeout(() => inputRef.current?.focus(), 50);
                        }
                  }
                  onMenu={() =>
                    root.mine ? confirmDeleteComment(root) : signedIn ? setReportTarget({ type: 'comment', id: root.id }) : needLogin()
                  }
                />
                {p.comments
                  .filter((r) => r.parent_id === root.id)
                  .map((r) => (
                    <View key={r.id} style={styles.reply}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.replyArrow}>
                        ↳
                      </ThemedText>
                      <View style={styles.flex}>
                        <CommentRow
                          c={r}
                          small
                          isWriter={r.author.nickname === p.author.nickname}
                          onMenu={() =>
                            r.mine ? confirmDeleteComment(r) : signedIn ? setReportTarget({ type: 'comment', id: r.id }) : needLogin()
                          }
                        />
                      </View>
                    </View>
                  ))}
              </View>
            ))
        )}
      </View>
    </ScrollView>

      {/* 아래 고정 댓글 입력줄 (키보드가 올라오면 함께 올라간다) */}
      {replyTo ? (
        <View style={[styles.replyBanner, { backgroundColor: theme.tintSoft, borderTopColor: theme.border }]}>
          <ThemedText type="small" themeColor="tint" style={styles.flex} numberOfLines={1}>
            ↳ {replyTo.nickname}님에게 답글 작성 중
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="답글 취소" hitSlop={10} onPress={() => setReplyTo(null)}>
            <ThemedText type="smallBold" themeColor="tint">
              ✕
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
      <View style={[styles.inputBar, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
        {signedIn ? (
          <>
            <TextInput
              ref={inputRef}
              value={comment}
              onChangeText={setComment}
              placeholder={replyTo ? '답글을 입력하세요' : '댓글을 입력하세요'}
              placeholderTextColor={theme.textSecondary}
              maxLength={500}
              multiline
              maxFontSizeMultiplier={1.4}
              style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={replyTo ? '답글 등록' : '댓글 등록'}
              disabled={addComment.isPending || !comment.trim()}
              onPress={sendComment}
              style={[styles.send, { backgroundColor: comment.trim() ? Brand.orange : theme.backgroundSelected }]}>
              <ThemedText type="smallBold" style={{ color: comment.trim() ? '#FFFFFF' : theme.textSecondary }}>
                {addComment.isPending ? '…' : '등록'}
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <Pressable accessibilityRole="button" onPress={needLogin} style={[styles.input, styles.loginBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              로그인하고 댓글 쓰기
            </ThemedText>
          </Pressable>
        )}
      </View>
      </KeyboardAvoidingView>

      <ReportSheet
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        // 글쓴이를 차단하면 이 글도 더 이상 보이지 않으므로 목록으로 돌아간다
        onBlocked={(t) => t.type === 'post' && router.back()}
      />
    </ThemedView>
  );
}

/** 댓글 한 줄: 작은 프로필 · 이름(작성자 표시)·시간 · 오른쪽 삭제/신고 · 본문 · (원댓글이면) 답글 */
function CommentRow({
  c,
  isWriter,
  small,
  onReply,
  onMenu,
}: {
  c: PostComment;
  isWriter: boolean;
  small?: boolean;
  onReply?: () => void;
  onMenu: () => void;
}) {
  const theme = useTheme();
  if (c.deleted) {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.deletedText}>
        삭제되었거나 볼 수 없는 댓글이에요
      </ThemedText>
    );
  }
  const size = small ? 24 : 28;
  return (
    <View style={styles.comment}>
      <View style={[styles.cAvatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.tintSoft }]}>
        <AppIcon name="tab-me-active" size={small ? 12 : 14} tint={theme.tint} />
      </View>
      <View style={styles.flex}>
        <View style={styles.cHead}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.shrink}>
            {c.author.nickname}
          </ThemedText>
          {isWriter ? (
            <View style={[styles.writer, { borderColor: theme.tint }]}>
              <ThemedText type="caption" themeColor="tint" style={styles.writerText}>
                작성자
              </ThemedText>
            </View>
          ) : null}
          <ThemedText type="caption" themeColor="textSecondary">
            {timeAgo(c.created_at)}
          </ThemedText>
          <View style={styles.flex} />
          <Pressable accessibilityRole="button" accessibilityLabel={c.mine ? '댓글 삭제' : '댓글 신고'} hitSlop={10} onPress={onMenu}>
            <ThemedText type="caption" themeColor="textSecondary">
              {c.mine ? '삭제' : '신고'}
            </ThemedText>
          </Pressable>
        </View>
        <ThemedText type="small" style={styles.cBody}>
          {c.body}
        </ThemedText>
        {onReply ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${c.author.nickname}님 댓글에 답글 달기`} hitSlop={8} onPress={onReply} style={styles.replyBtn}>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.bold}>
              답글
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  thread: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  reply: { flexDirection: 'row', gap: 4, paddingLeft: 30 },
  replyArrow: { paddingTop: 10 },
  replyBtn: { alignSelf: 'flex-start', marginTop: 4, minHeight: 24, justifyContent: 'center' },
  replyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  deletedText: { paddingVertical: 12, fontStyle: 'italic' },
  shrink: { flexShrink: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  comments: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  commentsHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10 },
  noComment: { paddingBottom: 12 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  cAvatar: { alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  cHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cBody: { marginTop: 3, lineHeight: 21 },
  writer: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 4 },
  writerText: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 42, maxHeight: 120, borderWidth: 1, borderRadius: 21, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15 },
  loginBar: { justifyContent: 'center' },
  send: { minHeight: 42, minWidth: 56, borderRadius: 21, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  mineActions: { flexDirection: 'row', gap: 14 },
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
