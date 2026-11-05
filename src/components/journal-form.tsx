import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Journal, JournalInput } from '@/api/types';
import { DateTimeField } from '@/components/date-time-field';
import { Button, Field, TextField } from '@/components/form';
import { PhotoPicker, usePhotoUploads } from '@/components/photo-picker';
import { PlaceField } from '@/components/place-field';
import { Card } from '@/components/screen';
import { SpeciesField, type SpeciesValue } from '@/components/species-field';
import { ThemedText } from '@/components/themed-text';

type Props = {
  initial?: Journal;
  submitLabel: string;
  submitting: boolean;
  serverError?: string;
  onSubmit: (input: JournalInput) => void;
  /** 새 일지일 때 미리 채울 장소 (홈 기준 낚시터) */
  defaultPlaceId?: number | null;
};

/**
 * 낚시일지 작성/수정 폼 (재설계 v2 §8).
 * ① 장소·일시 ② 조과(어종 검색·마릿수·길이) ③ 사진 ④ 미끼·채비·메모(접힘)
 * 사진이 있으면 [저장] / [저장하고 인증 신청]. 포인트는 관리자 승인 후에만 생긴다.
 */
export function JournalForm({ initial, submitLabel, submitting, serverError, onSubmit, defaultPlaceId }: Props) {
  const [placeId, setPlaceId] = useState<number | null>(initial?.place_id ?? defaultPlaceId ?? null);
  const [fishedAt, setFishedAt] = useState(() => (initial ? new Date(initial.fished_at) : new Date()));
  const [species, setSpecies] = useState<SpeciesValue>({
    code: initial?.species_code ?? null,
    etc: initial?.species_etc ?? null,
  });
  const [count, setCount] = useState(initial?.count != null ? String(initial.count) : '');
  const [length, setLength] = useState(initial?.max_length_cm != null ? String(initial.max_length_cm) : '');
  const [bait, setBait] = useState(initial?.bait ?? '');
  const [rig, setRig] = useState(initial?.rig ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [moreOpen, setMoreOpen] = useState(!!(initial?.bait || initial?.rig || initial?.memo));
  const [error, setError] = useState<string | null>(null);
  const photos = usePhotoUploads('journal', initial?.photos ?? []);

  const status = initial?.verification.status ?? 'none';
  const canRequestAfterSave = status === 'none' || status === 'rejected';
  const hasPhoto = photos.photoIds.length > 0;
  const hasSpecies = !!(species.code || species.etc);

  const submit = (requestVerification: boolean) => {
    if (photos.uploading) return setError('사진을 올리는 중이에요. 잠시 후 다시 눌러 주세요.');
    if (photos.failed) return setError('올리지 못한 사진이 있어요. 눌러서 다시 시도하거나 ✕로 빼 주세요.');
    if (requestVerification && !hasSpecies) return setError('인증 신청에는 어종이 필요해요.');
    const result = buildInput({ placeId, fishedAt, species, count, length, bait, rig, memo });
    if (typeof result === 'string') return setError(result);
    setError(null);
    onSubmit({ ...result, photo_ids: photos.photoIds, request_verification: requestVerification });
  };

  return (
    <View style={styles.form}>
      <Section title="언제, 어디서">
        <Field label="장소" required>
          <PlaceField value={placeId} onChange={setPlaceId} placeholder="어디서 낚시했나요?" />
        </Field>
        <Field label="출조 일시" required>
          <DateTimeField value={fishedAt} onChange={setFishedAt} maximumDate={new Date()} />
        </Field>
      </Section>

      <Section title="조과">
        <Field label="어종">
          <SpeciesField value={species} onChange={setSpecies} />
        </Field>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label="마릿수">
              <TextField value={count} onChangeText={setCount} keyboardType="number-pad" placeholder="0" maxLength={3} />
            </Field>
          </View>
          <View style={styles.flex}>
            <Field label="최대 길이 (cm)">
              <TextField
                value={length}
                onChangeText={setLength}
                keyboardType="decimal-pad"
                placeholder="예: 32.5"
                maxLength={5}
              />
            </Field>
          </View>
        </View>
      </Section>

      <Section title="사진 (인증용, 최대 4장)">
        <PhotoPicker state={photos} />
        <ThemedText type="small" themeColor="textSecondary">
          물고기와 계측(자·줄자)이 보이면 검토가 빨라요. 위치 정보는 지우고 저장하며, 사진은 나만 볼 수 있어요(인증 후
          공유하면 공개).
        </ThemedText>
      </Section>

      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
          onPress={() => setMoreOpen((v) => !v)}
          style={styles.between}>
          <ThemedText type="smallBold">미끼·채비·메모 (선택)</ThemedText>
          <ThemedText type="small" themeColor="tint">
            {moreOpen ? '접기 ▴' : '펼치기 ▾'}
          </ThemedText>
        </Pressable>
        {moreOpen ? (
          <>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Field label="미끼">
                  <TextField value={bait} onChangeText={setBait} maxLength={50} />
                </Field>
              </View>
              <View style={styles.flex}>
                <Field label="채비">
                  <TextField value={rig} onChangeText={setRig} maxLength={50} />
                </Field>
              </View>
            </View>
            <Field label="메모">
              <TextField
                value={memo}
                onChangeText={setMemo}
                multiline
                maxLength={1000}
                placeholder="목록에 없는 장소면 실제 위치를 적어 주세요"
              />
            </Field>
          </>
        ) : null}
      </Card>

      {(error || serverError) && <ThemedText themeColor="danger">{error ?? serverError}</ThemedText>}

      {/* 인증 안내: 사진 첨부만으로는 포인트가 없다 */}
      {canRequestAfterSave ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hasPhoto
            ? `인증 신청 조건: 사진 ✓ · 어종 ${hasSpecies ? '✓' : '필요'}. 관리자가 확인해 승인하면 포인트가 지급돼요.`
            : '사진을 추가하면 인증을 신청할 수 있어요. 포인트는 인증이 완료된 기록에만 지급돼요.'}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {status === 'approved' ? '인증 완료 기록이에요. ' : '인증 검토 중인 기록이에요. '}
          장소·일시·어종·마릿수·길이·사진을 바꾸면 다시 검토 대기로 돌아가요.
        </ThemedText>
      )}

      {canRequestAfterSave && hasPhoto ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label={submitting ? '저장 중…' : submitLabel} variant="secondary" onPress={() => submit(false)} disabled={submitting} />
          </View>
          <View style={styles.flex}>
            <Button
              label={submitting ? '저장 중…' : '저장하고 인증 신청'}
              onPress={() => submit(true)}
              disabled={submitting || photos.uploading}
            />
          </View>
        </View>
      ) : (
        <Button
          label={submitting ? '저장 중…' : photos.uploading ? '사진 올리는 중…' : submitLabel}
          onPress={() => submit(false)}
          disabled={submitting || photos.uploading}
        />
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </Card>
  );
}

