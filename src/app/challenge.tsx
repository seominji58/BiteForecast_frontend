/**
 * 낚시 탐험 30선 — 화면 미리보기 (2026-11-26).
 * 명산 100처럼 바다낚시 명소를 찾아가 도장을 모으는 기능의 화면 구조만 먼저 보여 준다.
 * - 데이터: lib/challenge-data.ts (조사 문서의 후보 34곳, 지어낸 값 없음)
 * - 서버·방문 기록 저장은 아직 없음 → 진행률은 0, 「방문 인증」은 정식 오픈 후
 * - 모두 낚시 가능 여부를 확인 중인 후보라는 것을 화면 맨 위에 밝힌다
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/form';
import { useNavPicker } from '@/components/nav-picker';
import { Card, StackScreen } from '@/components/screen';
import { SegmentTabs } from '@/components/segment-tabs';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CHALLENGE_CHECKED_AT, CHALLENGE_SPOTS, type ChallengeSea, type ChallengeSpot, type ChallengeStatus } from '@/lib/challenge-data';

const SEAS: ChallengeSea[] = ['동해', '서해', '남해', '제주'];

const STATUS_HINT: Record<ChallengeStatus, string> = {
  '검증 완료': '낚시 가능 여부·접근·방문 지점까지 확인을 마친 곳',
  조건부: '공식 제한에 걸리지 않고 낚시 안내 근거가 있어요. 조건을 꼭 지켜야 해요',
  미확인: '시군 낚시통제구역 고시를 아직 확인하지 못했어요',
  보류: '낚시 제한이 생길 수 있어 확인될 때까지 보류했어요',
};

function spotIcon(name: string): AppIconName {
  if (/해변|해수욕장/.test(name)) return 'place-beach';
  if (/선창|포구/.test(name)) return 'place-wharf';
  return 'place-breakwater';
}

function useStatusColor() {
  const theme = useTheme();
  return (s: ChallengeStatus) => (s === '조건부' || s === '검증 완료' ? theme.tint : s === '보류' ? theme.warning : theme.textSecondary);
}

export default function ChallengeScreen() {
  const theme = useTheme();
  const [sea, setSea] = useState<ChallengeSea>('동해');
  const [picked, setPicked] = useState<ChallengeSpot | null>(null);
  const total = CHALLENGE_SPOTS.length;
  const visited = 0; // 방문 기록 저장은 정식 오픈 후
  const spots = CHALLENGE_SPOTS.filter((s) => s.sea === sea);

  return (
    <StackScreen>
      {/* 진행률 (도장첩 표지) */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <AppIcon name="medal" size={36} />
          <View style={styles.flex}>
            <ThemedText type="sectionTitle" style={styles.onNavy}>
              전국 낚시 탐험
            </ThemedText>
            <ThemedText type="small" style={styles.onNavySub}>
              바다낚시 명소를 찾아가 도장을 하나씩 모아요
            </ThemedText>
          </View>
          <View style={styles.previewPill}>
            <ThemedText type="smallBold" style={styles.previewText}>
              미리보기
            </ThemedText>
          </View>
        </View>
        <View style={styles.progressRow}>
          <ThemedText style={styles.progressNum}>
            {visited}
            <ThemedText style={styles.progressTotal}> / {total}곳</ThemedText>
          </ThemedText>
          <ThemedText type="small" style={styles.onNavySub}>
            {SEAS.map((s) => `${s} 0`).join(' · ')}
          </ThemedText>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${(visited / total) * 100}%` }]} />
        </View>
      </View>

      <Card style={{ backgroundColor: theme.warningSoft, borderColor: theme.warningSoft }}>
        <ThemedText type="small">
          <ThemedText type="smallBold">아직 후보예요.</ThemedText> 낚시해도 되는 곳인지 시군 고시·해경 공고로 확인하는 중이라(
          {CHECKED_LABEL}), 검증을 마친 곳부터 정식으로 열려요. 지금은 방문 기록이 저장되지 않아요.
        </ThemedText>
      </Card>

      <SegmentTabs
        tabs={SEAS.map((s) => ({ value: s, label: `${s} ${CHALLENGE_SPOTS.filter((x) => x.sea === s).length}` }))}
        value={sea}
        onChange={setSea}
      />

      {/* 도장 칸 */}
      <View style={styles.grid}>
        {spots.map((s) => (
          <Stamp key={s.id} spot={s} onPress={() => setPicked(s)} />
        ))}
      </View>

      <Legend />

      <SpotSheet spot={picked} onClose={() => setPicked(null)} />
    </StackScreen>
  );
}

const CHECKED_LABEL = `${Number(CHALLENGE_CHECKED_AT.slice(5, 7))}/${Number(CHALLENGE_CHECKED_AT.slice(8, 10))} 기준`;

function Stamp({ spot, onPress }: { spot: ChallengeSpot; onPress: () => void }) {
  const theme = useTheme();
  const color = useStatusColor()(spot.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${spot.name}, ${spot.sigungu}, ${spot.status}, 아직 방문 안 함`}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.stamp, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <AppIcon name={spotIcon(spot.name)} size={34} style={styles.stampIcon} />
      </View>
      <ThemedText type="smallBold" numberOfLines={2} style={styles.cellName}>
        {spot.name}
      </ThemedText>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <ThemedText type="small" style={{ color }}>
          {spot.reserve ? `${spot.status} · 예비` : spot.status}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function Legend() {
  const color = useStatusColor();
  return (
    <Card>
      <ThemedText type="smallBold">상태 보는 법</ThemedText>
      {(['조건부', '미확인', '보류'] as ChallengeStatus[]).map((s) => (
        <View key={s} style={styles.legendRow}>
          <View style={[styles.dot, styles.legendDot, { backgroundColor: color(s) }]} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            <ThemedText type="smallBold" style={{ color: color(s) }}>
              {s}
            </ThemedText>{' '}
            {STATUS_HINT[s]}
          </ThemedText>
        </View>
      ))}
    </Card>
  );
}

