import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useFavorites, usePlaces } from '@/api/queries';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Card, SectionHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PLACE_IMAGE } from '@/lib/place';
import { getRecent, RECENT_PLACES } from '@/lib/prefs';

// 서버 기준값과 같다 (backend core/db.py DEFAULT_TITLES, services/points.py POINTS)
const TITLES: [string, number][] = [
  ['입문', 0],
  ['초보', 50],
  ['주말', 150],
  ['베테랑', 300],
  ['바다의 고수', 600],
];
const POINT_RULES: [string, number][] = [
  ['인증 완료 기록', 10],
  ['어종·크기까지 기록', 5],
  ['처음 가 본 낚시터', 15],
  ['같은 어종 최대어 갱신', 20],
];

function PlaceRows({ places, empty }: { places: Place[]; empty: string }) {
  const theme = useTheme();
  if (places.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {empty}
      </ThemedText>
    );
  }
  return (
    <>
      {places.map((p, i) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(p.id) } })}
          style={({ pressed }) => [
            styles.row,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <AppIcon name={PLACE_IMAGE[p.type]} size={IconSize.row} />
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {p.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {p.region_name}
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </Pressable>
      ))}
    </>
  );
}

/** 최근 본 낚시터 (이 기기에 저장, 로그인 없이도 보임) */
export function RecentPlacesSection() {
  const places = usePlaces();
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => {
    getRecent(RECENT_PLACES).then((list) => setIds(list.map(Number)));
  }, []);
  const list = ids.map((id) => places.data?.find((p) => p.id === id)).filter((p): p is Place => !!p);
  return (
    <>
      <SectionHeader title="최근 본 낚시터" />
      <Card style={styles.list}>
        <PlaceRows places={list} empty="아직 본 낚시터가 없어요. 홈에서 검색하거나 지도로 찾아보세요." />
      </Card>
    </>
  );
}

/** 즐겨찾기 낚시터 (계정에 저장, 기기를 바꿔도 유지) */
export function FavoritesSection() {
  const favs = useFavorites();
  return (
    <>
      <SectionHeader title="즐겨찾기 낚시터" />
      <Card style={styles.list}>
        <PlaceRows
          places={favs.data ?? []}
          empty="낚시터 상세 화면에서 ☆를 누르면 여기에 모아 둘 수 있어요."
        />
      </Card>
    </>
  );
}

/** 비회원에게 보여주는 회원 혜택: 포인트 규칙과 칭호 단계 (실제 서버 기준값) */
export function MemberBenefits() {
  const theme = useTheme();
  return (
    <>
      <SectionHeader title="회원이 되면" />
      <Card>
        <Benefit icon="cat-catch" text="낚시 기록을 계정에 보관해요. 휴대폰을 바꿔도 그대로 이어져요." />
        <Benefit icon="medal" text="사진 인증을 받은 기록마다 포인트가 쌓이고 칭호가 올라가요." />
        <Benefit icon="comment" text="커뮤니티에 조황을 올리고, 인증 기록은 「인증 조황」 배지로 공유해요." />
        <Benefit icon="find-map" text="자주 가는 낚시터를 즐겨찾기로 모아 둘 수 있어요." />
      </Card>
      <Card>
        <ThemedText type="smallBold">포인트 (사진 인증이 완료된 기록만)</ThemedText>
        {POINT_RULES.map(([label, p]) => (
          <View key={label} style={styles.between}>
            <ThemedText type="small">{label}</ThemedText>
            <ThemedText type="smallBold" themeColor="success">
              +{p}P
            </ThemedText>
          </View>
        ))}
        <View style={[styles.sep, { backgroundColor: theme.border }]} />
        <ThemedText type="smallBold">칭호</ThemedText>
        <View style={styles.ladder}>
          {TITLES.map(([name, min]) => (
            <View key={name} style={[styles.step, { borderColor: theme.border }]}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {min}P
              </ThemedText>
            </View>
          ))}
        </View>
      </Card>
    </>
  );
}

function Benefit({ icon, text }: { icon: Parameters<typeof AppIcon>[0]['name']; text: string }) {
  return (
    <View style={styles.benefit}>
      <AppIcon name={icon} size={IconSize.row} />
      <ThemedText type="small" style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  list: { gap: 0, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sep: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  ladder: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 2 },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