type Raw = {
  placeId: number | null;
  fishedAt: Date;
  species: SpeciesValue;
  count: string;
  length: string;
  bait: string;
  rig: string;
  memo: string;
};

/** 입력값 검증 + 변환. 실패하면 오류 메시지(string) 반환 */
export function buildInput(r: Raw): JournalInput | string {
  if (r.placeId == null) return '장소를 선택해 주세요.';
  if (r.fishedAt.getTime() > Date.now() + 5 * 60_000) return '출조 일시는 미래일 수 없습니다.';

  let count: number | null = null;
  if (r.count.trim()) {
    if (!/^\d+$/.test(r.count.trim())) return '마릿수는 0 이상의 정수로 입력해 주세요.';
    count = Number(r.count.trim());
    if (count > 999) return '마릿수는 999 이하로 입력해 주세요.';
  }

  let length: number | null = null;
  if (r.length.trim()) {
    length = Number(r.length.trim().replace(',', '.'));
    if (!Number.isFinite(length) || length <= 0 || length > 300) return '최대 길이는 0보다 크고 300cm 이하로 입력해 주세요.';
    length = Math.round(length * 10) / 10;
  }

  const opt = (s: string) => s.trim() || null;
  return {
    place_id: r.placeId,
    fished_at: r.fishedAt.toISOString(),
    species_code: r.species.code,
    species_etc: r.species.code ? null : (r.species.etc?.trim() || null),
    count,
    max_length_cm: length,
    bait: opt(r.bait),
    rig: opt(r.rig),
    memo: opt(r.memo),
  };
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  section: { gap: 10 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
