/**
 * 지도 「참고 포인트」 (탐험 1단계, 2026-11-19): 해양수산부 갯바위낚시포인트 1,070곳.
 * - 낚시터가 아니라 「해수부가 정리한 포인트 위치」 — 낚시 허용·접근 여부는 확인되지 않았다고 늘 적는다
 * - 해경 출입통제구역 200m 안은 서버에서 이미 뺐고, 연안사고 위험구역 100m 안은 빨간 경고
 * - 추천·출조계획·인증 대상이 아니다 (탐험 100선은 따로 검증 후)
 * - 1,070개를 한꺼번에 찍지 않게: 지도를 충분히 확대했을 때(위도 폭 1.5° 이하) 화면 안 것만, 최대 300개
 * - 2026-11-20: 근처 주소(카카오 좌표→주소, 번지 없으면 「○○리 근처」)·길안내·근처 낚시점(5km)·낚시배(15km)
 */
import { useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RockPoint } from '@/api/types';
import { Button } from '@/components/form';
import type { MapMarker, MapRegion } from '@/components/map/types';
import { NearbyShops } from '@/components/nearby-shops';
import { useNavPicker } from '@/components/nav-picker';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { nearLabel } from '@/lib/navigate';

export const ROCK_MAX_DELTA = 1.5;
const MAX_MARKERS = 300;

/** 화면 안의 참고 포인트 → 지도 마커 (id 「r123」) */
export function rockMarkers(points: RockPoint[] | undefined, view: MapRegion | null, selectedId: number | null): MapMarker[] {
  if (!points || !view || view.latitudeDelta > ROCK_MAX_DELTA) return [];
  const lat0 = view.latitude - view.latitudeDelta / 2;
  const lat1 = view.latitude + view.latitudeDelta / 2;
  const lon0 = view.longitude - view.longitudeDelta / 2;
  const lon1 = view.longitude + view.longitudeDelta / 2;
  return points
    .filter((p) => p.lat >= lat0 && p.lat <= lat1 && p.lon >= lon0 && p.lon <= lon1)
    .slice(0, MAX_MARKERS)
    .map((p) => ({
      id: `r${p.id}`,
      lat: p.lat,
      lon: p.lon,
      tone: p.id === selectedId ? 'selected' : p.danger ? 'danger' : 'gray',
      label: `참고 포인트 ${p.name.trim()}`,
      selected: p.id === selectedId,
    }));
}

