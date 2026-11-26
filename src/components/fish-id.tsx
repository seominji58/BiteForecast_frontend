/**
 * 사진으로 어종 찾기 (2026-11-26). 낚시일지 어종 칸 아래 버튼 → 앨범에서 사진 1장 → AI 후보 최대 3개.
 * - 후보를 누르면 어종 칸이 채워진다 (최종 선택은 사용자)
 * - 목록 어종이면 금어기·금지체장 한 줄을 같이 보여 준다
 * - 먹어도 되는지는 답하지 않는다 (서버 안내 문구 그대로)
 * - 로그인 + 서버에 키가 있을 때만 보인다. 하루 횟수 제한은 서버가 센다
 */
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { identifyFish, useFishIdStatus, type FishCandidate, type FishIdResult } from '@/api/fish-id';
import { useDateRange, useFishingRules } from '@/api/queries';
import { AppIcon } from '@/components/app-icon';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/form';
import { SpeciesImage } from '@/components/species';
import type { SpeciesValue } from '@/components/species-field';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { inPeriod, periodText, rulesForSpecies } from '@/lib/rules';
import { speciesByCode } from '@/lib/species';

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; uri: string }
  | { kind: 'done'; uri: string; result: FishIdResult }
  | { kind: 'error'; uri: string | null; message: string };

export function FishIdButton({ onPick }: { onPick: (v: SpeciesValue) => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const status = useFishIdStatus();
  const [state, setState] = useState<State>({ kind: 'idle' });
  if (!status.data?.enabled) return null;

  const start = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setState({ kind: 'loading', uri: asset.uri });
    try {
      const result = await identifyFish(asset);
      setState({ kind: 'done', uri: asset.uri, result });
    } catch (e) {
      setState({ kind: 'error', uri: asset.uri, message: e instanceof Error ? e.message : '어종을 찾지 못했어요' });
    } finally {
      qc.invalidateQueries({ queryKey: ['fish-id-status'] });
    }
  };

  const pick = (c: FishCandidate) => {
    onPick(c.code ? { code: c.code, etc: null } : { code: null, etc: c.name.slice(0, 50) });
    setState({ kind: 'idle' });
  };

  const left = status.data.remaining;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`사진으로 어종 찾기, 오늘 ${left}번 남음`}
        disabled={left <= 0}
        onPress={start}
        style={({ pressed }) => [styles.btn, { borderColor: theme.border, opacity: left <= 0 ? 0.5 : pressed ? 0.7 : 1 }]}>
        <AppIcon name="cat-question" size={20} />
        <View style={styles.flex}>
          <ThemedText type="smallBold" themeColor="tint">
            사진으로 어종 찾기
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {left > 0 ? `모르는 물고기면 사진을 올려 보세요 · 오늘 ${left}번 남음` : '오늘은 모두 썼어요 · 내일 다시 쓸 수 있어요'}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary">›</ThemedText>
      </Pressable>

      <BottomSheet open={state.kind !== 'idle'} title="사진으로 어종 찾기" onClose={() => setState({ kind: 'idle' })}>
        <ResultBody state={state} onPick={pick} onRetry={start} />
      </BottomSheet>
    </>
  );
}

