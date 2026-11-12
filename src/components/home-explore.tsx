/**
 * 홈 「포인트 탐색」 (설계 개정 v2 §B). 앱이 순위 점수를 만들지 않는다.
 * - 어종 상관없음·공식 지수 없는 어종: 일반 낚시터 — 위치 허용 시 가까운 순, 아니면 자료 연결 많은 순 → 이름순
 * - 공식 지수 어종: [공식 지수 지점] / [근처 일반 낚시터 · 참고] — 특보 발효 곳 맨 뒤 → 공식 등급 → 파고 → 풍속 → 이름
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FishingIndexDay, IndexPoint, Place, PlaceSummary, PlaceType } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { SpeciesImage } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WARNING_SHORT } from '@/lib/criteria';
import { seaState, windName } from '@/lib/describe';
import { formatForecastWave } from '@/lib/format';
import { type TermKey, tideWord } from '@/lib/glossary';
import { distLabel, PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';
import { GRADE_RANK, GRADE_TONE, INDEX_DISCLAIMER, josa, type SpeciesItem } from '@/lib/species';

export const SHOW = 3;

/** 방식 필터 — 낚시터 유형을 낚시 방식 묶음으로 */
export const METHODS: { key: string; label: string; types: PlaceType[] }[] = [
  { key: 'all', label: '전체', types: [] },
  { key: 'boat', label: '선상', types: ['boat'] },
  { key: 'rock', label: '갯바위·포인트', types: ['point', 'rock'] },
  { key: 'shore', label: '방파제·항구', types: ['breakwater', 'wharf', 'beach'] },
  { key: 'paid', label: '유료 낚시터', types: ['paid'] },
];
export const methodOk = (m: string, p: Place) => {
  const t = METHODS.find((x) => x.key === m);
  return !t || t.types.length === 0 || t.types.includes(p.type);
};

/** 자료가 연결된 개수 (예보·물때·공식 지수·실측) — 정렬용, 좋고 나쁨이 아니다 */
const linked = (s: PlaceSummary) =>
  [s.wave_fc_max, s.wind_fc_max, s.next_tide, s.index, s.wave_obs, s.temp_obs].filter((v) => v != null).length;

export function sortGeneral(list: PlaceSummary[], byId: Map<number, Place>, dist: (s: PlaceSummary) => number | null) {
  return [...list].sort((a, b) => {
    const da = dist(a);
    const db = dist(b);
    if (da != null && db != null && da !== db) return da - db;
    return linked(b) - linked(a) || byId.get(a.place_id)!.name.localeCompare(byId.get(b.place_id)!.name, 'ko');
  });
}

/** 조건을 말로 (숫자는 함께, 판정은 하지 않음) */
function conditionLine(s: PlaceSummary | undefined, pending: boolean): string {
  if (!s) return '해황 자료 없음';
  if (pending) return '파고·풍속 예보 발표 전';
  const wave = s.wave_fc_max ? `${seaState(s.wave_fc_max.v)}(${formatForecastWave(s.wave_fc_max.v)})` : '파고 예보 없음';
  const wind = s.wind_fc_max ? `${windName(s.wind_fc_max.v).name} ${s.wind_fc_max.v}m/s` : '풍속 예보 없음';
  return `${wave} · ${wind}`;
}

