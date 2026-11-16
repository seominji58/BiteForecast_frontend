import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { useDateRange, usePlaces, usePlacesSummary } from '@/api/queries';
import type { Place, PlaceSummary } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { AppMap, type AppMapHandle, type MapMarker, type MapRegion } from '@/components/map/app-map';
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
  freshnessLine,
  INDEX_STEPS,
  WAVE_STEPS,
  WARNING_SHORT,
  WIND_STEPS,
} from '@/lib/criteria';
import { type Coords, getCurrentCoords } from '@/lib/location';
import { CoordNote, SameCoordSheet } from '@/components/coord-note';
import { coordKey, distLabel, km, PLACE_IMAGE, PLACE_TYPE_LABEL, recommendable, sidoOf, usableForLocation } from '@/lib/place';
import { getRecent, RECENT_PLACES, useCriteria, useExploreRegion, useHomePlace } from '@/lib/prefs';

const KOREA: MapRegion = { latitude: 36.0, longitude: 127.8, latitudeDelta: 6.5, longitudeDelta: 6.5 };
const PAGE = 20;
/** 보이는 위도 폭을 몇 칸으로 나눠 묶을지 (지도 높이 300 기준 한 칸 약 35pt) */
const CLUSTER_CELLS = 9;

type Origin = { kind: 'gps' | 'home'; coords: Coords; label: string } | null;

/** 지역 값 앞붙임: 해역 (예: 'sea:서해'). 시·도는 이름 그대로 */
const SEA = 'sea:';
const SEA_ORDER = ['서해', '남해', '동해', '제주'] as const;

/**
 * 낚시터 찾기 (사용자 결정 2026-11-05): 지도 + 거리순 목록 + 특보·해황 요약 → 상세 해황 / 비교.
 * - near=1: 들어오자마자 현재 위치(앱 사용 중 권한, 기기 안에서만 사용)
 * - mode=criteria: 「조건으로 찾기」 — 사용자가 정한 파고·풍속 상한 + 특보 + 공식 지수로 거른다 (앱 판정 없음)
 * - region: 홈에서 고른 지역을 이어받는다. 해역은 'sea:서해' 처럼, 시·도는 이름 그대로 (지역 기준 통일, 서비스 개선 설계 H1)
 */
