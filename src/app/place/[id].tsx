import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConditions, useDateRange, useFavorites, usePlaceKakao, usePlaces, usePlacesSummary, useSetFavorite } from '@/api/queries';
import { TripAddModal } from '@/components/add-to-trip';
import { Amenities } from '@/components/amenities';
import { BottomSheet } from '@/components/bottom-sheet';
import { CatchStrip } from '@/components/catch-strip';
import { CoordNote } from '@/components/coord-note';
import { Button } from '@/components/form';
import { MarineWarningBanner } from '@/components/marine-warning-banner';
import { NearbyShops } from '@/components/nearby-shops';
import { MetricTiles, NearbyCompact } from '@/components/place-compact';
import { PlaceNavigate } from '@/components/place-navigate';
import { PlaceGallery } from '@/components/place-photo';
import { Card, ErrorView, Loading } from '@/components/screen';
import { DataBasis, FishingIndexCard, MetricTable, NearbyPlaces, TideCard, WeatherForecastCard } from '@/components/sea-detail';
import { SegmentTabs } from '@/components/segment-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ZoneNotice } from '@/components/zone-notice';
import { Brand, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dayLabel, timeLabel } from '@/lib/compare';
import { nearLabel } from '@/lib/navigate';
import { nearby, PLACE_TYPE_LABEL, placeKindNote, placeName } from '@/lib/place';
import { pushRecentPlace, useHomePlace } from '@/lib/prefs';

type Tab = 'sea' | 'tide' | 'around';
const TABS: { value: Tab; label: string }[] = [
  { value: 'sea', label: '해황' },
  { value: 'tide', label: '물때' },
  { value: 'around', label: '주변 시설' },
];
type Sheet = 'index' | 'source' | 'around' | 'photo' | null;

/**
 * 위치 상세 (2026-11-23 화면 재설계): 길게 나열하던 구조를
 *   ① 장소·작은 지도/사진 ② 특보·위험구역(안전은 기본 화면에) ③ 파고·풍속·수온 3칸
 *   ④ [해황][물때][주변 시설] 탭 — 고른 탭 내용만 ⑤ 아래 고정 버튼 [조건 비교][출조계획에 추가]
 * 로 바꿨다. 낚시지수·전체 주변 시설·자료 출처·사진 크게 보기는 바텀시트로.
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
  const [tab, setTab] = useState<Tab>('sea');
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
              {/* 기관 지정 대표 지점 ↔ 실제 낚시 자리 구분, 위치 정확도는 짧게 */}
              {placeKindNote(place) ? (
                <ThemedText type="small" themeColor="tint">
                  {placeKindNote(place)}
                </ThemedText>
              ) : null}
              <CoordNote place={pc?.place ?? place} compact kakaoMoved={kakao.data?.moved} />
              <PlaceNavigate place={place} name={placeName(place)} compact />
              <View style={styles.links}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={() =>
                    router.push({
                      pathname: '/journal/new',
                      params: { place: String(place.id) },
                    })
                  }>
                  <ThemedText type="smallBold" themeColor="tint">
                    기록 남기기
                  </ThemedText>
                </Pressable>
                {place.id !== homeId ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => {
                      setHomeId(place.id);
                      router.back();
                    }}>
                    <ThemedText type="smallBold" themeColor="tint">
                      기준으로 설정
                    </ThemedText>
                  </Pressable>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    내 기준 낚시터
                  </ThemedText>
                )}
                {kakao.data ? (
                  <Pressable accessibilityRole="link" hitSlop={6} onPress={() => Linking.openURL(kakao.data!.url).catch(() => {})}>
                    <ThemedText type="smallBold" themeColor="tint">
                      카카오맵
                    </ThemedText>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" hitSlop={6} onPress={() => setSheet('source')}>
                  <ThemedText type="smallBold" themeColor="tint">
                    자료 출처
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </Card>
        ) : null}

        {pc ? (
          <>
            {/* 안전 정보는 기본 화면에: 출입통제·위험구역, 해상 특보(누르면 발표 시각·해역) */}
            <ZoneNotice regulation={pc.regulation} compact />
            <MarineWarningBanner w={pc.warning} />

            <View style={styles.between}>
              <ThemedText type="smallBold">현재 해황</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {today ? dayLabel(today) : ''}
                {cond.data ? ` · ${timeLabel(cond.data.generated_at)} 갱신` : ''}
              </ThemedText>
            </View>
            <MetricTiles pc={pc} />

            <SegmentTabs tabs={TABS} value={tab} onChange={setTab} />
            {tab === 'sea' ? (
              <>
                <MetricTable pc={pc} />
                <WeatherForecastCard pc={pc} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSheet('index')}
                  style={[
                    styles.rowLink,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundElement,
                    },
                  ]}>
                  <ThemedText type="smallBold">공식 바다낚시지수</ThemedText>
                  <ThemedText type="smallBold" themeColor="tint">
                    보기 ›
                  </ThemedText>
                </Pressable>
                <CatchStrip
                  title="이 낚시터 이용자 조황"
                  filter={{ placeId }}
                  note="이용자가 올린 조황이에요. 예보가 아니고, 낚시가 허용된 곳이라는 뜻도 아니에요."
                />
              </>
            ) : tab === 'tide' ? (
              <>
                {cal?.mulddae || cal?.sunrise ? (
                  <Card>
                    <ThemedText type="smallBold">
                      {[
                        cal.mulddae ? `물때 ${cal.mulddae}` : null,
                        cal.sunrise ? `일출 ${cal.sunrise}` : null,
                        cal.sunset ? `일몰 ${cal.sunset}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </ThemedText>
                    {cal.wind_dir_fc && cal.wind_fc_max ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        가장 센 바람 {cal.wind_dir_fc}풍 {cal.wind_fc_max.v}m/s (예보)
                      </ThemedText>
                    ) : null}
                    {calendarSource(cal) ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {calendarSource(cal)}
                      </ThemedText>
                    ) : null}
                  </Card>
                ) : null}
                <TideCard pc={pc} />
              </>
            ) : (
              <>
                {place && places.data && !place.location_suspect && !place.coord?.recommend_hold ? (
                  <NearbyPlaces
                    items={nearby(place, places.data, 8)}
                    currentId={place.id}
                    onPress={(p) =>
                      router.replace({
                        pathname: '/place/[id]',
                        params: { id: String(p.id) },
                      })
                    }
                  />
                ) : null}
                <Card>
                  <NearbyCompact placeId={placeId} onAll={() => setSheet('around')} />
                </Card>
              </>
            )}
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
            <PlaceGallery place={place} />
          </View>
        </Modal>
      ) : null}
    </ThemedView>
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
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'center',
    minHeight: 32,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  rowLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
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
