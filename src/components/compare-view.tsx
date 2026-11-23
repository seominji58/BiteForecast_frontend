import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FishingIndex, FishingIndexLevel, PlaceCompare, Series } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { BottomSheet } from '@/components/bottom-sheet';
import { MarineWarningBanner } from '@/components/marine-warning-banner';
import { SegmentTabs } from '@/components/segment-tabs';
import { Card } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  findSeries,
  formatValue,
  hourTable,
  KIND_TEXT,
  latestPoint,
  lowerOf,
  rangeText,
  REASON_TEXT,
  REGULATION_TEXT,
  sourceLine,
  timeLabel,
} from '@/lib/compare';
import { placeName } from '@/lib/place';

/** 지수 등급은 색과 함께 항상 텍스트로 표시 (NFR-05) */
export const LEVEL_COLOR: Record<FishingIndexLevel, 'success' | 'text' | 'warning' | 'danger'> = {
  매우좋음: 'success',
  좋음: 'success',
  보통: 'text',
  나쁨: 'warning',
  매우나쁨: 'danger',
};

/**
 * A/B 비교 (SCR-02, FR-02~05, FR-07) — 2026-11-23 화면 재설계.
 * - 결론 카드(CompareVerdict) → 탭 하나로 바뀌는 비교 패널(ComparePanel) → 세부는 바텀시트
 * - 예보와 실측은 섞지 않고 각각 표시 (TC-03). 판정·안전 단정 문구 없음 (명세 §14)
 * - 결론의 수치는 「하루 전체」 최댓값 기준이라고 늘 밝힌다 (내 기준 충족은 남은 시간 예보 기준이라 다를 수 있음)
 */
export type CompareTab = 'summary' | 'sea' | 'tide' | 'index';
export const COMPARE_TABS: { value: CompareTab; label: string }[] = [
  { value: 'summary', label: '요약' },
  { value: 'sea', label: '파고·바람' },
  { value: 'tide', label: '물때' },
  { value: 'index', label: '낚시지수' },
];

export type FitRow = {
  label: 'A' | 'B';
  status: 'meets' | 'fails' | 'unknown';
  notes: string[];
};

const shortName = (p: PlaceCompare) => placeName(p.place);

/**
 * 결론 카드 (2026-11-23 가독성 개선): 「오늘 더 유리한 곳」 큰 글씨 → 파고·풍속 A/B 나란히(낮은 쪽 강조) → 상태 칩 2개.
 * 같은 종류(예보끼리·실측끼리) 하루 최댓값만 비교한다. 특보가 있으면 「확인 필요」를 따로 둔다 (안전 단정 없음)
 */
