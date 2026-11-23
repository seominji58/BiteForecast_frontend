/**
 * 내 포인트 추가·고치기 (2026-11-23).
 * 추가: 지도를 움직여 가운데 핀을 자리에 맞추고 이름·메모 → 저장. 「현재 위치로」는 지도만 옮긴다 (저장은 누를 때만).
 * 고치기(?id): 이름·메모만 바꾼다 (자리는 그대로).
 * 저장한 좌표는 계정에 저장되고 본인만 본다 (개인정보 처리방침 「내 낚시터」).
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useMySpots, useSaveSpot } from '@/api/queries';
import { Field, Button, TextField } from '@/components/form';
import { AppMap } from '@/components/map/app-map';
import type { AppMapHandle, MapRegion } from '@/components/map/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UiIcon } from '@/components/ui-icon';
import { Brand, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentCoords } from '@/lib/location';

const KOREA: MapRegion = { latitude: 35.9, longitude: 127.8, latitudeDelta: 5.5, longitudeDelta: 5.5 };

export default function SpotNewScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const spots = useMySpots();
  const editing = editId != null ? (spots.data?.find((s) => s.id === editId) ?? null) : null;
  const theme = useTheme();
  const save = useSaveSpot();
  const mapRef = useRef<AppMapHandle>(null);
  const [center, setCenter] = useState<MapRegion>(KOREA);
  const [name, setName] = useState<string | null>(null);
  const [memo, setMemo] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const nameV = name ?? editing?.name ?? '';
  const memoV = memo ?? editing?.memo ?? '';
  // 너무 멀리서 찍으면 자리가 부정확하다 → 어느 정도 확대해야 저장
  const zoomedIn = editing != null || center.latitudeDelta <= 0.5;

  const locate = async () => {
    setLocating(true);
    const r = await getCurrentCoords();
    setLocating(false);
    if ('error' in r) return Alert.alert('현재 위치', r.error);
    mapRef.current?.moveTo({ latitude: r.coords.lat, longitude: r.coords.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
  };

  const submit = () => {
    if (!nameV.trim()) return Alert.alert('이름', '포인트 이름을 적어 주세요.');
    save.mutate(
      { id: editId ?? undefined, name: nameV.trim(), memo: memoV.trim() || null, lat: center.latitude, lon: center.longitude },
      {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: editId != null ? '포인트 고치기' : '내 포인트 추가' }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {editId == null ? (
          <View style={styles.mapBox}>
            <AppMap ref={mapRef} initialRegion={KOREA} markers={[]} onCameraIdle={setCenter} style={styles.flex} />
            {/* 가운데 핀: 지도를 움직여 자리를 맞춘다 */}
            <View pointerEvents="none" style={styles.pinWrap}>
              <UiIcon name="pin" size={40} color={Brand.orange} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="현재 위치로 지도 옮기기"
              onPress={locate}
              disabled={locating}
              style={[styles.gps, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <UiIcon name="navigate" size={18} />
              <ThemedText type="smallBold">{locating ? '찾는 중…' : '현재 위치로'}</ThemedText>
            </Pressable>
            {!zoomedIn ? (
              <View style={[styles.hint, { backgroundColor: theme.background }]} pointerEvents="none">
                <ThemedText type="small">지도를 확대해 핀을 정확한 자리에 맞춰 주세요</ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Field label="이름" required>
            <TextField value={nameV} onChangeText={setName} placeholder="예: 방파제 끝 테트라" maxLength={40} />
          </Field>
          <Field label="메모 (나만 보기)">
            <TextField value={memoV} onChangeText={setMemo} placeholder="채비, 잘 나온 물때·시간, 주차 위치 등" maxLength={500} multiline />
          </Field>
          <Button
            label={save.isPending ? '저장 중…' : editId != null ? '고친 내용 저장' : zoomedIn ? '이 자리에 저장' : '지도를 확대해 주세요'}
            disabled={save.isPending || !zoomedIn || (editId != null && !editing)}
            onPress={submit}
          />
          <ThemedText type="small" themeColor="textSecondary">
            포인트와 메모는 계정에 저장되고 나만 볼 수 있어요. 해황·물때는 가까운 공식 낚시터 자료로 보여드려요.
          </ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mapBox: { height: 300 },
  pinWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 36,
  },
  gps: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
  },
  hint: { position: 'absolute', left: 12, top: 12, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  form: { padding: Layout.screenPadding, gap: 12 },
});