/** 지도 왼쪽 아래 켜기/끄기 */
export function RockToggle({ on, onPress, zoomHint }: { on: boolean; onPress: () => void; zoomHint: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.toggleWrap} pointerEvents="box-none">
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel="해수부 갯바위 참고 포인트 보기"
        onPress={onPress}
        style={({ pressed }) => [
          styles.toggle,
          { backgroundColor: on ? '#0B2D4D' : theme.background, borderColor: on ? '#0B2D4D' : theme.border },
          pressed && styles.pressed,
        ]}>
        <View style={[styles.dot, { backgroundColor: on ? '#FFFFFF' : '#64748B' }]} />
        <Text style={[styles.toggleText, { color: on ? '#FFFFFF' : theme.text }]}>참고 포인트</Text>
      </Pressable>
      {on && zoomHint ? (
        <View style={[styles.hint, { backgroundColor: theme.background }]}>
          <ThemedText type="small" themeColor="textSecondary">
            지도를 확대하면 보여요
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const openInMap = (p: RockPoint) => {
  const name = encodeURIComponent(p.name.trim());
  const fallback =
    Platform.OS === 'ios' ? `https://maps.apple.com/?ll=${p.lat},${p.lon}&q=${name}` : `geo:${p.lat},${p.lon}?q=${p.lat},${p.lon}(${name})`;
  Linking.openURL(`kakaomap://look?p=${p.lat},${p.lon}`).catch(() => Linking.openURL(fallback).catch(() => {}));
};

/** 고른 참고 포인트 카드 */
export function RockCard({ point, source, onClose }: { point: RockPoint; source: string; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [shopsOpen, setShopsOpen] = useState(false);
  const name = point.name.trim();
  const nav = useNavPicker({ kind: 'route', name, lat: point.lat, lon: point.lon });
  const near = nearLabel(point.near_address, point.near_address_kind);
  const facts = [
    point.depth ? `수심 ${point.depth.replace(/m$/i, '')}m` : null,
    point.bottom ? `바닥 ${point.bottom}` : null,
    point.tide ? `물때 ${point.tide}` : null,
  ].filter(Boolean);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <View style={[styles.tag, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small" themeColor="textSecondary">
              참고 포인트 · 해양수산부 2022
            </ThemedText>
          </View>
          <ThemedText type="sectionTitle" numberOfLines={1}>
            {point.name.trim()}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {near ?? `${point.area} · ${point.admin}`}
          </ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={10} onPress={onClose} style={styles.close}>
          <ThemedText themeColor="textSecondary">✕</ThemedText>
        </Pressable>
      </View>

      {point.danger ? (
        <View style={[styles.warn, { backgroundColor: theme.dangerSoft }]}>
          <ThemedText type="smallBold" themeColor="danger">
            ⚠ 연안사고 위험구역 · {point.danger}
          </ThemedText>
        </View>
      ) : null}

      {facts.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {facts.join(' · ')}
        </ThemedText>
      ) : null}
      {point.catches.slice(0, 4).map((c) => (
        <ThemedText key={c.species} type="small" numberOfLines={1}>
          <ThemedText type="smallBold">{c.species}</ThemedText>
          {c.methods.length ? ` · ${c.methods.join(', ')}` : ''}
        </ThemedText>
      ))}

      <ThemedText type="small" themeColor="warning">
        낚시 허용 여부·가는 방법은 확인되지 않은 참고 위치예요. 섬은 배를 타야 할 수 있어요. 현장 안내와 지자체·해경 공고를 확인하세요.
      </ThemedText>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label="길안내" variant="navy" onPress={nav.open} />
        </View>
        <View style={styles.flex}>
          <Button label="근처 낚시점" variant="secondary" onPress={() => setShopsOpen(true)} />
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        가까운 길까지 안내해요 · 바위까지는 걸어가야 하고, 섬은 배를 타야 해요
      </ThemedText>
      <Pressable accessibilityRole="link" onPress={() => openInMap(point)} hitSlop={6} style={styles.link}>
        <ThemedText type="smallBold" themeColor="tint">
          지도 앱에서 위치 보기 ›
        </ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
        출처: {source}
        {point.near_address ? ' · 주소: 카카오 좌표→주소' : ''}
      </ThemedText>
      {nav.sheet}

      <Modal visible={shopsOpen} transparent animationType="slide" onRequestClose={() => setShopsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShopsOpen(false)} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <ThemedText type="sectionTitle" numberOfLines={1}>
                {name} 주변 낚시점·낚시배
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                낚시점 5km · 낚시배 15km 안 · 가까운 순 · 카카오 등록 업체
              </ThemedText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={10} onPress={() => setShopsOpen(false)} style={styles.close}>
              <ThemedText themeColor="textSecondary">✕</ThemedText>
            </Pressable>
          </View>
          <ScrollView style={styles.sheetList}>
            {shopsOpen ? <NearbyShops rockId={point.id} area={point.near_address ?? point.admin} /> : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  toggleWrap: { position: 'absolute', left: 16, bottom: 12, gap: 6, alignItems: 'flex-start' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  toggleText: { fontSize: 14, fontWeight: '700' },
  hint: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  card: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tag: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, marginBottom: 2 },
  close: { padding: 4 },
  warn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  link: { minHeight: 32, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { padding: 16, gap: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetList: { maxHeight: 460 },
});
