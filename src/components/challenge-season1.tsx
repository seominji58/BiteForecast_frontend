/**
 * 전국 낚시 탐험 도장첩 (2026-11-26) — 두 시즌이 같은 화면을 쓴다.
 * - 시즌 1 · 바다낚시공원 (/challenge): 반경 300m · 특보·해진 뒤 막기
 * - 배낚시 항구 (/challenge-ports): 반경 500m · 배낚시 기준 특보 막기 · 새벽 출항이라 밤 제한 없음
 * 도장 찍기: 지금 위치를 서버에 보내 거리만 확인 (위치는 저장하지 않음). 처음 찍은 곳 +20P
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { request } from '@/api/client';
import { useChallenge } from '@/api/queries';
import type { ChallengeVisitResult } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/form';
import { useNavPicker } from '@/components/nav-picker';
import { Card, ErrorView, Loading } from '@/components/screen';
import { SegmentTabs } from '@/components/segment-tabs';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

const SEA_ORDER = ['서해', '남해', '동해', '제주'];

/** 두 시즌 공통 장소 모양 */
type Stamp = {
  id: string;
  name: string;
  region: string;
  sea: string;
  lat: number | null;
  lon: number | null;
  visited_at: string | null;
  visits: number;
  /** 시트에 보여 줄 정보 줄 [이름, 값] */
  rows: [string, string][];
  note: string | null;
  phone: string | null;
  checked: string | null;
  placeId: number | null;
  kakaoUrl: string | null;
};
type Season = { title: string; radius_m: number; points: number; visited: number; spots: Stamp[] };

type Kind = {
  icon: AppIconName;
  subtitle: string;
  rule: (s: Season) => string;
  visit: (spot: Stamp, lat: number, lon: number) => Promise<ChallengeVisitResult>;
  noInfo: string;
};

