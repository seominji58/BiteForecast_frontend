/**
 * 낚시터 공공데이터 안내 (2026-11-26) — 국립공원 경계·국가어항·해변 개장기간·시군 낚시통제구역.
 * 「낚시 가능·불가」 판정이 아니라 공식 자료가 이렇게 말한다는 안내. 출처·기준일을 같이 보여 준다.
 * 시군 통제구역은 좌표가 없는 목록이라 「이 낚시터가 들어 있는지는 직접 확인」으로 안내한다
 */
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import type { PlaceNotice } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const ICON: Record<PlaceNotice['kind'], string> = { park: '🏞', harbor: '⚓', beach: '🏖', zone: '🚫' };

export function PlaceNotices({ notices }: { notices: PlaceNotice[] }) {
  const theme = useTheme();
  if (!notices.length) return null;
  return (
    <View style={[styles.box, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">공공데이터 안내</ThemedText>
      {notices.map((n, i) => (
        <NoticeRow key={`${n.kind}-${i}`} n={n} />
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        공식 자료를 옮긴 안내예요. 낚시 가능 여부를 판정하지 않아요 — 현장 안내판과 시군·해경 공고를 따르세요.
      </ThemedText>
    </View>
  );
}

function NoticeRow({ n }: { n: PlaceNotice }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const warn = n.kind === 'zone' || n.kind === 'park';
  return (
    <View style={styles.row}>
      <ThemedText style={styles.icon}>{ICON[n.kind]}</ThemedText>
      <View style={styles.flex}>
        <ThemedText type="smallBold" themeColor={warn ? 'warning' : 'text'}>
          {n.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {n.detail}
        </ThemedText>
        {n.zone_items.length ? (
          <>
            <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)} hitSlop={8}>
              <ThemedText type="small" themeColor="tint">
                {open ? '목록 접기 ▴' : `통제구역 ${n.zone_items.length}곳 보기 ▾`}
              </ThemedText>
            </Pressable>
            {open
              ? n.zone_items.map((z, i) => (
                  <View key={i} style={[styles.zone, { borderLeftColor: theme.warning }]}>
                    <ThemedText type="small">
                      {z.name}
                      {z.since ? ` · ${z.since} 지정` : ''}
                    </ThemedText>
                    {z.area ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {z.area}
                      </ThemedText>
                    ) : null}
                    {z.rule ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {z.rule}
                      </ThemedText>
                    ) : null}
                  </View>
                ))
              : null}
          </>
        ) : null}
        {n.source_name ? (
          <Pressable
            accessibilityRole="link"
            disabled={!n.source_url}
            onPress={() => n.source_url && Linking.openURL(n.source_url).catch(() => undefined)}>
            <ThemedText type="small" themeColor="textSecondary">
              출처: {n.source_name}
              {n.source_date ? ` (${n.source_date})` : ''}
              {n.source_url ? ' ›' : ''}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  box: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  icon: { width: 22, textAlign: 'center' },
  zone: { borderLeftWidth: 2, paddingLeft: 8, marginTop: 4 },
});
