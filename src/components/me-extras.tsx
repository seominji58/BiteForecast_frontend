import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useFavorites, usePlaces } from '@/api/queries';
import type { Place } from '@/api/types';
import { SectionHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { PlacePhoto } from '@/components/place-photo';
import { useTheme } from '@/hooks/use-theme';
import { placeName } from '@/lib/place';
import { getRecent, RECENT_PLACES } from '@/lib/prefs';

/** 낚시터를 가로 한 줄 카드로 (내정보가 세로로 길어지지 않게) */
function PlaceStrip({ places }: { places: Place[] }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {places.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`${placeName(p)}, ${p.region_name}`}
          onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(p.id) } })}
          style={({ pressed }) => [
            styles.tile,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <PlacePhoto place={p} size="thumb" style={styles.thumb} />
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {placeName(p)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {p.region_name}
            </ThemedText>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** 최근 본 낚시터 (이 기기에 저장, 로그인 없이도 보임). 가로 한 줄, 없으면 숨김 */
export function RecentPlacesSection() {
  const places = usePlaces();
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => {
    getRecent(RECENT_PLACES).then((list) => setIds(list.map(Number)));
  }, []);
  const list = ids.map((id) => places.data?.find((p) => p.id === id)).filter((p): p is Place => !!p);
  if (list.length === 0) return null;
  return (
    <>
      <SectionHeader title="최근 본 낚시터" />
      <PlaceStrip places={list} />
    </>
  );
}

/** 즐겨찾기 낚시터 (계정에 저장, 기기를 바꿔도 유지). 가로 한 줄 */
export function FavoritesSection() {
  const favs = useFavorites();
  return (
    <>
      <SectionHeader title="즐겨찾기 낚시터" />
      {favs.data?.length ? (
        <PlaceStrip places={favs.data} />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          낚시터 상세에서 ☆를 누르면 여기에 모여요.
        </ThemedText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 8, paddingRight: 8 },
  tile: {
    width: 168,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    minHeight: 60,
  },
  flex: { flex: 1 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  pressed: { opacity: 0.7 },
});
