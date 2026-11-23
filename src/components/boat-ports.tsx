/**
 * 배낚시: 낚시어선 출항항 (2026-11-23).
 * - 지도 「출항항」 켜기 → 항구 핀(척수). 확대했을 때(위도 폭 3° 이하) 화면 안 것만, 최대 200개
 * - 항구 카드: 척수·최대 승객·배 이름 일부 · 그 앞바다(가장 가까운 낚시터 요약) 특보·파고·풍속 ·
 *   [선상낚시 업체](카카오, 전화) [길안내] [카카오맵]
 * - 신고정보에는 연락처·출항 시간이 없어 업체에 직접 확인하라고 늘 적는다. 예약·결제는 하지 않는다
 */
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { BoatPort, Place, PlaceSummary } from '@/api/types';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/form';
import type { MapMarker, MapRegion } from '@/components/map/types';
import { NearbyShops } from '@/components/nearby-shops';
import { useNavPicker } from '@/components/nav-picker';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const PORT_MAX_DELTA = 3;
const MAX_MARKERS = 200;

export function portMarkers(ports: BoatPort[] | undefined, view: MapRegion | null, selectedId: number | null): MapMarker[] {
  if (!ports || !view || view.latitudeDelta > PORT_MAX_DELTA) return [];
  const lat0 = view.latitude - view.latitudeDelta / 2;
  const lat1 = view.latitude + view.latitudeDelta / 2;
  const lon0 = view.longitude - view.longitudeDelta / 2;
  const lon1 = view.longitude + view.longitudeDelta / 2;
  return ports
    .filter((p) => p.lat >= lat0 && p.lat <= lat1 && p.lon >= lon0 && p.lon <= lon1)
    .slice(0, MAX_MARKERS)
    .map((p) => ({
      id: `h${p.id}`,
      lat: p.lat,
      lon: p.lon,
      tone: 'teal',
      kind: 'port',
      caption: `${p.boats}척`,
      label: `${p.name} 낚시어선 ${p.boats}척`,
      selected: p.id === selectedId,
    }));
}

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

/** 가까운 출항항 (선상 지점 상세용) */
export function nearestPort(ports: BoatPort[] | undefined, at: { lat: number | null; lon: number | null }) {
  if (!ports?.length || at.lat == null || at.lon == null) return null;
  const p = { lat: at.lat, lon: at.lon };
  let best: { port: BoatPort; km: number } | null = null;
  for (const port of ports) {
    const d = km(p, port);
    if (!best || d < best.km) best = { port, km: d };
  }
  return best;
}

/** 지도 왼쪽 아래(참고 포인트 위) 켜기/끄기 */
export function PortToggle({ on, onPress, zoomHint }: { on: boolean; onPress: () => void; zoomHint: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.toggleWrap} pointerEvents="box-none">
      {on && zoomHint ? (
        <View style={[styles.hint, { backgroundColor: theme.background }]}>
          <ThemedText type="small" themeColor="textSecondary">
            지도를 확대하면 항구가 보여요
          </ThemedText>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel="낚시어선 출항항 보기"
        onPress={onPress}
        style={({ pressed }) => [
          styles.toggle,
          { backgroundColor: on ? Brand.teal : theme.background, borderColor: on ? Brand.teal : theme.border },
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.toggleText, { color: on ? '#FFFFFF' : theme.text }]}>⚓ 출항항</Text>
      </Pressable>
    </View>
  );
}

export function PortCard({
  port,
  sea,
  notice,
  onClose,
}: {
  port: BoatPort;
  /** 항구에서 가장 가까운 낚시터의 요약 (20km 안일 때만) */
  sea: { place: Place; s: PlaceSummary | undefined; km: number } | null;
  notice: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [shops, setShops] = useState(false);
  const nav = useNavPicker({ kind: 'route', name: port.kakao_name, lat: port.lat, lon: port.lon });
  const s = sea?.s;
  const warn = s?.warning_level === 'warning' ? '해상 특보 발효 중' : s?.warning_level === 'nearby' ? '인근 해역 특보' : null;
  const seaParts = [
    s?.wave_fc_max ? `파고 최대 ${s.wave_fc_max.v}m` : null,
    s?.wind_fc_max ? `풍속 최대 ${s.wind_fc_max.v}m/s` : null,
  ].filter(Boolean);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <View style={[styles.tag, { backgroundColor: theme.tintSoft }]}>
            <ThemedText type="small" themeColor="tint">
              배낚시 출항항
            </ThemedText>
          </View>
          <ThemedText type="sectionTitle" numberOfLines={1}>
            {port.kakao_name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {port.sgg} · 낚시어선 {port.boats}척 · 최대 승객 {port.max_passengers}명
          </ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={10} onPress={onClose} style={styles.close}>
          <ThemedText themeColor="textSecondary">✕</ThemedText>
        </Pressable>
      </View>

      {sea ? (
        <View style={[styles.sea, { backgroundColor: warn ? theme.dangerSoft : theme.backgroundElement }]}>
          <ThemedText type="small" numberOfLines={2}>
            {warn ? (
              <ThemedText type="smallBold" themeColor="danger">
                {warn}
                {seaParts.length ? ' · ' : ''}
              </ThemedText>
            ) : null}
            {seaParts.join(' · ') || '오늘 예보 자료 없음'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {sea.place.name} {Math.round(sea.km)}km 기준 · 먼바다는 다를 수 있어요
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label="선상낚시 업체" onPress={() => setShops(true)} />
        </View>
        <View style={styles.flex}>
          <Button label="길안내" variant="navy" onPress={nav.open} />
        </View>
      </View>
      <View style={styles.links}>
        {port.kakao_url ? (
          <Pressable accessibilityRole="link" hitSlop={6} onPress={() => Linking.openURL(port.kakao_url!).catch(() => {})}>
            <ThemedText type="smallBold" themeColor="tint">
              카카오맵에서 항구 보기 ›
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {notice}
      </ThemedText>
      {nav.sheet}

      <BottomSheet open={shops} title={`${port.kakao_name} 주변 낚시배·낚시점`} onClose={() => setShops(false)}>
        {port.boat_names.length ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
            이 항구 신고 낚시어선: {port.boat_names.slice(0, 12).join(', ')}
            {port.boats > 12 ? ` 외 ${port.boats - 12}척` : ''}
          </ThemedText>
        ) : null}
        {shops ? <NearbyShops portId={port.id} area={port.sgg} /> : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  toggleWrap: { position: 'absolute', left: 16, bottom: 60, gap: 6, alignItems: 'flex-start' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
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
  toggleText: { fontSize: 14, fontWeight: '700' },
  hint: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  card: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tag: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, marginBottom: 2 },
  close: { padding: 4 },
  sea: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  links: { flexDirection: 'row', gap: 14, minHeight: 28, alignItems: 'center' },
});
