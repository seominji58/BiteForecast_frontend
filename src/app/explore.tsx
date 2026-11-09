import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { useDateRange, usePlaces, usePlacesSummary } from '@/api/queries';
import type { Place, PlaceSummary } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Button, Chip } from '@/components/form';
import { Card, ErrorView } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, IconSize, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { timeLabel } from '@/lib/compare';
import { CriteriaResult } from '@/components/criteria-result';
import {
  breakdown,
  CHECK_TEXT,
  checkPlace,
  type Criteria,
  criteriaLabel,
  INDEX_STEPS,
  WAVE_STEPS,
  WARNING_SHORT,
  WIND_STEPS,
} from '@/lib/criteria';
import { type Coords, getCurrentCoords } from '@/lib/location';
import { km, PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';
import { useCriteria, useHomePlace } from '@/lib/prefs';

const KOREA: Region = { latitude: 36.0, longitude: 127.8, latitudeDelta: 6.5, longitudeDelta: 6.5 };
const PAGE = 20;

type Origin = { kind: 'gps' | 'home'; coords: Coords; label: string } | null;

/**
 * 낚시터 찾기 (사용자 결정 2026-11-05): 지도 + 거리순 목록 + 특보·해황 요약 → 상세 해황 / 비교.
 * - near=1: 들어오자마자 현재 위치(앱 사용 중 권한, 기기 안에서만 사용)
 * - mode=criteria: 「조건으로 찾기」 — 사용자가 정한 파고·풍속 상한 + 특보 + 공식 지수로 거른다 (앱 판정 없음)
 */
export default function ExploreScreen() {
  // pick=compare: 비교 화면에서 「지도에서 고르기」로 들어옴 (a = 이미 고른 A)
  const params = useLocalSearchParams<{ near?: string; mode?: string; pick?: string; a?: string }>();
  const theme = useTheme();
  const places = usePlaces();
  const range = useDateRange();
  const summary = usePlacesSummary(range.data?.today);
  const [homeId, , homeLoaded] = useHomePlace();
  const [criteria, setCriteria] = useCriteria();

  const [onlyMatching, setOnlyMatching] = useState(params.mode === 'criteria');
  // 같은 화면이 다른 진입점(조건으로 찾기 ↔ 지도)으로 다시 열리면 스위치를 진입점에 맞춘다
  const [lastMode, setLastMode] = useState(params.mode);
  if (params.mode !== lastMode) {
    setLastMode(params.mode);
    setOnlyMatching(params.mode === 'criteria');
  }
  const [editCriteria, setEditCriteria] = useState(false);
  const [gps, setGps] = useState<{ loading: boolean; coords: Coords | null; error: string | null }>({
    loading: false,
    coords: null,
    error: null,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [shown, setShown] = useState(PAGE);
  const mapRef = useRef<MapView>(null);

  const locate = async () => {
    setGps({ loading: true, coords: null, error: null });
    const r = await getCurrentCoords();
    if ('coords' in r) {
      setGps({ loading: false, coords: r.coords, error: null });
      mapRef.current?.animateToRegion(
        { latitude: r.coords.lat, longitude: r.coords.lon, latitudeDelta: 0.8, longitudeDelta: 0.8 },
        400,
      );
    } else setGps({ loading: false, coords: null, error: r.error });
  };

  // 「내 주변 찾기」로 들어오면 바로 위치 확인 (버튼을 눌러 들어온 경우만)
  const askedRef = useRef(false);
  useEffect(() => {
    if (params.near === '1' && !askedRef.current) {
      askedRef.current = true;
      locate();
    }
  }, [params.near]);

  const home = places.data?.find((p) => p.id === homeId) ?? null;
  const origin: Origin = useMemo(
    () =>
      gps.coords
        ? { kind: 'gps', coords: gps.coords, label: '현재 위치' }
        : home && home.lat != null && home.lon != null
          ? { kind: 'home', coords: { lat: home.lat, lon: home.lon }, label: `최근 본 ${home.name}` }
          : null,
    [gps.coords, home],
  );

  const byId = useMemo(() => new Map((summary.data?.places ?? []).map((s) => [s.place_id, s])), [summary.data]);

  const rows = useMemo(() => {
    const list = (places.data ?? [])
      .map((p) => {
        const s = byId.get(p.id);
        return { place: p, s, dist: origin ? km(origin.coords, p) : null, check: checkPlace(s, criteria) };
      })
      .filter((r) => !onlyMatching || r.check.status === 'meets');
    list.sort((a, b) =>
      a.dist != null && b.dist != null ? a.dist - b.dist : a.place.region_name.localeCompare(b.place.region_name),
    );
    return list;
  }, [places.data, byId, origin, criteria, onlyMatching]);

  const selected = rows.find((r) => r.place.id === selectedId) ?? null;

  // 조건 맞는 곳만 볼 때: 가까운 결과들이 지도에 보이도록 화면을 맞춘다
  const fitKey = onlyMatching ? rows.slice(0, 8).map((r) => r.place.id).join(',') : '';
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    if (!fitKey || !mapReady) return;
    const pts = rows
      .slice(0, 8)
      .filter((r) => r.place.lat != null && r.place.lon != null)
      .map((r) => ({ latitude: r.place.lat!, longitude: r.place.lon! }));
    if (origin) pts.push({ latitude: origin.coords.lat, longitude: origin.coords.lon });
    if (pts.length)
      mapRef.current?.fitToCoordinates(pts, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
  }, [fitKey, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const pinColor = (r: (typeof rows)[number]) => {
    if (r.s?.warning_level === 'warning') return theme.danger;
    if (onlyMatching || params.mode === 'criteria') return r.check.status === 'meets' ? Brand.teal : '#9AA5B1';
    return Brand.navy;
  };

  const initialRegion: Region = origin
    ? { latitude: origin.coords.lat, longitude: origin.coords.lon, latitudeDelta: 0.8, longitudeDelta: 0.8 }
    : KOREA;

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: params.mode === 'criteria' ? '조건으로 찾기' : '낚시터 찾기' }} />
      {homeLoaded ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={!!gps.coords}
          onMapReady={() => setMapReady(true)}>
          {rows
            .filter((r) => r.place.lat != null && r.place.lon != null)
            .map((r) => (
              <Marker
                key={r.place.id}
                coordinate={{ latitude: r.place.lat!, longitude: r.place.lon! }}
                pinColor={pinColor(r)}
                title={r.place.name}
                description={r.s ? WARNING_SHORT[r.s.warning_level].text : undefined}
                onPress={() => setSelectedId(r.place.id)}
              />
            ))}
        </MapView>
      ) : (
        <View style={styles.map} />
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {/* 거리 기준 */}
        <View style={styles.between}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {gps.loading
              ? '현재 위치 확인 중…'
              : origin
                ? `${origin.label}에서 가까운 순`
                : '지역순 (내 위치를 쓰면 가까운 순으로 보여드려요)'}
          </ThemedText>
          <Pressable accessibilityRole="button" onPress={locate} hitSlop={8} disabled={gps.loading}>
            {gps.loading ? (
              <ActivityIndicator color={theme.tint} />
            ) : (
              <View style={styles.between}>
                <AppIcon name="find-gps" size={IconSize.inline + 2} />
                <ThemedText type="smallBold" themeColor="tint">
                  내 위치로
                </ThemedText>
              </View>
            )}
          </Pressable>
        </View>
        {gps.error ? (
          <ThemedText type="small" themeColor="warning">
            {gps.error}
          </ThemedText>
        ) : null}

        {/* 조건으로 찾기 */}
        <Card>
          <View style={styles.between}>
            <ThemedText type="smallBold" style={styles.flex}>
              내 조건에 맞는 곳만
            </ThemedText>
            <Switch value={onlyMatching} onValueChange={setOnlyMatching} trackColor={{ true: Brand.teal }} />
          </View>
          <Pressable accessibilityRole="button" onPress={() => setEditCriteria((v) => !v)}>
            <ThemedText type="small" themeColor="textSecondary">
              {criteriaLabel(criteria)}{' '}
              <ThemedText type="smallBold" themeColor="tint">
                {editCriteria ? '닫기 ▴' : '바꾸기 ▾'}
              </ThemedText>
            </ThemedText>
          </Pressable>
          {editCriteria ? <CriteriaEditor c={criteria} onChange={setCriteria} /> : null}
          <ThemedText type="small" themeColor="textSecondary">
            앱이 좋고 나쁨을 판정하지 않아요. 오늘 남은 시간 예보 최대값이 내 기준 이하이고 특보가 발효 중이 아닌 곳을
            보여드려요. 예보가 없으면 「자료 부족」이에요.
          </ThemedText>
        </Card>

        {summary.isError ? <ErrorView message={summary.error.message} onRetry={() => summary.refetch()} /> : null}
        {places.isError ? <ErrorView message={places.error.message} onRetry={() => places.refetch()} /> : null}

        {selected ? (
          <SelectedCard
            place={selected.place}
            s={selected.s}
            dist={selected.dist}
            check={onlyMatching || params.mode === 'criteria' ? selected.check : null}
            homeId={homeId}
            pick={params.pick === 'compare' ? { a: params.a ? Number(params.a) : null } : null}
            onClose={() => setSelectedId(null)}
          />
        ) : null}

        <ThemedText type="sectionTitle">
          {onlyMatching ? `조건에 맞는 곳 ${rows.length}` : `낚시터 ${rows.length}`}
        </ThemedText>
        {summary.isPending || places.isPending ? <ActivityIndicator color={theme.tint} /> : null}
        {rows.length === 0 && summary.isSuccess ? (
          <Card>
            <CriteriaResult
              b={breakdown(summary.data.places, criteria)}
              criteria={criteria}
              places={places.data ?? []}
              origin={null}
              onChangeCriteria={() => setEditCriteria(true)}
            />
            <Button label="모든 낚시터 보기" variant="secondary" onPress={() => setOnlyMatching(false)} />
          </Card>
        ) : null}
        {rows.slice(0, shown).map((r) => (
          <PlaceRow
            key={r.place.id}
            place={r.place}
            s={r.s}
            dist={r.dist}
            check={onlyMatching || params.mode === 'criteria' ? r.check : null}
            selected={r.place.id === selectedId}
            onPress={() => {
              setSelectedId(r.place.id);
              if (r.place.lat != null && r.place.lon != null)
                mapRef.current?.animateToRegion(
                  { latitude: r.place.lat, longitude: r.place.lon, latitudeDelta: 0.3, longitudeDelta: 0.3 },
                  300,
                );
            }}
          />
        ))}
        {rows.length > shown ? (
          <Button label={`더 보기 (${rows.length - shown}곳 남음)`} variant="secondary" onPress={() => setShown((n) => n + PAGE)} />
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {summary.data?.disclaimer}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function CriteriaEditor({ c, onChange }: { c: Criteria; onChange: (c: Criteria) => void }) {
  return (
    <View style={styles.editor}>
      <ThemedText type="small" themeColor="textSecondary">
        파고 상한
      </ThemedText>
      <View style={styles.wrap}>
        {WAVE_STEPS.map((v) => (
          <Chip key={v} label={`${v}m`} selected={c.maxWave === v} onPress={() => onChange({ ...c, maxWave: v })} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        풍속 상한
      </ThemedText>
      <View style={styles.wrap}>
        {WIND_STEPS.map((v) => (
          <Chip key={v} label={`${v}m/s`} selected={c.maxWind === v} onPress={() => onChange({ ...c, maxWind: v })} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        국립해양조사원 바다낚시지수
      </ThemedText>
      <View style={styles.wrap}>
        {INDEX_STEPS.map((v) => (
          <Chip key={v ?? 'none'} label={v ? `${v} 이상` : '조건 없음'} selected={c.minIndex === v} onPress={() => onChange({ ...c, minIndex: v })} />
        ))}
      </View>
    </View>
  );
}

/** 요약 한 줄: 실측과 예보를 따로 표시 */
function metricText(s: PlaceSummary | undefined) {
  if (!s) return '해황 자료 없음';
  const part = (label: string, unit: string, obs: PlaceSummary['wave_obs'], fc: PlaceSummary['wave_fc_max']) => {
    const bits = [obs ? `실측 ${obs.v}${unit}` : null, fc ? `예보 최대 ${fc.v}${unit}` : null].filter(Boolean);
    return `${label} ${bits.length ? bits.join(' · ') : '자료 없음'}`;
  };
  return `${part('파고', 'm', s.wave_obs, s.wave_fc_max)}\n${part('풍속', 'm/s', s.wind_obs, s.wind_fc_max)}`;
}

function PlaceRow({
  place,
  s,
  dist,
  check,
  selected,
  onPress,
}: {
  place: Place;
  s: PlaceSummary | undefined;
  dist: number | null;
  check: ReturnType<typeof checkPlace> | null;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const w = s ? WARNING_SHORT[s.warning_level] : null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: selected ? Brand.orange : theme.border, backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <AppIcon name={PLACE_IMAGE[place.type]} size={IconSize.menu} />
      <View style={styles.flex}>
        <View style={styles.between}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
            {place.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {dist != null && Number.isFinite(dist) ? (dist < 1 ? '1km 미만' : `${Math.round(dist)}km`) : place.region_name}
          </ThemedText>
        </View>
        <ThemedText type="small" numberOfLines={1}>
          {w ? (
            <ThemedText type="small" themeColor={w.color} style={styles.bold}>
              {w.text}
            </ThemedText>
          ) : null}
          {check ? (
            <ThemedText type="small" themeColor={CHECK_TEXT[check.status].color} style={styles.bold}>
              {`  ${CHECK_TEXT[check.status].label}`}
            </ThemedText>
          ) : null}
          {s?.index ? (
            <ThemedText type="small" themeColor="textSecondary">{`  지수 최고 ${s.index.best}`}</ThemedText>
          ) : null}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {metricText(s)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function SelectedCard({
  place,
  s,
  dist,
  check,
  homeId,
  pick,
  onClose,
}: {
  place: Place;
  s: PlaceSummary | undefined;
  dist: number | null;
  check: ReturnType<typeof checkPlace> | null;
  homeId: number | null;
  /** 비교 화면에서 고르러 온 경우: 이미 고른 A (없으면 이 곳이 A) */
  pick: { a: number | null } | null;
  onClose: () => void;
}) {
  const w = s ? WARNING_SHORT[s.warning_level] : null;
  const compareWith = pick
    ? pick.a != null && pick.a !== place.id
      ? pick.a
      : null
    : homeId != null && homeId !== place.id
      ? homeId
      : null;
  return (
    <Card style={styles.selected}>
      <View style={styles.between}>
        <ThemedText type="sectionTitle" numberOfLines={1} style={styles.flex}>
          {place.name}
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="선택 닫기" hitSlop={10} onPress={onClose}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            ✕
          </ThemedText>
        </Pressable>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {place.region_name} · {PLACE_TYPE_LABEL[place.type]}
        {dist != null && Number.isFinite(dist) ? ` · ${dist < 1 ? '1km 미만' : `${Math.round(dist)}km`}` : ''}
      </ThemedText>
      {w ? (
        <ThemedText type="smallBold" themeColor={w.color}>
          {w.text}
          {s?.warning_types.length ? ` · ${s.warning_types.join('·')}` : ''}
        </ThemedText>
      ) : null}
      <ThemedText type="small">{metricText(s)}</ThemedText>
      {s?.temp_obs ? (
        <ThemedText type="small">
          수온 실측 {s.temp_obs.v}°C ({timeLabel(s.temp_obs.t)})
        </ThemedText>
      ) : null}
      {s?.index ? (
        <ThemedText type="small">
          바다낚시지수({s.index.period}) {s.index.best === s.index.worst ? s.index.best : `${s.index.worst}~${s.index.best}`} ·
          국립해양조사원
        </ThemedText>
      ) : null}
      {check ? (
        <ThemedText type="small" themeColor={CHECK_TEXT[check.status].color}>
          {CHECK_TEXT[check.status].label}: {check.notes.join(', ')}
        </ThemedText>
      ) : null}
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            label="상세 해황"
            variant="secondary"
            onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(place.id) } })}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={pick ? (compareWith ? 'B로 담아 비교' : 'A로 담기') : compareWith ? '기준 낚시터와 비교' : '비교하기'}
            onPress={() =>
              router.navigate({
                pathname: '/compare',
                params: compareWith ? { a: String(compareWith), b: String(place.id) } : { a: String(place.id) },
              })
            }
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.8 },
  map: { height: 300, width: '100%' },
  content: { padding: Layout.screenPadding, gap: Layout.gap, paddingBottom: 48 },
  between: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editor: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: Layout.cardRadius, padding: 10 },
  selected: { borderColor: Brand.orange, borderWidth: 1.5 },
  actions: { flexDirection: 'row', gap: 8 },
});