export default function ExploreScreen() {
  // pick=compare: 비교 화면에서 「지도에서 고르기」로 들어옴 (a = 이미 고른 A)
  const params = useLocalSearchParams<{ near?: string; mode?: string; pick?: string; a?: string; region?: string }>();
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
  const mapRef = useRef<AppMapHandle>(null);
  // 지금 지도에 보이는 범위 (마커 묶음 계산용, 이동·확대가 멈출 때 갱신)
  const [view, setView] = useState<MapRegion | null>(null);

  const locate = async () => {
    setGps({ loading: true, coords: null, error: null });
    const r = await getCurrentCoords();
    if ('coords' in r) {
      setGps({ loading: false, coords: r.coords, error: null });
      mapRef.current?.moveTo(
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

  // 거리 기준은 현재 위치(GPS 허용 시)뿐이다. 최근 본 낚시터를 기준으로 「가까운 순」이라 하지 않는다
  const origin: Origin = useMemo(
    () => (gps.coords ? { kind: 'gps', coords: gps.coords, label: '현재 위치' } : null),
    [gps.coords],
  );
  // 지역: 해역(서해·남해·동해·제주) 또는 시·도. 홈에서 넘어온 지역이 있으면 그것으로 시작
  const [region, setRegion] = useExploreRegion();
  const [lastRegionParam, setLastRegionParam] = useState<string | undefined>(undefined);
  if (params.region && params.region !== lastRegionParam) {
    setLastRegionParam(params.region);
    setRegion(params.region);
  }
  const seaOf = useMemo(
    () => new Map((summary.data?.places ?? []).map((s) => [s.place_id, s.sea_group])),
    [summary.data],
  );
  const inRegion = (p: Place) =>
    region === 'all' || (region.startsWith(SEA) ? seaOf.get(p.id) === region.slice(SEA.length) : sidoOf(p) === region);
  const regionOptions = useMemo<DropdownOption<string>[]>(() => {
    const counts = new Map<string, number>();
    const seas = new Map<string, number>();
    for (const p of places.data ?? []) {
      counts.set(sidoOf(p), (counts.get(sidoOf(p)) ?? 0) + 1);
      const sea = seaOf.get(p.id);
      if (sea) seas.set(sea, (seas.get(sea) ?? 0) + 1);
    }
    return [
      { value: 'all', label: '전국' },
      ...SEA_ORDER.filter((sea) => seas.has(sea)).map((sea) => ({
        value: `${SEA}${sea}`,
        label: `${sea} 전체`,
        hint: `${seas.get(sea)}곳`,
      })),
      ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([sd, n]) => ({ value: sd, label: sd, hint: `${n}곳` })),
    ];
  }, [places.data, seaOf]);
  const [recentPlaces, setRecentPlaces] = useState<Place[]>([]);
  useEffect(() => {
    getRecent(RECENT_PLACES).then((ids) =>
      setRecentPlaces(ids.map((id) => places.data?.find((p) => p.id === Number(id))).filter((p): p is Place => !!p)),
    );
  }, [places.data]);

  const stale = !!summary.data?.data_status.stale;
  const byId = useMemo(() => new Map((summary.data?.places ?? []).map((s) => [s.place_id, s])), [summary.data]);

  const rows = useMemo(() => {
    const list = (places.data ?? [])
      // 좌표 오류 의심(D등급)은 지도·거리순에서 뺀다 (상세·검색에는 남음)
      .filter(usableForLocation)
      .map((p) => {
        const s = byId.get(p.id);
        return { place: p, s, dist: origin ? km(origin.coords, p) : null, check: checkPlace(s, criteria) };
      })
      // 자료가 오래됐으면 「조건에 맞는 곳」을 고르지 않는다 (최신처럼 보이지 않게)
      // 「조건에 맞는 곳」은 추천이므로 좌표 불일치 의심 곳은 뺀다 (전체 보기에는 안내와 함께 남김)
      .filter((r) => !onlyMatching || (!stale && r.check.status === 'meets' && recommendable(r.place)))
      .filter((r) => inRegion(r.place));
    // 현재 위치가 있으면 거리순, 없으면 지역 이름 → 낚시터 이름순 (임의 기준의 「가까운 순」 없음)
    list.sort((a, b) =>
      a.dist != null && b.dist != null
        ? a.dist - b.dist
        : a.place.region_name.localeCompare(b.place.region_name) || a.place.name.localeCompare(b.place.name),
    );
    return list;
  }, [places.data, byId, origin, criteria, onlyMatching, stale, region, seaOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const regionName = region.startsWith(SEA) ? region.slice(SEA.length) : region;
  const orderLabel = gps.loading
    ? '현재 위치 확인 중…'
    : origin
      ? `${region === 'all' ? '' : `${regionName} · `}현재 위치에서 가까운 순`
      : region !== 'all'
        ? `${regionName} 낚시터 · 이름순`
        : '전국 · 지역 이름순 (내 위치를 쓰거나 지역을 고르면 그 기준으로 보여드려요)';

  const selected = rows.find((r) => r.place.id === selectedId) ?? null;
  const excluded = (places.data ?? []).filter((p) => !usableForLocation(p)).length;
  // 같은 좌표를 쓰는 낚시터는 핀 하나로 묶고, 누르면 목록으로 펼친다
  const pins = useMemo(() => {
    const g = new Map<string, typeof rows>();
    for (const r of rows) g.set(coordKey(r.place), [...(g.get(coordKey(r.place)) ?? []), r]);
    return [...g.values()];
  }, [rows]);
  const [samePick, setSamePick] = useState<Place[] | null>(null);

  // 조건 맞는 곳만 볼 때: 가까운 결과들이 지도에 보이도록 화면을 맞춘다
  const fitKey = onlyMatching ? rows.slice(0, 8).map((r) => r.place.id).join(',') : '';
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    if (!fitKey || !mapReady) return;
    const pts = rows
      .slice(0, 8)
      .filter((r) => r.place.lat != null && r.place.lon != null)
      .map((r) => ({ lat: r.place.lat!, lon: r.place.lon! }));
    if (origin) pts.push({ lat: origin.coords.lat, lon: origin.coords.lon });
    if (pts.length) mapRef.current?.fitTo(pts);
  }, [fitKey, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapReady || region === 'all' || origin) return;
    const pts = (places.data ?? [])
      .filter((p) => inRegion(p) && usableForLocation(p))
      .map((p) => ({ lat: p.lat!, lon: p.lon! }));
    if (pts.length) mapRef.current?.fitTo(pts);
  }, [region, mapReady, seaOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const tone = (r: (typeof rows)[number]): MapMarker['tone'] => {
    if (r.place.id === selectedId) return 'selected';
    if (r.s?.warning_level === 'warning') return 'danger';
    if (!stale && (onlyMatching || params.mode === 'criteria')) return r.check.status === 'meets' ? 'teal' : 'gray';
    return 'navy';
  };
  // 지도 마커 묶기: 지금 보이는 범위를 격자로 나눠, 화면에서 가까운 낚시터끼리 숫자 원 하나로 묶는다.
  // 확대할수록 격자가 작아져 갈라진다. 선택한 낚시터는 묶지 않고 따로 보인다.
  const clusters = useMemo(() => {
    const cell = (view?.latitudeDelta ?? KOREA.latitudeDelta) / CLUSTER_CELLS;
    const cells = new Map<string, (typeof pins)[number][]>();
    const alone: (typeof pins)[number][] = [];
    for (const g of pins) {
      const p = g[0].place;
      if (g.some((r) => r.place.id === selectedId)) {
        alone.push(g);
        continue;
      }
      const key = `${Math.floor(p.lat! / cell)}_${Math.floor(p.lon! / cell)}`;
      cells.set(key, [...(cells.get(key) ?? []), g]);
    }
    return [...[...cells.entries()].map(([key, groups]) => ({ key, groups })), ...alone.map((g) => ({ key: '', groups: [g] }))];
  }, [pins, view?.latitudeDelta, selectedId]);

  // 지도 마커: 낚시터 하나는 점, 같은 좌표 여러 곳·가까운 곳 묶음은 숫자 원 (특보 발효 곳이 있으면 빨강)
  const markers: MapMarker[] = clusters.map(({ key, groups }) => {
    if (groups.length > 1) {
      const all = groups.flat();
      const warn = all.some((x) => x.s?.warning_level === 'warning');
      return {
        id: `c${key}`,
        lat: groups.reduce((a, g) => a + g[0].place.lat!, 0) / groups.length,
        lon: groups.reduce((a, g) => a + g[0].place.lon!, 0) / groups.length,
        tone: warn ? 'danger' : 'navy',
        count: all.length,
        label: `가까운 낚시터 ${all.length}곳, 눌러서 확대`,
      };
    }
    const group = groups[0];
    const r = group[0];
    if (group.length === 1)
      return { id: `p${r.place.id}`, lat: r.place.lat!, lon: r.place.lon!, tone: tone(r), label: r.place.name };
    const warn = group.some((x) => x.s?.warning_level === 'warning');
    return {
      id: `g${coordKey(r.place)}`,
      lat: r.place.lat!,
      lon: r.place.lon!,
      tone: warn ? 'danger' : 'navy',
      count: group.length,
      label: `같은 좌표의 낚시터 ${group.length}곳`,
    };
  });
  const pressMarker = (id: string) => {
    if (id.startsWith('p')) return setSelectedId(Number(id.slice(1)));
    if (id.startsWith('c')) {
      const c = clusters.find((x) => `c${x.key}` === id);
      if (!c) return;
      const all = c.groups.flat();
      const lats = all.map((r) => r.place.lat!);
      const lons = all.map((r) => r.place.lon!);
      // 아주 가까이 모인 곳(약 2km)은 더 확대해도 갈라지지 않으니 목록으로 펼친다
      if (Math.max(...lats) - Math.min(...lats) < 0.02 && Math.max(...lons) - Math.min(...lons) < 0.02)
        return setSamePick(all.map((r) => r.place));
      return mapRef.current?.fitTo(all.map((r) => ({ lat: r.place.lat!, lon: r.place.lon! })));
    }
    const group = pins.find((g) => `g${coordKey(g[0].place)}` === id);
    if (group) setSamePick(group.map((x) => x.place));
  };

  const initialRegion: MapRegion = origin
    ? { latitude: origin.coords.lat, longitude: origin.coords.lon, latitudeDelta: 0.8, longitudeDelta: 0.8 }
    : KOREA;

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: params.mode === 'criteria' ? '조건으로 찾기' : '낚시터 찾기' }} />
      {homeLoaded ? (
        <AppMap
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          markers={markers}
          userLocation={gps.coords}
          onMarkerPress={pressMarker}
          onCameraIdle={setView}
          onReady={() => setMapReady(true)}
        />
      ) : (
        <View style={styles.map} />
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {/* 탐색 기준: 지역 + 현재 위치 */}
        <View style={styles.between}>
          <Dropdown label="지역" value={region} options={regionOptions} onChange={setRegion} compact />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex} numberOfLines={2}>
            {orderLabel}
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
        {recentPlaces.length ? (
          <View style={styles.recentRow}>
            <ThemedText type="small" themeColor="textSecondary">
              최근 본 곳
            </ThemedText>
            {recentPlaces.slice(0, 4).map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={false}
                onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(p.id) } })}
              />
            ))}
          </View>
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

        {summary.isSuccess ? (
          <ThemedText type="small" themeColor={stale ? 'warning' : 'textSecondary'}>
            {stale ? `⚠ ${summary.data.data_status.stale_reason} · ` : ''}
            {freshnessLine(summary.data.data_status)}
          </ThemedText>
        ) : null}
        {summary.isError ? <ErrorView message={summary.error.message} onRetry={() => summary.refetch()} /> : null}
        {places.isError ? <ErrorView message={places.error.message} onRetry={() => places.refetch()} /> : null}

        {selected ? (
          <SelectedCard
            place={selected.place}
            s={selected.s}
            dist={selected.dist}
            check={!stale && (onlyMatching || params.mode === 'criteria') ? selected.check : null}
            homeId={homeId}
            pick={params.pick === 'compare' ? { a: params.a ? Number(params.a) : null } : null}
            onClose={() => setSelectedId(null)}
          />
        ) : null}

        <ThemedText type="sectionTitle">
          {onlyMatching ? `조건에 맞는 곳 ${rows.length}` : `낚시터 ${rows.length}`}
        </ThemedText>
        {excluded ? (
          <ThemedText type="small" themeColor="textSecondary">
            좌표가 주소와 맞지 않는 {excluded}곳(위치 확인 필요)은 지도·거리순에서 뺐어요. 검색과 상세 화면에서는 볼 수 있어요.
          </ThemedText>
        ) : null}
        {summary.isPending || places.isPending ? <ActivityIndicator color={theme.tint} /> : null}
        {rows.length === 0 && summary.isSuccess ? (
          <Card>
            <CriteriaResult
              dataStatus={summary.data.data_status}
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
            check={!stale && (onlyMatching || params.mode === 'criteria') ? r.check : null}
            selected={r.place.id === selectedId}
            onPress={() => {
              setSelectedId(r.place.id);
              if (r.place.lat != null && r.place.lon != null)
                mapRef.current?.moveTo(
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
      <SameCoordSheet
        places={samePick}
        onClose={() => setSamePick(null)}
        onPick={(p) => {
          setSamePick(null);
          setSelectedId(p.id);
        }}
      />
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
            {distLabel(dist, place) ?? place.region_name}
          </ThemedText>
        </View>
        <CoordNote place={place} compact />
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
        {distLabel(dist, place) ? ` · ${distLabel(dist, place)}` : ''}
      </ThemedText>
      <CoordNote place={place} compact />
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
  recentRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editor: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: Layout.cardRadius, padding: 10 },
  selected: { borderColor: Brand.orange, borderWidth: 1.5 },
  actions: { flexDirection: 'row', gap: 8 },
});
