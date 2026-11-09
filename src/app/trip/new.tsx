import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { useDateRange, usePlaces, useTrip, useTripMutation } from '@/api/queries';
import type { Trip } from '@/api/types';
import { PickerField } from '@/components/date-time-field';
import { Button, Chip, ChipGroup, Field, TextField } from '@/components/form';
import { AuthGate } from '@/components/login-required';
import { Loading, StackScreen } from '@/components/screen';
import { NO_SPECIES, SpeciesField, type SpeciesValue } from '@/components/species-field';
import { ThemedText } from '@/components/themed-text';
import { PlaceField } from '@/components/place-field';
import { formatDay, parseDay } from '@/lib/compare';
import { SEA_GROUPS } from '@/lib/prefs';
import { DEFAULT_CHECKLIST_HINT, periodLabel } from '@/lib/trip';

const MAX_DAYS = 7;

/**
 * 출조계획 만들기 · 수정 (설계안 §5-2). 한 화면 폼.
 * - ?place=147&date=2026-11-14 : 홈·상세의 「계획에 추가」에서 들어오면 장소·날짜가 채워진다
 *   (로그인하지 않았으면 로그인 후 이 화면으로 돌아와 그대로 채워진다 — 기기에 따로 저장하지 않음)
 * - ?id=3 : 수정 (장소는 계획 화면에서 바꾼다)
 */
function TripFormScreen() {
  const params = useLocalSearchParams<{ place?: string; date?: string; id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const existing = useTrip(editId ?? NaN);
  const range = useDateRange();
  if (editId != null && existing.isPending) return <Loading />;
  if (!range.data) return <Loading />;
  return (
    <TripForm
      today={range.data.today}
      initial={editId != null ? existing.data : undefined}
      placeId={params.place ? Number(params.place) : null}
      date={params.date ?? null}
    />
  );
}

function TripForm({
  today,
  initial,
  placeId: initialPlace,
  date,
}: {
  today: string;
  initial?: Trip;
  placeId: number | null;
  date: string | null;
}) {
  const places = usePlaces();
  const startDefault = initial?.start_date ?? (date && date >= today ? date : today);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [start, setStart] = useState(startDefault);
  const [end, setEnd] = useState(initial?.end_date ?? startDefault);
  const [region, setRegion] = useState<string | null>(initial?.region ?? null);
  const [species, setSpecies] = useState<SpeciesValue>(
    initial ? { code: initial.species_code, etc: initial.species_etc } : NO_SPECIES,
  );
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [placeId, setPlaceId] = useState<number | null>(initial ? null : initialPlace);
  const [error, setError] = useState<string | null>(null);

  const save = useTripMutation((v: { id: number | null }) => {
    const body = {
      title: title.trim() || null,
      start_date: start,
      end_date: end,
      region,
      species_code: species.code,
      species_etc: species.etc,
      memo: memo.trim() || null,
    };
    return v.id != null
      ? api.updateTrip(v.id, body)
      : api.createTrip({ ...body, stops: placeId ? [{ day: start, place_id: placeId }] : [] });
  });

  const maxEnd = formatDay(new Date(parseDay(start).getTime() + (MAX_DAYS - 1) * 86_400_000));
  const setStartDay = (d: string) => {
    setStart(d);
    if (end < d || end > formatDay(new Date(parseDay(d).getTime() + (MAX_DAYS - 1) * 86_400_000))) setEnd(d);
  };
  const place = places.data?.find((p) => p.id === placeId);
  const autoTitle = `${Number(start.slice(5, 7))}/${Number(start.slice(8, 10))} ${region ?? place?.region_name.split(' ').at(-1) ?? ''} 출조`.replace('  ', ' ');

  const submit = () => {
    setError(null);
    save.mutate(
      { id: initial?.id ?? null },
      {
        onSuccess: (t) =>
          initial ? router.back() : router.replace({ pathname: '/trip/[id]', params: { id: String(t.id) } }),
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <StackScreen>
      <Stack.Screen options={{ title: initial ? '출조계획 수정' : '새 출조계획' }} />
      <Field label="날짜" required>
        <View style={styles.row}>
          <PickerField
            mode="date"
            a11y="시작 날짜"
            value={parseDay(start)}
            minimumDate={initial ? undefined : parseDay(today)}
            onChange={(d) => setStartDay(formatDay(d))}
          />
          <ThemedText themeColor="textSecondary">~</ThemedText>
          <PickerField
            mode="date"
            a11y="끝 날짜"
            value={parseDay(end)}
            minimumDate={parseDay(start)}
            maximumDate={parseDay(maxEnd)}
            onChange={(d) => setEnd(formatDay(d))}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {periodLabel(start, end)} · 최대 {MAX_DAYS}일. 예보가 아직 없는 날짜도 저장할 수 있어요.
        </ThemedText>
      </Field>

      {!initial ? (
        <Field label="첫 낚시터 (선택)">
          <PlaceField value={placeId} onChange={setPlaceId} placeholder="낚시터 고르기 — 나중에 추가해도 돼요" />
          {placeId ? (
            <ThemedText type="small" themeColor="textSecondary">
              첫날({start.slice(5).replace('-', '/')})에 넣어요. 다른 날 장소는 계획 화면에서 추가하세요.
            </ThemedText>
          ) : null}
        </Field>
      ) : null}

      <Field label="지역 (선택)">
        <ChipGroup>
          <Chip label="정하지 않음" selected={region == null} onPress={() => setRegion(null)} />
          {SEA_GROUPS.map((g) => (
            <Chip key={g} label={g} selected={region === g} onPress={() => setRegion(g)} />
          ))}
        </ChipGroup>
      </Field>

      <Field label="목표 어종 (선택)">
        <SpeciesField value={species} onChange={setSpecies} />
      </Field>

      <Field label="제목 (선택)">
        <TextField value={title} onChangeText={setTitle} placeholder={autoTitle} maxLength={60} />
      </Field>

      <Field label="메모 (선택)">
        <TextField value={memo} onChangeText={setMemo} placeholder="예: 새벽 4시 출발, 동행 2명" multiline maxLength={1000} />
      </Field>

      {!initial ? (
        <ThemedText type="small" themeColor="textSecondary">
          {DEFAULT_CHECKLIST_HINT}
        </ThemedText>
      ) : null}
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
      <Button label={save.isPending ? '저장 중…' : initial ? '수정 저장' : '계획 만들기'} disabled={save.isPending} onPress={submit} />
    </StackScreen>
  );
}

export default function NewTripScreen() {
  return (
    <AuthGate message="출조계획은 로그인 후 저장할 수 있어요. 로그인하면 고르던 날짜·낚시터가 그대로 채워져요." icon="trips">
      <TripFormScreen />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
