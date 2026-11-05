import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSpecies } from '@/api/queries';
import type { Journal, JournalInput } from '@/api/types';
import { DateTimeField } from '@/components/date-time-field';
import { Button, Chip, ChipGroup, Field, TextField } from '@/components/form';
import { PlaceField } from '@/components/place-field';
import { Loading } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const ETC = '__etc__';

type Props = {
  initial?: Journal;
  submitLabel: string;
  submitting: boolean;
  serverError?: string;
  onSubmit: (input: JournalInput) => void;
  /** 새 일지일 때 미리 채울 장소 (홈 기준 낚시터) */
  defaultPlaceId?: number | null;
};

/** 낚시일지 작성/수정 폼 (SCR-04, FR-08). 서버와 같은 기준으로 먼저 검증한다 */
export function JournalForm({ initial, submitLabel, submitting, serverError, onSubmit, defaultPlaceId }: Props) {
  const species = useSpecies();

  const [placeId, setPlaceId] = useState<number | null>(initial?.place_id ?? defaultPlaceId ?? null);
  const [fishedAt, setFishedAt] = useState(() => (initial ? new Date(initial.fished_at) : new Date()));
  const [speciesSel, setSpeciesSel] = useState<string | null>(
    initial?.species_code ?? (initial?.species_etc ? ETC : null),
  );
  const [speciesEtc, setSpeciesEtc] = useState(initial?.species_etc ?? '');
  const [count, setCount] = useState(initial?.count != null ? String(initial.count) : '');
  const [length, setLength] = useState(initial?.max_length_cm != null ? String(initial.max_length_cm) : '');
  const [bait, setBait] = useState(initial?.bait ?? '');
  const [rig, setRig] = useState(initial?.rig ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const result = buildInput({ placeId, fishedAt, speciesSel, speciesEtc, count, length, bait, rig, memo });
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    setError(null);
    onSubmit(result);
  };

  if (species.isPending) return <Loading />;

  return (
    <View style={styles.form}>
      <Field label="장소" required>
        <PlaceField value={placeId} onChange={setPlaceId} placeholder="어디서 낚시했나요?" />
        <ThemedText type="small" themeColor="textSecondary">
          목록에 없는 곳이면 가장 가까운 낚시터를 고르고 메모에 실제 위치를 적어 주세요.
        </ThemedText>
      </Field>

      <Field label="출조 일시" required>
        <DateTimeField value={fishedAt} onChange={setFishedAt} maximumDate={new Date()} />
      </Field>

      <Field label="어종">
        <ChipGroup>
          {species.data?.map((s) => (
            <Chip
              key={s.code}
              label={s.name_ko}
              selected={speciesSel === s.code}
              onPress={() => setSpeciesSel(speciesSel === s.code ? null : s.code)}
            />
          ))}
          <Chip label="기타" selected={speciesSel === ETC} onPress={() => setSpeciesSel(speciesSel === ETC ? null : ETC)} />
        </ChipGroup>
        {speciesSel === ETC && (
          <TextField value={speciesEtc} onChangeText={setSpeciesEtc} placeholder="어종 이름" maxLength={50} />
        )}
      </Field>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="마릿수">
            <TextField value={count} onChangeText={setCount} keyboardType="number-pad" placeholder="0" maxLength={3} />
          </Field>
        </View>
        <View style={styles.flex}>
          <Field label="최대 길이 (cm)">
            <TextField value={length} onChangeText={setLength} keyboardType="decimal-pad" placeholder="예: 32.5" maxLength={5} />
          </Field>
        </View>
      </View>

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
        <TextField value={memo} onChangeText={setMemo} multiline maxLength={1000} />
      </Field>

      {(error || serverError) && <ThemedText themeColor="danger">{error ?? serverError}</ThemedText>}

      <Button label={submitting ? '저장 중…' : submitLabel} onPress={submit} disabled={submitting} />
    </View>
  );
}

type Raw = {
  placeId: number | null;
  fishedAt: Date;
  speciesSel: string | null;
  speciesEtc: string;
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

  const isEtc = r.speciesSel === ETC;
  if (isEtc && !r.speciesEtc.trim()) return '기타 어종 이름을 입력해 주세요.';

  const opt = (s: string) => s.trim() || null;
  return {
    place_id: r.placeId,
    fished_at: r.fishedAt.toISOString(),
    species_code: isEtc ? null : r.speciesSel,
    species_etc: isEtc ? r.speciesEtc.trim() : null,
    count,
    max_length_cm: length,
    bait: opt(r.bait),
    rig: opt(r.rig),
    memo: opt(r.memo),
  };
}

const styles = StyleSheet.create({
  form: { gap: Spacing.four },
  row: { flexDirection: 'row', gap: Spacing.three },
  flex: { flex: 1 },
});
