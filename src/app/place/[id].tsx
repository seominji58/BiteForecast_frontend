import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useConditions, useDateRange, usePlaces } from '@/api/queries';
import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { MarineWarningBanner } from '@/components/marine-warning-banner';
import { Card, ErrorView, Loading, SectionHeader, StackScreen } from '@/components/screen';
import { DataBasis, FishingIndexCard, MetricTable, NearbyPlaces, TideCard } from '@/components/sea-detail';
import { ThemedText } from '@/components/themed-text';
import { dayLabel, timeLabel } from '@/lib/compare';
import { nearby, PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';
import { useHomePlace } from '@/lib/prefs';

// 상세 해황 (재설계 v2 §4-4): 홈에서 줄인 내용을 모두 여기서 본다. 데이터는 홈과 같은 API.
export default function PlaceDetailScreen() {
  const placeId = Number(useLocalSearchParams<{ id: string }>().id);
  const places = usePlaces();
  const range = useDateRange();
  const [homeId, setHomeId] = useHomePlace();
  const place = places.data?.find((p) => p.id === placeId) ?? null;
  const today = range.data?.today;
  const cond = useConditions(place ? placeId : null, today);
  const pc = cond.data?.place;

  return (
    <StackScreen>
      <Stack.Screen options={{ title: place?.name ?? '상세 해황' }} />
      {places.isPending || (place && cond.isPending) ? <Loading /> : null}
      {places.isSuccess && !place ? (
        <ErrorView message="지원하지 않는 낚시터예요." onRetry={() => places.refetch()} />
      ) : null}
      {cond.isError ? <ErrorView message={cond.error.message} onRetry={() => cond.refetch()} /> : null}

      {place ? (
        <Card>
          <View style={styles.row}>
            <AppIcon name={PLACE_IMAGE[place.type]} size={32} />
            <View style={styles.flex}>
              <ThemedText type="sectionTitle">{place.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {place.region_name} · {PLACE_TYPE_LABEL[place.type]}
                {place.address ? ` · ${place.address}` : ''}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {today ? `${dayLabel(today)} · ` : ''}
            {place.id === homeId ? '내 기준 낚시터' : '기준 낚시터 아님'}
            {cond.data ? ` · ${timeLabel(cond.data.generated_at)} 갱신` : ''}
          </ThemedText>
          {place.id !== homeId ? (
            <Button
              label="이 낚시터를 기준으로 설정"
              variant="secondary"
              onPress={() => {
                setHomeId(place.id);
                router.back();
              }}
            />
          ) : null}
        </Card>
      ) : null}

      {pc ? (
        <>
          <MarineWarningBanner w={pc.warning} />

          <SectionHeader title="지금 바다" />
          <MetricTable pc={pc} />

          <SectionHeader title="물때 (오늘)" />
          <TideCard pc={pc} />

          <SectionHeader title="바다낚시지수 (국립해양조사원)" />
          <FishingIndexCard pc={pc} />

          {place && places.data ? (
            <>
              <SectionHeader title="가까운 낚시터" />
              <NearbyPlaces
                items={nearby(place, places.data, 10)}
                currentId={place.id}
                onPress={(p) => router.replace({ pathname: '/place/[id]', params: { id: String(p.id) } })}
              />
            </>
          ) : null}

          <DataBasis pc={pc} initiallyOpen />

          <Button
            label="다른 곳과 비교"
            onPress={() => router.push({ pathname: '/compare', params: { a: String(placeId) } })}
          />
          {/* 서버 고지문 전문(관측소 위치 차이·조과 비보장·특보 확인)은 상세에서 그대로 보여준다 */}
          <ThemedText type="small" themeColor="textSecondary">
            {cond.data?.disclaimer}
          </ThemedText>
        </>
      ) : null}
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
