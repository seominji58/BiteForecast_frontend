/**
 * 전국 낚시 탐험 시즌 1 — 공식 바다낚시공원 도장 (2026-11-26).
 * - 장소·내 도장은 서버(/challenge). 도장 찍기: 지금 위치가 300m 안이면 (위치는 확인에만, 저장 안 함)
 * - 해상 특보 중·해진 뒤·같은 곳 하루 두 번은 서버가 막고 이유를 알려 준다
 * - 처음 찍은 곳은 +20P (칭호·포인트)
 */
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { useChallenge } from '@/api/queries';
import type { ChallengeSpot } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/form';
import { useNavPicker } from '@/components/nav-picker';
import { Card, ErrorView, Loading } from '@/components/screen';
import { SegmentTabs } from '@/components/segment-tabs';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

const SEA_ORDER = ['서해', '남해', '동해', '제주'];

export function Season1() {
  const theme = useTheme();
  const q = useChallenge();
  const [sea, setSea] = useState<string | null>(null);
  const [picked, setPicked] = useState<ChallengeSpot | null>(null);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView message={q.error.message} onRetry={() => q.refetch()} />;
  const s = q.data;
  const seas = SEA_ORDER.filter((x) => s.spots.some((sp) => sp.sea === x));
  const cur = sea ?? seas[0];
  const spots = s.spots.filter((sp) => sp.sea === cur);
  const total = s.spots.length;

  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <AppIcon name="medal" size={36} />
          <View style={styles.flex}>
            <ThemedText type="sectionTitle" style={styles.onNavy}>
              {s.title || '전국 낚시 탐험'}
            </ThemedText>
            <ThemedText type="small" style={styles.onNavySub}>
              지자체·어촌계가 운영하는 바다낚시공원을 찾아가 도장을 모아요
            </ThemedText>
          </View>
        </View>
        <View style={styles.progressRow}>
          <ThemedText style={styles.progressNum}>
            {s.visited}
            <ThemedText style={styles.progressTotal}> / {total}곳</ThemedText>
          </ThemedText>
          <ThemedText type="small" style={styles.onNavySub}>
            {seas
              .map(
                (x) =>
                  `${x} ${s.spots.filter((sp) => sp.sea === x && sp.visited_at).length}/${s.spots.filter((sp) => sp.sea === x).length}`,
              )
              .join(' · ')}
          </ThemedText>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${total ? (s.visited / total) * 100 : 0}%` }]} />
        </View>
      </View>

      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          낚시공원 {s.radius_m}m 안에서 「도장 찍기」를 누르면 도장을 받아요 · 처음 찍은 곳 +{s.points}P · 해상 특보 중이거나 해가 진 뒤엔
          찍을 수 없어요 · 위치는 확인에만 쓰고 저장하지 않아요
        </ThemedText>
      </Card>

      {seas.length > 1 ? (
        <SegmentTabs
          tabs={seas.map((x) => ({ value: x, label: `${x} ${s.spots.filter((sp) => sp.sea === x).length}` }))}
          value={cur}
          onChange={setSea}
        />
      ) : null}

      <View style={styles.grid}>
        {spots.map((sp) => {
          const done = !!sp.visited_at;
          return (
            <Pressable
              key={sp.place_id}
              accessibilityRole="button"
              accessibilityLabel={`${sp.name}, ${done ? '도장 받음' : '아직 안 감'}`}
              onPress={() => setPicked(sp)}
              style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.7 : 1 }]}>
              <View
                style={[
                  styles.stamp,
                  done
                    ? { borderColor: Brand.orange, backgroundColor: theme.warningSoft, borderStyle: 'solid' }
                    : { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                ]}>
                <AppIcon name="place-wharf" size={34} style={done ? undefined : styles.dim} />
                {done ? (
                  <View style={styles.check}>
                    <ThemedText type="smallBold" style={styles.onNavy}>
                      ✓
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText type="smallBold" numberOfLines={2} style={styles.cellName}>
                {sp.name.replace(/낚시터$/, ' 낚시터')}
              </ThemedText>
              <ThemedText type="small" themeColor={done ? 'warning' : 'textSecondary'}>
                {done ? visitedLabel(sp.visited_at!) : (sp.region.split(' ')[1] ?? sp.region)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <SpotSheet spot={picked} radius={s.radius_m} points={s.points} onClose={() => setPicked(null)} />
    </>
  );
}

function visitedLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear() % 100}.${d.getMonth() + 1}.${d.getDate()} 방문`;
}

