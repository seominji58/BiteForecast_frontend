/**
 * 상세 「오늘 바다」 그래프 카드 (2026-11-23, 사용자 요청 「주식 그래프처럼」).
 * [물때·파고·바람·날씨] 칩 → 위에 지금 값을 크게, 아래에 하루(0~24시) 선 그래프와 「지금」 세로선.
 * 예보는 선+영역, 실측은 주황 선(파고·바람). 물때는 만조·간조 점과 시각. 날씨는 기온 선 + 강수확률 막대.
 * 기존 3칸 수치·해황 표·물때 탭·날씨 카드를 한 카드로 대신한다. 데이터: GET /places/{id}/conditions
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import type { PlaceCompare } from '@/api/types';
import { TermLinks } from '@/components/term-sheet';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { areaPath, type Box, dayPoints, linePath, nowX, px, py, valueAt, type XY, yRange } from '@/lib/chart';
import { currentIndexPeriod, findSeries, latestPoint, nextExtreme, rangeText, REASON_TEXT, timeLabel } from '@/lib/compare';
import { seaState, windName } from '@/lib/describe';
import { ptyLabel, SKY_TEXT } from '@/lib/format';

type Tab = 'tide' | 'wave' | 'wind' | 'weather';
const TABS: { key: Tab; label: string }[] = [
  { key: 'tide', label: '물때' },
  { key: 'wave', label: '파고' },
  { key: 'wind', label: '바람' },
  { key: 'weather', label: '날씨' },
];
const H = 120; // 그래프 높이
const LEFT = 30; // y 눈금 자리
const f1 = (n: number) => String(Math.round(n * 10) / 10);

type Cal = {
  mulddae?: string | null;
  sunrise?: string | null;
  sunset?: string | null;
  wind_dir_fc?: string | null;
  wind_fc_max?: { v: number } | null;
};

export function SeaChart({ pc, date, cal, updated }: { pc: PlaceCompare; date: string; cal?: Cal; updated?: string | null }) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('tide');
  const [w, setW] = useState(0);
  const now = new Date();
  const nx = nowX(date, now);

  // 탭마다: 큰 값, 설명, 예보 선, 실측 선, 표시 점, 막대, 출처
  let big = '';
  let unit = '';
  let sub = '';
  let fc: XY[] = [];
  let obs: XY[] = [];
  let marks: { x: number; v: number; label: string }[] = [];
  let bars: XY[] = [];
  let src = '';
  let floor: number | undefined;
  let terms: Parameters<typeof TermLinks>[0]['items'] = [];
  let empty: string | null = null;

  if (tab === 'tide') {
    const lv = findSeries(pc, 'tide_level', 'forecast');
    const ex = findSeries(pc, 'tide_extreme', 'forecast');
    fc = dayPoints(lv?.points, date);
    const next = nextExtreme(ex, now);
    big = next ? `${next.type === 'high' ? '만조' : '간조'} ${timeLabel(next.t)}` : '물때';
    sub = [
      next?.v != null ? `${next.v}cm` : null,
      cal?.mulddae ? `물때 ${cal.mulddae}` : (currentIndexPeriod(pc.fishing_index, now)?.tide_phase ?? null),
      cal?.sunrise ? `일출 ${cal.sunrise}` : null,
      cal?.sunset ? `일몰 ${cal.sunset}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    marks = (ex?.status === 'ok' ? (ex.extremes ?? []) : []).flatMap((e) => {
      const p = dayPoints([{ t: e.t, v: e.v }], date)[0];
      return p ? [{ ...p, label: `${e.type === 'high' ? '만' : '간'} ${timeLabel(e.t)}` }] : [];
    });
    // 만조·간조 높이가 곡선과 단위가 같을 때만 곡선 위에, 아니면 곡선 값으로
    marks = marks.map((m) => ({ ...m, v: valueAt(fc, m.x) ?? m.v }));
    src = ex?.source ? `예보 · ${ex.source.agency} ${ex.source.station_name}` : '';
    terms = [['tide', '물때란?']];
    if (!fc.length) empty = ex?.reason ? REASON_TEXT[ex.reason] : '조위 예보 자료 없음';
  } else if (tab === 'wave' || tab === 'wind') {
    const metric = tab === 'wave' ? 'wave_height' : 'wind_speed';
    const fs = findSeries(pc, metric, 'forecast');
    const os = findSeries(pc, metric, 'observed');
    fc = dayPoints(fs?.points, date);
    obs = dayPoints(os?.points, date);
    const last = latestPoint(os);
    const v = last?.v ?? (nx != null ? valueAt(fc, nx) : null);
    unit = tab === 'wave' ? 'm' : 'm/s';
    big = v != null ? f1(v) : '–';
    const grade = v != null ? (tab === 'wave' ? seaState(v) : windName(v).name) : null;
    sub = [
      last?.v != null ? `실측 ${timeLabel(last.t)}` : v != null ? '지금 예보' : null,
      grade,
      rangeText(fs) ? `오늘 예보 ${rangeText(fs)}` : null,
      tab === 'wind' && cal?.wind_dir_fc && cal.wind_fc_max ? `가장 센 바람 ${cal.wind_dir_fc}풍 ${cal.wind_fc_max.v}m/s` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    floor = 0;
    src = [
      os?.source ? `실측 ${os.source.station_name}${os.source.distance_km != null ? ` ${Math.round(os.source.distance_km)}km` : ''}` : null,
      fs?.source ? `예보 ${fs.source.agency}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    terms = tab === 'wave' ? [['wave', '파고란?']] : [['wind', '풍속이란?']];
    if (!fc.length && !obs.length) empty = '예보·실측 자료 없음';
  } else {
    const ts = findSeries(pc, 'air_temp', 'forecast');
    const pop = findSeries(pc, 'precipitation_probability', 'forecast');
    const sky = findSeries(pc, 'sky_state', 'forecast');
    const pty = findSeries(pc, 'precipitation_type', 'forecast');
    fc = dayPoints(ts?.points, date);
    bars = dayPoints(pop?.points, date);
    const v = nx != null ? valueAt(fc, nx) : null;
    unit = '°C';
    big = v != null ? f1(v) : '–';
    const skyText = [...new Set((sky?.points ?? []).flatMap((p) => (p.v == null ? [] : [SKY_TEXT[p.v]])).filter(Boolean))].join('→');
    const ptyText = [...new Set((pty?.points ?? []).flatMap((p) => (p.v && p.v > 0 ? [ptyLabel(p.v)] : [])))].join('·');
    const maxPop = bars.length ? Math.max(...bars.map((b) => b.v)) : null;
    sub = [
      rangeText(ts) ? `오늘 ${rangeText(ts)}` : null,
      maxPop != null ? `강수확률 최대 ${f1(maxPop)}%` : null,
      [skyText, ptyText].filter(Boolean).join(' · ') || null,
    ]
      .filter(Boolean)
      .join(' · ');
    src = '기상청 단기예보 · 육상 날씨라 바다 상태·입질을 뜻하지 않아요';
    if (!fc.length) empty = '단기 날씨 예보 자료 없음';
  }

  const values = [...fc, ...obs].map((p) => p.v);
  const r = yRange(values, floor);
  const cw = Math.max(0, w - LEFT);
  const box: Box = { w: cw, h: H, min: r.min, max: r.max };
  const nowPx = nx != null ? px(nx, box) : null;
  const gid = `g-${tab}`;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.head}>
        <ThemedText type="smallBold">오늘 바다</ThemedText>
        {updated ? (
          <ThemedText type="small" themeColor="textSecondary">
            {timeLabel(updated)} 갱신
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setTab(t.key)}
              style={[styles.tab, { backgroundColor: on ? Brand.teal : theme.background, borderColor: on ? Brand.teal : theme.border }]}>
              <Text style={[styles.tabText, { color: on ? '#FFFFFF' : theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 지금 값 (주식 앱의 현재가 자리) */}
      <View style={styles.bigRow}>
        <Text style={[styles.big, { color: theme.text }]}>{big}</Text>
        {unit ? <Text style={[styles.unit, { color: theme.textSecondary }]}>{unit}</Text> : null}
      </View>
      {sub ? (
        <ThemedText type="small" themeColor="textSecondary">
          {sub}
        </ThemedText>
      ) : null}

      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={styles.chart}>
        {empty ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            {empty}
          </ThemedText>
        ) : w > 0 ? (
          <Svg width={w} height={H + 22}>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={Brand.teal} stopOpacity={0.28} />
                <Stop offset="1" stopColor={Brand.teal} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {/* y 눈금: 최대·최소 */}
            <SvgText x={0} y={10} fontSize={10} fill={theme.textSecondary}>
              {f1(r.max)}
            </SvgText>
            <SvgText x={0} y={H} fontSize={10} fill={theme.textSecondary}>
              {f1(r.min)}
            </SvgText>
            {/* 그래프 영역 */}
            <Line x1={LEFT} y1={H} x2={w} y2={H} stroke={theme.border} strokeWidth={1} />
            {[6, 12, 18].map((hh) => (
              <Line
                key={hh}
                x1={LEFT + px(hh, box)}
                y1={0}
                x2={LEFT + px(hh, box)}
                y2={H}
                stroke={theme.border}
                strokeWidth={0.5}
                strokeDasharray="3,4"
              />
            ))}
            {/* 강수확률 막대 (0~100% 를 그래프 높이 절반까지) */}
            {bars.map((b) => {
              const bh = (b.v / 100) * (H / 2);
              return bh > 0 ? (
                <Rect key={b.x} x={LEFT + px(b.x, box) - 3} y={H - bh} width={6} height={bh} rx={2} fill="#7FB3E8" opacity={0.6} />
              ) : null;
            })}
            <Path d={areaPath(fc, box)} fill={`url(#${gid})`} transform={`translate(${LEFT},0)`} />
            <Path d={linePath(fc, box)} stroke={Brand.teal} strokeWidth={2.2} fill="none" transform={`translate(${LEFT},0)`} />
            {obs.length ? (
              <Path d={linePath(obs, box)} stroke={Brand.orange} strokeWidth={2.2} fill="none" transform={`translate(${LEFT},0)`} />
            ) : null}
            {marks.map((m) => (
              <Circle
                key={m.x}
                cx={LEFT + px(m.x, box)}
                cy={py(m.v, box)}
                r={3.5}
                fill={theme.backgroundElement}
                stroke={Brand.teal}
                strokeWidth={2}
              />
            ))}
            {marks.map((m) => {
              const x = Math.min(Math.max(LEFT + px(m.x, box), LEFT + 18), w - 18);
              const y = py(m.v, box);
              return (
                <SvgText
                  key={`l${m.x}`}
                  x={x}
                  y={m.label.startsWith('간') ? (y + 16 < H ? y + 16 : y - 8) : y < 16 ? y + 16 : y - 8}
                  fontSize={10}
                  fontWeight="700"
                  fill={theme.text}
                  textAnchor="middle">
                  {m.label}
                </SvgText>
              );
            })}
            {/* 지금 */}
            {nowPx != null ? (
              <>
                <Line x1={LEFT + nowPx} y1={0} x2={LEFT + nowPx} y2={H} stroke={Brand.orange} strokeWidth={1.2} />
                {valueAt(fc, nx!) != null ? <Circle cx={LEFT + nowPx} cy={py(valueAt(fc, nx!)!, box)} r={4.5} fill={Brand.orange} /> : null}
              </>
            ) : null}
            {/* x 눈금 */}
            {[0, 6, 12, 18, 24].map((hh) => (
              <SvgText
                key={`x${hh}`}
                x={LEFT + px(hh, box)}
                y={H + 16}
                fontSize={10}
                fill={theme.textSecondary}
                textAnchor={hh === 0 ? 'start' : hh === 24 ? 'end' : 'middle'}>
                {hh === 24 ? '24시' : `${hh}`}
              </SvgText>
            ))}
          </Svg>
        ) : null}
      </View>

      <View style={styles.foot}>
        {obs.length ? (
          <ThemedText type="small" themeColor="textSecondary">
            <Text style={{ color: Brand.teal }}>━</Text> 예보 <Text style={{ color: Brand.orange }}>━</Text> 실측
          </ThemedText>
        ) : null}
        {src ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex} numberOfLines={2}>
            {src}
          </ThemedText>
        ) : null}
      </View>
      {terms.length ? <TermLinks items={terms} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { flex: 1, minHeight: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 14, fontWeight: '700' },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  big: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  unit: { fontSize: 15, fontWeight: '700' },
  chart: { minHeight: H + 22, justifyContent: 'center' },
  empty: { textAlign: 'center' },
  foot: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
