/**
 * 낚시터 상세 「주변」 카드의 시설 요약 (2026-11-23): 낚시점·낚시배·편의점·주차장·화장실마다 가장 가까운 곳 거리.
 * 전체 목록(전화·지도)은 상세의 「시설 전체」 시트에서.
 */
import { StyleSheet, View } from 'react-native';

import { useAmenities, useNearbyShops } from '@/api/queries';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const km = (m: number) => (m < 1000 ? `${m}m` : `${Number((m / 1000).toFixed(1))}km`);

type Item = { name: string; distance_m: number };

/** 주변 시설 한 줄 요약: 종류마다 가장 가까운 곳 거리 (상세 「주변」 카드, 2026-11-23) */
export function NearbySummary({ placeId }: { placeId: number }) {
  const shops = useNearbyShops(placeId);
  const am = useAmenities(placeId);
  const theme = useTheme();
  const skipped = shops.data?.skipped ?? am.data?.skipped;
  if (skipped) return null;
  const cats: [string, Item[] | undefined][] = [
    ['낚시점', shops.data?.shops],
    ['낚시배', shops.data?.boats],
    ['편의점', am.data?.stores],
    ['주차장', am.data?.parking],
    ['화장실', am.data?.toilets],
  ];
  return (
    <View style={styles.sumRow}>
      {cats.map(([label, items]) =>
        items === undefined ? null : (
          <View key={label} style={[styles.sumChip, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ThemedText type="small" themeColor={items.length ? 'text' : 'textSecondary'}>
              {label} {items.length ? km(items[0].distance_m) : '없음'}
            </ThemedText>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sumRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sumChip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
