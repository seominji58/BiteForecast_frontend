import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useCreatePost, useJournal } from '@/api/queries';
import type { PostCategory } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { Dropdown } from '@/components/dropdown';
import { Button, Field, TextField } from '@/components/form';
import { PhotoPicker, usePhotoUploads } from '@/components/photo-picker';
import { PlaceField } from '@/components/place-field';
import { AuthGate } from '@/components/login-required';
import { Card, ErrorView, Loading, StackScreen } from '@/components/screen';
import { NO_SPECIES, SpeciesField, type SpeciesValue } from '@/components/species-field';
import { ThemedText } from '@/components/themed-text';
import { CATEGORY } from '@/lib/community';
import { formatDateTime } from '@/lib/format';

const CATEGORY_OPTIONS = (Object.keys(CATEGORY) as PostCategory[]).map((k) => ({
  value: k,
  label: CATEGORY[k].label,
  icon: CATEGORY[k].icon,
}));

// 커뮤니티 글쓰기 (재설계 v2 §7): 카테고리 드롭다운 · 제목 · 본문 · 사진 · 장소·어종 검색
// ?journal=ID 로 열면 인증 완료된 내 기록 공유 (장소·어종·사진은 기록 것을 그대로 사용)
function NewPostScreenInner() {
  const journalId = Number(useLocalSearchParams<{ journal?: string }>().journal);
  const sharing = Number.isFinite(journalId);
  const journal = useJournal(sharing ? journalId : NaN);
  const create = useCreatePost();
  const photos = usePhotoUploads('post');

  const [category, setCategory] = useState<PostCategory>('catch');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [placeId, setPlaceId] = useState<number | null>(null);
  const [species, setSpecies] = useState<SpeciesValue>(NO_SPECIES);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (title.trim().length < 2) return setError('제목을 2자 이상 입력해 주세요.');
    if (!body.trim()) return setError('내용을 입력해 주세요.');
    if (photos.uploading) return setError('사진을 올리는 중이에요. 잠시 후 다시 눌러 주세요.');
    if (photos.failed) return setError('올리지 못한 사진이 있어요. 눌러서 다시 시도하거나 ✕로 빼 주세요.');
    setError(null);
    create.mutate(
      sharing
        ? {
            category: 'catch',
            title: title.trim(),
            body: body.trim(),
            place_id: null,
            species_code: null,
            species_etc: null,
            photo_ids: [],
            journal_id: journalId,
          }
        : {
            category,
            title: title.trim(),
            body: body.trim(),
            place_id: placeId,
            species_code: species.code,
            species_etc: species.etc,
            photo_ids: photos.photoIds,
          },
      {
        onSuccess: (p) => router.replace({ pathname: '/community/[id]', params: { id: String(p.id) } }),
        onError: (e) => Alert.alert('등록하지 못했습니다', e.message),
      },
    );
  };

  if (sharing && journal.isPending) {
    return (
      <StackScreen>
        <Loading />
      </StackScreen>
    );
  }
  if (sharing && journal.isError) {
    return (
      <StackScreen>
        <ErrorView message={journal.error.message} onRetry={() => journal.refetch()} />
      </StackScreen>
    );
  }

  return (
    <StackScreen>
      <Stack.Screen options={{ title: sharing ? '인증 기록 공유' : '글쓰기' }} />
      <View style={styles.form}>
        {sharing && journal.data ? (
          <SharedJournal j={journal.data} />
        ) : (
          <Field label="카테고리" required>
            <Dropdown label="카테고리" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
          </Field>
        )}

        <Field label="제목" required>
          <TextField value={title} onChangeText={setTitle} maxLength={60} placeholder="예: 동명항 우럭 입질 시작" />
        </Field>

        <Field label="내용" required>
          <TextField
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
            placeholder="조황, 채비, 질문 등을 자유롭게 적어주세요."
            style={styles.body}
          />
        </Field>

        {!sharing ? (
          <>
            <Field label="사진 (선택, 최대 4장)">
              <PhotoPicker state={photos} />
              <ThemedText type="small" themeColor="textSecondary">
                위치 정보는 지우고 저장해요. 일반 글 사진은 포인트와 관계없어요.
              </ThemedText>
            </Field>

            <Field label="장소 (선택)">
              <PlaceField value={placeId} onChange={setPlaceId} placeholder="어느 낚시터 이야기인가요?" />
              {placeId != null ? (
                <Pressable accessibilityRole="button" onPress={() => setPlaceId(null)} hitSlop={8}>
                  <ThemedText type="small" themeColor="textSecondary">
                    장소 태그 빼기
                  </ThemedText>
                </Pressable>
              ) : null}
            </Field>

            <Field label="어종 (선택)">
              <SpeciesField value={species} onChange={setSpecies} />
            </Field>
          </>
        ) : null}

        <ThemedText type="small" themeColor="textSecondary">
          • 연락처·실명 등 개인정보는 적지 마세요.{'\n'}• 광고·욕설·허위 정보는 신고될 수 있으며, 신고가 누적되면 글이
          숨겨집니다.{'\n'}• 정확한 포인트 좌표 공유는 낚시 금지구역·안전 문제를 확인한 뒤 해주세요.
        </ThemedText>

        {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
        <Button
          label={create.isPending ? '등록 중…' : photos.uploading ? '사진 올리는 중…' : '등록하기'}
          onPress={submit}
          disabled={create.isPending || photos.uploading}
        />
      </View>
    </StackScreen>
  );
}

function SharedJournal({ j }: { j: NonNullable<ReturnType<typeof useJournal>['data']> }) {
  const source = usePhotoSource();
  return (
    <Card>
      <ThemedText type="smallBold" themeColor="success">
        ✓ 인증 완료 기록 · 조황공유로 올라가요
      </ThemedText>
      <ThemedText type="smallBold">
        {j.place_name} · {j.species_name ?? '어종 미기록'}
        {j.count != null ? ` · ${j.count}마리` : ''}
        {j.max_length_cm != null ? ` · 최대 ${j.max_length_cm}cm` : ''}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatDateTime(j.fished_at)}
      </ThemedText>
      <View style={styles.thumbs}>
        {j.photos.map((p) => {
          const src = source(p);
          return src ? <Image key={p.id} source={src} style={styles.thumb} contentFit="cover" /> : null;
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  body: { minHeight: 140 },
  thumbs: { flexDirection: 'row', gap: 6 },
  thumb: { width: 60, height: 60, borderRadius: 8 },
});

export default function NewPostScreen() {
  return (
    <AuthGate message="커뮤니티 글쓰기는 로그인 후 할 수 있어요. 글 읽기는 로그인 없이 돼요." icon="comment">
      <NewPostScreenInner />
    </AuthGate>
  );
}