function GradeChip({ grade, muted }: { grade: string | undefined; muted?: boolean }) {
  const theme = useTheme();
  if (!grade) {
    return (
      <View style={[styles.grade, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.gradeText}>
          지수 없음
        </ThemedText>
      </View>
    );
  }
  const tone = muted ? 'textSecondary' : GRADE_TONE[grade] ?? 'textSecondary';
  return (
    <View style={[styles.grade, { borderColor: muted ? theme.border : theme[tone] }]}>
      <ThemedText type="small" themeColor={tone} style={styles.gradeText}>
        {grade}
      </ThemedText>
    </View>
  );
}

export function PointCard({
  place,
  s,
  dist,
  pending,
  future,
  species,
  index,
  onPlan,
}: {
  place: Place;
  s: PlaceSummary | undefined;
  dist: number | null;
  pending: boolean;
  future: boolean;
  species?: SpeciesItem | null;
  /** 공식 지수 줄: 등급(시간대별)과, 근처 낚시터면 지점 이름·거리 */
  index?: { grades: Record<string, string>; periods: string[]; period: string; tide: string | null; via?: { name: string; km: number | null } };
  onPlan: () => void;
}) {
  const theme = useTheme();
  const w = s ? WARNING_SHORT[s.warning_level] : null;
  const where = [place.region_name, PLACE_TYPE_LABEL[place.type], distLabel(dist, place)].filter(Boolean).join(' · ');
  const muted = !!index?.via;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${where}, 상세 보기`}
      onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(place.id) } })}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}>
      <View style={styles.row}>
        {/* 어종 그림은 공식 지수 지점에만 — 근처 일반 낚시터에 붙이면 그 어종이 있는 곳처럼 보인다 */}
        {species && !index?.via ? <SpeciesImage code={species.code} size={40} /> : <AppIcon name={PLACE_IMAGE[place.type]} size={36} />}
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {place.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {where}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="tint">
          상세 ›
        </ThemedText>
      </View>
      {index && species ? (
        <View style={styles.indexRow}>
          <ThemedText type="small" themeColor={muted ? 'textSecondary' : 'text'} style={styles.bold}>
            {species.name}
          </ThemedText>
          {index.periods.map((p, i) => (
            <View key={p} style={styles.row}>
              {i > 0 ? <ThemedText type="small" themeColor="textSecondary">→</ThemedText> : null}
              <ThemedText type="small" themeColor={p === index.period ? 'text' : 'textSecondary'}>
                {p}
              </ThemedText>
              <GradeChip grade={index.grades[p]} muted={muted || p !== index.period} />
            </View>
          ))}
        </View>
      ) : null}
      {index?.via ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {index.via.name} 지점{index.via.km != null ? `(${index.via.km}km)` : ''} 지수 · 참고 — 이 낚시터에서 잡힌다는 뜻이 아니에요
        </ThemedText>
      ) : null}
      <ThemedText type="small" numberOfLines={1}>
        {conditionLine(s, pending)}
        {index?.tide ? ` · 물때 ${index.tide}` : ''}
      </ThemedText>
      <View style={styles.row}>
        <ThemedText type="small" themeColor={w?.color ?? 'textSecondary'} style={styles.flex} numberOfLines={1}>
          {w ? (future ? `특보(지금 기준) ${w.text}` : w.text) : '특보 확인 불가'}
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel={`${place.name} 출조계획에 추가`} onPress={onPlan} hitSlop={8} style={styles.plan}>
          <ThemedText type="small" themeColor="tint" style={styles.bold}>
            + 출조계획
          </ThemedText>
        </Pressable>
      </View>
    </Pressable>
  );
}

type IndexEntry = { place: Place; s: PlaceSummary | undefined; point: IndexPoint; grades: Record<string, string>; km: number | null };

/** 공식 지수 어종 결과: 탭 2개 */
export function IndexResults({
  species,
  day,
  scope,
  byId,
  summaryById,
  dist,
  period,
  pending,
  future,
  scopeName,
  onPlan,
  onMore,
}: {
  species: SpeciesItem;
  day: FishingIndexDay;
  scope: (p: Place) => boolean;
  byId: Map<number, Place>;
  summaryById: Map<number, PlaceSummary>;
  dist: (placeId: number) => number | null;
  period: string;
  pending: boolean;
  future: boolean;
  scopeName: string;
  onPlan: (placeId: number) => void;
  onMore: () => void;
}) {
  const [tab, setTab] = useState<'official' | 'near'>('official');
  const [all, setAll] = useState(false);
  const { official, near, bySea } = useMemo(() => {
    const off: IndexEntry[] = [];
    const nb: IndexEntry[] = [];
    const seaCount = new Map<string, number>();
    for (const point of day.points) {
      const grades = point.species.find((x) => x.species === species.indexName)?.grades;
      if (!grades || Object.keys(grades).length === 0) continue;
      for (const l of point.places) {
        const place = byId.get(l.place_id);
        if (!place) continue;
        const s = summaryById.get(l.place_id);
        if (l.official && s?.sea_group) seaCount.set(s.sea_group, (seaCount.get(s.sea_group) ?? 0) + 1);
        if (!scope(place)) continue;
        (l.official ? off : nb).push({ place, s, point, grades, km: l.distance_km });
      }
    }
    const rank = (e: IndexEntry) => GRADE_RANK[e.grades[period]] ?? 0;
    const sorter = (a: IndexEntry, b: IndexEntry) => {
      const wa = a.s?.warning_level === 'warning' ? 1 : 0;
      const wb = b.s?.warning_level === 'warning' ? 1 : 0;
      return (
        wa - wb ||
        rank(b) - rank(a) ||
        (a.s?.wave_fc_max?.v ?? 99) - (b.s?.wave_fc_max?.v ?? 99) ||
        (a.s?.wind_fc_max?.v ?? 99) - (b.s?.wind_fc_max?.v ?? 99) ||
        a.place.name.localeCompare(b.place.name, 'ko')
      );
    };
    return { official: off.sort(sorter), near: nb.sort(sorter), bySea: seaCount };
  }, [day, species, scope, byId, summaryById, period]);

  const list = tab === 'official' ? official : near;
  const shown = all ? list.slice(0, 20) : list.slice(0, SHOW);
  return (
    <View style={styles.col}>
      <View style={styles.tabs}>
        <Tab label={`공식 지수 지점 ${official.length}`} on={tab === 'official'} onPress={() => setTab('official')} />
        <Tab label={`근처 일반 낚시터 ${near.length} · 참고`} on={tab === 'near'} onPress={() => setTab('near')} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        ⓘ {INDEX_DISCLAIMER}
      </ThemedText>
      {list.length === 0 ? (
        <Empty
          text={
            tab === 'official'
              ? `${scopeName}에는 ${species.name} 공식 지수 지점이 없어요.${
                  bySea.size ? ` 제공 바다: ${[...bySea].map(([k, v]) => `${k} ${v}곳`).join(' · ')}` : ''
                }`
              : `${scopeName}에서 ${species.name} 지수 지점 ${day.max_km}km 안의 일반 낚시터가 없어요.`
          }
        />
      ) : (
        shown.map((e) => (
          <PointCard
            key={`${e.point.station_id}-${e.place.id}`}
            place={e.place}
            s={e.s}
            dist={dist(e.place.id)}
            pending={pending}
            future={future}
            species={species}
            index={{
              grades: e.grades,
              periods: day.periods.filter((p) => p in e.grades || day.periods.length > 1),
              period,
              tide: e.point.tide_phase[period] ?? Object.values(e.point.tide_phase)[0] ?? null,
              via: tab === 'near' ? { name: e.point.station_name, km: e.km } : undefined,
            }}
            onPlan={() => onPlan(e.place.id)}
          />
        ))
      )}
      {list.length > SHOW ? (
        <Pressable accessibilityRole="button" onPress={() => (all ? onMore() : setAll(true))} style={styles.more}>
          <ThemedText type="smallBold" themeColor="tint">
            {all ? '지도에서 모두 보기 ›' : `${list.length - SHOW}곳 더 보기 ›`}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function Tab({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.tab, { borderColor: on ? theme.tint : theme.border, backgroundColor: on ? theme.tint : theme.backgroundElement }]}>
      <ThemedText type="smallBold" themeColor={on ? 'onTint' : 'text'} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** 일반 낚시터 결과 (어종 상관없음·공식 지수 없는 어종) */
export function GeneralResults({
  list,
  byId,
  dist,
  pending,
  future,
  sortLabel,
  onPlan,
  onMore,
}: {
  list: PlaceSummary[];
  byId: Map<number, Place>;
  dist: (s: PlaceSummary) => number | null;
  pending: boolean;
  future: boolean;
  sortLabel: string;
  onPlan: (placeId: number) => void;
  onMore: () => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? list.slice(0, 20) : list.slice(0, SHOW);
  if (list.length === 0) return <Empty text="이 범위에 등록된 낚시터가 없어요. 지역이나 방식을 바꿔 보세요." />;
  return (
    <View style={styles.col}>
      <ThemedText type="small" themeColor="textSecondary">
        {list.length}곳 · {sortLabel}
      </ThemedText>
      {shown.map((s) => (
        <PointCard
          key={s.place_id}
          place={byId.get(s.place_id)!}
          s={s}
          dist={dist(s)}
          pending={pending}
          future={future}
          onPlan={() => onPlan(s.place_id)}
        />
      ))}
      {list.length > SHOW ? (
        <Pressable accessibilityRole="button" onPress={() => (all ? onMore() : setAll(true))} style={styles.more}>
          <ThemedText type="smallBold" themeColor="tint">
            {all ? '지도에서 모두 보기 ›' : `${list.length - SHOW}곳 더 보기 ›`}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 공식 지수 없는 어종 안내 — 등급·추천 장소를 만들지 않고, 실제 조황 기록만 연결 */
export function NoIndexNotice({ species, catchCount, scopeName, onCatches }: { species: SpeciesItem; catchCount: number | null; scopeName: string; onCatches: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="smallBold">{josa(species.name, '은', '는')} 국립해양조사원 공식 낚시지수가 없는 어종이에요</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        아래는 어종과 상관없는 {scopeName} 낚시터예요. {josa(species.name, '이', '가')} 잡히는 곳이라는 뜻이 아니에요.
      </ThemedText>
      <Pressable accessibilityRole="button" onPress={onCatches} style={styles.more}>
        <ThemedText type="smallBold" themeColor="tint">
          {catchCount == null ? `${species.name} 조황 기록 보기 ›` : catchCount === 0 ? `아직 ${species.name} 조황 기록이 없어요 · 첫 기록 남기기 ›` : `${species.name} 실제 조황 기록 ${catchCount}건 보기 ›`}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
    </View>
  );
}

/** 레퍼런스의 두 버튼 */
export function HomeActions({ onMap, onPlan }: { onMap: () => void; onPlan: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={onMap} style={({ pressed }) => [styles.action, { backgroundColor: theme.tint }, pressed && styles.pressed]}>
        <AppIcon name="find-map" size={22} />
        <ThemedText type="smallBold" themeColor="onTint">
          지도에서 찾기 ›
        </ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onPlan}
        style={({ pressed }) => [styles.action, { backgroundColor: theme.accentSoft, borderColor: Brand.orange, borderWidth: 1 }, pressed && styles.pressed]}>
        <AppIcon name="trips" size={22} />
        <ThemedText type="smallBold">출조계획 ›</ThemedText>
      </Pressable>
    </View>
  );
}

/** 오늘의 바다 미리보기 (지역 단위, 범위로 — 하나로 뭉뚱그리지 않음) */
export function SeaPreview({
  list,
  tide,
  future,
  pending,
  onInfo,
}: {
  list: PlaceSummary[];
  tide: string | null;
  future: boolean;
  pending: boolean;
  /** 칸을 누르면 용어 풀이 */
  onInfo?: (t: TermKey) => void;
}) {
  const theme = useTheme();
  const waves = list.flatMap((s) => (s.wave_fc_max ? [s.wave_fc_max.v] : []));
  const winds = list.flatMap((s) => (s.wind_fc_max ? [s.wind_fc_max.v] : []));
  // 지역 안 낚시터들의 예보 최댓값 (가장 거친 곳 기준 — 평균으로 낮춰 보이지 않게)
  const wMax = waves.length ? Math.max(...waves) : null;
  const vMax = winds.length ? Math.max(...winds) : null;
  const warn = list.filter((s) => s.warning_level === 'warning').length;
  const unknown = list.length > 0 && list.every((s) => s.warning_level === 'unknown');
  const tiles: { key: TermKey; label: string; value: string; word: string | null }[] = [
    {
      key: 'wave',
      label: '파고',
      value: pending ? '발표 전' : wMax == null ? '자료 없음' : `최대 ${formatForecastWave(wMax)}`,
      word: !pending && wMax != null ? seaState(wMax) : null,
    },
    {
      key: 'wind',
      label: '풍속',
      value: pending ? '발표 전' : vMax == null ? '자료 없음' : `최대 ${vMax}m/s`,
      word: !pending && vMax != null ? windName(vMax).name : null,
    },
    { key: 'tide', label: '물때', value: tide ?? '자료 없음', word: tideWord(tide) },
    {
      key: 'warning',
      label: future ? '특보(지금)' : '해상 특보',
      value: unknown ? '확인 불가' : warn ? `발효 ${warn}곳` : '발효 없음',
      word: !unknown && warn ? '원문 확인' : null,
    },
  ];
  return (
    <View style={styles.col}>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <Pressable
            key={t.key}
            accessibilityRole="button"
            accessibilityLabel={`${t.label} ${t.value}${t.word ? `, ${t.word}` : ''}, 뜻 보기`}
            onPress={() => onInfo?.(t.key)}
            style={({ pressed }) => [styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {t.label} ⓘ
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit style={t.key === 'warning' && warn ? { color: theme.danger } : undefined}>
              {t.value}
            </ThemedText>
            {t.word ? (
              <ThemedText type="small" themeColor="tint" numberOfLines={1} adjustsFontSizeToFit style={styles.word}>
                {t.word}
              </ThemedText>
            ) : null}
          </Pressable>
        ))}
      </View>
      {onInfo ? (
        <ThemedText type="small" themeColor="textSecondary">
          칸을 누르면 파고·풍속·물때·특보가 무슨 뜻인지 볼 수 있어요
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  col: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.75 },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  indexRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  grade: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  gradeText: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  plan: { paddingVertical: 2 },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  more: { minHeight: 36, justifyContent: 'center' },
  notice: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tiles: { flexDirection: 'row', gap: 6 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 8, gap: 2 },
  word: { fontSize: 12, lineHeight: 16 },
});
