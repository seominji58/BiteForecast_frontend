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
import { useDateRange } from '@/api/queries';
import { AppIcon } from '@/components/app-icon';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/form';
import { RulesLine } from '@/components/rules-line';
import { SpeciesImage } from '@/components/species';
import type { SpeciesValue } from '@/components/species-field';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
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
  const range = useDateRange();
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
  return (
    <View style={styles.body}>
      {photo}
      {!r.is_fish || !r.candidates.length ? (
        <ThemedText>사진에서 물고기를 찾지 못했어요. 물고기 옆모습이 크게 나오게 다시 찍어 보세요.</ThemedText>
      ) : (
        <>
          <ThemedText type="smallBold">이 물고기로 보여요 · 맞는 것을 눌러 고르세요</ThemedText>
          {r.candidates.map((c, i) => {
            const item = speciesByCode(c.code);
            return (
              <Pressable
                key={`${c.name}-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, 확실한 정도 ${c.confidence}, 이 어종으로 고르기`}
                onPress={() => onPick(c)}
                style={({ pressed }) => [styles.cand, { borderColor: i === 0 ? theme.tint : theme.border, opacity: pressed ? 0.7 : 1 }]}>
                <SpeciesImage code={c.code} size={48} />
                <View style={styles.flex}>
                  <View style={styles.candHead}>
                    <ThemedText type="smallBold">{c.name}</ThemedText>
                    <View style={[styles.conf, { backgroundColor: c.confidence === '높음' ? theme.tintSoft : theme.backgroundElement }]}>
                      <ThemedText type="small" themeColor={c.confidence === '높음' ? 'tint' : 'textSecondary'}>
                        {c.confidence === '높음' ? '가능성 높음' : c.confidence === '보통' ? '가능성 보통' : '가능성 낮음'}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {c.features}
                    {c.code ? '' : ' · 목록에 없는 어종 (직접 입력으로 저장)'}
                  </ThemedText>
                  {item && i === 0 ? <RulesLine species={item} today={range.data?.today} /> : null}
                </View>
              </Pressable>
            );
          })}
        </>
      )}
      {r.photo_tip ? (
        <ThemedText type="small" themeColor="textSecondary">
          📷 {r.photo_tip}
        </ThemedText>
      ) : null}
      <View style={[styles.notice, { backgroundColor: theme.warningSoft }]}>
        <ThemedText type="small">{r.notice}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        사진은 위치 정보를 지운 뒤 AI(OpenAI)로 보내 판별하고 저장하지 않아요 · 오늘 {r.remaining}번 남음
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
  photo: { width: '100%', height: 180, borderRadius: 12 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 12 },
  cand: { flexDirection: 'row', gap: 12, borderWidth: 1.5, borderRadius: 12, padding: 10, alignItems: 'flex-start' },
  candHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  conf: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  notice: { borderRadius: 10, padding: 10 },
});
