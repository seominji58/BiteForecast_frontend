/**
 * 주변 편의시설: 편의점·주차장·공중화장실 (2026-11-20).
 * - 서버가 카카오 로컬로 반경 2km 안을 가까운 순으로 3곳씩 찾는다
 * - 줄을 누르면 카카오맵 장소 페이지(위치·영업시간), 없으면 네이버 지도 검색
 * - 없으면 「반경 2km 안에 없어요」로 쓰고 채워 넣지 않는다. 영업 여부는 방문 전에 확인하라고 적는다
 */
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { useAmenities } from '@/api/queries';
import type { Amenity } from '@/api/types';
import { Card } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { UiIcon } from '@/components/ui-icon';
import { useTheme } from '@/hooks/use-theme';

const km = (m: number) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);
const naverSearch = (q: string) => `https://map.naver.com/p/search/${encodeURIComponent(q)}`;

export function Amenities({ placeId, rockId }: { placeId?: number; rockId?: number }) {
  const q = useAmenities(placeId ?? null, rockId ?? null);
  const theme = useTheme();
  if (q.isPending || q.isError) {
    return (
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {q.isPending ? '주변 편의점·주차장·화장실을 찾는 중이에요…' : '주변 편의시설을 지금 불러올 수 없어요.'}
        </ThemedText>
      </Card>
    );
  }
  const d = q.data;
  const r = km(d.radius_m);
  return (
    <Card style={styles.card}>
      {d.skipped ? (
        <ThemedText type="small" themeColor="textSecondary">
          {d.skipped}
        </ThemedText>
      ) : (
        <>
          <Group title="편의점" items={d.stores} empty={`반경 ${r} 안에 등록된 편의점이 없어요.`} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Group title="주차장" items={d.parking} empty={`반경 ${r} 안에 등록된 주차장이 없어요.`} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Group title="공중화장실" items={d.toilets} empty={`반경 ${r} 안에 등록된 공중화장실이 없어요.`} />
        </>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        출처: {d.source} · 반경 {r} · 영업 여부·요금은 방문 전에 확인하세요
      </ThemedText>
    </Card>
  );
}

function Group({ title, items, empty }: { title: string; items: Amenity[]; empty: string }) {
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {empty}
        </ThemedText>
      ) : (
        items.map((a) => <Row key={`${a.name}-${a.lat}-${a.lon}`} a={a} />)
      )}
    </View>
  );
}

function Row({ a }: { a: Amenity }) {
  const theme = useTheme();
  const open = () => Linking.openURL(a.kakao_url ?? naverSearch(`${a.name} ${a.address}`)).catch(() => {});
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${a.name}, ${km(a.distance_m)}, 지도에서 보기`}
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <ThemedText type="default" numberOfLines={1}>
          {a.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {km(a.distance_m)} · {a.address}
        </ThemedText>
      </View>
      <View style={[styles.iconBtn, { borderColor: theme.border }]}>
        <UiIcon name="map" size={16} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  group: { gap: 4 },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