export function CompareVerdict({
  a,
  b,
  fit,
  fitBasis,
  onCriteria,
}: {
  a: PlaceCompare;
  b: PlaceCompare;
  fit: FitRow[] | null;
  fitBasis: string;
  onCriteria: () => void;
}) {
  const theme = useTheme();
  const wave = lowerOf(a, b, 'wave_height');
  const wind = lowerOf(a, b, 'wind_speed');
  const wins = [wave?.winner, wind?.winner].filter(Boolean) as ('A' | 'B')[];
  const leader = wins.length && wins.every((w) => w === wins[0]) ? wins[0] : null;
  const split = wave?.winner && wind?.winner && wave.winner !== wind.winner;
  const what = leader ? [wave?.winner === leader ? '파고' : null, wind?.winner === leader ? '풍속' : null].filter(Boolean).join('·') : '';
  const kind = wave?.kind ?? wind?.kind;
  const warn = [a, b].filter((p) => ['warning', 'nearby', 'preliminary'].includes(p.warning.level));
  const unknownWarn = [a, b].some((p) => p.warning.level === 'unknown');
  const metrics = [wave ? { label: '파고', unit: 'm', r: wave } : null, wind ? { label: '풍속', unit: 'm/s', r: wind } : null].filter(
    (x): x is { label: string; unit: string; r: NonNullable<typeof wave> } => !!x,
  );

  return (
    <View style={[styles.verdict, { backgroundColor: theme.tintSoft, borderColor: theme.border }]}>
      {/* 결론 */}
      <View style={styles.verdictHead}>
        <AppIcon name="fact" size={28} />
        <View style={styles.flex}>
          {leader ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                오늘 더 유리한 곳
              </ThemedText>
              <ThemedText type="sectionTitle" numberOfLines={1}>
                <ThemedText type="sectionTitle" themeColor="tint">
                  {leader}{' '}
                </ThemedText>
                {shortName(leader === 'A' ? a : b)}
              </ThemedText>
              <ThemedText type="small">{what} 모두 더 낮아요</ThemedText>
            </>
          ) : (
            <ThemedText type="smallBold">
              {split
                ? `파고는 ${wave!.winner}, 풍속은 ${wind!.winner}가 더 낮아요`
                : metrics.length
                  ? '두 곳의 파고·풍속이 같아요'
                  : '같은 종류의 파고·풍속 자료가 없어 비교하지 않았어요'}
            </ThemedText>
          )}
        </View>
      </View>

      {/* 파고·풍속 A/B 나란히 — 낮은 쪽을 굵게 */}
      {metrics.length ? (
        <View style={[styles.mini, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.miniRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.miniLabel}>
              {kind ? `${KIND_TEXT[kind]} 최대` : ''}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.miniCell}>
              A
            </ThemedText>
            <ThemedText type="smallBold" style={styles.miniCell}>
              B
            </ThemedText>
          </View>
          {metrics.map((m) => (
            <View key={m.label} style={[styles.miniRow, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
              <ThemedText type="small" style={styles.miniLabel}>
                {m.label}
              </ThemedText>
              {(['A', 'B'] as const).map((side) => {
                const win = m.r.winner === side;
                return (
                  <ThemedText
                    key={side}
                    type={win ? 'smallBold' : 'small'}
                    themeColor={win ? 'tint' : 'textSecondary'}
                    style={styles.miniCell}>
                    {side === 'A' ? m.r.aMax : m.r.bMax}
                    {m.unit}
                    {win ? ' ✓' : ''}
                  </ThemedText>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}

      {/* 상태: 내 기준 · 특보 (서로 다른 기준이라 칩을 나눈다) */}
      <View style={styles.chips}>
        {fit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`내 기준(${fitBasis}): ${fit.map((r) => `${r.label} ${CHECK_LABEL[r.status]}`).join(', ')}. 기준 바꾸기`}
            onPress={onCriteria}
            style={[styles.chip, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              내 기준{' '}
            </ThemedText>
            {fit.map((r, i) => (
              <ThemedText key={r.label} type="smallBold" themeColor={CHECK_COLOR[r.status]}>
                {i ? ' · ' : ''}
                {r.label} {CHECK_LABEL[r.status]}
              </ThemedText>
            ))}
          </Pressable>
        ) : null}
        {warn.length ? (
          <View style={[styles.chip, { backgroundColor: theme.dangerSoft, borderColor: 'transparent' }]}>
            <ThemedText type="smallBold" themeColor="danger">
              ⚠ 특보 확인 필요 {warn.map((p) => (p === a ? 'A' : 'B')).join('·')}
            </ThemedText>
          </View>
        ) : unknownWarn ? (
          <View style={[styles.chip, { backgroundColor: theme.warningSoft, borderColor: 'transparent' }]}>
            <ThemedText type="smallBold" themeColor="warning">
              특보 자료 확인 안 됨
            </ThemedText>
          </View>
        ) : null}
      </View>
      {fit ? (
        <ThemedText type="small" themeColor="textSecondary">
          표는 하루 전체, 내 기준은 {fitBasis}로 판단해요
        </ThemedText>
      ) : null}
    </View>
  );
}

const CHECK_LABEL = {
  meets: '충족',
  fails: '기준 밖',
  unknown: '자료 부족',
} as const;
const CHECK_COLOR = {
  meets: 'success',
  fails: 'textSecondary',
  unknown: 'warning',
} as const;

/** 탭 하나로 내용이 바뀌는 비교 패널 (내용을 아래로 쌓지 않는다) */
export function ComparePanel({ places, tab, warningNote }: { places: PlaceCompare[]; tab: CompareTab; warningNote?: string }) {
  const [a, b] = places;
  const theme = useTheme();
  const rows: ReactNode[] = [];
  if (tab === 'summary') {
    rows.push(
      <Row key="warn" image="report" label={warningNote ? '특보(현재)' : '해상 특보'}>
        <MarineWarningBanner w={a.warning} compact />
        <MarineWarningBanner w={b.warning} compact />
      </Row>,
      <Row key="wave" image="wave" label="파고">
        <BriefCell p={a} metric="wave_height" />
        <BriefCell p={b} metric="wave_height" />
      </Row>,
      <Row key="wind" image="wind" label="풍속">
        <BriefCell p={a} metric="wind_speed" />
        <BriefCell p={b} metric="wind_speed" />
      </Row>,
      <Row key="temp" image="water-temp" label="수온">
        <BriefCell p={a} metric="water_temp" />
        <BriefCell p={b} metric="water_temp" />
      </Row>,
    );
    // 금지·조건부 제한이 확인된 곳만 줄로 보여주고, 미확인은 표 아래 한 줄로 (FR-20: 미확인임을 명시)
    if ([a, b].some((p) => p.regulation.status === 'PROHIBITED' || p.regulation.status === 'CONDITIONAL')) {
      rows.push(
        <Row key="reg" image="regulation" label="규제">
          <RegulationCell p={a} />
          <RegulationCell p={b} />
        </Row>,
      );
    }
  } else if (tab === 'sea') {
    rows.push(
      <Row key="wave" image="wave" label="파고">
        <RangeCell series={[findSeries(a, 'wave_height', 'observed'), findSeries(a, 'wave_height', 'forecast')]} />
        <RangeCell series={[findSeries(b, 'wave_height', 'observed'), findSeries(b, 'wave_height', 'forecast')]} />
      </Row>,
      <Row key="wind" image="wind" label="바람">
        <RangeCell series={[findSeries(a, 'wind_speed', 'observed'), findSeries(a, 'wind_speed', 'forecast')]} />
        <RangeCell series={[findSeries(b, 'wind_speed', 'observed'), findSeries(b, 'wind_speed', 'forecast')]} />
      </Row>,
    );
  } else if (tab === 'tide') {
    rows.push(
      <Row key="ext" image="tide" label="만조/간조">
        <ExtremeCell s={findSeries(a, 'tide_extreme', 'forecast')} />
        <ExtremeCell s={findSeries(b, 'tide_extreme', 'forecast')} />
      </Row>,
      <Row key="level" image="tide-level" label="조위">
        <RangeCell series={[findSeries(a, 'tide_level', 'forecast')]} />
        <RangeCell series={[findSeries(b, 'tide_level', 'forecast')]} />
      </Row>,
    );
  } else {
    rows.push(
      <Row key="index" image="fishing-index" label="낚시지수">
        <FishingIndexCell f={a.fishing_index} />
        <FishingIndexCell f={b.fishing_index} />
      </Row>,
    );
  }
  return (
    <Card style={styles.tableCard}>
      <View style={[styles.headRow, { borderColor: theme.border }]}>
        <View style={styles.headLabel} />
        <ThemedText type="smallBold" style={styles.headCell} numberOfLines={1}>
          A {shortName(a)}
        </ThemedText>
        <ThemedText type="smallBold" style={styles.headCell} numberOfLines={1}>
          B {shortName(b)}
        </ThemedText>
      </View>
      {rows.map((r, i) => (
        <LastRowContext.Provider key={i} value={i === rows.length - 1}>
          {r}
        </LastRowContext.Provider>
      ))}
      {tab === 'summary' && ![a, b].some((p) => p.regulation.status === 'PROHIBITED' || p.regulation.status === 'CONDITIONAL') ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.panelNote}>
          규제: A {REGULATION_TEXT[a.regulation.status]} · B {REGULATION_TEXT[b.regulation.status]}
        </ThemedText>
      ) : null}
      {warningNote && tab === 'summary' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.panelNote}>
          {warningNote}
        </ThemedText>
      ) : null}
    </Card>
  );
}

/** 요약 칸: 예보 범위가 있으면 예보, 없으면 최근 실측 하나 (종류 표시) */
function BriefCell({ p, metric }: { p: PlaceCompare; metric: 'wave_height' | 'wind_speed' | 'water_temp' }) {
  const fc = findSeries(p, metric, 'forecast');
  const obs = findSeries(p, metric, 'observed');
  const fcText = rangeText(fc);
  if (fcText) return <Valued kind="예보" text={fcText} />;
  const pt = latestPoint(obs);
  if (pt?.v != null)
    return <Valued kind={`실측 ${timeLabel(pt.t)}`} text={`${Math.round(pt.v * 10) / 10}${obs!.unit === '°C' ? '°C' : ` ${obs!.unit}`}`} />;
  const reason = (fc?.reason && fc.reason !== 'FUTURE_DATE' ? fc.reason : obs?.reason) ?? null;
  return <Muted>{reason ? REASON_TEXT[reason] : '자료 없음'}</Muted>;
}

function Valued({ kind, text }: { kind: string; text: string }) {
  return (
    <View>
      <ThemedText type="smallBold">{text}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {kind}
      </ThemedText>
    </View>
  );
}

const HOURLY_TABS = [
  { value: 'wave', label: '파고' },
  { value: 'wind', label: '풍속' },
  { value: 'temp', label: '수온' },
  { value: 'tide', label: '조위' },
] as const;
type HourlyTab = (typeof HOURLY_TABS)[number]['value'];

/** 시간별 해황 상세 (바텀시트): 탭 하나씩, 예보·실측은 따로 */
export function HourlySheet({ open, onClose, places }: { open: boolean; onClose: () => void; places: PlaceCompare[] }) {
  const [a, b] = places;
  const [tab, setTab] = useState<HourlyTab>('wave');
  const blocks: [string, Series | undefined, Series | undefined][] =
    tab === 'wave'
      ? [
          ['파고 (예보)', findSeries(a, 'wave_height', 'forecast'), findSeries(b, 'wave_height', 'forecast')],
          ['파고 (실측)', findSeries(a, 'wave_height', 'observed'), findSeries(b, 'wave_height', 'observed')],
        ]
      : tab === 'wind'
        ? [
            ['풍속 (예보)', findSeries(a, 'wind_speed', 'forecast'), findSeries(b, 'wind_speed', 'forecast')],
            ['풍속 (실측)', findSeries(a, 'wind_speed', 'observed'), findSeries(b, 'wind_speed', 'observed')],
          ]
        : tab === 'temp'
          ? [['수온 (실측)', findSeries(a, 'water_temp', 'observed'), findSeries(b, 'water_temp', 'observed')]]
          : [['조위 (예보)', findSeries(a, 'tide_level', 'forecast'), findSeries(b, 'tide_level', 'forecast')]];
  return (
    <BottomSheet
      open={open}
      title="시간별 해황 상세"
      onClose={onClose}
      header={<SegmentTabs tabs={[...HOURLY_TABS]} value={tab} onChange={setTab} />}>
      <ThemedText type="small" themeColor="textSecondary">
        A {shortName(a)} · B {shortName(b)}
      </ThemedText>
      {blocks.map(([title, x, y]) => (
        <HourlyBlock key={title} title={title} a={x} b={y} />
      ))}
    </BottomSheet>
  );
}

/** 자료 기준·출처 (바텀시트) */
export function SourceSheet({
  open,
  onClose,
  places,
  disclaimer,
}: {
  open: boolean;
  onClose: () => void;
  places: PlaceCompare[];
  disclaimer: string;
}) {
  return (
    <BottomSheet open={open} title="자료 기준·출처" onClose={onClose}>
      <ThemedText type="small">
        <ThemedText type="smallBold">예보</ThemedText>는 기상청 단기예보·국립해양조사원 조석예보,{' '}
        <ThemedText type="smallBold">실측</ThemedText>은 가까운 관측소 값이에요. 두 종류는 섞어 비교하지 않아요.
      </ThemedText>
      <SourceList places={places} />
      <ThemedText type="small" themeColor="textSecondary">
        {disclaimer}
      </ThemedText>
    </BottomSheet>
  );
}

const LastRowContext = createContext(false);

function Row({ image, label, children }: { image: AppIconName; label: string; children: ReactNode }) {
  const theme = useTheme();
  const last = useContext(LastRowContext);
  const [left, right] = Array.isArray(children) ? children : [children, null];
  return (
    <View
      style={[
        styles.row,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
        },
      ]}>
      <View style={styles.label}>
        <AppIcon name={image} size={16} badge />
        <ThemedText type="small" style={styles.labelText}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.cell}>{left}</View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <View style={styles.cell}>{right}</View>
    </View>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {children}
    </ThemedText>
  );
}

function RegulationCell({ p }: { p: PlaceCompare }) {
  const status = p.regulation.status;
  // FR-20: 미확인 장소는 「합법 여부 미확인」을 명시
  return (
    <ThemedText type="small" themeColor={status === 'PROHIBITED' ? 'danger' : status === 'UNVERIFIED' ? 'warning' : 'text'}>
      {REGULATION_TEXT[status]}
      {p.regulation.stale ? ' · 최신 여부 미확인' : ''}
    </ThemedText>
  );
}

function FishingIndexCell({ f }: { f: FishingIndex }) {
  if (f.status !== 'ok' || !f.periods) {
    return (
      <View>
        <Muted>{f.reason ? REASON_TEXT[f.reason] : '자료 없음'} · 비교 불가</Muted>
        {f.source && (
          <Muted>
            ({f.source.station_name} {f.source.distance_km != null ? `${f.source.distance_km}km` : ''})
          </Muted>
        )}
      </View>
    );
  }
  return (
    <View style={styles.cellStack}>
      {f.periods.map((p) => (
        <View key={p.period}>
          <ThemedText type="small" themeColor="textSecondary">
            {p.period === '일' ? '하루' : p.period}
            {p.tide_phase ? ` · ${p.tide_phase}` : ''}
          </ThemedText>
          {p.items.map((i) => (
            <View key={i.species} style={styles.between}>
              <ThemedText type="small">{i.species}</ThemedText>
              <ThemedText type="smallBold" themeColor={i.index ? LEVEL_COLOR[i.index] : 'textSecondary'}>
                {i.index ?? '자료 없음'}
              </ThemedText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ExtremeCell({ s }: { s: Series | undefined }) {
  const theme = useTheme();
  if (s?.status !== 'ok' || !s.extremes) return <Muted>{s?.reason ? REASON_TEXT[s.reason] : '자료 없음'} · 비교 불가</Muted>;
  return (
    <View style={styles.cellStack}>
      {s.extremes.map((e) => (
        <View key={e.t} style={styles.extreme}>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: e.type === 'high' ? theme.tintSoft : theme.accentSoft,
              },
            ]}>
            <ThemedText type="small" themeColor={e.type === 'high' ? 'tint' : 'accent'} style={styles.pillText}>
              {e.type === 'high' ? '만조' : '간조'}
            </ThemedText>
          </View>
          <ThemedText type="small">
            {timeLabel(e.t)}{' '}
            <ThemedText type="small" themeColor="textSecondary">
              ({formatValue(e.v, 'cm')})
            </ThemedText>
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** 계열별 하루 범위. 실측/예보를 각각 다른 줄로 (TC-03) */
function RangeCell({ series }: { series: (Series | undefined)[] }) {
  const lines = series.filter((s): s is Series => !!s);
  const ok = lines.filter((s) => s.status === 'ok');
  if (ok.length === 0) {
    const reason = lines.find((s) => s.reason && s.reason !== 'FUTURE_DATE')?.reason ?? lines[0]?.reason;
    return <Muted>{reason ? REASON_TEXT[reason] : '자료 없음'} · 비교 불가</Muted>;
  }
  return (
    <View style={styles.cellStack}>
      {ok.map((s) => (
        <View key={s.kind} style={styles.kindLine}>
          <ThemedText type="small" themeColor="textSecondary">
            {KIND_TEXT[s.kind]}
          </ThemedText>
          <ThemedText type="smallBold">{rangeText(s) ?? '자료 없음'}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function HourlyBlock({ title, a, b }: { title: string; a: Series | undefined; b: Series | undefined }) {
  const theme = useTheme();
  const rows = hourTable(a, b);
  const unit = a?.unit ?? b?.unit ?? '';
  return (
    <Card>
      <ThemedText type="smallBold">{title}</ThemedText>
      {rows.length === 0 ? (
        <Muted>
          A: {a?.reason ? REASON_TEXT[a.reason] : '자료 없음'} · B: {b?.reason ? REASON_TEXT[b.reason] : '자료 없음'}
        </Muted>
      ) : (
        <View>
          <View style={[styles.hRow, styles.hHead, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hourCol}>
              시각
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.valCol}>
              A
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.valCol}>
              B
            </ThemedText>
          </View>
          {rows.map((r) => (
            <View key={r.hour} style={styles.hRow}>
              <ThemedText type="small" style={styles.hourCol}>
                {r.hour}
              </ThemedText>
              <ThemedText type="small" themeColor={r.a == null ? 'textSecondary' : 'text'} style={styles.valCol}>
                {a?.status !== 'ok' ? '–' : formatValue(r.a, unit)}
              </ThemedText>
              <ThemedText type="small" themeColor={r.b == null ? 'textSecondary' : 'text'} style={styles.valCol}>
                {b?.status !== 'ok' ? '–' : formatValue(r.b, unit)}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

/** 자료 출처·관측소 거리 (FR-07) */
function SourceList({ places }: { places: PlaceCompare[] }) {
  return (
    <Card>
      <ThemedText type="smallBold">자료 출처</ThemedText>
      {places.map((p, i) => {
        const seen = new Set<string>();
        const lines = [
          ...p.series.map((s) => s.source && `${KIND_TEXT[s.kind]} · ${s.source.dataset} · ${sourceLine(s.source)}`),
          p.fishing_index.source &&
            `${p.fishing_index.source.dataset} · ${p.fishing_index.source.station_name} 지점 · ${p.fishing_index.source.distance_km ?? '?'}km`,
        ].filter((l): l is string => !!l && !seen.has(l) && !!seen.add(l));
        return (
          <View key={p.place.id} style={styles.cellStack}>
            <ThemedText type="small">
              {i === 0 ? 'A' : 'B'} · {p.region_name} {placeName(p.place)}
            </ThemedText>
            {lines.map((l) => (
              <Muted key={l}>{l}</Muted>
            ))}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tableCard: { padding: 0, gap: 0, overflow: 'hidden' },
  verdict: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  verdictHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mini: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  miniRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  miniLabel: { width: 72 },
  miniCell: { flex: 1, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  headRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  headLabel: { width: 68 },
  headCell: { flex: 1, paddingHorizontal: Spacing.two + 2 },
  panelNote: { padding: Spacing.two + 2 },
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 46 },
  label: {
    width: 68,
    backgroundColor: Brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.two,
  },
  labelText: { color: Brand.onNavy, fontWeight: '700', textAlign: 'center' },
  cell: { flex: 1, padding: Spacing.two + 2, justifyContent: 'center' },
  divider: { width: StyleSheet.hairlineWidth },
  cellStack: { gap: 4 },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  extreme: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  pillText: { fontWeight: '700', fontSize: 12, lineHeight: 18 },
  kindLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  fact: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  factBody: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two + 2,
  },
  factLabel: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.two,
  },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two + 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hRow: { flexDirection: 'row', paddingVertical: 2 },
  hHead: {
    borderBottomWidth: 1,
    paddingBottom: Spacing.one,
    marginBottom: Spacing.one,
  },
  hourCol: { width: 56 },
  valCol: { flex: 1, textAlign: 'right' },
  notice: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
