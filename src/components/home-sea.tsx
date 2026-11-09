/**
 * 홈 v3 (2026-11-09) 구성 요소: 출조 후보 카드 · 지역별 바다 상황 지도 · 선택한 낚시터의 해황(물때 선 그래프).
 *
 * 원칙
 * - 값을 만들지 않는다: 자료가 없으면 「없음」과 이유를 쓴다 (0 으로 채우지 않음)
 * - 물때는 「가까운 조위관측소 예보」 참고 자료다 — 관측소 이름·거리·자료 기준을 항상 함께 보여준다
 * - 파고·풍속·특보는 섞지 않고 따로 보여준다
 * - 사진처럼 보이는 가짜 이미지를 쓰지 않는다 (낚시터 유형 아이콘 + 정보 카드)
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { useConditions } from '@/api/queries';
import type { Place, PlaceSummary, Series } from '@/api/types';
import { AddToTripButton } from '@/components/add-to-trip';
import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, IconSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, findSeries, REASON_TEXT, timeLabel } from '@/lib/compare';
import { WARNING_SHORT } from '@/lib/criteria';
import { CoordNote, SameCoordSheet } from '@/components/coord-note';
import { distLabel, isApprox, PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';

const TIDE_TYPE = { high: '만조', low: '간조' } as const;

/** 거리 표시 (대략 위치면 「약」) */
export function distanceText(d: number | null, place?: Place | null): string | null {
  return distLabel(d, place);
}

/* ───────────── 출조 후보 카드 ───────────── */

export function CandidateCard({
  place,
  s,
  dist,
  future,
  selected,
  onSelect,
}: {
  place: Place;
  s: PlaceSummary;
  dist: number | null;
  future: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  const w = WARNING_SHORT[s.warning_level];
  const where = [place.region_name, PLACE_TYPE_LABEL[place.type], distanceText(dist, place)].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${place.name}, ${where}, 이 낚시터 해황 보기`}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.cand,
        { borderColor: selected ? theme.tint : theme.border, backgroundColor: theme.backgroundElement },
        selected && styles.candSelected,
        pressed && styles.pressed,
      ]}>
      <View style={styles.candHead}>
        {/* 사진 대신 낚시터 유형 정보 칸 (가짜 사진 없음) */}
        <View style={[styles.candArt, { backgroundColor: theme.tintSoft }]}>
          <AppIcon name={PLACE_IMAGE[place.type]} size={28} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {place.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {where}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${place.name} 상세 보기`}
          hitSlop={10}
          onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(place.id) } })}
          style={styles.detailLink}>
          <ThemedText type="small" themeColor="tint">
            상세 ›
          </ThemedText>
        </Pressable>
      </View>
      <CoordNote place={place} compact />
      {/* 파고 · 바람 · 특보를 따로 */}
      <View style={styles.metrics}>
        <Metric icon="wave" label="파고 최대" value={s.wave_fc_max ? `${s.wave_fc_max.v}m` : '없음'} />
        <Metric icon="wind" label="풍속 최대" value={s.wind_fc_max ? `${s.wind_fc_max.v}m/s` : '없음'} />
        <View style={[styles.metric, { backgroundColor: theme.background }]}>
          <ThemedText type="small" themeColor="textSecondary">
            특보
          </ThemedText>
          <ThemedText type="smallBold" themeColor={future ? 'textSecondary' : w.color} numberOfLines={1}>
            {future ? '발표 전' : w.text.replace('해상 ', '')}
          </ThemedText>
        </View>
      </View>
      {s.next_tide ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {future ? '그날 첫' : '다음'} {TIDE_TYPE[s.next_tide.type]} {timeLabel(s.next_tide.t)} · {s.next_tide.station_name}{' '}
          관측소 기준
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function Metric({ icon, label, value }: { icon: 'wave' | 'wind'; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: theme.background }]}>
      <View style={styles.metricLabel}>
        <AppIcon name={icon} size={14} />
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

/* ───────────── 지역별 바다 상황 (작은 지도) ───────────── */

const KOREA: Region = { latitude: 35.9, longitude: 127.6, latitudeDelta: 6.4, longitudeDelta: 6.4 };

