import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { useTripMutation, useTrips } from '@/api/queries';
import type { Trip } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dayLabel } from '@/lib/compare';
import { periodLabel } from '@/lib/trip';

/**
 * 「출조계획에 추가」 (설계안 §4). 홈 해황·낚시터 상세에서 쓴다.
 * - 로그인 전: 계획 만들기 화면으로 (로그인 후 장소·날짜가 그대로 채워짐)
 * - 로그인 후: 그 날짜가 들어 있는 다가오는 계획에 넣거나, 새 계획 만들기
 */
export function AddToTripButton({ placeId, placeName, date }: { placeId: number; placeName: string; date: string }) {
  const { signedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const go = () =>
    signedIn ? setOpen(true) : router.push({ pathname: '/trip/new', params: { place: String(placeId), date } });
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={go}
        style={({ pressed }) => [styles.btn, { borderColor: theme.tint }, pressed && styles.pressed]}>
        <AppIcon name="trips" size={18} />
        <ThemedText type="smallBold" themeColor="tint">
          출조계획에 추가
        </ThemedText>
      </Pressable>
      {signedIn ? (
        <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
          {open ? <Sheet placeId={placeId} placeName={placeName} date={date} onClose={() => setOpen(false)} /> : null}
        </Modal>
      ) : null}
    </>
  );
}

function Sheet({ placeId, placeName, date, onClose }: { placeId: number; placeName: string; date: string; onClose: () => void }) {
  const theme = useTheme();
  const trips = useTrips('upcoming');
  const add = useTripMutation((v: { tripId: number; has: boolean }) =>
    api.addTripStop(v.tripId, { day: date, place_id: placeId, role: v.has ? 'alternative' : 'main' }),
  );
  // 이 날짜가 기간 안에 있는 계획만 (다른 날짜로 옮겨 넣지 않는다)
  const fits = (trips.data ?? []).filter((t) => t.start_date <= date && date <= t.end_date);
  const pick = (tripId: number, stopCount: number) =>
    add.mutate(
      { tripId, has: stopCount > 0 },
      {
        onSuccess: (t: Trip) => {
          onClose();
          router.push({ pathname: '/trip/[id]', params: { id: String(t.id) } });
        },
        onError: (e) => Alert.alert('추가하지 못했어요', e.message),
      },
    );
  return (
    <ThemedView style={styles.sheet}>
      <ThemedText type="sectionTitle">출조계획에 추가</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {placeName} · {dayLabel(date)}
      </ThemedText>
      {trips.isPending ? (
        <ThemedText type="small" themeColor="textSecondary">
          계획을 불러오는 중…
        </ThemedText>
      ) : fits.length ? (
        fits.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            onPress={() => pick(t.id, t.stop_count)}
            style={({ pressed }) => [styles.row, { borderColor: theme.border, backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">{t.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {periodLabel(t.start_date, t.end_date)} · 장소 {t.stop_count}곳
              </ThemedText>
            </View>
            <ThemedText themeColor="tint">추가 ›</ThemedText>
          </Pressable>
        ))
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {dayLabel(date)}이 들어 있는 계획이 없어요.
        </ThemedText>
      )}
      <Button
        label="이 날짜로 새 계획 만들기"
        onPress={() => {
          onClose();
          router.push({ pathname: '/trip/new', params: { place: String(placeId), date } });
        }}
      />
      <Button label="닫기" variant="secondary" onPress={onClose} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 10,
  },
  sheet: { flex: 1, padding: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 56 },
});
