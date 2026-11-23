import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useBoatPorts,
  useConditions,
  useDateRange,
  useFavorites,
  usePlaceKakao,
  usePlaces,
  usePlacesSummary,
  useSetFavorite,
} from '@/api/queries';
import { TripAddModal } from '@/components/add-to-trip';
import { Amenities } from '@/components/amenities';
import { BottomSheet } from '@/components/bottom-sheet';
import { CatchStrip } from '@/components/catch-strip';
import { CoordNote } from '@/components/coord-note';
import { Button } from '@/components/form';
import { MarineWarningBanner, warningSummary } from '@/components/marine-warning-banner';
import { useNavPicker } from '@/components/nav-picker';
import { UiIcon, type UiIconName } from '@/components/ui-icon';
import { NearbyShops } from '@/components/nearby-shops';
import { nearestPort } from '@/components/boat-ports';
import { NearbySummary } from '@/components/place-compact';
import { PlaceGallery } from '@/components/place-photo';
import { Card, ErrorView, Loading } from '@/components/screen';
import { DataBasis, FishingIndexCard, IndexChips } from '@/components/sea-detail';
import { SeaChart } from '@/components/sea-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ZoneNotice } from '@/components/zone-notice';
import { Brand, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { nearLabel, navTarget } from '@/lib/navigate';
import { nearby, PLACE_TYPE_LABEL, placeKindNote, placeName } from '@/lib/place';
import { pushRecentPlace, useHomePlace } from '@/lib/prefs';
import type { Place, PlaceCompare } from '@/api/types';

type Sheet = 'index' | 'source' | 'around' | 'photo' | 'safety' | null;

/**
 * 위치 상세 (2026-11-23 v2): ① 장소·작은 지도/사진 ② 위험구역·특보 ③ 공식 낚시지수 칩
 *   ④ 「오늘 바다」 그래프(물때·파고·바람·날씨 하루 선 그래프) ⑤ 근처 낚시터·주변 시설 ⑥ 조황
 *   아래 고정 [조건 비교][출조계획에 추가]. 탭을 없애 한 화면에서 위→아래로 읽는다.
 * 낚시지수 전체·주변 시설 전체·자료 출처·사진 크게 보기는 바텀시트로.
 * 데이터는 이전과 같은 API (GET /places/{id}/conditions · 전체 요약 · 카카오).
 */
export default function PlaceDetailScreen() {
  const placeId = Number(useLocalSearchParams<{ id: string }>().id);
  useEffect(() => {
    if (Number.isFinite(placeId)) pushRecentPlace(placeId);
  }, [placeId]);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const places = usePlaces();
  const range = useDateRange();
  const [homeId, setHomeId] = useHomePlace();
  const place = places.data?.find((p) => p.id === placeId) ?? null;
  const today = range.data?.today;
  const cond = useConditions(place ? placeId : null, today);
  const pc = cond.data?.place;
  const summary = usePlacesSummary(today);
  const cal = summary.data?.places.find((x) => x.place_id === placeId);
  const kakao = usePlaceKakao(placeId);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [trip, setTrip] = useState(false);

  const address = place ? (place.address ?? (place.near_address ? nearLabel(place.near_address, place.near_address_kind) : null)) : null;

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: place ? placeName(place) : '상세 해황' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {places.isPending || (place && cond.isPending) ? <Loading /> : null}
        {places.isSuccess && !place ? <ErrorView message="지원하지 않는 낚시터예요." onRetry={() => places.refetch()} /> : null}
        {cond.isError ? <ErrorView message={cond.error.message} onRetry={() => cond.refetch()} /> : null}

        {place ? (
          <Card style={styles.headCard}>
            {/* 사진(관광공사·이용자) 또는 작은 위치 지도. 누르면 크게 */}
            <Pressable accessibilityRole="button" accessibilityLabel="사진·지도 크게 보기" onPress={() => setSheet('photo')}>
              <PlaceGallery place={place} height={140} />
            </Pressable>
            <View style={styles.headBody}>
              <View style={styles.titleRow}>
                <View style={styles.flex}>
                  <ThemedText type="sectionTitle" numberOfLines={1}>
                    {placeName(place)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {place.region_name} · {PLACE_TYPE_LABEL[place.type]}
                    {address ? ` · ${address}` : ''}
                  </ThemedText>
                </View>
                <FavoriteStar placeId={place.id} />
              </View>
              {placeKindNote(place) ? (
                <ThemedText type="small" themeColor="tint" numberOfLines={1}>
                  {placeKindNote(place)}
                </ThemedText>
              ) : null}
              <CoordNote place={pc?.place ?? place} compact kakaoMoved={kakao.data?.moved} />
              {/* 행동은 아이콘 한 줄: 길안내(배 지점은 출항항)·공유·기록·기준·출처 */}
              <ActionRow
                place={place}
                isHome={place.id === homeId}
                onHome={() => setHomeId(place.id)}
                onSource={() => setSheet('source')}
                kakaoUrl={kakao.data?.url ?? null}
              />
            </View>
          </Card>
        ) : null}

        {pc ? (
          <>
            {/* 안전: 위험구역·특보를 한 줄씩, 누르면 자세히 */}
            <SafetyStrip pc={pc} onOpen={() => setSheet('safety')} />
            {/* 공식 낚시지수: 어종 칩 한 줄 (누르면 시간대·환경 범위 시트) */}
            <IndexChips pc={pc} onMore={() => setSheet('index')} />
            {/* 오늘 바다: 물때·파고·바람·날씨 하루 그래프 (지금 값 크게) */}
            {today ? <SeaChart pc={pc} date={today} cal={cal} updated={cond.data?.generated_at} /> : null}
            {/* 주변: 근처 낚시터 이름 + 시설 거리 요약, 누르면 전체 */}
            <NearbyCard place={place} all={places.data} onAll={() => setSheet('around')} />
            <CatchStrip
              title="이 낚시터 이용자 조황"
              filter={{ placeId }}
              note="이용자가 올린 조황이에요. 예보가 아니고, 낚시가 허용된 곳이라는 뜻도 아니에요."
            />
          </>
        ) : null}
      </ScrollView>

      {/* 주요 행동: 아래 고정 */}
      {place && today ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 8,
              backgroundColor: theme.background,
              borderColor: theme.border,
            },
          ]}>
          <View style={styles.flex}>
            <Button
              label="조건 비교"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/compare',
                  params: { a: String(placeId) },
                })
              }
            />
          </View>
          <View style={styles.flex}>
            <Button label="출조계획에 추가" onPress={() => setTrip(true)} />
          </View>
        </View>
      ) : null}

      {place && today ? (
        <TripAddModal target={trip ? { placeId: place.id, placeName: place.name } : null} date={today} onClose={() => setTrip(false)} />
      ) : null}
      {pc ? (
        <>
          <BottomSheet open={sheet === 'safety'} title="안전 정보" onClose={() => setSheet(null)}>
            <ZoneNotice regulation={pc.regulation} />
            <MarineWarningBanner w={pc.warning} />
          </BottomSheet>
          <BottomSheet open={sheet === 'index'} title="공식 바다낚시지수" onClose={() => setSheet(null)}>
            <FishingIndexCard pc={pc} />
          </BottomSheet>
          <BottomSheet open={sheet === 'source'} title="자료 기준·출처" onClose={() => setSheet(null)}>
            <DataBasis pc={pc} initiallyOpen />
            {cal && calendarSource(cal) ? (
              <ThemedText type="small" themeColor="textSecondary">
                {calendarSource(cal)}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              {cond.data?.disclaimer}
            </ThemedText>
          </BottomSheet>
        </>
      ) : null}
      {place ? (
        <BottomSheet open={sheet === 'around'} title="주변 시설" onClose={() => setSheet(null)}>
          <NearbyShops placeId={place.id} area={place.region_name} />
          <Amenities placeId={place.id} />
        </BottomSheet>
      ) : null}
      {place ? (
        <Modal visible={sheet === 'photo'} animationType="fade" onRequestClose={() => setSheet(null)}>
          <View style={[styles.photoModal, { paddingTop: insets.top + 8 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={() => setSheet(null)} style={styles.photoClose}>
              <Text style={styles.photoCloseText}>✕</Text>
            </Pressable>
            <PlaceGallery place={place} onPost={() => setSheet(null)} />
          </View>
        </Modal>
      ) : null}
    </ThemedView>
  );
}

/**
 * 상단 행동 한 줄 (2026-11-23): 아이콘 + 짧은 글자. 길안내(배 지점이면 가까운 출항항) · 공유 · 기록 · 기준 · 출처
 * 길안내 정확도 안내는 길안내 시트에서 (상단을 짧게)
 */
function ActionRow({
  place,
  isHome,
  onHome,
  onSource,
  kakaoUrl,
}: {
  place: Place;
  isHome: boolean;
  onHome: () => void;
  onSource: () => void;
  kakaoUrl: string | null;
}) {
  const theme = useTheme();
  const name = placeName(place);
  const t = navTarget(place, name);
  const nav = useNavPicker(t);
  const ports = useBoatPorts();
  const port = t.kind === 'none' ? nearestPort(ports.data?.ports, place) : null;
  const share = () => Share.share({ message: [name, place.address ?? place.region_name].filter(Boolean).join('\n') }).catch(() => {});
  const items: { icon: UiIconName; label: string; onPress: () => void; on?: boolean }[] = [
    t.kind !== 'none'
      ? { icon: 'navigate', label: t.kind === 'route' ? '길안내' : '주소 찾기', onPress: nav.open }
      : port && port.km <= 60
        ? {
            icon: 'boat',
            label: `출항항 ${Math.round(port.km)}km`,
            onPress: () => router.push({ pathname: '/explore', params: { port: String(port.port.id) } }),
          }
        : { icon: 'map', label: '카카오맵', onPress: () => kakaoUrl && Linking.openURL(kakaoUrl).catch(() => {}) },
    { icon: 'share', label: '공유', onPress: share },
    { icon: 'edit', label: '기록', onPress: () => router.push({ pathname: '/journal/new', params: { place: String(place.id) } }) },
    { icon: isHome ? 'homeOn' : 'home', label: isHome ? '내 기준' : '기준 설정', onPress: onHome, on: isHome },
    { icon: 'info', label: '자료 출처', onPress: onSource },
  ];
  return (
    <View style={[styles.actions, { borderColor: theme.border }]}>
      {items.map((it) => (
        <Pressable
          key={it.label}
          accessibilityRole="button"
          accessibilityState={it.on != null ? { selected: it.on } : undefined}
          onPress={it.onPress}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
          <UiIcon name={it.icon} size={22} color={it.on ? Brand.orange : Brand.teal} />
          <ThemedText type="small" numberOfLines={1} style={styles.actionText}>
            {it.label}
          </ThemedText>
        </Pressable>
      ))}
      {nav.sheet}
    </View>
  );
}

/** 안전 한 카드: 위험구역·특보를 한 줄씩. 누르면 자세한 안내 시트 */
function SafetyStrip({ pc, onOpen }: { pc: PlaceCompare; onOpen: () => void }) {
  const theme = useTheme();
  const zones = pc.regulation.items.filter((i) => i.restriction_type === 'access' || i.restriction_type === 'coastal_danger');
  const w = warningSummary(pc.warning);
  const danger = pc.warning.level === 'warning' || zones.some((z) => z.restriction_type === 'access');
  const caution = danger || zones.length > 0 || pc.warning.level === 'nearby' || pc.warning.level === 'preliminary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.safety,
        { backgroundColor: danger ? theme.dangerSoft : caution ? theme.warningSoft : theme.backgroundElement, borderColor: theme.border },
        pressed && { opacity: 0.85 },
      ]}>
      <View style={styles.flex}>
        {zones.map((z, i) => {
          const [, near] = (z.remarks ?? '').split(' · ');
          const control = z.restriction_type === 'access';
          return (
            <ThemedText key={i} type="small" numberOfLines={1}>
              <ThemedText type="smallBold" themeColor={control ? 'danger' : 'warning'}>
                {control ? '출입통제구역' : '연안사고 위험구역'}
              </ThemedText>
              {near ? ` · ${near}` : ''}
            </ThemedText>
          );
        })}
        <ThemedText type="small" numberOfLines={1}>
          <ThemedText type="smallBold" themeColor={w.fg}>
            {w.title}
          </ThemedText>
          {w.sub ? ` · ${w.sub}` : ''}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">›</ThemedText>
    </Pressable>
  );
}

