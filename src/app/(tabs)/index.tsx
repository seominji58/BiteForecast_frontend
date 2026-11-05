import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { useDateRange, usePlaces, usePlacesSummary } from '@/api/queries';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { PlacePicker } from '@/components/place-picker';
import { Card, TabScreen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { UiIcon } from '@/components/ui-icon';
import type { AppIconName } from '@/constants/icons';
import { Brand, IconSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WARNING_SHORT } from '@/lib/criteria';
import { matches, PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';
import { useHomePlace } from '@/lib/prefs';

// SCR-01 홈 (사용자 제안 구조, 2026-11-05): 해황 데이터를 먼저 보여주지 않고 「오늘 어디서 어떻게」를 고르는 출발점.
// 검색 · 내 주변(GPS, 누를 때만) · 지도 → 낚시터 목록+지도 → 상세 해황 / 비교
export default function HomeScreen() {
  const theme = useTheme();
  const places = usePlaces();
  const range = useDateRange();
  const summary = usePlacesSummary(range.data?.today);
  const [homeId, setHomeId] = useHomePlace();
  const [query, setQuery] = useState('');
  const [picker, setPicker] = useState(false);

  // 링크로 기준 낚시터 지정: /?place=147
  const linkPlace = useLocalSearchParams<{ place?: string }>().place;
  useEffect(() => {
    const id = Number(linkPlace);
    if (linkPlace && places.data?.some((p) => p.id === id) && id !== homeId) setHomeId(id);
  }, [linkPlace, places.data, homeId, setHomeId]);

  const home = places.data?.find((p) => p.id === homeId) ?? null;
  const homeSummary = summary.data?.places.find((s) => s.place_id === homeId);
  const results = query.trim() ? (places.data ?? []).filter((p) => matches(p, query)).slice(0, 6) : [];

  const openPlace = (p: Place) => {
    setHomeId(p.id); // 마지막으로 본 낚시터 = 기준 낚시터 (비교 A 자동 입력에 쓰임)
    setQuery('');
    Keyboard.dismiss();
    router.push({ pathname: '/place/[id]', params: { id: String(p.id) } });
  };

  return (
    <TabScreen title="입질예보" logo>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>오늘 어디로 낚시 가시나요?</Text>
        <Text style={styles.heroSub}>지역을 찾거나 현재 위치 주변을 살펴보세요.</Text>
      </View>

      <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder="지역·낚시터 검색 (예: 태안, 대천)" />
      {query.trim() ? (
        <Card>
          {results.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              맞는 낚시터가 없어요. 「지도로 찾기」에서 지역별로 둘러보세요.
            </ThemedText>
          ) : (
            results.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => openPlace(p)}
                style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
                <AppIcon name={PLACE_IMAGE[p.type]} size={IconSize.row} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {p.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {p.region_name} · {PLACE_TYPE_LABEL[p.type]}
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            ))
          )}
        </Card>
      ) : null}

      <View style={styles.tiles}>
        {/* 제공 아이콘 세트에 GPS·지도 그림이 없어 보조 아이콘 사용 */}
        <Tile
          icon={<UiIcon name="gps" size={IconSize.tile} />}
          title="내 주변 찾기"
          sub="현재 위치 기준"
          onPress={() => router.push({ pathname: '/explore', params: { near: '1' } })}
        />
        <Tile
          icon={<UiIcon name="map" size={IconSize.tile} />}
          title="지도로 찾기"
          sub="지역별 탐색"
          onPress={() => router.push('/explore')}
        />
      </View>

      <ThemedText type="sectionTitle">어떤 정보가 궁금하세요?</ThemedText>
      <MenuRow
        image="fishing-index"
        title="내 조건에 맞는 곳 찾기"
        sub="특보·파고·바람 기준과 공식 낚시지수로 거르기"
        onPress={() => router.push({ pathname: '/explore', params: { mode: 'criteria' } })}
      />
      <MenuRow
        image="wave"
        title="선택한 낚시터 해황 보기"
        sub={home ? `${home.name} · 물때·파고·풍속·수온 상세` : '물때·파고·풍속·수온 상세'}
        onPress={() =>
          home ? router.push({ pathname: '/place/[id]', params: { id: String(home.id) } }) : setPicker(true)
        }
      />
      <MenuRow
        image="fact"
        title="두 낚시터 비교하기"
        sub="같은 날 조건을 나란히 비교"
        onPress={() => router.push(home ? { pathname: '/compare', params: { a: String(home.id) } } : '/compare')}
      />

      {/* 최근 본 낚시터: 한 줄만. 특보 단계는 안전 정보라 함께 표시 */}
      {home ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(home.id) } })}
          style={({ pressed }) => [styles.recent, { borderColor: theme.border }, pressed && styles.pressed]}>
          <AppIcon name={PLACE_IMAGE[home.type]} size={IconSize.row} />
          <ThemedText type="small" themeColor="textSecondary">
            최근 본 곳
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
            {home.name}
          </ThemedText>
          {homeSummary ? (
            <ThemedText type="smallBold" themeColor={WARNING_SHORT[homeSummary.warning_level].color}>
              {WARNING_SHORT[homeSummary.warning_level].text}
            </ThemedText>
          ) : null}
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </Pressable>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        국립해양조사원·기상청 공공데이터 · 조과를 보장하지 않으며 출조 전 특보를 꼭 확인하세요
      </ThemedText>

      <PlacePicker
        visible={picker}
        title="해황을 볼 낚시터"
        selectedId={home?.id}
        onSelect={openPlace}
        onClose={() => setPicker(false)}
      />
    </TabScreen>
  );
}

function Tile({ icon, title, sub, onPress }: { icon: ReactNode; title: string; sub: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.tileIcon, { backgroundColor: theme.tintSoft }]}>{icon}</View>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {sub}
      </ThemedText>
    </Pressable>
  );
}

function MenuRow({
  image,
  title,
  sub,
  onPress,
}: {
  image: AppIconName;
  title: string;
  sub: string;
  onPress: () => void;
}): ReactNode {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.menu,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.menuIcon}>
        <AppIcon name={image} size={IconSize.menu} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {sub}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">›</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  center: { textAlign: 'center' },
  hero: { backgroundColor: Brand.navy, borderRadius: 12, padding: 16, gap: 4 },
  heroTitle: { color: Brand.onNavy, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: Brand.onNavySecondary, fontSize: 13 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 12, paddingVertical: 16 },
  tileIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  menu: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  menuIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
});