/** pending = 그 날짜 예보 발표 전 (판단하지 않음) */
export type MapDot = { place: Place; tone: 'warning' | 'meets' | 'other' | 'unknown' | 'pending' };

function regionFor(dots: MapDot[]): Region {
  const pts = dots.filter((d) => d.place.lat != null && d.place.lon != null);
  if (pts.length === 0) return KOREA;
  const lats = pts.map((d) => d.place.lat!);
  const lons = pts.map((d) => d.place.lon!);
  const [a, b, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  return {
    latitude: (a + b) / 2,
    longitude: (c + d) / 2,
    latitudeDelta: Math.max(0.25, (b - a) * 1.4),
    longitudeDelta: Math.max(0.25, (d - c) * 1.4),
  };
}

type Cluster = { key: string; lat: number; lon: number; dots: MapDot[] };

/**
 * 화면 거리 RADIUS px 안의 점을 하나로 묶는다 (먼저 놓인 묶음 중심 기준, 겹침 방지).
 * 묶음 위치는 묶인 낚시터 실제 좌표의 평균
 */
const RADIUS = 46;
function clusterDots(dots: MapDot[], region: Region, size: { w: number; h: number }): Cluster[] {
  if (!size.w) return [];
  const pxLon = size.w / region.longitudeDelta;
  const pxLat = size.h / region.latitudeDelta;
  const groups: { x: number; y: number; dots: MapDot[] }[] = [];
  const pts = dots
    .filter((d) => d.place.lat != null && d.place.lon != null)
    .sort((p, q) => q.place.lat! - p.place.lat! || p.place.lon! - q.place.lon!);
  for (const d of pts) {
    const x = d.place.lon! * pxLon;
    const y = -d.place.lat! * pxLat;
    const g = groups.find((c) => Math.hypot(c.x - x, c.y - y) < RADIUS);
    if (g) g.dots.push(d);
    else groups.push({ x, y, dots: [d] });
  }
  return groups.map((g) => ({
    key: String(g.dots[0].place.id),
    lat: g.dots.reduce((t, d) => t + d.place.lat!, 0) / g.dots.length,
    lon: g.dots.reduce((t, d) => t + d.place.lon!, 0) / g.dots.length,
    dots: g.dots,
  }));
}

const TONE_ORDER: MapDot['tone'][] = ['warning', 'meets', 'other', 'unknown', 'pending'];

/**
 * 지역별 바다 상황 지도. 화면 스크롤과 겹치지 않게 손가락 이동·확대는 막고, 누르는 동작만 쓴다.
 * - 묶음(숫자)을 누르면 그 묶음 범위로 확대 · 낚시터 점을 누르면 그 낚시터 해황을 보여준다
 * - 권역을 바꾸면 그 권역 낚시터 범위로 이동
 */
export function SeaMap({
  dots,
  title,
  selectedId,
  onPick,
}: {
  dots: MapDot[];
  title: string;
  selectedId: number | null;
  onPick: (placeId: number) => void;
}) {
  const theme = useTheme();
  const color: Record<MapDot['tone'], string> = {
    warning: theme.danger,
    meets: Brand.teal,
    other: '#8A97A6',
    unknown: '#C3CBD4',
    pending: '#AEB8C4',
  };
  const mapRef = useRef<MapView>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const key = dots.map((d) => d.place.id).join(',');
  const home = useMemo(() => regionFor(dots), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [region, setRegion] = useState<Region>(home);
  const [zoomed, setZoomed] = useState(false);
  const [samePick, setSamePick] = useState<Place[] | null>(null);

  // 권역(낚시터 묶음)이 바뀌면 그 범위로 이동 (렌더 중 상태 맞춤 → 지도는 effect 에서 이동)
  const [lastHome, setLastHome] = useState(home);
  if (lastHome !== home) {
    setLastHome(home);
    setRegion(home);
    setZoomed(false);
  }
  useEffect(() => {
    mapRef.current?.animateToRegion(home, 350);
  }, [home]);

  const go = (r: Region, z: boolean) => {
    setRegion(r);
    setZoomed(z);
    mapRef.current?.animateToRegion(r, 350);
  };
  const clusters = useMemo(() => clusterDots(dots, region, size), [dots, region, size]);
  const count = (t: MapDot['tone']) => dots.filter((d) => d.tone === t).length;

  return (
    <View style={[styles.mapCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={styles.mapBox} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={home}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}>
          {clusters.map((c) => {
            if (c.dots.length === 1) {
              const d = c.dots[0];
              const on = d.place.id === selectedId;
              return (
                <Marker
                  key={`p${d.place.id}${on ? 's' : ''}`}
                  coordinate={{ latitude: d.place.lat!, longitude: d.place.lon! }}
                  tracksViewChanges={false}
                  anchor={{ x: 0.5, y: 0.5 }}
                  accessibilityLabel={`${d.place.name} 해황 보기`}
                  onPress={() => onPick(d.place.id)}>
                  <View style={styles.hit}>
                    <View style={[on ? styles.dotOn : styles.dot, { backgroundColor: color[d.tone] }]} />
                  </View>
                </Marker>
              );
            }
            const tones = TONE_ORDER.map((t) => [t, c.dots.filter((d) => d.tone === t).length] as const);
            const main = [...tones].sort((x, y) => y[1] - x[1])[0][0];
            const warn = tones[0][1];
            const lats = c.dots.map((d) => d.place.lat!);
            const lons = c.dots.map((d) => d.place.lon!);
            return (
              <Marker
                key={`c${c.key}:${c.dots.length}:${main}:${warn}`}
                coordinate={{ latitude: c.lat, longitude: c.lon }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
                accessibilityLabel={`낚시터 ${c.dots.length}곳 묶음, 눌러서 ${
                  Math.max(...lats) - Math.min(...lats) < 0.003 && Math.max(...lons) - Math.min(...lons) < 0.003 ? '목록 보기' : '확대'
                }`}
                onPress={() =>
                  // 사실상 같은 좌표(약 300m 안)에 모인 곳은 확대해도 갈라지지 않으므로 목록으로 펼친다
                  Math.max(...lats) - Math.min(...lats) < 0.003 && Math.max(...lons) - Math.min(...lons) < 0.003
                    ? setSamePick(c.dots.map((d) => d.place))
                    : go(
                    {
                      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
                      longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
                      latitudeDelta: Math.max(0.08, (Math.max(...lats) - Math.min(...lats)) * 1.8),
                      longitudeDelta: Math.max(0.08, (Math.max(...lons) - Math.min(...lons)) * 1.8),
                    },
                        true,
                      )
                }>
                <View style={[styles.cluster, { backgroundColor: color[main] }]}>
                  <Text style={styles.clusterText}>{c.dots.length}</Text>
                  {warn && main !== 'warning' ? (
                    <View style={[styles.clusterWarn, { backgroundColor: color.warning }]}>
                      <Text style={styles.clusterWarnText}>{warn}</Text>
                    </View>
                  ) : null}
                </View>
              </Marker>
            );
          })}
        </MapView>
        <SameCoordSheet
          places={samePick}
          onClose={() => setSamePick(null)}
          onPick={(p) => {
            setSamePick(null);
            onPick(p.id);
          }}
        />
        {zoomed ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => go(home, false)}
            style={({ pressed }) => [styles.mapBack, pressed && styles.pressed]}>
            <Text style={styles.mapBackText}>‹ 전체 범위</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.legend}>
        <ThemedText type="smallBold">
          {title}{' '}
          <ThemedText type="small" themeColor="textSecondary">
            · 숫자는 묶음(눌러서 확대), 점을 누르면 해황
          </ThemedText>
        </ThemedText>
        <View style={styles.legendRow}>
          {count('pending') ? (
            <Legend color={color.pending} label={`예보 발표 전 ${count('pending')}`} />
          ) : (
            <>
              <Legend color={color.warning} label={`특보 발효 ${count('warning')}`} />
              <Legend color={color.meets} label={`내 기준 충족 ${count('meets')}`} />
              <Legend color={color.other} label={`기준 밖 ${count('other')}`} />
              {count('unknown') ? <Legend color={color.unknown} label={`자료 부족 ${count('unknown')}`} /> : null}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}곳
      </ThemedText>
    </View>
  );
}

/* ───────────── 선택한 낚시터의 해황 ───────────── */

export function SelectedSea({
  placeId,
  basis,
  date,
  today,
  pending,
  onClear,
}: {
  placeId: number;
  /** 왜 이 낚시터인지 (내가 고른 곳 / 후보에서 고른 곳 / 즐겨찾기) */
  basis: string;
  date: string;
  today: string;
  /** 그 날짜 예보 발표 전 */
  pending?: boolean;
  onClear?: () => void;
}) {
  const theme = useTheme();
  const q = useConditions(placeId, date);
  const future = date !== today;
  // 그래프의 「지금」 선·남은 시간 기준 (자료를 받은 시점으로 고정)
  const [now] = useState(() => Date.now());

  if (q.isPending) {
    return (
      <View style={[styles.seaCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (q.isError) {
    return (
      <View style={[styles.seaCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="small" themeColor="danger">
          해황을 불러오지 못했어요. {q.error.message}
        </ThemedText>
      </View>
    );
  }
  const pc = q.data.place;
  const p = pc.place;
  const tideLevel = findSeries(pc, 'tide_level', 'forecast');
  const tideExt = findSeries(pc, 'tide_extreme', 'forecast');
  const waveFc = findSeries(pc, 'wave_height', 'forecast');
  const windFc = findSeries(pc, 'wind_speed', 'forecast');
  const waveObs = findSeries(pc, 'wave_height', 'observed');
  const windObs = findSeries(pc, 'wind_speed', 'observed');
  const after = future ? null : now;
  const w = WARNING_SHORT[pc.warning.level];
  const tideSrc = tideExt?.source ?? tideLevel?.source;

  return (
    <View style={[styles.seaCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={styles.seaHead}>
        <AppIcon name={PLACE_IMAGE[p.type]} size={IconSize.row} />
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {p.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {basis} · {dayLabel(date)}
          </ThemedText>
        </View>
        {onClear ? (
          <Pressable accessibilityRole="button" accessibilityLabel="선택 해제" hitSlop={10} onPress={onClear} style={styles.detailLink}>
            <ThemedText type="small" themeColor="textSecondary">
              해제
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="link"
          hitSlop={10}
          onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(p.id) } })}
          style={styles.detailLink}>
          <ThemedText type="small" themeColor="tint">
            상세 ›
          </ThemedText>
        </Pressable>
      </View>

      {p.location_suspect ? (
        <ThemedText type="small" themeColor="warning">
          {REASON_TEXT.LOCATION_CHECK}
        </ThemedText>
      ) : (
        <>
          <CoordNote place={p} compact />
          {/* 물때: 선 그래프 + 만조·간조 시각 */}
          <View style={styles.block}>
            <View style={styles.metricLabel}>
              <AppIcon name="tide" size={16} />
              <ThemedText type="smallBold">물때 (조위 예측)</ThemedText>
            </View>
            {tideLevel?.status === 'ok' && (tideLevel.points?.filter((x) => x.v != null).length ?? 0) >= 2 ? (
              <TideChart
                points={tideLevel.points!}
                extremes={tideExt?.status === 'ok' ? (tideExt.extremes ?? []) : []}
                now={future ? null : now}
              />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {(tideExt ?? tideLevel)?.reason ? REASON_TEXT[(tideExt ?? tideLevel)!.reason!] : '물때 자료 없음'}
              </ThemedText>
            )}
            {tideExt?.status === 'ok' && tideExt.extremes?.length ? (
              <ThemedText type="small">
                {tideExt.extremes
                  .map((e) => `${TIDE_TYPE[e.type]} ${timeLabel(e.t)}${e.v != null ? `(${Math.round(e.v)}cm)` : ''}`)
                  .join('  ·  ')}
              </ThemedText>
            ) : null}
            {tideSrc && (tideExt?.status === 'ok' || tideLevel?.status === 'ok') ? (
              <ThemedText type="small" themeColor="textSecondary">
                기준: {tideSrc.station_name} 조위관측소
                {tideSrc.distance_km != null
                  ? ` (낚시터에서 ${isApprox(p) ? `약 ${Math.round(tideSrc.distance_km)}` : tideSrc.distance_km}km)`
                  : ''} · {tideSrc.agency} 조석 예보 ·
                참고 자료예요. 관측소와 낚시터의 물때는 다를 수 있어요.
              </ThemedText>
            ) : null}
          </View>

          {/* 파고 · 바람은 따로 */}
          <View style={styles.metrics}>
            <SeaMetric
              icon="wave"
              title="파고"
              fc={waveFc}
              obs={future ? undefined : waveObs}
              unit="m"
              after={after}
              pending={pending}
            />
            <SeaMetric
              icon="wind"
              title="풍속"
              fc={windFc}
              obs={future ? undefined : windObs}
              unit="m/s"
              after={after}
              pending={pending}
            />
          </View>

          {/* 특보는 따로 */}
          <View style={[styles.warnRow, { backgroundColor: theme.background }]}>
            <ThemedText type="small" themeColor="textSecondary">
              해상 특보
            </ThemedText>
            <ThemedText type="smallBold" themeColor={w.color} style={styles.flex} numberOfLines={2}>
              {pc.warning.reference_only
                ? pc.warning.level === 'unknown'
                  ? '실제 위치 특보 확인 안 됨'
                  : `참고 · 주소 기준 ${w.text}`
                : w.text}
              {pc.warning.active.length ? ` (${pc.warning.active.map((m) => m.type).join('·')})` : ''}
            </ThemedText>
          </View>
          <AddToTripButton placeId={p.id} placeName={p.name} date={date} />
          {pc.warning.note ? (
            <ThemedText type="small" themeColor="warning">
              {pc.warning.note}
            </ThemedText>
          ) : null}
          {future ? (
            <ThemedText type="small" themeColor="textSecondary">
              특보는 「지금」 발효 상태예요. 그날 특보는 아직 발표 전이니 출조 전 꼭 다시 확인하세요.
            </ThemedText>
          ) : null}
        </>
      )}
    </View>
  );
}

function SeaMetric({
  icon,
  title,
  fc,
  obs,
  unit,
  after,
  pending,
}: {
  pending?: boolean;
  icon: 'wave' | 'wind';
  title: string;
  fc: Series | undefined;
  obs: Series | undefined;
  unit: string;
  after: number | null;
}) {
  const theme = useTheme();
  const vals = (fc?.status === 'ok' && !pending ? (fc.points ?? []) : []).filter(
    (x) => x.v != null && (after == null || new Date(x.t).getTime() >= after - 3 * 3600_000),
  );
  const peak = vals.reduce<{ t: string; v: number } | null>((m, x) => (m == null || x.v! > m.v ? { t: x.t, v: x.v! } : m), null);
  const last = [...(obs?.status === 'ok' ? (obs.points ?? []) : [])].reverse().find((x) => x.v != null);
  return (
    <View style={[styles.seaMetric, { backgroundColor: theme.background }]}>
      <View style={styles.metricLabel}>
        <AppIcon name={icon} size={16} />
        <ThemedText type="small" themeColor="textSecondary">
          {title} 예보 최대
        </ThemedText>
      </View>
      <ThemedText type="sectionTitle">{peak ? `${peak.v}${unit}` : pending ? '발표 전' : '없음'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
        {peak
          ? `${timeLabel(peak.t)} 무렵 · 기상청 예보`
          : pending
            ? '이 날짜 예보는 아직 발표 전이에요'
            : fc?.reason
            ? REASON_TEXT[fc.reason]
            : '예보 자료 없음'}
      </ThemedText>
      {last ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          실측 {last.v}
          {unit} ({timeLabel(last.t)}
          {obs?.source?.distance_km != null ? ` · ${obs.source.distance_km}km 떨어진 부이` : ''})
        </ThemedText>
      ) : null}
    </View>
  );
}

/* ───────────── 물때 선 그래프 (추가 네이티브 모듈 없이 View 로 그림) ───────────── */

const CHART_H = 92;

export function TideChart({
  points,
  extremes,
  now,
}: {
  points: { t: string; v: number | null }[];
  extremes: { t: string; type: 'high' | 'low'; v: number | null }[];
  now: number | null;
}) {
  const theme = useTheme();
  const [w, setW] = useState(0);
  const pts = points.filter((x): x is { t: string; v: number } => x.v != null).map((x) => ({ t: new Date(x.t).getTime(), v: x.v }));
  const t0 = pts[0].t;
  const span = Math.max(pts[pts.length - 1].t - t0, 3600_000);
  const vs = pts.map((x) => x.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const pad = Math.max((hi - lo) * 0.15, 5);
  const X = (t: number) => ((t - t0) / span) * w;
  const Y = (v: number) => CHART_H - ((v - (lo - pad)) / (hi - lo + pad * 2)) * CHART_H;
  const ticks = [0, 6, 12, 18, 24].map((h) => t0 + h * 3600_000).filter((t) => t <= t0 + span + 1);

  return (
    <View accessible accessibilityLabel={`조위 예측 그래프. ${extremes.map((e) => `${TIDE_TYPE[e.type]} ${timeLabel(e.t)}`).join(', ')}`}>
      <View style={styles.chart} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 ? (
          <>
            {pts.slice(1).map((b, i) => {
              const a = pts[i];
              const ax = X(a.t);
              const ay = Y(a.v);
              const bx = X(b.t);
              const by = Y(b.v);
              const len = Math.hypot(bx - ax, by - ay);
              return (
                <View
                  key={b.t}
                  style={[
                    styles.seg,
                    {
                      backgroundColor: theme.tint,
                      width: len,
                      left: (ax + bx) / 2 - len / 2,
                      top: (ay + by) / 2 - 1.25,
                      transform: [{ rotate: `${Math.atan2(by - ay, bx - ax)}rad` }],
                    },
                  ]}
                />
              );
            })}
            {now != null && now >= t0 && now <= t0 + span ? (
              <View style={[styles.nowLine, { left: X(now) }]}>
                <ThemedText type="small" style={styles.nowText}>
                  지금
                </ThemedText>
              </View>
            ) : null}
            {extremes.map((e) => {
              const t = new Date(e.t).getTime();
              if (t < t0 || t > t0 + span || e.v == null) return null;
              const x = X(t);
              const y = Y(e.v);
              return (
                <View key={e.t} style={[styles.ext, { left: x - 4, top: y - 4, backgroundColor: e.type === 'high' ? Brand.navy : theme.backgroundElement, borderColor: Brand.navy }]} />
              );
            })}
          </>
        ) : null}
      </View>
      <View style={styles.axis}>
        {ticks.map((t) => (
          <ThemedText key={t} type="small" themeColor="textSecondary" style={styles.axisText}>
            {new Date(t).getHours()}시
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  cand: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  candSelected: { borderWidth: 2, padding: 11 },
  candHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  candArt: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  detailLink: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 },
  metrics: { flexDirection: 'row', gap: 6 },
  metric: { flex: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, gap: 1 },
  metricLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  mapBox: { height: 190 },
  hit: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: '#fff' },
  dotOn: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: Brand.orange },
  cluster: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  clusterWarn: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterWarnText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  mapBack: {
    position: 'absolute',
    left: 8,
    top: 8,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  mapBackText: { color: Brand.navy, fontSize: 14, fontWeight: '700' },
  legend: { padding: 10, gap: 4 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  seaCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  seaHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  block: { gap: 6 },
  seaMetric: { flex: 1, borderRadius: 10, padding: 10, gap: 2 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 10 },
  chart: { height: CHART_H, marginTop: 4 },
  seg: { position: 'absolute', height: 2.5, borderRadius: 2 },
  nowLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: Brand.orange },
  nowText: { position: 'absolute', top: -2, left: 4, color: Brand.orange, fontWeight: '700' },
  ext: { position: 'absolute', width: 8, height: 8, borderRadius: 4, borderWidth: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axisText: { fontSize: 11 },
});
