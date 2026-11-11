import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Keyboard, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useDateRange, useFishingIndex, usePlaces, usePlacesSummary, usePosts, useSpecies } from '@/api/queries';
import type { Place, PostSummary } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { AppIcon } from '@/components/app-icon';
import { GeneralResults, HomeActions, IndexResults, methodOk, METHODS, NoIndexNotice, SeaPreview, sortGeneral } from '@/components/home-explore';
import { Card, SectionHeader, TabScreen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { SpeciesImage, SpeciesRail, SpeciesStrip } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, IconSize, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { catchLine, shortDate, whereLine } from '@/lib/community';
import { dayLabel, dayList } from '@/lib/compare';
import { freshnessLine } from '@/lib/criteria';
import { timeAgo } from '@/lib/format';
import { type Coords, getCurrentCoords } from '@/lib/location';
import { km, matches, PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';
import { SEA_GROUPS, type SeaChoice, useHomeSea, useHomeSpecies } from '@/lib/prefs';
import { mergeWithApi, speciesByCode, type SpeciesItem } from '@/lib/species';
import { SPECIES_IMAGES } from '@/lib/species-images';

/** 받아 둔 기상청 예보가 하루 전체를 덮는 마지막 날짜 (KST, YYYY-MM-DD) */
function forecastLastDay(validUntil: string | null): string | null {
  if (!validUntil) return null;
  // valid_until 이 KST 자정이면 그 전날까지가 온전한 하루 예보
  const kst = new Date(new Date(validUntil).getTime() - 1000 + 9 * 3600_000);
  return kst.toISOString().slice(0, 10);
}

/** 「내 주변」 후보로 볼 거리 (현재 위치 기준) */
const NEAR_KM = 60;

// 시간대별 분위기만 바꾸고, 데이터·검색·추천 로직은 그대로 유지한다.
// 나중에 사용자 업로드 URI를 받을 때는 이 반환값을 원격 ImageSource로 대체하면 된다.
function homeBackgroundSource(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 9) return require('../../../assets/home-backgrounds/dawn.png');
  if (hour >= 9 && hour < 16) return require('../../../assets/home-backgrounds/day.png');
  if (hour >= 16 && hour < 18) return require('../../../assets/home-backgrounds/sunset.png');
  if (hour >= 18 && hour < 21) return require('../../../assets/home-backgrounds/dusk.png');
  return require('../../../assets/home-backgrounds/night.png');
}

/**
 * SCR-01 홈 v3 (2026-11-09, docs/05_UX/2026-11-09_홈_재설계안.md)
 * 상단(검색·내 주변·지도·날짜) → 오늘의 출조 탐색(권역 칩 + 후보 2~3곳) → 지역별 바다 상황(요약)
 * → 출조계획·비교·안전 바로가기. 상세 해황은 낚시터 상세 화면에서 확인한다.
 *
 * - 후보는 고른 날짜의 실제 예보로 「내 기준 충족」인 곳만. 특보 발효·자료 부족·좌표 의심 곳은 후보로 내지 않는다
 * - 추천 카드를 누르면 상세 화면으로 이동한다 (홈에서 상세 해황을 중복 노출하지 않음)
 */
export default function HomeScreen() {
  const places = usePlaces();
  const range = useDateRange();
  const speciesApi = useSpecies();
  const today = range.data?.today;
  const [dateSel, setDate] = useState<string | null>(null);
  const date = dateSel ?? today;
  const future = !!date && !!today && date !== today;
  const summary = usePlacesSummary(date);
  const fi = useFishingIndex(date);
  const lastForecastDay = forecastLastDay(summary.data?.data_status.forecast_valid_until ?? null);
  // 예보 범위 밖 날짜: 「예보 발표 전」 — 다른 날짜 자료로 대신하지 않는다
  const pending = !!date && !!lastForecastDay && date > lastForecastDay;
  const [sea, setSea] = useHomeSea();
  const [speciesCode, setSpeciesCode] = useHomeSpecies();
  const [method, setMethod] = useState('all');
  const [periodSel, setPeriod] = useState<string | null>(null);
  const [near, setNear] = useState(false);
  const [gps, setGps] = useState<{ loading: boolean; coords: Coords | null; error: string | null }>({
    loading: false,
    coords: null,
    error: null,
  });
  const [query, setQuery] = useState('');

  const allSpecies = useMemo(() => mergeWithApi(speciesApi.data), [speciesApi.data]);
  const railSpecies = useMemo(() => allSpecies.filter((x) => SPECIES_IMAGES[x.code]), [allSpecies]);
  const species = speciesByCode(speciesCode) ?? allSpecies.find((x) => x.code === speciesCode) ?? null;
  const byId = useMemo(() => new Map((places.data ?? []).map((p) => [p.id, p])), [places.data]);
  const summaryById = useMemo(() => new Map((summary.data?.places ?? []).map((s) => [s.place_id, s])), [summary.data]);
  const results = query.trim() ? (places.data ?? []).filter((p) => matches(p, query)).slice(0, 6) : [];

  // 내 주변: 버튼을 누를 때만 위치 권한을 묻는다 (좌표는 기기 안에서 거리 계산에만)
  const locate = async () => {
    setNear(true);
    setGps({ loading: true, coords: null, error: null });
    const r = await getCurrentCoords();
    setGps('coords' in r ? { loading: false, coords: r.coords, error: null } : { loading: false, coords: null, error: r.error });
  };
  const chooseSea = (v: SeaChoice | null) => {
    setNear(false);
    setSea(v);
  };

  const distOf = (placeId: number) => (near && gps.coords && byId.has(placeId) ? km(gps.coords, byId.get(placeId)!) : null);
  // 범위: 내 주변 60km / 바다 권역 / 전국. 방식 필터
  const inScope = (p: Place) => {
    if (!methodOk(method, p)) return false;
    if (near) return !!gps.coords && km(gps.coords, p) <= NEAR_KM;
    if (!sea) return true;
    return summaryById.get(p.id)?.sea_group === sea;
  };
  const scopeName = near ? `내 주변 ${NEAR_KM}km` : (sea ?? '전국');
  // 좌표 의심(D) 곳은 처음부터 뺀다 (기존 정책)
  const scoped = useMemo(
    () => (summary.data?.places ?? []).filter((s) => !s.location_suspect && byId.has(s.place_id) && inScope(byId.get(s.place_id)!)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summary.data, byId, near, gps.coords, sea, method],
  );
  const general = useMemo(() => sortGeneral(scoped, byId, (s) => distOf(s.place_id)), [scoped, byId, near, gps.coords]); // eslint-disable-line react-hooks/exhaustive-deps

  const day = fi.data;
  const periods = day?.periods ?? [];
  const period = periodSel && periods.includes(periodSel) ? periodSel : (periods[0] ?? '');
  const indexCount = (s: SpeciesItem) =>
    day ? day.points.filter((p) => p.places.some((l) => l.official) && p.species.some((x) => x.species === s.indexName)).length : null;
  // 범위 안 공식 지점들의 물때 (발표값, 가장 많은 값)
  const tide = useMemo(() => {
    if (!day) return null;
    const ids = new Set(scoped.map((s) => s.place_id));
    const count = new Map<string, number>();
    for (const p of day.points) {
      const t = p.tide_phase[period] ?? Object.values(p.tide_phase)[0];
      if (t && p.places.some((l) => ids.has(l.place_id))) count.set(t, (count.get(t) ?? 0) + 1);
    }
    return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [day, scoped, period]);

  const catches = usePosts('catch', 'latest', { species: species ? (species.speciesCode ?? species.name) : null });
  const catchCount = species && !species.indexName ? (catches.data?.length ?? null) : null;

  const openSearchResult = (p: Place) => {
    setQuery('');
    Keyboard.dismiss();
    router.push({ pathname: '/place/[id]', params: { id: String(p.id) } });
  };
  // 출조계획: 고른 어종을 목표 어종으로, 장소·날짜가 있으면 함께
  const plan = (placeId?: number) =>
    router.push({
      pathname: '/trip/new',
      params: { ...(placeId ? { place: String(placeId) } : {}), ...(date ? { date } : {}), ...(species ? { species: species.code } : {}) },
    });

  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['places-summary'] }),
      qc.invalidateQueries({ queryKey: ['fishing-index'] }),
      qc.invalidateQueries({ queryKey: ['conditions'] }),
      qc.invalidateQueries({ queryKey: ['community', 'posts'] }),
      qc.invalidateQueries({ queryKey: ['meta', 'date-range'] }),
    ]);

  const dates = range.data ? dayList(range.data.today, range.data.max) : [];
  const shortDay = (d: string) => (d === today ? '오늘' : dates[1] === d ? '내일' : dayLabel(d).replace(' ', ''));
  const stale = !!summary.data?.data_status.stale;
  const dateText = date ? dayLabel(date) : '';

  return (
    <TabScreen title="" immersive onRefresh={refresh}>
      {/* ① 상단: 바다 배경 · 검색 · 내 주변 · 지도 탐색 · 날짜 */}
      <ImageBackground source={homeBackgroundSource()} imageStyle={styles.heroImage} style={styles.hero}>
        <View pointerEvents="none" style={styles.heroShade} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>오늘은 어떤 낚시를 떠나세요?</Text>
          <Text style={styles.heroSubtitle}>어종과 지역을 고르고 바다 조건을 확인해 보세요</Text>
        </View>
        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder="어종·지역·낚시터 검색" />
        <View style={styles.heroActions}>
          <HeroButton icon="find-gps" label="내 주변" active={near} onPress={locate} />
          <HeroButton icon="find-map" label="지도 탐색" onPress={() => router.push('/explore')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {dates.map((d) => {
            const on = d === date;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${dayLabel(d)} 보기${lastForecastDay && d > lastForecastDay ? ', 예보 발표 전' : ''}`}
                onPress={() => setDate(d)}
                style={({ pressed }) => [styles.datePill, on && styles.datePillOn, pressed && styles.pressed]}>
                <Text style={[styles.dateText, !on && lastForecastDay && d > lastForecastDay && styles.dateTextPending, on && styles.dateTextOn]}>
                  {shortDay(d)}
                  {lastForecastDay && d > lastForecastDay ? ' · 예보 전' : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </ImageBackground>

      {query.trim() ? (
        <Card>
          {(() => {
            const sp = allSpecies.filter((x) => x.name.includes(query.trim()) || (x.alias ?? '').includes(query.trim())).slice(0, 3);
            return (
              <>
                {sp.map((x) => (
                  <Pressable
                    key={x.code}
                    accessibilityRole="button"
                    onPress={() => {
                      setSpeciesCode(x.code);
                      setQuery('');
                      Keyboard.dismiss();
                    }}
                    style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
                    <SpeciesImage code={x.code} size={36} />
                    <View style={styles.flex}>
                      <ThemedText type="smallBold">{x.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        어종 · {x.indexName ? '공식 지수 제공' : '공식 지수 없음'}
                      </ThemedText>
                    </View>
                    <ThemedText themeColor="textSecondary">›</ThemedText>
                  </Pressable>
                ))}
                {results.length === 0 && sp.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    맞는 어종·낚시터가 없어요. 「지도 탐색」에서 지역별로 둘러보세요.
                  </ThemedText>
                ) : null}
                {results.map((p) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    onPress={() => openSearchResult(p)}
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
                ))}
              </>
            );
          })()}
        </Card>
      ) : null}

      {/* ② 목표 어종 */}
      <SectionHeader title="어떤 어종을 잡으러 가세요?" actionLabel="전체 어종 보기" onAction={() => router.push('/species')} />
      <SpeciesRail
        items={railSpecies}
        selected={speciesCode}
        onSelect={setSpeciesCode}
        status={(x) => {
          if (!x.indexName) return '공식 지수 없음';
          const n = indexCount(x);
          return n == null ? '공식 지수 제공' : n ? `공식 지수 ${n}곳` : '이날 지수 없음';
        }}
      />
      {species ? (
        <SpeciesStrip
          item={species}
          onClear={() => setSpeciesCode(null)}
          line={
            species.indexName
              ? `공식 낚시지수 제공 · ${dateText} ${periods.join('·') || '발표 전'}`
              : '공식 낚시지수 없음 · 일반 장소 탐색과 실제 조황 기록으로 안내해요'
          }
        />
      ) : null}

      {/* ③ 지역 · 방식 (· 시간대) */}
      <View style={styles.chipRow}>
        <SeaChip label="내 주변" icon="find-gps" on={near} onPress={locate} />
        <SeaChip label="전국" on={!near && !sea} onPress={() => chooseSea(null)} />
        {SEA_GROUPS.map((g) => (
          <SeaChip key={g} label={g} on={!near && sea === g} onPress={() => chooseSea(g)} />
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodRow}>
        {species?.indexName && periods.length > 1
          ? periods.map((p) => <MiniChip key={p} label={p} on={p === period} onPress={() => setPeriod(p)} accent />)
          : null}
        {METHODS.map((m) => (
          <MiniChip key={m.key} label={m.label} on={method === m.key} onPress={() => setMethod(m.key)} />
        ))}
      </ScrollView>

      {/* ④ 포인트 탐색 */}
      <SectionHeader title={`${scopeName} · ${dateText} 포인트`} />
      {near && gps.loading ? (
        <Hint text="현재 위치를 확인하는 중이에요…" loading />
      ) : near && gps.error ? (
        <Hint text={`${gps.error} 위의 전국·서해·남해·동해·제주 중에서 골라 주세요.`} tone="warning" />
      ) : summary.isPending || places.isPending ? (
        <Hint text="낚시터 해황을 확인하는 중이에요…" loading />
      ) : summary.isError ? (
        <DataStateNotice
          title="해황 자료를 잠시 확인할 수 없어요"
          detail="낚시터 검색·지도 탐색과 출조계획은 계속 사용할 수 있어요."
          actionLabel="다시 확인"
          onAction={refresh}
          tone="danger"
        />
      ) : species?.indexName ? (
        fi.isPending ? (
          <Hint text="공식 낚시지수를 확인하는 중이에요…" loading />
        ) : !day || day.points.length === 0 ? (
          <Hint text={`${dateText} ${species.name} 공식 지수는 아직 발표 전이에요. 지수는 약 7일 앞까지 발표돼요.`} />
        ) : (
          <IndexResults
            species={species}
            day={day}
            scope={inScope}
            byId={byId}
            summaryById={summaryById}
            dist={distOf}
            period={period}
            pending={pending}
            future={future}
            scopeName={scopeName}
            onPlan={plan}
            onMore={() => router.push('/explore')}
          />
        )
      ) : (
        <View style={styles.hintCol}>
          {species ? (
            <NoIndexNotice
              species={species}
              catchCount={catchCount}
              scopeName={scopeName}
              onCatches={() => router.push(catchCount === 0 ? '/community/new' : '/community')}
            />
          ) : null}
          <GeneralResults
            list={general}
            byId={byId}
            dist={(s) => distOf(s.place_id)}
            pending={pending}
            future={future}
            sortLabel={near && gps.coords ? '가까운 순' : '자료가 많이 연결된 곳 먼저 · 이름순'}
            onPlan={plan}
            onMore={() => router.push('/explore')}
          />
        </View>
      )}

      {/* ⑤ 지도 · 출조계획 */}
      <HomeActions onMap={() => router.push('/explore')} onPlan={() => plan()} />

      {/* ⑥ 오늘의 바다 미리보기 */}
      {summary.isSuccess ? (
        <SeaPreview list={scoped} tide={tide} future={future} pending={pending} title={`${scopeName} 바다 미리보기 · ${dateText}`} />
      ) : null}
      {summary.isSuccess ? (
        <ThemedText type="small" themeColor={stale ? 'warning' : 'textSecondary'}>
          {freshnessLine(summary.data.data_status)}
          {future ? ' · 특보는 지금 발효 상태 기준' : ''}
        </ThemedText>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => router.push('/info/safety')} style={styles.linkRow}>
        <ThemedText type="smallBold" themeColor="tint">
          금어기·안전 수칙 보기 ›
        </ThemedText>
      </Pressable>

      {/* ⑦ 최근 조황 (실제 기록만) */}
      <RecentCatches species={species} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        국립해양조사원·기상청 공공데이터 · 조과를 보장하지 않으며 출조 전 특보를 꼭 확인하세요
      </ThemedText>
    </TabScreen>
  );
}

function MiniChip({ label, on, onPress, accent }: { label: string; on: boolean; onPress: () => void; accent?: boolean }) {
  const theme = useTheme();
  const bg = on ? (accent ? Brand.orange : theme.text) : theme.backgroundElement;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [styles.miniChip, { backgroundColor: bg, borderColor: on ? bg : theme.border }, pressed && styles.pressed]}>
      <ThemedText type="small" style={[styles.bold, { color: on ? '#fff' : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function HeroButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.heroBtn, active && styles.heroBtnOn, pressed && styles.pressed]}>
      <View style={styles.heroIcon}>
        <AppIcon name={icon} size={18} />
      </View>
      <Text style={styles.heroBtnText}>{label}</Text>
    </Pressable>
  );
}

function SeaChip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: AppIconName }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.seaChip,
        { backgroundColor: on ? theme.tint : theme.backgroundElement, borderColor: on ? theme.tint : theme.border },
        pressed && styles.pressed,
      ]}>
      {icon ? <AppIcon name={icon} size={14} /> : null}
      <ThemedText type="smallBold" themeColor={on ? 'onTint' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Hint({ text, tone, loading }: { text: string; tone?: 'warning' | 'danger'; loading?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.hint, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {loading ? <ActivityIndicator size="small" /> : null}
      <ThemedText type="small" themeColor={tone ?? 'textSecondary'} style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

function DataStateNotice({
  title,
  detail,
  actionLabel,
  onAction,
  tone = 'warning',
}: {
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
  tone?: 'warning' | 'danger';
}) {
  const theme = useTheme();
  return (
    <View style={[styles.stateNotice, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.flex}>
        <ThemedText type="smallBold" themeColor={tone}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{detail}</ThemedText>
      </View>
      <Pressable accessibilityRole="button" onPress={onAction} style={styles.stateAction}>
        <ThemedText type="smallBold" themeColor="tint">{actionLabel} ›</ThemedText>
      </Pressable>
    </View>
  );
}

function RecentCatches({ species }: { species: SpeciesItem | null }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const posts = usePosts('catch', 'latest', { species: species ? (species.speciesCode ?? species.name) : null });
  const source = usePhotoSource();
  const items = useMemo(() => {
    const all = (posts.data ?? []).filter((p) => p.category === 'catch');
    const photo = all.filter((p) => p.thumb);
    return [...photo.filter((p) => p.verified), ...photo.filter((p) => !p.verified), ...all.filter((p) => !p.thumb)].slice(0, 8);
  }, [posts.data]);
  const full = Math.min(width, 600) - Layout.screenPadding * 2;
  const cardW = items.length === 1 ? full : Math.min(220, (full - 12) / 2);

  if (posts.isPending) return null;
  // 실제 조황이 없으면 섹션을 숨긴다 (가짜 조황 없음)
  if (items.length === 0) return null;
  return (
    <>
      <SectionHeader title={species ? `최근 ${species.name} 조황` : '최근 조황'} actionLabel="전체보기" onAction={() => router.push('/community')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + 12}
        decelerationRate="fast"
        contentContainerStyle={styles.catchRow}>
        {items.map((p) => (
          <CatchCard key={p.id} p={p} width={cardW} src={p.thumb ? source(p.thumb) : null} border={theme.border} />
        ))}
      </ScrollView>
    </>
  );
}

function CatchCard({
  p,
  width,
  src,
  border,
}: {
  p: PostSummary;
  width: number;
  src: ReturnType<ReturnType<typeof usePhotoSource>>;
  border: string;
}) {
  const theme = useTheme();
  const where = whereLine(p);
  const detail = p.catch ? catchLine(p.catch) : p.species_name;
  const when = p.catch ? `${shortDate(p.catch.fished_at)} 출조` : timeAgo(p.created_at);
  const h = Math.min(width * 0.8, 220);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.verified ? '인증 조황, ' : ''}${p.title}, ${where ?? ''}, ${when}`}
      onPress={() => router.push({ pathname: '/community/[id]', params: { id: String(p.id) } })}
      style={({ pressed }) => [
        styles.catchCard,
        { width, borderColor: border, backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      {src ? (
        <View>
          <Image source={src} style={[styles.catchImg, { height: h }]} contentFit="cover" transition={150} />
          {p.verified ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>✓ 인증 조황</Text>
            </View>
          ) : null}
        </View>
      ) : (
        // 사진 없는 조황: 그림을 대신 넣지 않고 글로 보여준다
        <View style={[styles.textCatch, { height: h, backgroundColor: theme.tintSoft }]}>
          <ThemedText type="small" themeColor="tint" style={styles.bold}>
            조황 이야기
          </ThemedText>
          <ThemedText type="small" numberOfLines={5}>
            {p.excerpt}
          </ThemedText>
        </View>
      )}
      <View style={styles.catchInfo}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {p.title}
        </ThemedText>
        {detail ? (
          <ThemedText type="small" themeColor="tint" numberOfLines={1} style={styles.bold}>
            {detail}
          </ThemedText>
        ) : null}
        {where ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {where}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {when} · {p.author.nickname}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  center: { textAlign: 'center' },
  bold: { fontWeight: '700' },
  hero: { backgroundColor: Brand.navy, marginTop: -16, marginHorizontal: -16, paddingTop: 104, paddingHorizontal: 16, paddingBottom: 14, gap: 10, overflow: 'hidden' },
  heroImage: { borderRadius: 0 },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(5, 30, 58, 0.42)' },
  heroCopy: { paddingHorizontal: 4, paddingTop: 8, gap: 2 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 32, fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  heroActions: { flexDirection: 'row', gap: 8 },
  heroBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroBtnOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  heroIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F6F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnText: { color: Brand.onNavy, fontSize: 15, fontWeight: '700' },
  dateRow: { gap: 6 },
  datePill: {
    minHeight: 36,
    minWidth: 52,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  datePillOn: { backgroundColor: Brand.orange, borderColor: Brand.orange },
  dateText: { color: Brand.onNavySecondary, fontSize: 14, fontWeight: '600' },
  dateTextPending: { opacity: 0.6 },
  dateTextOn: { color: '#fff', fontWeight: '800' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  methodRow: { gap: 6, paddingRight: 16 },
  miniChip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  seaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  hintCol: { gap: 4 },
  stateNotice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  stateAction: { paddingVertical: 4 },
  cands: { gap: 8 },
  linkRow: { minHeight: 40, justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4 },
  mapSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 68 },
  mapSummaryIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  writeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 56 },
  catchRow: { gap: 12, paddingRight: Layout.screenPadding },
  catchCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  catchImg: { width: '100%' },
  catchInfo: { padding: 10, gap: 2 },
  textCatch: { padding: 12, gap: 6 },
  badge: {
    position: 'absolute',
    left: 8,
    top: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(46,125,50,0.92)',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
