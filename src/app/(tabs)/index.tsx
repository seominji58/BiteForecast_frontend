import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useDateRange, usePlaces, usePlacesSummary, usePosts } from '@/api/queries';
import type { Place, PlaceSummary, PostSummary } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { AppIcon } from '@/components/app-icon';
import { CandidateCard } from '@/components/home-sea';
import { Card, SectionHeader, TabScreen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, IconSize, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { catchLine, shortDate, whereLine } from '@/lib/community';
import { dayLabel, dayList } from '@/lib/compare';
import { breakdown, criteriaLabel, freshnessLine } from '@/lib/criteria';
import { timeAgo } from '@/lib/format';
import { type Coords, getCurrentCoords } from '@/lib/location';
import { km, matches, PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';
import { SEA_GROUPS, type SeaChoice, useCriteria, useHomeSea } from '@/lib/prefs';

/** 받아 둔 기상청 예보가 하루 전체를 덮는 마지막 날짜 (KST, YYYY-MM-DD) */
function forecastLastDay(validUntil: string | null): string | null {
  if (!validUntil) return null;
  // valid_until 이 KST 자정이면 그 전날까지가 온전한 하루 예보
  const kst = new Date(new Date(validUntil).getTime() - 1000 + 9 * 3600_000);
  return kst.toISOString().slice(0, 10);
}

/** 「내 주변」 후보로 볼 거리 (현재 위치 기준) */
const NEAR_KM = 60;
const CANDIDATES = 3;

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
  const today = range.data?.today;
  const [dateSel, setDate] = useState<string | null>(null);
  const date = dateSel ?? today;
  const future = !!date && !!today && date !== today;
  const summary = usePlacesSummary(date);
  const lastForecastDay = forecastLastDay(summary.data?.data_status.forecast_valid_until ?? null);
  // 예보 범위 밖 날짜: 「예보 발표 전」 — 다른 날짜 자료로 대신하거나 조건 충족으로 보지 않는다
  const pending = !!date && !!lastForecastDay && date > lastForecastDay;
  const [criteria] = useCriteria();
  const [sea, setSea] = useHomeSea();
  const [near, setNear] = useState(false);
  const [gps, setGps] = useState<{ loading: boolean; coords: Coords | null; error: string | null }>({
    loading: false,
    coords: null,
    error: null,
  });
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map((places.data ?? []).map((p) => [p.id, p])), [places.data]);
  const results = query.trim() ? (places.data ?? []).filter((p) => matches(p, query)).slice(0, 6) : [];

  // 내 주변: 버튼을 누를 때만 위치 권한을 묻는다 (좌표는 기기 안에서 거리 계산에만)
  const locate = async () => {
    setNear(true);
    setGps({ loading: true, coords: null, error: null });
    const r = await getCurrentCoords();
    setGps('coords' in r ? { loading: false, coords: r.coords, error: null } : { loading: false, coords: null, error: r.error });
  };
  const chooseSea = (v: SeaChoice) => {
    setNear(false);
    setSea(v);
  };

  // 탐색 범위: 좌표 의심 낚시터는 처음부터 뺀다 (자료를 연결하지 않음)
  const scope = useMemo(() => {
    const list = (summary.data?.places ?? []).filter((s) => !s.location_suspect && byId.has(s.place_id));
    if (near) {
      if (!gps.coords) return [];
      return list.filter((s) => km(gps.coords!, byId.get(s.place_id)!) <= NEAR_KM);
    }
    return sea ? list.filter((s) => s.sea_group === sea) : [];
  }, [summary.data, byId, near, gps.coords, sea]);
  const b = useMemo(() => breakdown(scope, criteria, { future }), [scope, criteria, future]);
  const stale = !!summary.data?.data_status.stale;
  const scopeName = near ? `내 주변 ${NEAR_KM}km` : (sea ?? '');
  const chosen = near ? !!gps.coords : !!sea;

  const dist = (s: PlaceSummary) => (gps.coords && near ? km(gps.coords, byId.get(s.place_id)!) : null);
  const held = b.meets.filter((s) => byId.get(s.place_id)?.coord?.recommend_hold).length;
  const candidates = useMemo(() => {
    if (stale) return [];
    // 좌표 불일치 의심(추가 검증 필요) 곳은 검증 전까지 후보로 내지 않는다
    const list = b.meets.filter((s) => !byId.get(s.place_id)?.coord?.recommend_hold);
    // 내 주변: 가까운 순 / 바다 권역: 파고 예보 최대가 낮은 순 → 풍속 낮은 순 (실제 예보값 기준)
    list.sort((x, y) =>
      near && gps.coords
        ? km(gps.coords, byId.get(x.place_id)!) - km(gps.coords, byId.get(y.place_id)!)
        : x.wave_fc_max!.v - y.wave_fc_max!.v || x.wind_fc_max!.v - y.wind_fc_max!.v,
    );
    return list.slice(0, CANDIDATES);
  }, [b.meets, stale, near, gps.coords, byId]);

  const openSearchResult = (p: Place) => {
    setQuery('');
    Keyboard.dismiss();
    router.push({ pathname: '/place/[id]', params: { id: String(p.id) } });
  };

  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['places-summary'] }),
      qc.invalidateQueries({ queryKey: ['conditions'] }),
      qc.invalidateQueries({ queryKey: ['community', 'posts'] }),
      qc.invalidateQueries({ queryKey: ['meta', 'date-range'] }),
    ]);

  const dates = range.data ? dayList(range.data.today, range.data.max) : [];
  const shortDay = (d: string) => (d === today ? '오늘' : dates[1] === d ? '내일' : dayLabel(d).replace(' ', ''));
  const openCriteria = () => router.push({ pathname: '/explore', params: { mode: 'criteria' } });

  return (
    <TabScreen title="입질예보" logo onRefresh={refresh}>
      {/* 상단: 작은 검색 + 내 주변 · 지도 탐색 · 날짜 */}
      <View style={styles.hero}>
        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder="지역·낚시터 검색 (예: 태안, 대천)" />
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
                accessibilityLabel={`${dayLabel(d)} 해황 보기${lastForecastDay && d > lastForecastDay ? ', 예보 발표 전' : ''}`}
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
      </View>

      {query.trim() ? (
        <Card>
          {results.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              맞는 낚시터가 없어요. 「지도 탐색」에서 지역별로 둘러보세요.
            </ThemedText>
          ) : (
            results.map((p) => (
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
            ))
          )}
        </Card>
      ) : null}

      {/* 오늘의 출조 탐색 */}
      <SectionHeader
        title={date && future ? `${dayLabel(date)} 출조 탐색` : '오늘의 출조 탐색'}
        actionLabel="기준 바꾸기"
        onAction={openCriteria}
      />
      <View style={styles.chipRow}>
        <SeaChip label="내 주변" icon="find-gps" on={near} onPress={locate} />
        {SEA_GROUPS.map((g) => (
          <SeaChip key={g} label={g} on={!near && sea === g} onPress={() => chooseSea(g)} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
        내 기준: {criteriaLabel(criteria)}
      </ThemedText>

      {!near && !sea ? (
        <Hint text="바다를 고르거나 「내 주변」을 누르면, 고른 날짜의 예보로 내 기준에 맞는 낚시터를 보여드려요." />
      ) : near && gps.loading ? (
        <Hint text="현재 위치를 확인하는 중이에요…" loading />
      ) : near && gps.error ? (
        <Hint text={`${gps.error} 위의 서해·남해·동해·제주 중에서 골라 주세요.`} tone="warning" />
      ) : summary.isPending ? (
        <Hint text="낚시터 해황을 확인하는 중이에요…" loading />
      ) : summary.isError ? (
        <Hint text={`해황 자료를 불러오지 못했어요. ${summary.error.message}`} tone="danger" />
      ) : stale ? (
        <Hint
          text={`${summary.data.data_status.stale_reason ?? '자료가 오래됐어요'}. 오래된 예보·특보로는 후보를 고르지 않아요.`}
          tone="warning"
        />
      ) : pending ? (
        <Hint
          text={`${dayLabel(date!)}은 아직 예보 발표 전이에요. 기상청 예보는 ${dayLabel(lastForecastDay!)}까지 나와 있어요. 예보가 나오기 전에는 출조 후보를 고르지 않아요.`}
        />
      ) : scope.length === 0 ? (
        <Hint text={near ? `현재 위치에서 ${NEAR_KM}km 안에 등록된 바다 낚시터가 없어요. 바다를 골라 주세요.` : '이 바다에 등록된 낚시터가 없어요.'} />
      ) : b.insufficient ? (
        <Hint
          tone="warning"
          text={
            future && summary.data.data_status.forecast_valid_until
              ? `${dayLabel(date!)}은 아직 예보가 충분하지 않아요 (받아 둔 예보는 ${dayLabel(summary.data.data_status.forecast_valid_until.slice(0, 10))}까지). 자료가 없는 곳은 후보로 내지 않아요.`
              : `${scopeName} ${b.total}곳 중 ${b.unknown}곳은 예보·특보 자료가 없어 판단할 수 없어요. 자료가 없는 곳은 후보로 내지 않아요.`
          }
        />
      ) : candidates.length === 0 ? (
        <NoMatch b={b} scopeName={scopeName} onChange={openCriteria} />
      ) : (
        <View style={styles.cands}>
          <ThemedText type="small" themeColor="textSecondary">
            {scopeName} {b.total}곳 중 내 기준 충족 {b.meets.length}곳 · {near ? '가까운 순' : '파고 예보가 낮은 순'}
          </ThemedText>
          {held ? (
            <ThemedText type="small" themeColor="textSecondary">
              좌표를 검증 중인 {held}곳(주소와 좌표의 시·군이 다름)은 후보에서 뺐어요.
            </ThemedText>
          ) : null}
          {candidates.map((s) => (
            <CandidateCard
              key={s.place_id}
              place={byId.get(s.place_id)!}
              s={s}
              dist={dist(s)}
              future={future}
              selected={false}
              onSelect={() => router.push({ pathname: '/place/[id]', params: { id: String(s.place_id) } })}
            />
          ))}
          {b.meets.length > candidates.length ? (
            <Pressable accessibilityRole="button" onPress={openCriteria} style={styles.linkRow}>
              <ThemedText type="smallBold" themeColor="tint">
                맞는 곳 {b.meets.length}곳 모두 지도에서 보기 ›
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}
      {summary.isSuccess && chosen ? (
        <ThemedText type="small" themeColor={stale ? 'warning' : 'textSecondary'}>
          {freshnessLine(summary.data.data_status)}
          {future ? ' · 특보는 지금 발효 상태 기준' : ''}
        </ThemedText>
      ) : null}

      {/* 지역별 바다 상황 */}
      <SectionHeader title="지역별 바다 상황" actionLabel="전체 지도 보기" onAction={() => router.push('/explore')} />
      {summary.isSuccess ? (
        <MapSummary
          scopeName={chosen ? scopeName : '전국'}
          dateLabel={date ? dayLabel(date) : ''}
          total={chosen ? b.total : summary.data.places.filter((s) => !s.location_suspect).length}
          meets={chosen && !pending && !stale ? b.meets.length : null}
          warnings={future ? null : (chosen ? scope : summary.data.places).filter((s) => s.warning_level === 'warning').length}
          onPress={() => router.push('/explore')}
        />
      ) : (
        <Hint text={summary.isError ? '지도 자료를 불러오지 못했어요.' : '지도 자료를 불러오는 중이에요…'} loading={summary.isPending} />
      )}

      {/* 바로가기 */}
      <SectionHeader title="빠른 메뉴" />
      <View style={styles.tiles}>
        <Tile icon="trips" title="출조계획" onPress={() => router.push('/trips')} />
        <Tile icon="find-compare" title="두 곳 비교" onPress={() => router.push('/compare')} />
        <Tile icon="regulation" title="금어기·안전" onPress={() => router.push('/info/safety')} />
      </View>
      {false ? <RecentCatches /> : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        국립해양조사원·기상청 공공데이터 · 조과를 보장하지 않으며 출조 전 특보를 꼭 확인하세요
      </ThemedText>
    </TabScreen>
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

/** 맞는 곳 0곳: 빠진 이유를 이유별 곳 수로 (조건 밖 곳을 추천처럼 보여주지 않음) */
function NoMatch({ b, scopeName, onChange }: { b: ReturnType<typeof breakdown>; scopeName: string; onChange: () => void }) {
  const reasons = [
    b.warning ? `특보 발효 ${b.warning}곳` : null,
    b.unknown ? `자료 부족 ${b.unknown}곳` : null,
    b.waveOver ? `파고 초과 ${b.waveOver}곳` : null,
    b.windOver ? `풍속 초과 ${b.windOver}곳` : null,
    b.indexLow ? `지수 미달 ${b.indexLow}곳` : null,
  ].filter(Boolean);
  return (
    <View style={styles.hintCol}>
      <Hint text={`${scopeName} ${b.total}곳 중 내 기준에 맞는 곳이 없어요 · ${reasons.join(' · ')}`} />
      <Pressable accessibilityRole="button" onPress={onChange} style={styles.linkRow}>
        <ThemedText type="smallBold" themeColor="tint">
          기준 바꾸기 ›
        </ThemedText>
      </Pressable>
    </View>
  );
}

function Tile({ icon, title, onPress }: { icon: AppIconName; title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <AppIcon name={icon} size={28} />
      <ThemedText type="smallBold" style={styles.center} numberOfLines={1}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

function MapSummary({ scopeName, dateLabel, total, meets, warnings, onPress }: {
  scopeName: string;
  dateLabel: string;
  total: number;
  meets: number | null;
  warnings: number | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${scopeName} 바다 상황 전체 지도 보기`}
      onPress={onPress}
      style={({ pressed }) => [styles.mapSummary, { borderColor: theme.border, backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
      <View style={[styles.mapSummaryIcon, { backgroundColor: theme.tintSoft }]}>
        <AppIcon name="find-map" size={28} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{scopeName} · {dateLabel}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          등록 낚시터 {total}곳{meets != null ? ` · 내 기준 충족 ${meets}곳` : ''}{warnings != null ? ` · 특보 ${warnings}곳` : ''}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" themeColor="tint">전체 지도 ›</ThemedText>
    </Pressable>
  );
}

/** 최근 조황: 실제 조황 글이 있을 때만 카드. 없으면 작은 글쓰기 입구만 (가짜 조황·사진 없음) */
function RecentCatches() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const posts = usePosts('catch', 'latest');
  const source = usePhotoSource();
  const items = useMemo(() => {
    const all = (posts.data ?? []).filter((p) => p.category === 'catch');
    const photo = all.filter((p) => p.thumb);
    return [...photo.filter((p) => p.verified), ...photo.filter((p) => !p.verified), ...all.filter((p) => !p.thumb)].slice(0, 8);
  }, [posts.data]);
  const full = Math.min(width, 600) - Layout.screenPadding * 2;
  const cardW = items.length === 1 ? full : Math.min(220, (full - 12) / 2);

  if (posts.isPending) return null;
  if (items.length === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/community/new')}
        style={({ pressed }) => [
          styles.writeRow,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <AppIcon name="cat-catch" size={IconSize.row} />
        <View style={styles.flex}>
          <ThemedText type="smallBold">아직 올라온 조황이 없어요</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            첫 조황을 올려 주세요
          </ThemedText>
        </View>
        <ThemedText type="smallBold" themeColor="tint">
          글쓰기 ›
        </ThemedText>
      </Pressable>
    );
  }
  return (
    <>
      <SectionHeader title="최근 조황" actionLabel="전체보기" onAction={() => router.push('/community')} />
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
  hero: { backgroundColor: Brand.navy, borderRadius: 14, padding: 12, gap: 8 },
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