function StampBook({
  q,
  kind,
}: {
  q: { isPending: boolean; isError: boolean; error: Error | null; data?: Season; refetch: () => void };
  kind: Kind;
}) {
  const theme = useTheme();
  const [sea, setSea] = useState<string | null>(null);
  const [picked, setPicked] = useState<Stamp | null>(null);

  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) return <ErrorView message={q.error?.message ?? '불러오지 못했어요'} onRetry={() => q.refetch()} />;
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
              {s.title}
            </ThemedText>
            <ThemedText type="small" style={styles.onNavySub}>
              {kind.subtitle}
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
          {kind.rule(s)}
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
              key={sp.id}
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
                <AppIcon name={kind.icon} size={34} style={done ? undefined : styles.dim} />
                {done ? (
                  <View style={styles.check}>
                    <ThemedText type="smallBold" style={styles.onNavy}>
                      ✓
                    </ThemedText>
                  </View>
                ) : null}
                {sp.note && !done ? (
                  <View style={[styles.warnDot, { backgroundColor: theme.warning }]}>
                    <ThemedText type="smallBold" style={styles.onNavy}>
                      !
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText type="smallBold" numberOfLines={2} style={styles.cellName}>
                {sp.name}
              </ThemedText>
              <ThemedText type="small" themeColor={done ? 'warning' : 'textSecondary'}>
                {done ? visitedLabel(sp.visited_at!) : (sp.region.split(' ')[1] ?? sp.region)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <SpotSheet spot={picked} season={s} kind={kind} onClose={() => setPicked(null)} />
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

function SpotSheet({ spot, season, kind, onClose }: { spot: Stamp | null; season: Season; kind: Kind; onClose: () => void }) {
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
      const r = await kind.visit(spot, c.lat, c.lon);
      await qc.invalidateQueries({ queryKey: ['challenge'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      onClose();
      Alert.alert(
        r.first ? '🎉 도장을 받았어요' : '오늘도 다녀갔어요',
        r.first
          ? `${spot.name} 도장 · +${r.points}P\n${season.title} ${r.visited}/${r.total}곳`
          : `${spot.name} · 다시 찾은 기록이 남았어요`,
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

        {spot.note ? (
          <View style={[styles.noteBox, { backgroundColor: theme.warningSoft }]}>
            <ThemedText type="small" themeColor="warning">
              ⚠ {spot.note}
            </ThemedText>
          </View>
        ) : null}

        {spot.rows.length ? (
          <View style={[styles.infoBox, { borderColor: theme.border }]}>
            {spot.rows.map(([k, v]) => (
              <View key={k} style={styles.infoRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.infoKey}>
                  {k}
                </ThemedText>
                <ThemedText type="small" style={styles.flex}>
                  {v}
                </ThemedText>
              </View>
            ))}
            {spot.checked ? (
              <ThemedText type="small" themeColor="textSecondary">
                {spot.checked}
              </ThemedText>
            ) : null}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {kind.noInfo}
          </ThemedText>
        )}

        <View style={styles.btnRow}>
          {spot.phone ? (
            <View style={styles.flex}>
              <Button label="전화" variant="secondary" onPress={() => Linking.openURL(`tel:${spot.phone}`).catch(() => undefined)} />
            </View>
          ) : null}
          <View style={styles.flex}>
            <Button label="길안내" variant="secondary" onPress={nav.open} />
          </View>
          {spot.placeId != null ? (
            <View style={styles.flex}>
              <Button label="상세 해황" variant="secondary" onPress={() => (onClose(), router.push(`/place/${spot.placeId}`))} />
            </View>
          ) : spot.kakaoUrl ? (
            <View style={styles.flex}>
              <Button label="카카오맵" variant="secondary" onPress={() => Linking.openURL(spot.kakaoUrl!).catch(() => undefined)} />
            </View>
          ) : null}
        </View>
        <Button
          label={
            busy
              ? '위치 확인 중…'
              : signedIn
                ? spot.visited_at
                  ? '오늘 도장 찍기'
                  : `도장 찍기 · +${season.points}P`
                : '로그인하고 도장 찍기'
          }
          disabled={busy}
          onPress={stamp}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {season.radius_m}m 안에서만 찍을 수 있어요. 안전 수칙과 현장 안내를 따라 주세요.
        </ThemedText>
        {nav.sheet}
      </View>
    </BottomSheet>
  );
}

/** 시즌 1 · 바다낚시공원 */
export function Season1() {
  const q = useChallenge();
  const data: Season | undefined = q.data && {
    ...q.data,
    title: q.data.title || '시즌 1 · 바다낚시공원',
    spots: q.data.spots.map((sp) => {
      const i = sp.info;
      const rows = (
        [
          ['운영', i?.status],
          ['요금', i?.fee],
          ['시간', i?.hours],
          ['휴장', i?.closed],
          ['예약', i?.reservation],
          ['참고', i?.note],
        ] as [string, string | null | undefined][]
      ).filter((r): r is [string, string] => !!r[1]);
      return {
        id: String(sp.place_id),
        name: sp.name,
        region: sp.region,
        sea: sp.sea,
        lat: sp.lat,
        lon: sp.lon,
        visited_at: sp.visited_at,
        visits: sp.visits,
        rows,
        note: null, // 경고(!)는 안전 안내에만 — 낚시공원 메모는 「참고」 줄로
        phone: i?.phone ?? null,
        checked: i ? `${i.checked_at ? `${i.checked_at} 확인 · ` : ''}가기 전에 운영 여부를 전화로 확인하세요` : null,
        placeId: sp.place_id,
        kakaoUrl: null,
      };
    }),
  };
  return (
    <StampBook
      q={{ ...q, data }}
      kind={{
        icon: 'place-wharf',
        subtitle: '지자체·어촌계가 운영하는 바다낚시공원을 찾아가 도장을 모아요',
        rule: (s) =>
          `낚시공원 ${s.radius_m}m 안에서 「도장 찍기」를 누르면 도장을 받아요 · 처음 찍은 곳 +${s.points}P · 해상 특보 중이거나 해가 진 뒤엔 찍을 수 없어요 · 위치는 확인에만 쓰고 저장하지 않아요`,
        visit: (spot, lat, lon) => api.visitChallenge(Number(spot.id), lat, lon),
        noInfo: '운영 시간·요금은 확인 중이에요. 가기 전에 낚시공원에 전화로 확인하세요.',
      }}
    />
  );
}

type PortSeasonOut = {
  title: string;
  radius_m: number;
  points: number;
  visited: number;
  spots: {
    key: string;
    name: string;
    region: string;
    sea: string;
    lat: number;
    lon: number;
    boats: number;
    max_passengers: number | null;
    kakao_url: string | null;
    note: string | null;
    visited_at: string | null;
    visits: number;
  }[];
};

/** 배낚시 항구 (낚시어선 신고가 많은 항구) */
export function SeasonPorts() {
  const { signedIn } = useAuth();
  const q = useQuery({
    queryKey: ['challenge', 'ports', signedIn],
    queryFn: () => request<PortSeasonOut>('/challenge-ports'),
    staleTime: 60_000,
  });
  const data: Season | undefined = q.data && {
    ...q.data,
    title: q.data.title || '배낚시 항구',
    spots: q.data.spots.map((sp) => ({
      id: sp.key,
      name: sp.name,
      region: sp.region,
      sea: sp.sea,
      lat: sp.lat,
      lon: sp.lon,
      visited_at: sp.visited_at,
      visits: sp.visits,
      rows: [
        ['어선', `낚시어선 ${sp.boats}척 신고`] as [string, string],
        ...(sp.max_passengers ? [['정원', `배 한 척 최대 ${sp.max_passengers}명`] as [string, string]] : []),
      ],
      note: sp.note,
      phone: null,
      checked: '해양수산부 낚시 어선업 신고정보 (2026-11-23) · 출항 시간·예약은 선사에 직접 확인하세요',
      placeId: null,
      kakaoUrl: sp.kakao_url,
    })),
  };
  return (
    <StampBook
      q={{ ...q, data }}
      kind={{
        icon: 'anchor',
        subtitle: '낚시어선이 많이 드나드는 항구에서 배를 타고 도장을 모아요',
        rule: (s) =>
          `항구 ${s.radius_m}m 안에서 「도장 찍기」를 누르면 도장을 받아요 · 처음 찍은 곳 +${s.points}P · 해상 특보 중엔 찍을 수 없어요(출항 통제와 같아요) · 항구 안 방파제·테트라포드에서는 낚시하지 마세요`,
        visit: (spot, lat, lon) =>
          request<ChallengeVisitResult>('/challenge-ports/visit', { method: 'POST', body: { key: spot.id, lat, lon } }),
        noInfo: '',
      }}
    />
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
  warnDot: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellName: { textAlign: 'center' },
  sheet: { gap: 12, paddingBottom: 8 },
  noteBox: { borderRadius: 10, padding: 10 },
  infoBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  infoRow: { flexDirection: 'row', gap: 10 },
  infoKey: { width: 32 },
  btnRow: { flexDirection: 'row', gap: 8 },
});