/** 주변 한 카드: 근처 낚시터 이름(누르면 그곳) + 시설 거리 요약, 「전체」는 시트 */
function NearbyCard({ place, all, onAll }: { place: Place | null; all: Place[] | undefined; onAll: () => void }) {
  const theme = useTheme();
  if (!place) return null;
  const near =
    all && !place.location_suspect && !place.coord?.recommend_hold ? nearby(place, all, 6).filter((x) => x.place.id !== place.id) : [];
  return (
    <View style={[styles.nearCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.nearHead}>
        <ThemedText type="smallBold">주변</ThemedText>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAll}>
          <ThemedText type="smallBold" themeColor="tint">
            시설 전체 · 전화·지도 ›
          </ThemedText>
        </Pressable>
      </View>
      {near.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearRow}>
          {near.map(({ place: p, km }) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => router.replace({ pathname: '/place/[id]', params: { id: String(p.id) } })}
              style={({ pressed }) => [
                styles.nearPill,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && { opacity: 0.7 },
              ]}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {p.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {PLACE_TYPE_LABEL[p.type]} · {km < 1 ? '1km 안' : `${Math.round(km)}km`}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <NearbySummary placeId={place.id} />
    </View>
  );
}

/** 물때(음력)·일출·일몰 출처 한 줄. 한국천문연구원 자료를 못 받았으면 「계산」이라고 그대로 쓴다 */
function calendarSource(c: { mulddae?: string | null; lunar_source?: string | null; sunrise?: string | null; sun_source?: string | null }) {
  const parts = [
    c.mulddae && c.lunar_source ? `음력 ${c.lunar_source}` : null,
    c.sunrise && c.sun_source ? `일출·일몰 ${c.sun_source}` : null,
  ].filter(Boolean);
  return parts.length ? `출처: ${parts.join(' · ')}` : null;
}

/** 즐겨찾기 ☆ (로그인 필요, 계정에 저장) */
function FavoriteStar({ placeId }: { placeId: number }) {
  const { signedIn } = useAuth();
  const favs = useFavorites();
  const set = useSetFavorite();
  const on = !!favs.data?.some((p) => p.id === placeId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={on ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      accessibilityState={{ selected: on }}
      hitSlop={10}
      disabled={set.isPending}
      onPress={() => (signedIn ? set.mutate({ placeId, on: !on }) : router.push('/login'))}>
      <Text style={[styles.star, { color: on ? Brand.orange : '#9AA5B1' }]}>{on ? '★' : '☆'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Layout.screenPadding,
    gap: Layout.gap,
    paddingBottom: Layout.gap * 3,
  },
  star: { fontSize: 26, lineHeight: 30 },
  headCard: { padding: 0, overflow: 'hidden', gap: 0 },
  headBody: { padding: 12, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  action: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48 },
  actionText: { fontSize: 12 },
  safety: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nearCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  nearHead: { flexDirection: 'row', justifyContent: 'space-between' },
  nearRow: { gap: 6 },
  nearPill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 160 },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  photoModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  photoClose: {
    position: 'absolute',
    top: 54,
    right: 16,
    zIndex: 2,
    padding: 8,
  },
  photoCloseText: { color: '#FFF', fontSize: 24, fontWeight: '700' },
});
