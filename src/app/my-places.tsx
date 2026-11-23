/**
 * 내 낚시터 (2026-11-23): 직접 찍은 비공개 포인트 · 찜한 곳 · 최근 본 곳을 한 화면에.
 * 포인트를 누르면 시트: 메모 · 「해황 보기(가까운 공식 낚시터 기준)」 · 길안내 · 고치기 · 지우기.
 * 포인트는 본인만 본다 (서버 /me/spots). 해황은 30km 안 가장 가까운 공식 낚시터 자료로 본다.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useDeleteSpot, useMySpots } from '@/api/queries';
import type { UserSpot } from '@/api/types';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/form';
import { LoginRequired } from '@/components/login-required';
import { FavoritesSection, RecentPlacesSection } from '@/components/me-extras';
import { useNavPicker } from '@/components/nav-picker';
import { ErrorView, Loading, SectionHeader, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { UiIcon } from '@/components/ui-icon';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

export default function MyPlacesScreen() {
  const { status } = useAuth();
  const spots = useMySpots();
  const theme = useTheme();
  const [open, setOpen] = useState<UserSpot | null>(null);

  if (status === 'loading') return <Loading />;
  if (status !== 'signed-in') {
    return (
      <StackScreen>
        <LoginRequired
          title="내 낚시터는 로그인하면 써요"
          message="직접 찍은 포인트와 메모는 나만 볼 수 있게 계정에 저장돼요."
          icon="trips"
        />
        <RecentPlacesSection />
      </StackScreen>
    );
  }
  const list = spots.data ?? [];
  return (
    <StackScreen>
      <SectionHeader
        title={`내 포인트 ${list.length ? list.length : ''}`.trim()}
        actionLabel="+ 추가"
        onAction={() => router.push('/spot/new')}
      />
      {spots.isPending ? <Loading /> : null}
      {spots.isError ? <ErrorView message={spots.error.message} onRetry={() => spots.refetch()} /> : null}
      {spots.isSuccess && list.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/spot/new')}
          style={({ pressed }) => [
            styles.empty,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <UiIcon name="pin" size={28} />
          <ThemedText type="smallBold">나만 아는 포인트를 저장해 보세요</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            지도에서 자리를 찍고 채비·잘 나온 시간 같은 메모를 남겨요.{'\n'}나만 볼 수 있어요.
          </ThemedText>
        </Pressable>
      ) : null}
      {list.length ? (
        <View style={[styles.list, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {list.map((s, i) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              onPress={() => setOpen(s)}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <UiIcon name="pin" size={20} color={Brand.orange} />
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {s.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {s.memo ?? (s.near ? `해황 기준 ${s.near.name} ${s.near.km}km` : '30km 안 공식 낚시터 없음')}
                </ThemedText>
              </View>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FavoritesSection />
      <RecentPlacesSection />

      <BottomSheet open={!!open} title={open?.name ?? ''} onClose={() => setOpen(null)}>
        {open ? <SpotDetail spot={open} onDone={() => setOpen(null)} /> : null}
      </BottomSheet>
    </StackScreen>
  );
}

function SpotDetail({ spot, onDone }: { spot: UserSpot; onDone: () => void }) {
  const del = useDeleteSpot();
  const nav = useNavPicker({ kind: 'route', name: spot.name, lat: spot.lat, lon: spot.lon });
  const remove = () =>
    Alert.alert('포인트를 지울까요?', `「${spot.name}」과 메모가 지워져요.`, [
      { text: '취소', style: 'cancel' },
      { text: '지우기', style: 'destructive', onPress: () => del.mutate(spot.id, { onSuccess: onDone }) },
    ]);
  return (
    <View style={styles.sheet}>
      {spot.memo ? <ThemedText>{spot.memo}</ThemedText> : <ThemedText themeColor="textSecondary">메모 없음</ThemedText>}
      <ThemedText type="small" themeColor="textSecondary">
        {spot.lat.toFixed(5)}, {spot.lon.toFixed(5)} · {spot.created_at.slice(0, 10)} 저장 · 나만 보기
      </ThemedText>
      {spot.near ? (
        <Button
          label={`해황·물때 보기 · ${spot.near.name} ${spot.near.km}km 기준`}
          onPress={() => {
            onDone();
            router.push({ pathname: '/place/[id]', params: { id: String(spot.near!.id) } });
          }}
        />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          30km 안에 공식 낚시터가 없어 해황을 붙이지 못했어요.
        </ThemedText>
      )}
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label="길안내" variant="navy" onPress={nav.open} />
        </View>
        <View style={styles.flex}>
          <Button
            label="고치기"
            variant="secondary"
            onPress={() => {
              onDone();
              router.push({ pathname: '/spot/new', params: { id: String(spot.id) } });
            }}
          />
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={remove} hitSlop={8} style={styles.del}>
        <ThemedText type="smallBold" themeColor="danger">
          포인트 지우기
        </ThemedText>
      </Pressable>
      {nav.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  center: { textAlign: 'center' },
  empty: { alignItems: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 20 },
  list: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8 },
  sheet: { gap: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  del: { alignSelf: 'center', paddingVertical: 8 },
});
