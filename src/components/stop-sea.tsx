/**
 * 출조계획 장소 카드의 해황 (2026-11-23 가독성 개선): 한 덩어리 글 대신
 *   ① 상태 칩 (내 기준 · 특보)  ② 파고·바람·강수 3칸  ③ 물때·일출·일몰 한 줄  ④ 만조·간조 칩 (다음 물때 강조)
 * 예보 전·지난 날짜·위치 확인 필요 등은 기존 한 줄 안내(outlookLine)를 그대로 쓴다.
 */
import { StyleSheet, View } from 'react-native';

import type { StopOutlook } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { useTheme } from '@/hooks/use-theme';
import { timeLabel } from '@/lib/compare';
import { type Criteria, WARNING_SHORT } from '@/lib/criteria';
import { ptyLabel } from '@/lib/format';
import { outlookLine } from '@/lib/trip';

export function StopSea({ o, criteria, lastDay }: { o: StopOutlook | undefined; criteria: Criteria; lastDay: string | null }) {
  const theme = useTheme();
  const line = outlookLine(o, criteria, lastDay);
  if (!o || o.forecast_status !== 'available') {
    return (
      <View style={[styles.box, { backgroundColor: theme.background }]}>
        <ThemedText type="small" themeColor={line.tone}>
          {line.text}
        </ThemedText>
        {line.tide ? (
          <ThemedText type="small" themeColor="textSecondary">
            {line.tide}
          </ThemedText>
        ) : null}
      </View>
    );
  }
  const warnLevel = o.warning_is_current ? o.warning_level : null;
  const warnChip =
    o.warning_level == null
      ? { text: '특보 확인 불가', fg: 'warning' as const, bg: theme.warningSoft }
      : !o.warning_is_current
        ? { text: '그날 특보 발표 전', fg: 'textSecondary' as const, bg: theme.backgroundElement }
        : warnLevel === 'warning'
          ? { text: `⚠ ${o.warning_types.join('·') || '해상 특보'} 발효`, fg: 'danger' as const, bg: theme.dangerSoft }
          : warnLevel === 'nearby' || warnLevel === 'preliminary'
            ? { text: WARNING_SHORT[warnLevel].text, fg: 'warning' as const, bg: theme.warningSoft }
            : { text: '특보 없음', fg: 'success' as const, bg: theme.tintSoft };
  const rain = [o.pop_fc_max ? `${o.pop_fc_max.v}%` : null, o.precipitation_types.length ? o.precipitation_types.map(ptyLabel).join('·') : null]
    .filter(Boolean)
    .join(' ');
  const now = new Date();
  const next = o.tides.find((t) => new Date(t.t) > now);
  const cal = [o.mulddae ? `${o.mulddae}` : null, o.sunrise ? `일출 ${o.sunrise}` : null, o.sunset ? `일몰 ${o.sunset}` : null].filter(Boolean);
  return (
    <View style={[styles.box, { backgroundColor: theme.background }]}>
      <View style={styles.chips}>
        {line.fit ? (
          <View style={[styles.chip, { backgroundColor: line.fit.color === 'success' ? theme.tintSoft : theme.backgroundElement }]}>
            <ThemedText type="smallBold" themeColor={line.fit.color}>
              {line.fit.label}
            </ThemedText>
          </View>
        ) : null}
        <View style={[styles.chip, { backgroundColor: warnChip.bg }]}>
          <ThemedText type="smallBold" themeColor={warnChip.fg} numberOfLines={1}>
            {warnChip.text}
          </ThemedText>
        </View>
      </View>

      <View style={styles.tiles}>
        <Tile icon="wave" label="파고 최대" value={o.wave_fc_max ? `${o.wave_fc_max.v}m` : '없음'} />
        <Tile
          icon="wind"
          label={o.wind_dir_fc ? `${o.wind_dir_fc}풍 최대` : '바람 최대'}
          value={o.wind_fc_max ? `${o.wind_fc_max.v}m/s` : '없음'}
        />
        <Tile emoji="☔" label="강수" value={rain || '없음'} />
      </View>

      {cal.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {cal.join(' · ')}
          {o.mulddae_style ? ` (${o.mulddae_style})` : ''}
        </ThemedText>
      ) : null}
      {o.tides.length ? (
        <View style={styles.tides}>
          {o.tides.map((t) => {
            const isNext = next?.t === t.t;
            return (
              <View
                key={t.t}
                style={[
                  styles.tide,
                  { borderColor: isNext ? theme.tint : theme.border, backgroundColor: theme.backgroundElement },
                  new Date(t.t) < now && styles.past,
                ]}>
                <ThemedText type="small" themeColor={t.type === 'high' ? 'tint' : 'accent'}>
                  {t.type === 'high' ? '만조' : '간조'}
                </ThemedText>
                <ThemedText type="smallBold">{timeLabel(t.t)}</ThemedText>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function Tile({ icon, emoji, label, value }: { icon?: AppIconName; emoji?: string; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {icon ? <AppIcon name={icon} size={18} /> : <ThemedText style={styles.emoji}>{emoji}</ThemedText>}
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 10, padding: 10, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: '100%' },
  tiles: { flexDirection: 'row', gap: 6 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', gap: 1 },
  tides: { flexDirection: 'row', gap: 6 },
  tide: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 4, alignItems: 'center' },
  past: { opacity: 0.45 },
  emoji: { fontSize: 15, lineHeight: 20 },
});
