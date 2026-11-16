import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useJournals, useRecordSummary } from '@/api/queries';
import type { EnvSnapshot, Journal } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { LoginRequired } from '@/components/login-required';
import { Card, EmptyView, ErrorView, Loading, SectionHeader, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { VERIFY_LABEL } from '@/lib/verification';

// SCR-05 낚시 기록 — 일지 목록(인증 상태 배지) + 당시 인근 관측소 기록 요약 (FR-08, FR-10)
export default function RecordsScreen() {
  const journals = useJournals();
  const { status } = useAuth();

  if (status !== 'signed-in') {
    return (
      <TabScreen title="낚시 기록">
        {status === 'loading' ? (
          <Loading />
        ) : (
          <LoginRequired
            icon="cat-catch"
            title="내 낚시 기록을 남겨 보세요"
            message="기록·사진 인증·포인트는 로그인 후 쓸 수 있어요. 이 기기에서 전에 쓴 기록이 있으면 가입한 계정으로 이어져요."
          />
        )}
      </TabScreen>
    );
  }

  return (
    <TabScreen title="낚시 기록">
      <Button label="기록 작성하기" icon="write" onPress={() => router.push('/journal/new')} />
      <SummaryCard />

      <SectionHeader title={`내 기록${journals.data ? ` (${journals.data.length})` : ''}`} />
      {journals.isPending && <Loading />}
      {journals.isError && <ErrorView message={journals.error.message} onRetry={() => journals.refetch()} />}
      {journals.isSuccess &&
        (journals.data.length === 0 ? (
          <EmptyView message="아직 기록이 없어요. 사진과 함께 기록을 남기고 인증을 받으면 포인트가 쌓여요." />
        ) : (
          journals.data.map((j) => <JournalRow key={j.id} journal={j} />)
        ))}
    </TabScreen>
  );
}

/** 내 낚시 요약 한 줄 → 「내 낚시 요약」 화면 (기록이 있을 때만) */
function SummaryCard() {
  const theme = useTheme();
  const s = useRecordSummary();
  if (!s.isSuccess || s.data.journal_count === 0) return null;
  const best = [...s.data.species]
    .filter((x) => x.best_length_cm != null)
    .sort((a, b) => b.best_length_cm! - a.best_length_cm!)[0];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/my-records')}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card style={{ borderColor: theme.tint }}>
        <ThemedText type="smallBold">
          출조 {s.data.trip_days}일 · 잡은 어종 {s.data.species.length}종
          {s.data.skunk_days ? ` · 못 잡은 날 ${s.data.skunk_days}일` : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {best ? `내 최대어 ${best.species_name} ${best.best_length_cm}cm · ` : ''}어종 도감·첫 포획 보기 ›
        </ThemedText>
      </Card>
    </Pressable>
  );
}

function envValue(snaps: EnvSnapshot[], metric: EnvSnapshot['metric']): string {
  const s = snaps.find((x) => x.metric === metric);
  return s?.value != null ? `${s.value}${s.unit}` : '–';
}

function JournalRow({ journal: j }: { journal: Journal }) {
  const theme = useTheme();
  const source = usePhotoSource();
  const thumb = j.photos[0] ? source(j.photos[0]) : null;
  const v = VERIFY_LABEL[j.verification.status];
  // 마릿수 0 = 「못 잡은 날」 기록 (꽝도 출조 기록으로 보여준다)
  const catchText =
    j.count === 0
      ? '못 잡은 날'
      : [j.count != null ? `${j.count}마리` : null, j.max_length_cm != null ? `${j.max_length_cm}cm` : null]
          .filter(Boolean)
          .join(' · ');

  return (
    <Link href={{ pathname: '/journal/[id]', params: { id: String(j.id) } }} asChild>
      <Pressable accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
        <Card style={styles.row}>
          <View style={[styles.art, { backgroundColor: theme.background }]}>
            {thumb ? (
              <Image source={thumb} style={styles.img} contentFit="cover" />
            ) : (
              <AppIcon name="cat-catch" size={36} />
            )}
          </View>
          <View style={styles.main}>
            <View style={styles.between}>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
                {formatDateTime(j.fished_at)}
              </ThemedText>
              <ThemedText type="smallBold" themeColor={v.color}>
                {v.label}
                {j.verification.points > 0 ? ` +${j.verification.points}P` : ''}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" numberOfLines={1}>
              {j.place_name}
            </ThemedText>
            <ThemedText type="small" numberOfLines={1}>
              {j.count === 0 && !j.species_name ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.bold}>
                  못 잡은 날
                </ThemedText>
              ) : (
                <>
                  <ThemedText type="small" themeColor="tint" style={styles.bold}>
                    {j.species_name ?? '어종 미기록'}
                  </ThemedText>
                  {catchText ? ` · ${catchText}` : ''}
                </>
              )}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              당시 관측 파고 {envValue(j.env_snapshots, 'wave_height')} · 바람 {envValue(j.env_snapshots, 'wind_speed')}
              {j.photo_count ? ` · 사진 ${j.photo_count}` : ''}
            </ThemedText>
            {j.verification.status === 'rejected' && j.verification.reject_reason ? (
              <ThemedText type="small" themeColor="danger" numberOfLines={1}>
                반려: {j.verification.reject_reason}
              </ThemedText>
            ) : null}
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  art: { width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  main: { flex: 1, gap: 2 },
  between: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bold: { fontWeight: '700' },
});
