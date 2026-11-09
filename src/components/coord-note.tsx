/**
 * 좌표 품질 표시 (docs/03_데이터/2026-11-09_좌표품질_검증보고서.md 단계 0).
 * - 대표 주소·대략 위치를 실제 낚시 지점처럼 보여주지 않는다
 * - 같은 좌표를 쓰는 낚시터는 목록으로 펼쳐 한 곳씩 고른다
 */
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';

/** 낚시터 위치 정확도 안내. compact 면 한 줄(카드·목록), 아니면 설명 포함(상세) */
export function CoordNote({ place, compact }: { place: Place; compact?: boolean }) {
  const theme = useTheme();
  if (place.location_suspect) {
    return (
      <View style={[styles.box, { backgroundColor: theme.warningSoft }]}>
        <ThemedText type="smallBold" themeColor="warning">
          위치 확인 필요
        </ThemedText>
        {compact ? null : (
          <ThemedText type="small" themeColor="textSecondary">
            등록된 좌표가 주소와 맞지 않아 지도·거리순·가까운 곳·해황 연결에서 뺐어요. 이름·주소 등 일반 정보는 그대로 볼 수 있어요.
          </ThemedText>
        )}
      </View>
    );
  }
  const c = place.coord;
  if (!c) return null;
  if (compact) {
    // 카드·목록에서는 대략 위치만 알린다 (정밀 좌표는 따로 표시하지 않음)
    return c.approx ? (
      <ThemedText type="small" themeColor="warning">
        📍 {c.label}
      </ThemedText>
    ) : null;
  }
  const detail = c.recommend_hold
    ? '등록된 주소와 좌표가 서로 다른 시·군을 가리켜요. 추가 검증 전까지 출조 후보·가까운 곳 추천에서는 빼고, 거리와 해황은 참고로만 보여드려요.'
    : c.approx
    ? '여러 낚시터가 같은 좌표를 쓰거나 좌표가 반올림돼 있어요. 지도 위치와 거리는 대략적이고, 실제 좌대·포인트 위치가 아니에요. 관측소 거리도 대략적이에요.'
    : c.grade === 'B'
      ? '기관이 정한 대표 지점이에요. 실제로 낚시하는 자리와는 다를 수 있어요.'
      : c.grade === 'A'
        ? '실제 낚시 위치를 확인한 좌표예요.'
        : '지자체에 신고된 좌표예요. 실제 낚시 지점인지 사업장 위치인지는 아직 확인하지 않았어요.';
  return (
    <View style={[styles.box, { backgroundColor: c.approx ? theme.warningSoft : theme.background }]}>
      <ThemedText type="smallBold" themeColor={c.approx ? 'warning' : 'textSecondary'}>
        위치 정확도 · {c.label}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {detail}
      </ThemedText>
    </View>
  );
}

/** 같은 좌표를 쓰는 낚시터 목록 (지도에서 한 점을 눌렀을 때) */
export function SameCoordSheet({
  places,
  onPick,
  onClose,
}: {
  places: Place[] | null;
  onPick: (p: Place) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const approx = places?.some((p) => p.coord?.approx);
  return (
    <Modal visible={!!places} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={styles.sheet}>
        <ThemedText type="sectionTitle">이 위치의 낚시터 {places?.length ?? 0}곳</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {approx
            ? '여러 낚시터가 같은 대표 좌표(사무실·어촌계 주소 등)로 등록돼 있어요. 실제 낚시 자리는 곳마다 다를 수 있어요.'
            : '여러 낚시터가 같은 좌표로 등록돼 있어요.'}
        </ThemedText>
        <ScrollView contentContainerStyle={styles.list}>
          {(places ?? []).map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => onPick(p)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <AppIcon name={PLACE_IMAGE[p.type]} size={IconSize.row} />
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {p.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {PLACE_TYPE_LABEL[p.type]}
                  {p.address ? ` · ${p.address}` : ''}
                </ThemedText>
              </View>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
        <Button label="닫기" variant="secondary" onPress={onClose} />
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  box: { borderRadius: 8, padding: 10, gap: 2 },
  sheet: { flex: 1, padding: 20, gap: 10 },
  list: { gap: 8, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 56 },
});
