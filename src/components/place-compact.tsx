/**
 * 위치 상세 재설계 조각 (2026-11-23)
 * - NearbyCompact: 주변 시설을 종류마다 한 줄 (가까운 1~2곳 + 거리). 없으면 「반경 2km 안 등록된 주차장 없음」 한 줄
 *   전체 목록은 「전체 보기」 시트에서 (낚시점·낚시배 + 편의시설 원래 카드)
 */
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { useAmenities, useNearbyShops } from '@/api/queries';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const km = (m: number) => (m < 1000 ? `${m}m` : `${Number((m / 1000).toFixed(1))}km`);
const naverSearch = (q: string) => `https://map.naver.com/p/search/${encodeURIComponent(q)}`;

type Item = {
  name: string;
  distance_m: number;
  address: string;
  kakao_url?: string | null;
};

export function NearbyCompact({ placeId, onAll }: { placeId: number; onAll: () => void }) {
  const shops = useNearbyShops(placeId);
  const am = useAmenities(placeId);
  const theme = useTheme();
  const rows: {
    label: string;
    items: Item[] | null;
    empty: string;
    loading: boolean;
  }[] = [
    {
      label: '낚시점',
      items: shops.data?.shops ?? null,
      empty: '반경 5km 안 등록된 낚시점 없음',
      loading: shops.isPending,
    },
    {
      label: '낚시배',
      items: shops.data?.boats ?? null,
      empty: '반경 15km 안 등록된 낚시배 없음',
      loading: shops.isPending,
    },
    {
      label: '편의점',
      items: am.data?.stores ?? null,
      empty: '반경 2km 안 등록된 편의점 없음',
      loading: am.isPending,
    },
    {
      label: '주차장',
      items: am.data?.parking ?? null,
      empty: '반경 2km 안 등록된 주차장 없음',
      loading: am.isPending,
    },
    {
      label: '화장실',
      items: am.data?.toilets ?? null,
      empty: '반경 2km 안 등록된 공중화장실 없음',
      loading: am.isPending,
    },
  ];
  const skipped = shops.data?.skipped ?? am.data?.skipped;
  if (skipped) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {skipped}
      </ThemedText>
    );
  }
  return (
    <View style={styles.list}>
      {rows.map((r) => {
        const top = (r.items ?? []).slice(0, 2);
        return (
          <View key={r.label} style={[styles.row, { borderColor: theme.border }]}>
            <ThemedText type="smallBold" style={styles.rowLabel}>
              {r.label}
            </ThemedText>
            {r.loading ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                찾는 중…
              </ThemedText>
            ) : top.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
                {r.items ? r.empty : '불러오지 못했어요'}
              </ThemedText>
            ) : (
              <View style={[styles.flex, styles.names]}>
                {top.map((it) => (
                  <Pressable
                    key={`${it.name}-${it.distance_m}`}
                    accessibilityRole="link"
                    accessibilityLabel={`${it.name} ${km(it.distance_m)}, 지도에서 보기`}
                    onPress={() => Linking.openURL(it.kakao_url ?? naverSearch(`${it.name} ${it.address}`)).catch(() => {})}
                    style={styles.nameBtn}>
                    <ThemedText type="small" numberOfLines={1}>
                      {it.name}{' '}
                      <ThemedText type="small" themeColor="textSecondary">
                        {km(it.distance_m)}
                      </ThemedText>
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}
      <Pressable accessibilityRole="button" onPress={onAll} style={styles.all}>
        <ThemedText type="smallBold" themeColor="tint">
          전체 보기 · 전화·지도 ›
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1,
    marginTop: 2,
  },
  tagText: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { width: 48 },
  names: { gap: 2, paddingVertical: 6 },
  nameBtn: { minHeight: 22, justifyContent: 'center' },
  all: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
