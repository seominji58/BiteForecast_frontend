import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useCatchSummary, useDateRange, useGeoSearch, useFishingIndex, usePlaces, usePlacesSummary, useSpecies } from '@/api/queries';
import type { CatchSummary, Place, PlaceSummary } from '@/api/types';
import { AddToTripButton } from '@/components/add-to-trip';
import { AppIcon } from '@/components/app-icon';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { AppMap, type AppMapHandle, type MapMarker, type MapRegion } from '@/components/map/app-map';
import { Button, Chip } from '@/components/form';
import { Card } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, IconSize, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
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
import { CoordNote, SameCoordSheet } from '@/components/coord-note';
import { coordKey, distLabel, km, matches, PLACE_IMAGE, PLACE_TYPE_LABEL, recommendable, sidoOf, usableForLocation } from '@/lib/place';
import { mergeWithApi, SPECIES } from '@/lib/species';
import { sortByCount, speciesPlaceCounts } from '@/lib/species-rank';
import { SearchBar } from '@/components/search-bar';
import { useCriteria, useExploreRegion, useHomePlace } from '@/lib/prefs';

const KOREA: MapRegion = { latitude: 36.0, longitude: 127.8, latitudeDelta: 6.5, longitudeDelta: 6.5 };
/** 보이는 위도 폭을 몇 칸으로 나눠 묶을지 (지도 높이 300 기준 한 칸 약 35pt) */
const CLUSTER_CELLS = 9;

type Origin = { kind: 'gps' | 'home'; coords: Coords; label: string } | null;

/** 지역 값 앞붙임: 해역 (예: 'sea:서해'). 시·도는 이름 그대로 */
const SEA = 'sea:';
const SEA_ORDER = ['서해', '남해', '동해', '제주'] as const;
/** 지도 어종 칩: 공식 바다낚시지수 어종을 앞에, 나머지는 「+ 다른 어종」에서 */
const INDEX_SPECIES = SPECIES.filter((x) => x.indexName).map((x) => x.indexName!);
/** 공식 낚시지수 등급 순서 (높을수록 바다 조건이 그 어종에 맞음) */
const GRADE_RANK: Record<string, number> = { 매우좋음: 5, 좋음: 4, 보통: 3, 나쁨: 2, 매우나쁨: 1 };

/**
 * 낚시터 찾기 (사용자 결정 2026-11-05): 지도 + 거리순 목록 + 특보·해황 요약 → 상세 해황 / 비교.
 * - near=1: 들어오자마자 현재 위치(앱 사용 중 권한, 기기 안에서만 사용)
 * - mode=criteria: 「조건으로 찾기」 — 사용자가 정한 파고·풍속 상한 + 특보 + 공식 지수로 거른다 (앱 판정 없음)
 * - region: 홈에서 고른 지역을 이어받는다. 해역은 'sea:서해' 처럼, 시·도는 이름 그대로 (지역 기준 통일, 서비스 개선 설계 H1)
 */