async function freshCoords(): Promise<{ lat: number; lon: number } | { error: string }> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return { error: '휴대폰의 위치 서비스가 꺼져 있어요.' };
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { error: '위치 권한이 있어야 도장을 찍을 수 있어요. 설정에서 허용해 주세요.' };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return { error: '현재 위치를 찾지 못했어요. 잠시 후 다시 시도해 주세요.' };
  }
}

function SpotSheet({ spot, radius, points, onClose }: { spot: ChallengeSpot | null; radius: number; points: number; onClose: () => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const { signedIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const nav = useNavPicker(
    spot?.lat != null && spot.lon != null ? { kind: 'route', name: spot.name, lat: spot.lat, lon: spot.lon } : { kind: 'none', reason: '' },
  );
  if (!spot)
    return (
      <BottomSheet open={false} title="" onClose={onClose}>
        {null}
      </BottomSheet>
    );
  const info = spot.info;

  const stamp = async () => {
    if (!signedIn) {
      onClose();
      router.push('/login');
      return;
    }
    setBusy(true);
    const c = await freshCoords();
    if ('error' in c) {
      setBusy(false);
      Alert.alert('도장 찍기', c.error);
      return;
    }
    try {
      const r = await api.visitChallenge(spot.place_id, c.lat, c.lon);
      await qc.invalidateQueries({ queryKey: ['challenge'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      onClose();
      Alert.alert(
        r.first ? '🎉 도장을 받았어요' : '오늘도 다녀갔어요',
        r.first ? `${spot.name} 도장 · +${r.points}P\n탐험 ${r.visited}/${r.total}곳` : `${spot.name} · 다시 찾은 기록이 남았어요`,
      );
    } catch (e) {
      Alert.alert('도장을 찍지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open title={spot.name} onClose={onClose}>
      <View style={styles.sheet}>
        <ThemedText type="small" themeColor="textSecondary">
          {spot.region} · {spot.sea}
          {spot.visited_at ? ` · ${visitedLabel(spot.visited_at)} (${spot.visits}번)` : ''}
        </ThemedText>

        {info ? (
          <View style={[styles.infoBox, { borderColor: theme.border }]}>
            {[
              ['운영', info.status],
              ['요금', info.fee],
              ['시간', info.hours],
              ['휴장', info.closed],
              ['예약', info.reservation],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <View key={k} style={styles.infoRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.infoKey}>
                    {k}
                  </ThemedText>
                  <ThemedText type="small" style={styles.flex}>
                    {v}
                  </ThemedText>
                </View>
              ))}
            {info.note ? (
              <ThemedText type="small" themeColor="textSecondary">
                {info.note}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              {info.checked_at ? `${info.checked_at} 확인 · ` : ''}가기 전에 운영 여부를 전화로 확인하세요
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            운영 시간·요금은 확인 중이에요. 가기 전에 낚시공원에 전화로 확인하세요.
          </ThemedText>
        )}

        <View style={styles.btnRow}>
          {info?.phone ? (
            <View style={styles.flex}>
              <Button label="전화" variant="secondary" onPress={() => Linking.openURL(`tel:${info.phone}`).catch(() => undefined)} />
            </View>
          ) : null}
          <View style={styles.flex}>
            <Button label="길안내" variant="secondary" onPress={nav.open} />
          </View>
          <View style={styles.flex}>
            <Button label="상세 해황" variant="secondary" onPress={() => (onClose(), router.push(`/place/${spot.place_id}`))} />
          </View>
        </View>
        <Button
          label={
            busy ? '위치 확인 중…' : signedIn ? (spot.visited_at ? '오늘 도장 찍기' : `도장 찍기 · +${points}P`) : '로그인하고 도장 찍기'
          }
          disabled={busy}
          onPress={stamp}
        />
        <ThemedText type="small" themeColor="textSecondary">
          낚시공원 {radius}m 안에서만 찍을 수 있어요. 안전 수칙과 공원 안내를 따라 주세요.
        </ThemedText>
        {nav.sheet}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { backgroundColor: Brand.navy, borderRadius: 14, padding: 16, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  onNavy: { color: '#FFFFFF' },
  onNavySub: { color: 'rgba(255,255,255,0.75)' },
  progressRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  progressNum: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '800' },
  progressTotal: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: '700' },
  bar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: Brand.orange },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 },
  cell: { width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  stamp: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.35 },
  check: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellName: { textAlign: 'center' },
  sheet: { gap: 12, paddingBottom: 8 },
  infoBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  infoRow: { flexDirection: 'row', gap: 10 },
  infoKey: { width: 32 },
  btnRow: { flexDirection: 'row', gap: 8 },
});
