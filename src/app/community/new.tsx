import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useCreatePost, useSpecies } from '@/api/queries';
import type { PostCategory } from '@/api/types';
import { Button, Chip, ChipGroup, Field, TextField } from '@/components/form';
import { PlaceField } from '@/components/place-field';
import { StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CATEGORY } from '@/lib/community';

// 커뮤니티 글쓰기
export default function NewPostScreen() {
  const create = useCreatePost();
  const species = useSpecies();

  const [category, setCategory] = useState<PostCategory>('catch');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [placeId, setPlaceId] = useState<number | null>(null);
  const [speciesCode, setSpeciesCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (title.trim().length < 2) return setError('제목을 2자 이상 입력해 주세요.');
    if (!body.trim()) return setError('내용을 입력해 주세요.');
    setError(null);
    create.mutate(
      { category, title: title.trim(), body: body.trim(), place_id: placeId, species_code: speciesCode },
      {
        onSuccess: (p) => {
          router.replace({ pathname: '/community/[id]', params: { id: String(p.id) } });
        },
        onError: (e) => Alert.alert('등록하지 못했습니다', e.message),
      },
    );
  };

  return (
    <StackScreen>
      <View style={styles.form}>
        <Field label="카테고리" required>
          <ChipGroup>
            {(Object.keys(CATEGORY) as PostCategory[]).map((k) => (
              <Chip key={k} label={CATEGORY[k].label} selected={category === k} onPress={() => setCategory(k)} />
            ))}
          </ChipGroup>
        </Field>

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
          <ChipGroup>
            {species.data?.map((s) => (
              <Chip
                key={s.code}
                label={s.name_ko}
                selected={speciesCode === s.code}
                onPress={() => setSpeciesCode(speciesCode === s.code ? null : s.code)}
              />
            ))}
          </ChipGroup>
        </Field>

        <ThemedText type="small" themeColor="textSecondary">
          • 연락처·실명 등 개인정보는 적지 마세요.{'\n'}• 광고·욕설·허위 정보는 신고될 수 있으며, 신고가 누적되면 글이
          숨겨집니다.{'\n'}• 정확한 포인트 좌표 공유는 낚시 금지구역·안전 문제를 확인한 뒤 해주세요.
        </ThemedText>

        {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
        <Button label={create.isPending ? '등록 중…' : '등록하기'} onPress={submit} disabled={create.isPending} />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.four },
  body: { minHeight: 160 },
});
