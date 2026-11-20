/**
 * 낚시터 근처 낚시점·낚시배 (주변 플레이스 설계 2차, 2026-11-18).
 * - 서버가 카카오 로컬로 반경 검색한 결과 (낚시점 5km · 선상낚시 15km, 거리순)
 * - 줄을 누르면 네이버 지도에서 그 가게를 연다 (사진·리뷰·영업시간은 거기서). 📞 은 바로 전화
 * - 장비 대여 여부는 카카오 자료로 알 수 없어 「대여 여부는 전화로 확인」으로만 안내한다
 * - 결과가 없거나 검색할 수 없으면 그 이유를 쓰고, 가짜 가게를 만들지 않는다
 */
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { useNearbyShops } from '@/api/queries';
import type { NearbyShop } from '@/api/types';
import { Card } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { UiIcon } from '@/components/ui-icon';
import { useTheme } from '@/hooks/use-theme';

const naverSearch = (q: string) => `https://map.naver.com/p/search/${encodeURIComponent(q)}`;

const km = (m: number) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)}km`);

export function NearbyShops({ placeId, rockId, area }: { placeId?: number; rockId?: number; area: string }) {
  const theme = useTheme();
  const q = useNearbyShops(placeId ?? null, rockId ?? null);
  if (q.isPending) {
    return (
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          근처 낚시점을 찾는 중이에요…
        </ThemedText>
      </Card>
    );
  }
  if (q.isError) {
    return (
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          근처 낚시점을 지금 불러올 수 없어요.
        </ThemedText>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(naverSearch(`${area} 낚시점`))} hitSlop={8}>
          <ThemedText type="smallBold" themeColor="tint">
            네이버 지도에서 찾아보기 ›
          </ThemedText>
        </Pressable>
      </Card>
    );
  }
  const d = q.data;
  return (
    <Card style={styles.card}>
      {d.skipped ? (
        <ThemedText type="small" themeColor="textSecondary">
          {d.skipped}
        </ThemedText>
      ) : (
        <>
          <Group title="낚시점" sub="미끼·채비 · 대여 여부는 전화로 확인" items={d.shops} empty="반경 5km 안에 등록된 낚시점이 없어요." />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Group title="낚시배 (선상낚시)" sub="출항 항구·예약은 전화로 확인" items={d.boats} empty="반경 15km 안에 등록된 낚시배가 없어요." />
        </>
      )}
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(naverSearch(`${area} 낚시점`))} hitSlop={8} style={styles.more}>
        <ThemedText type="smallBold" themeColor="tint">
          네이버 지도에서 더 보기 ›
        </ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        출처: {d.source} · 영업 여부·위치는 방문 전에 확인하세요
      </ThemedText>
    </Card>
  );
}

function Group({ title, sub, items, empty }: { title: string; sub: string; items: NearbyShop[]; empty: string }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
          {sub}
        </ThemedText>
      </View>
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {empty}
        </ThemedText>
      ) : (
        items.slice(0, 5).map((s) => <ShopRow key={`${s.name}-${s.lat}-${s.lon}`} s={s} />)
      )}
    </View>
  );
}

function ShopRow({ s }: { s: NearbyShop }) {
  const theme = useTheme();
  const open = () => Linking.openURL(naverSearch(`${s.name} ${s.address}`));
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${s.name}, ${km(s.distance_m)}, 네이버 지도에서 보기`}
        onPress={open}
        style={({ pressed }) => [styles.flex, pressed && styles.pressed]}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {s.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {km(s.distance_m)} · {s.address}
        </ThemedText>
      </Pressable>
      {s.phone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${s.name}에 전화 걸기`}
          hitSlop={8}
          onPress={() => Linking.openURL(`tel:${s.phone!.replace(/[^0-9+]/g, '')}`)}
          style={[styles.iconBtn, { borderColor: theme.border }]}>
          <UiIcon name="phone" size={18} />
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="link" accessibilityLabel={`${s.name} 지도`} hitSlop={8} onPress={open} style={[styles.iconBtn, { borderColor: theme.border }]}>
        <UiIcon name="map" size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  group: { gap: 6 },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  more: { minHeight: 32, justifyContent: 'center' },
});