export default function ExploreScreen() {
  // pick=compare: 비교 화면에서 「지도에서 고르기」로 들어옴 (a = 이미 고른 A)
  const params = useLocalSearchParams<{ near?: string; mode?: string; pick?: string; a?: string; region?: string; fish?: string; date?: string }>();
  const theme = useTheme();
  const places = usePlaces();
  const range = useDateRange();
  const summary = usePlacesSummary(range.data?.today);
  const [homeId, , homeLoaded] = useHomePlace();
  const [criteria, setCriteria] = useCriteria();
  // 어종 칩 (M2): 오늘 그 어종 지수를 발표한 지점 + 지점 가까운 낚시터만 지도·목록에 남긴다
  // 근거 두 가지: ① 그날 공식 낚시지수 지점(+10km 안 낚시터) ② 낚시터가 알린 대상 어종(공공데이터 원문). 둘 다 조황은 아니다
  // 홈에서 어종을 고르고 「지도에서 찾기」로 오면 그 어종으로 시작 (?fish=우럭)
  const [fish, setFish] = useState<string | null>(params.fish ?? null);
  const [fishSheet, setFishSheet] = useState(false);
  const speciesApi = useSpecies();
  const allSpecies = useMemo(() => mergeWithApi(speciesApi.data), [speciesApi.data]);
  const fishItem = allSpecies.find((x) => x.name === fish) ?? null;
  const fishIsIndex = !!fish && INDEX_SPECIES.includes(fish);
  const fi = useFishingIndex(fishIsIndex ? range.data?.today : undefined);
  // 최근 14일 이용자 조황 (낚시터 이름까지 공개한 조황 글만) — 핀 강조·어종 칩 첫째 근거·핀 카드
  const catches = useCatchSummary(14);
  const catchById = useMemo(() => new Map((catches.data ?? []).map((c) => [c.place_id, c])), [catches.data]);
  const fishMatch = useMemo(() => {
    if (!fish) return null;
    const names0 = [fish, fishItem?.alias].filter((x): x is string => !!x);
    const user = new Set(
      (catches.data ?? []).filter((c) => c.species.some((n) => names0.some((x) => n.includes(x)))).map((c) => c.place_id),
    );
    const index = new Set<number>();
    if (fishIsIndex && fi.data)
      for (const pt of fi.data.points)
        if (pt.species.some((x) => x.species === fish)) for (const l of pt.places) index.add(l.place_id);
    const names = [fish, fishItem?.alias].filter((x): x is string => !!x);
    const info = new Set(
      (places.data ?? []).filter((p) => p.info_species && names.some((n) => p.info_species!.includes(n))).map((p) => p.id),
    );
    return { user, index, info, all: new Set([...user, ...index, ...info]) };
  }, [fish, fishIsIndex, fishItem, fi.data, places.data, catches.data]);
  const fishPlaces = fishMatch?.all ?? null;
  // 고른 어종의 오늘 공식 낚시지수 (국립해양조사원 발표값 그대로). 낚시터마다 가장 가까운 지수 지점의 등급
  // 바다 조건이 그 어종에 맞는지를 나타내는 값이지 조황·어획 가능성이 아니다
  const fishGrade = useMemo(() => {
    const m = new Map<number, { best: string; text: string; station: string; km: number | null }>();
    if (!fish || !fishIsIndex || !fi.data) return m;
    const dist = new Map<number, number>();
    for (const pt of fi.data.points) {
      const sp = pt.species.find((x) => x.species === fish);
      if (!sp) continue;
      const grades = fi.data.periods.map((per) => sp.grades[per]).filter((g): g is string => !!g);
      if (!grades.length) continue;
      const best = grades.reduce((a, b) => ((GRADE_RANK[b] ?? 0) > (GRADE_RANK[a] ?? 0) ? b : a));
      const text = fi.data.periods
        .filter((per) => sp.grades[per])
        .map((per) => `${per} ${sp.grades[per]}`)
        .join(' · ');
      for (const l of pt.places) {
        const d = l.distance_km ?? 99;
        if (d >= (dist.get(l.place_id) ?? Infinity)) continue;
        dist.set(l.place_id, d);
        m.set(l.place_id, { best, text, station: pt.station_name, km: l.distance_km });
      }
    }
    return m;
  }, [fish, fishIsIndex, fi.data]);
  const goodGrade = (id: number) => (GRADE_RANK[fishGrade.get(id)?.best ?? ''] ?? 0) >= 4;
  const badGrade = (id: number) => {
    const r = GRADE_RANK[fishGrade.get(id)?.best ?? ''];
    return r != null && r <= 2;
  };

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
  // 낚시터 이름·지역 검색 (목록을 늘어놓지 않고, 고르면 지도에서 그곳으로)
  const [query, setQuery] = useState('');
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

  // 지역: 해역(서해·남해·동해·제주) 또는 시·도. 홈에서 넘어온 지역이 있으면 그것으로 시작
  const [region, setRegion] = useExploreRegion();
  // 「내 주변 찾기」로 들어오면 바로 위치 확인 (버튼을 눌러 들어온 경우만)
  const askedRef = useRef(false);
  useEffect(() => {
    if (params.near === '1' && !askedRef.current) {
      askedRef.current = true;
      setRegion('all'); // 내 주변은 지역에 묶지 않는다 (예전에 고른 「서해 전체」 등이 남아 있으면 먼 곳만 나온다)
      locate();
    }
  }, [params.near]); // eslint-disable-line react-hooks/exhaustive-deps

  // 거리 기준은 현재 위치(GPS 허용 시)뿐이다. 최근 본 낚시터를 기준으로 「가까운 순」이라 하지 않는다
  const origin: Origin = useMemo(
    () => (gps.coords ? { kind: 'gps', coords: gps.coords, label: '현재 위치' } : null),
    [gps.coords],
  );
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
      .filter((r) => inRegion(r.place))
      .filter((r) => !fishPlaces || fishPlaces.has(r.place.id));
    // 현재 위치가 있으면 거리순, 없으면 지역 이름 → 낚시터 이름순 (임의 기준의 「가까운 순」 없음)
    // 동점(같은 좌표 등)은 지역 → 이름 → 낚시터 번호로 고정 (서버 응답 순서에 기대지 않음)
    list.sort(
      (a, b) =>
        (a.dist != null && b.dist != null ? a.dist - b.dist : 0) ||
        a.place.region_name.localeCompare(b.place.region_name) ||
        a.place.name.localeCompare(b.place.name) ||
        a.place.id - b.place.id,
    );
    return list;
  }, [places.data, byId, origin, criteria, onlyMatching, stale, region, seaOf, fishPlaces]); // eslint-disable-line react-hooks/exhaustive-deps

  // 어종 칩 순서: 지금 지역에서 지도에 많이 찍히는 어종 먼저 (공식 지수 지점 · 이용자 조황 · 공공데이터 대상 어종).
  // 칩 순서는 오늘 지수 기준 — 어종을 고르기 전에도 셀 수 있게 지수를 따로 받는다
  const fiAll = useFishingIndex(range.data?.today);
  const fishCounts = useMemo(
    () =>
      places.data && summary.data
        ? speciesPlaceCounts(allSpecies, {
            places: places.data.filter(usableForLocation),
            day: fiAll.data,
            catches: catches.data,
            scope: inRegion,
          })
        : null,
    [places.data, summary.data, allSpecies, fiAll.data, catches.data, region, seaOf], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const fishChips = useMemo(
    () => sortByCount(allSpecies, fishCounts).filter((x) => !fishCounts || (fishCounts.get(x.code) ?? 0) > 0 || x.name === fish),
    [allSpecies, fishCounts, fish],
  );
  const selected = rows.find((r) => r.place.id === selectedId) ?? null;
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

  // 위치를 잡으면 내 위치와 가장 가까운 낚시터 5곳이 한 화면에 들어오게 (지도가 준비된 뒤에)
  const gpsKey = gps.coords ? `${gps.coords.lat},${gps.coords.lon}` : '';
  useEffect(() => {
    if (!gpsKey || !mapReady || !origin) return;
    const pts = rows
      .filter((r) => r.dist != null)
      .slice(0, 5)
      .map((r) => ({ lat: r.place.lat!, lon: r.place.lon! }));
    pts.push({ lat: origin.coords.lat, lon: origin.coords.lon });
    mapRef.current?.fitTo(pts);
    // 화면을 막 연 직후에는 지도가 카메라 이동을 무시할 때가 있어 한 번 더 맞춘다
    const t = setTimeout(() => mapRef.current?.fitTo(pts), 700);
    return () => clearTimeout(t);
  }, [gpsKey, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // 어종을 고르면 그 어종 지점들이 한눈에 보이게 지도를 맞춘다
  const fishKey = fishPlaces ? `${fish}|${region}|${rows.length}` : '';
  useEffect(() => {
    if (!fishKey || !mapReady || !rows.length) return;
    mapRef.current?.fitTo(rows.map((r) => ({ lat: r.place.lat!, lon: r.place.lon! })));
  }, [fishKey, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const tone = (r: (typeof rows)[number]): MapMarker['tone'] => {
    if (r.place.id === selectedId) return 'selected';
    if (r.s?.warning_level === 'warning') return 'danger';
    if (!stale && (onlyMatching || params.mode === 'criteria')) return r.check.status === 'meets' ? 'teal' : 'gray';
    // 순서: 이용자 조황(실제 글) → 공식 지수 좋음 이상 → 지수 나쁨 → 그 외
    if (catchById.has(r.place.id)) return 'catch';
    if (goodGrade(r.place.id)) return 'good';
    if (badGrade(r.place.id)) return 'gray';
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
    // 격자 경계 양쪽에 걸린 묶음은 화면에서 붙어 보인다 → 중심이 한 칸보다 가까우면 한 번 더 합친다
    const center = (gs: (typeof pins)[number][]) => ({
      lat: gs.reduce((a, g) => a + g[0].place.lat!, 0) / gs.length,
      lon: gs.reduce((a, g) => a + g[0].place.lon!, 0) / gs.length,
    });
    let merged = [...cells.entries()].map(([key, groups]) => ({ key, groups }));
    for (let changed = true; changed; ) {
      changed = false;
      outer: for (let i = 0; i < merged.length; i++)
        for (let j = i + 1; j < merged.length; j++) {
          const a = center(merged[i].groups);
          const b = center(merged[j].groups);
          if (Math.hypot(a.lat - b.lat, a.lon - b.lon) < cell * 0.9) {
            merged[i] = { key: merged[i].key, groups: [...merged[i].groups, ...merged[j].groups] };
            merged = merged.filter((_, k) => k !== j);
            changed = true;
            break outer;
          }
        }
    }
    return [...merged, ...alone.map((g) => ({ key: '', groups: [g] }))];
  }, [pins, view?.latitudeDelta, selectedId]);

  // 지도 마커: 낚시터 하나는 점, 같은 좌표 여러 곳·가까운 곳 묶음은 숫자 원 (특보 발효 곳이 있으면 빨강)
  const markers: MapMarker[] = clusters.map(({ key, groups }) => {
    if (groups.length > 1) {
      const all = groups.flat();
      const warn = all.some((x) => x.s?.warning_level === 'warning');
      const caught = all.some((x) => catchById.has(x.place.id));
      const good = all.some((x) => goodGrade(x.place.id));
      return {
        id: `c${key}`,
        lat: groups.reduce((a, g) => a + g[0].place.lat!, 0) / groups.length,
        lon: groups.reduce((a, g) => a + g[0].place.lon!, 0) / groups.length,
        tone: warn ? 'danger' : caught ? 'catch' : good ? 'good' : 'navy',
        count: all.length,
        label: `가까운 낚시터 ${all.length}곳, 눌러서 확대`,
      };
    }
    const group = groups[0];
    const r = group[0];
    if (group.length === 1)
      return {
        id: `p${r.place.id}`,
        lat: r.place.lat!,
        lon: r.place.lon!,
        tone: tone(r),
        label: r.place.name,
        // 고른 어종의 오늘 공식 지수가 좋음 이상이면 그 어종 그림 핀 (조황 아님 — 바다 조건)
        fish: tone(r) === 'good' ? fishItem?.code : undefined,
      };
    const warn = group.some((x) => x.s?.warning_level === 'warning');
    const caught = group.some((x) => catchById.has(x.place.id));
    const good = group.some((x) => goodGrade(x.place.id));
    return {
      id: `g${coordKey(r.place)}`,
      lat: r.place.lat!,
      lon: r.place.lon!,
      tone: warn ? 'danger' : caught ? 'catch' : good ? 'good' : 'navy',
      count: group.length,
      label: `같은 좌표의 낚시터 ${group.length}곳`,
    };
  });
  // 핀을 고르면 지금 확대 그대로 그 핀을 지도 가운데로 (가장자리·아래 카드에 가리지 않게)
  const focusPlace = (p: Place) => {
    if (p.lat == null || p.lon == null) return;
    const d = view?.latitudeDelta ?? 1;
    mapRef.current?.moveTo({ latitude: p.lat, longitude: p.lon, latitudeDelta: d, longitudeDelta: d }, 300);
  };
  const pressMarker = (id: string) => {
    if (id.startsWith('p')) {
      const r = rows.find((x) => x.place.id === Number(id.slice(1)));
      if (r) focusPlace(r.place);
      return setSelectedId(Number(id.slice(1)));
    }
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

  const checkOf = (r: (typeof rows)[number]) => (!stale && (onlyMatching || params.mode === 'criteria') ? r.check : null);
  const note = gps.error
    ? { text: gps.error, color: 'warning' as const }
    : summary.isError || places.isError
      ? { text: '낚시터·해황 자료를 불러오지 못했어요. 잠시 후 다시 열어 주세요', color: 'warning' as const }
    : summary.isSuccess && stale
      ? { text: `⚠ ${summary.data.data_status.stale_reason}`, color: 'warning' as const }
      : fish && fishMatch
        ? {
            text:
              fishIsIndex && fi.isLoading
                ? `${fish} 지수 불러오는 중…`
                : rows.length === 0
                  ? `${fish}: 이 지역엔 표시할 곳이 없어요`
                  : fishIsIndex
                    ? `${fish} · 🐟 오늘 지수 좋음 ${rows.filter((r) => goodGrade(r.place.id)).length}곳 (바다 조건)`
                    : `${fish} · 낚시터가 알린 대상 어종 ${rows.length}곳`,
            color: 'textSecondary' as const,
          }
        : onlyMatching && summary.isSuccess && rows.length === 0
          ? { text: '지금 내 조건에 맞는 곳이 없어요 · 「기준 바꾸기」로 조건을 넓혀 보세요', color: 'warning' as const }
          : null;
  // 지역·장소 (카카오): 입력이 잠깐 멈추면 검색 (글자마다 부르지 않게)
  const [geoQ, setGeoQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setGeoQ(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);
  const geo = useGeoSearch(geoQ);
  const geoHits = query.trim() && geoQ === query.trim() ? (geo.data ?? []).slice(0, 5) : [];
  const pickGeo = (g: { lat: number; lon: number }) => {
    Keyboard.dismiss();
    setQuery('');
    mapRef.current?.moveTo({ latitude: g.lat, longitude: g.lon, latitudeDelta: 0.3, longitudeDelta: 0.3 }, 300);
  };
  const searchHits = query.trim()
    ? (places.data ?? []).filter((p) => usableForLocation(p) && matches(p, query)).slice(0, 6)
    : [];
  const pickPlace = (p: Place) => {
    Keyboard.dismiss();
    setQuery('');
    setSelectedId(p.id);
    if (p.lat != null && p.lon != null)
      mapRef.current?.moveTo({ latitude: p.lat, longitude: p.lon, latitudeDelta: 0.3, longitudeDelta: 0.3 }, 300);
  };

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: params.mode === 'criteria' ? '조건으로 찾기' : '낚시터 찾기' }} />

      {/* 지도가 화면의 주인공: 위에 지역·조건·어종 칩, 오른쪽 아래에 내 위치 버튼 */}
      <View style={styles.flex}>
        {homeLoaded ? (
          <AppMap
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            markers={markers}
            userLocation={gps.coords}
            onMarkerPress={pressMarker}
            onCameraIdle={setView}
            onReady={() => setMapReady(true)}
          />
        ) : null}

        <View style={styles.top} pointerEvents="box-none">
          <View style={styles.searchWrap}>
            <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder="낚시터·지역 검색" />
            {searchHits.length || geoHits.length ? (
              <View style={[styles.hits, { backgroundColor: theme.background, borderColor: theme.border }]}>
                {searchHits.map((p) => (
                  <Pressable key={p.id} accessibilityRole="button" onPress={() => pickPlace(p)} style={styles.hit}>
                    <AppIcon name={PLACE_IMAGE[p.type]} size={IconSize.inline + 4} />
                    <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
                      {p.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {p.region_name}
                    </ThemedText>
                  </Pressable>
                ))}
                {geoHits.length ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.hitHead}>
                    지역·장소 (카카오)
                  </ThemedText>
                ) : null}
                {geoHits.map((g, k) => (
                  <Pressable key={`g${k}`} accessibilityRole="button" onPress={() => pickGeo(g)} style={styles.hit}>
                    <AppIcon name="find-map" size={IconSize.inline + 4} />
                    <View style={styles.flex}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {g.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {g.address}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : query.trim() && (geo.isFetching || geoQ !== query.trim()) ? (
              <View style={[styles.hits, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.hit}>
                  찾는 중…
                </ThemedText>
              </View>
            ) : query.trim() ? (
              <View style={[styles.hits, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.hit}>
                  찾는 낚시터·지역이 없어요
                </ThemedText>
              </View>
            ) : null}
          </View>
          {/* 지역 + 어종 한 줄. 고른 어종을 다시 누르면 풀린다. 조건 칩은 「조건으로 찾기」로 들어왔을 때만 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Dropdown label="지역" value={region} options={regionOptions} onChange={setRegion} compact />
            {params.mode === 'criteria' ? (
              <>
                <Chip label={onlyMatching ? '내 조건만 ✓' : '내 조건만'} selected={onlyMatching} onPress={() => setOnlyMatching((v) => !v)} />
                <Chip label="기준 바꾸기" selected={false} onPress={() => setEditCriteria(true)} />
              </>
            ) : null}
            {fishChips.map((x) => (
              <Chip
                key={x.code}
                label={fishCounts ? `${x.name} ${fishCounts.get(x.code) ?? 0}` : x.name}
                selected={fish === x.name}
                onPress={() => setFish(fish === x.name ? null : x.name)}
              />
            ))}
            <Chip label="+ 다른 어종" selected={false} onPress={() => setFishSheet(true)} />
          </ScrollView>
          {note ? (
            <View style={[styles.notePill, { backgroundColor: theme.background }]}>
              <ThemedText type="small" themeColor={note.color} numberOfLines={2}>
                {note.text}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="내 위치로"
          onPress={locate}
          disabled={gps.loading}
          style={({ pressed }) => [styles.gpsBtn, { backgroundColor: theme.background }, pressed && styles.pressed]}>
          {gps.loading ? <ActivityIndicator color={theme.tint} /> : <AppIcon name="find-gps" size={26} />}
        </Pressable>
      </View>

      {/* 아래에는 목록을 두지 않는다 — 핀이나 검색으로 고른 곳만 카드로 */}
      {selected ? (
        <View style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <SelectedCard
            place={selected.place}
            s={selected.s}
            dist={selected.dist}
            check={checkOf(selected)}
            caught={catchById.get(selected.place.id) ?? null}
            grade={fish && fishGrade.get(selected.place.id) ? { fish, ...fishGrade.get(selected.place.id)! } : null}
            homeId={homeId}
            pick={params.pick === 'compare' ? { a: params.a ? Number(params.a) : null } : null}
            // 출조계획에 추가: 홈에서 고른 날짜(없으면 오늘)·지도에서 고른 어종·그 낚시터의 바다를 함께 넘긴다
            plan={
              range.data
                ? {
                    date: params.date ?? range.data.today,
                    species: fishItem?.code,
                    region: selected.s?.sea_group ?? undefined,
                  }
                : null
            }
            onClose={() => setSelectedId(null)}
          />
        </View>
      ) : null}

      {/* 다른 어종 고르기 (공식 지수가 없는 어종 포함) */}
      <Modal visible={fishSheet} transparent animationType="slide" onRequestClose={() => setFishSheet(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFishSheet(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <ThemedText type="sectionTitle">어종 고르기</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            공식 낚시지수가 없는 어종은 낚시터가 알린 대상 어종으로만 찾아요. 실제로 잡히는지(조황)는 아니에요.
          </ThemedText>
          <ScrollView style={styles.sheetList} contentContainerStyle={styles.wrap}>
            {allSpecies.map((x) => (
              <Chip
                key={x.code}
                label={x.indexName ? `${x.name} · 지수` : x.name}
                selected={fish === x.name}
                onPress={() => {
                  setFish(x.name);
                  setFishSheet(false);
                }}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* 내 조건 바꾸기: 화면 아래에서 올라오는 시트 */}
      <Modal visible={editCriteria} transparent animationType="slide" onRequestClose={() => setEditCriteria(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditCriteria(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <ThemedText type="sectionTitle">내 조건</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            지금: {criteriaLabel(criteria)}
          </ThemedText>
          <CriteriaEditor c={criteria} onChange={setCriteria} />
          <ThemedText type="small" themeColor="textSecondary">
            앱이 좋고 나쁨을 판정하지 않아요. 오늘 남은 시간 예보 최대값이 기준 이하이고 특보가 발효 중이 아닌 곳이에요.
          </ThemedText>
          <Button
            label="이 조건으로 보기"
            onPress={() => {
              setOnlyMatching(true);
              setEditCriteria(false);
            }}
          />
        </View>
      </Modal>
      <SameCoordSheet
        places={samePick}
        onClose={() => setSamePick(null)}
        onPick={(p) => {
          setSamePick(null);
          focusPlace(p);
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

function SelectedCard({
  place,
  s,
  dist,
  check,
  caught,
  grade,
  homeId,
  pick,
  plan,
  onClose,
}: {
  place: Place;
  s: PlaceSummary | undefined;
  dist: number | null;
  check: ReturnType<typeof checkPlace> | null;
  /** 최근 이용자 조황 요약 (없으면 null) */
  caught: CatchSummary | null;
  /** 고른 어종의 오늘 공식 낚시지수 (어종을 골랐고 지수가 있을 때만) */
  grade: { fish: string; text: string; station: string; km: number | null } | null;
  homeId: number | null;
  /** 비교 화면에서 고르러 온 경우: 이미 고른 A (없으면 이 곳이 A) */
  pick: { a: number | null } | null;
  /** 「출조계획에 추가」에 함께 넘길 날짜·어종 코드·바다 */
  plan: { date: string; species?: string; region?: string } | null;
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
  // 바다 한 줄: 특보 · 파고 · 풍속 (예보 최대, 없으면 실측). 자세한 건 상세에서
  const wave = s?.wave_fc_max?.v ?? s?.wave_obs?.v;
  const wind = s?.wind_fc_max?.v ?? s?.wind_obs?.v;
  // 단기예보가 없으면 기상청 중기해상예보 (해역 범위, 참고)
  const mid = wave == null && s?.mid_sea?.wave_max != null ? s.mid_sea : null;
  const seaLine = [
    w?.text,
    wave != null ? `파고 ${wave}m` : mid ? `파고 ${mid.wave_min ?? '?'}~${mid.wave_max}m · ${mid.region} 해역 예보` : null,
    wind != null ? `${s?.wind_fc_max && s.wind_dir_fc ? `${s.wind_dir_fc}풍` : '풍속'} ${wind}m/s` : null,
    s?.mulddae,
  ]
    .filter(Boolean)
    .join(' · ');
  const openDetail = () => router.push({ pathname: '/place/[id]', params: { id: String(place.id) } });
  return (
    <Card style={styles.selected}>
      <View style={styles.between}>
        <View style={styles.flex}>
          <ThemedText type="sectionTitle" numberOfLines={1}>
            {place.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {place.region_name} · {PLACE_TYPE_LABEL[place.type]}
            {distLabel(dist, place) ? ` · ${distLabel(dist, place)}` : ''}
          </ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="선택 닫기" hitSlop={10} onPress={onClose}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            ✕
          </ThemedText>
        </Pressable>
      </View>
      <CoordNote place={place} compact />
      {/* 이용자 조황을 먼저 (예보가 아니라 실제로 올라온 글) */}
      {caught ? (
        <Pressable accessibilityRole="button" onPress={openDetail} style={styles.caught}>
          <ThemedText type="smallBold" style={styles.caughtText} numberOfLines={1}>
            최근 조황 {caught.posts}건{caught.species.length ? ` · ${caught.species.join('·')}` : ''}
            {caught.best_cm != null ? ` · 최대 ${caught.best_cm}cm` : ''} · {daysAgo(caught.last_at)} ›
          </ThemedText>
        </Pressable>
      ) : null}
      {grade ? (
        <ThemedText type="small" numberOfLines={1}>
          {grade.fish} 지수 {grade.text}
        </ThemedText>
      ) : null}
      {seaLine ? (
        <ThemedText type="small" themeColor={w?.color === 'danger' ? 'danger' : 'textSecondary'} numberOfLines={1}>
          {seaLine}
        </ThemedText>
      ) : null}
      {s?.zone_notes?.length ? (
        <ThemedText type="small" themeColor={s.zone_notes[0].startsWith('출입통제') ? 'danger' : 'warning'} numberOfLines={1}>
          ⚠ {s.zone_notes.join(' · ')}
        </ThemedText>
      ) : null}
      {s?.sunrise ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          일출 {s.sunrise} · 일몰 {s.sunset ?? '–'}
        </ThemedText>
      ) : null}
      {check ? (
        <ThemedText type="small" themeColor={CHECK_TEXT[check.status].color} numberOfLines={2}>
          {CHECK_TEXT[check.status].label}: {check.notes.join(', ')}
        </ThemedText>
      ) : null}
      {pick ? (
        <Button
          label={compareWith ? 'B로 담아 비교' : 'A로 담기'}
          onPress={() =>
            router.navigate({
              pathname: '/compare',
              params: compareWith ? { a: String(compareWith), b: String(place.id) } : { a: String(place.id) },
            })
          }
        />
      ) : (
        <View style={styles.cardActions}>
          <View style={styles.flex}>
            <Button label="상세 보기" variant="secondary" onPress={openDetail} />
          </View>
          {plan ? (
            <View style={styles.flex}>
              <AddToTripButton
                placeId={place.id}
                placeName={place.name}
                date={plan.date}
                extra={{ species: plan.species, region: plan.region }}
              />
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}

/** 「오늘」 「3일 전」 */
function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? '오늘' : `${d}일 전`;
}

const styles = StyleSheet.create({
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  caught: { backgroundColor: 'rgba(242,140,40,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  caughtText: { color: '#B8641A' },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.8 },
  top: { position: 'absolute', top: 8, left: 0, right: 0, gap: 6 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Layout.screenPadding },
  notePill: { marginHorizontal: Layout.screenPadding, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  gpsBtn: {
    position: 'absolute',
    right: Layout.screenPadding,
    bottom: 12,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  panel: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Layout.screenPadding, paddingTop: 6, paddingBottom: 26, gap: 8 },
  searchWrap: { marginHorizontal: Layout.screenPadding, gap: 4 },
  hits: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  hit: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  hitHead: { paddingTop: 6 },
  sheetList: { maxHeight: 360 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { padding: Layout.screenPadding, paddingBottom: 36, gap: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  between: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editor: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: Layout.cardRadius, padding: 10 },
  selected: { borderColor: Brand.orange, borderWidth: 1.5 },
  actions: { flexDirection: 'row', gap: 8 },
});
