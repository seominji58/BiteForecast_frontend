/**
 * 입질예보에게 묻기 (2026-11-26) — AI 가 우리 서버 자료(해황·바다낚시지수·특보·금어기)만 조회해 답한다.
 * - 대화는 이 화면에만 (서버 저장 안 함). 최근 대화를 함께 보내 이어서 묻게 한다
 * - 답에 나온 낚시터는 버튼으로 바로 열기
 * - ?place_id=&name= 으로 열면 「이 낚시터」 질문으로 시작
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { request } from '@/api/client';
import { AuthGate } from '@/components/login-required';
import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Msg = { role: 'user' | 'assistant'; content: string; places?: { place_id: number; name: string }[]; error?: boolean };
type AskOut = { answer: string; places: { place_id: number; name: string }[]; remaining: number };

const SUGGEST = ['내일 서해 바람 어때?', '이번 주말 감성돔 좋은 곳은?', '지금 주꾸미 잡아도 돼?'];

function AskBody() {
  const theme = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ place_id?: string; name?: string }>();
  const placeId = params.place_id ? Number(params.place_id) : null;
  const status = useQuery({
    queryKey: ['ask-status'],
    queryFn: () => request<{ enabled: boolean; remaining: number }>('/ask/status'),
  });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const suggest = params.name ? [`${params.name} 내일 바다 어때?`, `${params.name} 이번 주 물때는?`, ...SUGGEST.slice(2)] : SUGGEST;
  const left = status.data?.remaining;

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: question }];
    setMsgs(next);
    setText('');
    setBusy(true);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    try {
      const r = await request<AskOut>('/ask', {
        method: 'POST',
        body: {
          messages: next
            .filter((m) => !m.error)
            .slice(-8)
            .map(({ role, content }) => ({ role, content })),
          place_id: placeId,
        },
      });
      setMsgs((m) => [...m, { role: 'assistant', content: r.answer, places: r.places }]);
      qc.setQueryData(['ask-status'], { enabled: true, remaining: r.remaining });
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: e instanceof Error ? e.message : '답을 받지 못했어요', error: true }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  if (status.data && !status.data.enabled) {
    return (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">입질예보에게 묻기를 준비하고 있어요.</ThemedText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {msgs.length === 0 ? (
          <View style={styles.intro}>
            <AppIcon name="cat-question" size={40} />
            <ThemedText type="sectionTitle">무엇이든 물어보세요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              기상청 예보·특보, 국립해양조사원 바다낚시지수·물때, 금어기 자료를 찾아서 답해요.
            </ThemedText>
            <View style={styles.suggest}>
              {suggest.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  onPress={() => send(s)}
                  style={({ pressed }) => [styles.chip, { borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
                  <ThemedText type="small">{s}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <View key={i} style={[styles.bubble, styles.mine]}>
              <ThemedText style={styles.mineText}>{m.content}</ThemedText>
            </View>
          ) : (
            <View key={i} style={[styles.bubble, styles.theirs, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText themeColor={m.error ? 'danger' : 'text'}>{m.content}</ThemedText>
              {m.places?.length ? (
                <View style={styles.placeRow}>
                  {m.places.map((p) => (
                    <Pressable
                      key={p.place_id}
                      accessibilityRole="button"
                      onPress={() => router.push(`/place/${p.place_id}`)}
                      style={[styles.placeBtn, { backgroundColor: theme.tintSoft }]}>
                      <ThemedText type="small" themeColor="tint">
                        {p.name} 해황 ›
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ),
        )}
        {busy ? (
          <View
            style={[styles.bubble, styles.theirs, styles.typing, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ActivityIndicator color={theme.tint} />
            <ThemedText type="small" themeColor="textSecondary">
              자료를 찾고 있어요…
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
        <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={left === 0 ? '오늘은 모두 물어봤어요' : '예: 내일 남애항 파도 높아?'}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text }]}
            maxLength={300}
            editable={left !== 0}
            onSubmitEditing={() => send(text)}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="보내기"
            disabled={!text.trim() || busy || left === 0}
            onPress={() => send(text)}
            style={[styles.send, { backgroundColor: text.trim() && !busy ? Brand.orange : theme.backgroundSelected }]}>
            <AppIcon name="arrow-right" size={18} tint="#FFFFFF" />
          </Pressable>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          AI 답은 틀릴 수 있어요 · 출조 판단은 기상청 특보로 · 먹어도 되는지는 답하지 않아요{left != null ? ` · 오늘 ${left}번 남음` : ''}
        </ThemedText>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function AskScreen() {
  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: '입질예보에게 묻기' }} />
      <AuthGate message="로그인하면 해황·금어기를 물어볼 수 있어요">
        <AskBody />
      </AuthGate>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center' },
  list: { padding: Layout.screenPadding, gap: 10, paddingBottom: 24 },
  intro: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  suggest: { gap: 8, alignSelf: 'stretch', marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  bubble: { maxWidth: '86%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: Brand.navy, borderBottomRightRadius: 4 },
  mineText: { color: '#FFFFFF' },
  theirs: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  placeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  placeBtn: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 10, gap: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 24, paddingLeft: 14, paddingRight: 4 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  note: { textAlign: 'center' },
});
