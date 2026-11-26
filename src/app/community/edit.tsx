import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { usePost, useUpdatePost } from '@/api/queries';
import type { LocationVisibility, PostCategory } from '@/api/types';
import { Dropdown } from '@/components/dropdown';
import { Button, Field, TextField } from '@/components/form';
import { LocationVisibilityField } from '@/components/location-visibility';
import { AuthGate } from '@/components/login-required';
import { ErrorView, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { titleError, CATEGORY } from '@/lib/community';

const CATEGORY_OPTIONS = (Object.keys(CATEGORY) as PostCategory[]).map((k) => ({
  value: k,
  label: CATEGORY[k].label,
  icon: CATEGORY[k].icon,
}));

/**
 * 내 글 고치기 (서비스 개선 v2 C-B): 분류·제목·내용·위치 공개 범위.
 * 기록을 공유한 글은 분류를 바꾸지 않는다 (장소·어종·사진은 기록에서 고친다).
 * 사진·장소·어종 바꾸기는 지금은 지우고 다시 쓰기.
 */
function EditPostInner() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const post = usePost(id);
  const update = useUpdatePost(id);
  const [category, setCategory] = useState<PostCategory>('catch');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<LocationVisibility>('region');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 글을 받아 오면 한 번만 칸을 채운다 (렌더 중 갱신 — 다른 화면과 같은 방식)
  if (post.data && !loaded) {
    setLoaded(true);
    setCategory(post.data.category);
    setTitle(post.data.title);
    setBody(post.data.body);
    setVisibility(post.data.location_visibility);
  }

  if (post.isPending) {
    return (
      <StackScreen>
        <Loading />
      </StackScreen>
    );
  }
  if (post.isError || !post.data) {
    return (
      <StackScreen>
        <ErrorView message={post.error?.message ?? '글을 찾을 수 없어요'} onRetry={() => post.refetch()} />
      </StackScreen>
    );
  }
  const p = post.data;
  const shared = p.catch != null;
  const free = category === 'free';

  const save = () => {
    const tErr = titleError(title);
    if (tErr) return setError(tErr);
    if (!body.trim()) return setError('내용을 입력해 주세요.');
    setError(null);
    update.mutate(
      {
        ...(shared ? {} : { category }),
        title: title.trim(),
        body: body.trim(),
        location_visibility: visibility,
      },
      {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert('고치지 못했어요', e.message),
      },
    );
  };

  return (
    <StackScreen>
      <View style={styles.form}>
        {shared ? (
          <ThemedText type="small" themeColor="textSecondary">
            기록을 공유한 글이에요. 장소·어종·사진은 기록에서 고쳐 주세요.
          </ThemedText>
        ) : (
          <Field label="분류" required>
            <Dropdown label="분류" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
          </Field>
        )}
        <Field label="제목" required>
          <TextField value={title} onChangeText={setTitle} maxLength={60} />
        </Field>
        <Field label="내용" required>
          <TextField value={body} onChangeText={setBody} multiline maxLength={2000} style={styles.body} />
        </Field>
        {!free || shared ? (
          <LocationVisibilityField value={visibility} onChange={setVisibility} hasPlace={p.place_id != null || shared} />
        ) : null}
        {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
        <Button label={update.isPending ? '저장 중…' : '고친 내용 저장'} onPress={save} disabled={update.isPending} />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  body: { minHeight: 140 },
});

export default function EditPostScreen() {
  return (
    <AuthGate message="글 고치기는 로그인 후 할 수 있어요." icon="comment">
      <EditPostInner />
    </AuthGate>
  );
}