function ResultBody({ state, onPick, onRetry }: { state: State; onPick: (c: FishCandidate) => void; onRetry: () => void }) {
  const theme = useTheme();
  if (state.kind === 'idle') return null;
  const photo = state.uri ? <Image source={{ uri: state.uri }} style={styles.photo} contentFit="cover" /> : null;

  if (state.kind === 'loading') {
    return (
      <View style={styles.body}>
        {photo}
        <View style={styles.loading}>
          <ActivityIndicator color={theme.tint} />
          <ThemedText type="small" themeColor="textSecondary">
            사진을 보고 있어요… (5초 정도)
          </ThemedText>
        </View>
      </View>
    );
  }
  if (state.kind === 'error') {
    return (
      <View style={styles.body}>
        {photo}
        <ThemedText themeColor="danger">{state.message}</ThemedText>
        <Button label="다른 사진으로 다시" variant="secondary" onPress={onRetry} />
      </View>
    );
  }

  const r = state.result;
  const [top, ...others] = r.candidates;
  return (
    <View style={styles.body}>
      <View>
        {photo}
        <View style={styles.aiTag}>
          <ThemedText type="smallBold" style={styles.aiTagText}>
            AI 추정
          </ThemedText>
        </View>
      </View>

      {!r.is_fish || !top ? (
        <View style={[styles.topCard, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">물고기를 찾지 못했어요</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            물고기 옆모습이 화면에 크게 나오게 다시 찍어 보세요.
          </ThemedText>
          <Button label="다른 사진으로 다시" variant="secondary" onPress={onRetry} />
        </View>
      ) : (
        <>
          <View style={[styles.topCard, { borderColor: theme.tint }]}>
            <ThemedText type="small" themeColor="textSecondary">
              가장 가까운 어종
            </ThemedText>
            <View style={styles.topRow}>
              <SpeciesImage code={top.code} size={56} />
              <View style={styles.flex}>
                <View style={styles.nameRow}>
                  <ThemedText type="subtitle" style={styles.topName}>
                    {top.name}
                  </ThemedText>
                  <Confidence level={top.confidence} />
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {top.features}
                </ThemedText>
              </View>
            </View>
            <RuleText code={top.code} />
            <Button label={`${top.name.replace(/\(.*\)/, '')} 선택`} onPress={() => onPick(top)} />
          </View>

          {others.length ? (
            <View style={styles.others}>
              <ThemedText type="small" themeColor="textSecondary">
                다른 후보
              </ThemedText>
              {others.map((c, i) => (
                <Pressable
                  key={`${c.name}-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}, 가능성 ${c.confidence}, 이 어종으로 고르기`}
                  onPress={() => onPick(c)}
                  style={({ pressed }) => [styles.otherRow, { borderTopColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
                  <SpeciesImage code={c.code} size={36} />
                  <View style={styles.flex}>
                    <View style={styles.nameRow}>
                      <ThemedText type="smallBold">{c.name}</ThemedText>
                      <Confidence level={c.confidence} />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {c.code ? c.features : '목록에 없는 어종 · 직접 입력으로 저장'}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="tint">
                    고르기
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}

      {/* 첫 후보가 확실하면 다시 찍기 안내는 생략 */}
      {r.photo_tip && top?.confidence !== '높음' ? (
        <ThemedText type="small" themeColor="textSecondary">
          📷 {r.photo_tip}
        </ThemedText>
      ) : null}

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <ThemedText type="small" themeColor="warning">
          AI 추정이라 틀릴 수 있어요. 먹어도 되는지는 알려 드리지 않아요 — 모르는 물고기는 먹지 마세요.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          위치 정보를 지운 사진을 OpenAI로 보내 판별하고, 입질예보 서버에는 저장하지 않아요 · 오늘 {r.remaining}번 남음
        </ThemedText>
      </View>
    </View>
  );
}

/** 가능성: 색 점 + 글자 (높음 초록 · 보통 주황 · 낮음 회색) */
function Confidence({ level }: { level: FishCandidate['confidence'] }) {
  const theme = useTheme();
  const color = level === '높음' ? theme.tint : level === '보통' ? theme.warning : theme.textSecondary;
  return (
    <View style={styles.conf}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small" style={{ color }}>
        가능성 {level}
      </ThemedText>
    </View>
  );
}

/** 금어기·금지체장 한 줄 (상자 없이). 목록 밖 어종이면 그리지 않는다 */
function RuleText({ code }: { code: string | null }) {
  const theme = useTheme();
  const rules = useFishingRules();
  const today = useDateRange().data?.today;
  const item = speciesByCode(code);
  if (!item || !rules.data || !today) return null;
  const { bans, sizes } = rulesForSpecies(rules.data, item.code);
  const nowBan = bans.find((b) => b.periods.some((p) => inPeriod(p, today)));
  const text = nowBan
    ? `지금 금어기예요 · ${nowBan.periods
        .filter((p) => inPeriod(p, today))
        .map(periodText)
        .join('·')}`
    : [
        sizes.length ? `${sizes.map((x) => x.limit).join('·')} 이하는 놓아주세요` : null,
        bans.length
          ? `금어기 ${bans
              .flatMap((b) => b.periods)
              .map(periodText)
              .join('·')}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ') || '법정 금어기·금지체장 없음';
  return (
    <View style={[styles.rule, { backgroundColor: nowBan ? theme.dangerSoft : theme.backgroundElement }]}>
      <AppIcon name="regulation" size={16} />
      <ThemedText type="small" themeColor={nowBan ? 'danger' : 'text'} style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  body: { gap: 12, paddingBottom: 8 },
  photo: { width: '100%', height: 160, borderRadius: 14 },
  aiTag: {
    position: 'absolute',
    left: 10,
    top: 10,
    backgroundColor: 'rgba(8,28,50,0.72)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  aiTagText: { color: '#FFFFFF' },
  topCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 10 },
  topRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  topName: { fontSize: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  others: { gap: 0 },
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footer: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 12 },
  conf: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
