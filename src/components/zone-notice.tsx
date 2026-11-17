import { StyleSheet, View } from 'react-native';

import type { Regulation } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * 해양경찰청 출입통제구역·연안사고 위험구역 안내 (낚시터 상세).
 * 출입통제(빨강)와 위험구역(주황)을 다른 색·문구로 구분하고, 기준일·출처를 함께 적는다.
 * 금지 여부를 앱이 판정하지 않는다 — 공고와 현장 안내를 확인하라고 안내한다.
 */
export function ZoneNotice({ regulation }: { regulation: Regulation }) {
  const theme = useTheme();
  const items = regulation.items.filter((i) => i.restriction_type === 'access' || i.restriction_type === 'coastal_danger');
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => (a.restriction_type === 'access' ? -1 : 1) - (b.restriction_type === 'access' ? -1 : 1));
  return (
    <View style={styles.col}>
      {sorted.map((it, k) => {
        const control = it.restriction_type === 'access';
        const color = control ? theme.danger : theme.warning;
        const [where, ...rest] = (it.remarks ?? '').split(' · ');
        return (
          <View key={k} style={[styles.box, { borderColor: color, backgroundColor: theme.backgroundElement }]}>
            <View style={styles.head}>
              <AppIcon name="regulation" size={22} />
              <ThemedText type="smallBold" style={{ color }}>
                {control ? `출입통제구역 공고 범위${rest[0] === '안에 있음' ? ' 안' : ' 근처'}` : '연안사고 위험구역'}
              </ThemedText>
            </View>
            {where ? <ThemedText type="small">{[where, rest[0]].filter(Boolean).join(' · ')}</ThemedText> : null}
            <ThemedText type="small" themeColor="textSecondary">
              {control ? '현장 안내판과 해양경찰 공고를 꼭 확인하세요' : '방파제·갯바위 끝, 테트라포드 출입에 주의하세요'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {it.authority ?? '해양경찰청'}
              {it.notice_no ? ` · ${it.notice_no}` : ''}
              {it.published_at ? ` · ${it.published_at.slice(0, 4)}년 공간정보 기준` : ''} · 현장 안내 우선
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: 8 },
  box: { borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