function SpotSheet({ spot, onClose }: { spot: ChallengeSpot | null; onClose: () => void }) {
  const theme = useTheme();
  const color = useStatusColor();
  const nav = useNavPicker(spot ? { kind: 'route', name: spot.name, lat: spot.lat, lon: spot.lon } : { kind: 'none', reason: '' });
  return (
    <BottomSheet open={spot != null} title={spot?.name ?? ''} onClose={onClose}>
      {spot ? (
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <AppIcon name={spotIcon(spot.name)} size={44} />
            <View style={styles.flex}>
              <ThemedText type="small" themeColor="textSecondary">
                {spot.sigungu} · {spot.sea}
                {spot.reserve ? ' · 예비 후보' : ''}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: color(spot.status) }}>
                {spot.status}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {STATUS_HINT[spot.status]}
              </ThemedText>
            </View>
          </View>

          {spot.note ? (
            <View style={[styles.noteBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText type="smallBold">확인하며 남긴 메모</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {spot.note}
              </ThemedText>
            </View>
          ) : null}

          {spot.fish.length ? (
            <View style={styles.fishWrap}>
              <ThemedText type="smallBold">근처 해수부 포인트 대상어</ThemedText>
              <View style={styles.chips}>
                {spot.fish.map((f) => (
                  <View key={f} style={[styles.chip, { backgroundColor: theme.tintSoft }]}>
                    <ThemedText type="small" themeColor="tint">
                      {f}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Button label="길안내" variant="secondary" onPress={nav.open} />
          <Button label="방문 인증 · 정식 오픈 후" disabled onPress={() => undefined} />
          <ThemedText type="small" themeColor="textSecondary">
            정식 오픈하면 현장에서 사진으로 방문을 인증하고 도장을 받아요. 출입이 막힌 방파제(테트라포드)에는 들어가지 마세요.
          </ThemedText>
          {nav.sheet}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { backgroundColor: Brand.navy, borderRadius: 14, padding: 16, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  onNavy: { color: '#FFFFFF' },
  onNavySub: { color: 'rgba(255,255,255,0.75)' },
  previewPill: { backgroundColor: Brand.orange, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  previewText: { color: '#FFFFFF' },
  progressRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  progressNum: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '800' },
  progressTotal: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: '700' },
  bar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: Brand.orange },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 },
  cell: { width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  stamp: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampIcon: { opacity: 0.35 },
  cellName: { textAlign: 'center', minHeight: 36 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  legendDot: { marginTop: 6 },
  sheet: { gap: 12, paddingBottom: 8 },
  sheetHead: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  noteBox: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 2 },
  fishWrap: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
});
