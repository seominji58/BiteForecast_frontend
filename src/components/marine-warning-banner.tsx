import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Warning } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { timeLabel } from '@/lib/compare';

const TITLE: Record<Warning['level'], string> = {
  warning: '해상 특보 발효 중',
  nearby: '인근 해역 특보 발효 중',
  preliminary: '해상 예비특보',
  none: '이 낚시터에 연결된 특보 없음',
  unknown: '해상 특보 확인 불가',
};

const STATUS_TITLE: Partial<Record<Warning['status'], string>> = {
  no_match: '이 낚시터에 연결된 특보 없음 · 다른 해역 특보 있음',
  no_active_warnings: '발효 중인 해상 특보 없음',
  unknown_sea: '적용 해역 확인 불가 · 특보 확인 불가',
  stale: '해상 특보 자료 만료 · 확인 불가',
  collection_failed: '해상 특보 수집 실패 · 확인 불가',
  collector_failed: '자료 수집 중단 · 특보 확인 불가',
  never_collected: '해상 특보 자료 없음 · 확인 불가',
  location_check: '위치 확인 필요 · 특보 확인 불가',
};

/** 특보를 확인하지 못한 이유 (자료 만료와 수집 실패는 함께 있을 수 있다) */
function unknownReason(w: Warning): string {
  if (w.reason === 'LOCATION_CHECK' || w.status === 'location_check')
    return '등록된 좌표가 실제 주소와 맞지 않아(위치 확인 필요) 특보·해황 자료를 연결하지 않았어요.';
  if (w.reason === 'UNKNOWN_SEA' || w.status === 'unknown_sea')
    return '이 장소가 속한 해역을 알 수 없어 특보를 연결하지 못했어요. 특보가 없다는 뜻이 아니에요.';
  const why: string[] = [];
  if (w.issues.includes('stale')) why.push('마지막으로 받은 특보 자료가 3시간보다 오래됐어요');
  if (w.issues.includes('collection_failed')) why.push('최근 특보 자료 수집이 실패했어요');
  if (w.issues.includes('collector_failed')) why.push('자료 수집기가 중간에 멈춰 특보까지 받지 못했을 수 있어요');
  if (!why.length) why.push('최근 특보 자료를 받지 못했어요');
  return `${why.join(' · ')}.`;
}

/**
 * 기상청 해상 특보 (UX 검토 P0-1). 앱이 안전을 판정하지 않고 공식 발표만 전달한다.
 * - unknown 은 「특보 없음」과 다르게 보여준다 (자료가 없을 때 없다고 단정하지 않음)
 * - compact: 비교 표 칸 안에서 쓰는 짧은 형태
 */
export function MarineWarningBanner({ w, compact }: { w: Warning; compact?: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const tone =
    w.level === 'warning'
      ? { bg: theme.dangerSoft, fg: 'danger' as const }
      : w.level === 'nearby'
        ? { bg: theme.warningSoft, fg: 'warning' as const }
        : w.level === 'preliminary'
          ? { bg: theme.cautionSoft, fg: 'warning' as const }
          : { bg: theme.background, fg: 'textSecondary' as const };

  const issued = w.issued_at ? `기상청 ${timeLabel(w.issued_at)} 발표` : '기상청';
  // 참고용(좌표 불일치 의심 곳): 실제 위치의 특보는 확인 안 됨 — 「특보 없음」이라고 하지 않는다
  // 상태별 제목. 「특보 없음」·「해역 모름」·「자료 만료」·「수집 실패」를 서로 다른 말로 보여준다
  const statusTitle = STATUS_TITLE[w.status] ?? TITLE[w.level];
  const title = w.reference_only
    ? w.level === 'unknown'
      ? '실제 위치 특보 확인 안 됨'
      : `참고 · 주소 기준 ${TITLE[w.level]}`
    : statusTitle;
  const basis = w.seas.length ? `${w.seas.join('·')} 해역 기준` : '';
  const lines = [
    ...w.active.map((a) => `${a.type} · ${a.areas.join(', ')}`),
    ...w.preliminary.map((p) => `${p.type} · ${p.when} · ${p.areas.join(', ')}`),
  ];

  if (compact) {
    return (
      <View>
        <ThemedText type="smallBold" themeColor={tone.fg}>
          {title}
        </ThemedText>
        {w.active.length > 0 ? (
          <ThemedText type="small" themeColor={tone.fg}>
            {w.active.map((a) => a.type).join(', ')}
          </ThemedText>
        ) : null}
        {w.active.length === 0 && w.preliminary.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {w.preliminary[0].when}
          </ThemedText>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      disabled={lines.length === 0 && w.level !== 'unknown' && w.status !== 'no_match'}
      onPress={() => setOpen((v) => !v)}
      style={[styles.box, { backgroundColor: tone.bg, borderColor: theme.border }]}>
      <View style={styles.head}>
        <AppIcon name="report" size={22} />
        <View style={styles.flex}>
          <ThemedText type="smallBold" themeColor={tone.fg}>
            {title}
            {w.active.length > 0 ? ` · ${w.active.map((a) => a.type).join(', ')}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[issued, basis].filter(Boolean).join(' · ')}
            {lines.length > 0 || w.level === 'unknown' ? (open ? '  ▴' : '  ▾') : ''}
          </ThemedText>
        </View>
      </View>
      {w.note ? (
        // 좌표 불일치 의심 곳: 주소 기준 특보의 한계 — 접혀 있어도 보이게
        <ThemedText type="small" themeColor="warning">
          {w.note}
        </ThemedText>
      ) : null}
      {open ? (
        <View style={styles.detail}>
          {lines.map((l) => (
            <ThemedText key={l} type="small">
              • {l}
            </ThemedText>
          ))}
          {w.level === 'nearby' ? (
            <ThemedText type="small" themeColor="textSecondary">
              연안(앞바다)이 아닌 먼바다 구역 특보예요. 선상 낚시는 영향을 크게 받을 수 있어요.
            </ThemedText>
          ) : null}
          {w.level === 'unknown' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {unknownReason(w)}{' '}
              출조 전 기상청 날씨누리(weather.go.kr)에서 특보를 꼭 확인하세요.
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {w.status === 'no_match'
                ? '다른 해역에는 특보가 있지만 등록 주소 기준으로 이 낚시터에 연결되는 특보는 없어요. 안전하다는 뜻은 아니며 출조 전 원문을 확인하세요.'
                : '구역명에 이 장소의 바다 이름이 들어간 특보를 넓게 보여줘요. 정확한 구역은 기상청 발표 원문을 확인하세요.'}
            </ThemedText>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  box: { borderRadius: 12, padding: Spacing.two + 4, gap: Spacing.two, borderWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  detail: { gap: 4, paddingLeft: 30 },
});
