import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlaces } from '@/api/queries';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Chip } from '@/components/form';
import { ErrorView, Loading } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { matches, PLACE_IMAGE, PLACE_TYPE_LABEL, sidoOf } from '@/lib/place';
import { getRecentPlaceIds, pushRecentPlace } from '@/lib/prefs';

type Props = {
  visible: boolean;
  title: string;
  selectedId?: number | null;
  disabledId?: number | null;
  onSelect: (p: Place) => void;
  onClose: () => void;
};

/**
 * 낚시터 선택 (FR-01): 이름·지역·주소 검색 + 시·도 필터 + 목록.
 * 비교 상대와 같은 장소는 고를 수 없게 한다 (FR-02).
 */
export function PlacePicker({ visible, title, selectedId, disabledId, onSelect, onClose }: Props) {
  const places = usePlaces();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [sido, setSido] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<number[]>([]);

  // 열릴 때마다 최근 선택 목록을 읽는다 (기기 저장)
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    getRecentPlaceIds().then((ids) => alive && setRecentIds(ids));
    return () => {
      alive = false;
    };
  }, [visible]);

  const recent = useMemo(
    () => recentIds.map((id) => places.data?.find((p) => p.id === id)).filter((p): p is Place => !!p),
    [recentIds, places.data],
  );
  const pick = (p: Place) => {
    pushRecentPlace(p.id);
    onSelect(p);
    onClose();
  };

  const sidos = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of places.data ?? []) counts.set(sidoOf(p), (counts.get(sidoOf(p)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [places.data]);

  const list = useMemo(
    () => (places.data ?? []).filter((p) => (!sido || sidoOf(p) === sido) && matches(p, query)),
    [places.data, sido, query],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <ThemedText type="sectionTitle">{title}</ThemedText>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
            <ThemedText type="smallBold" themeColor="tint">
              닫기
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder="낚시터·지역 검색 (예: 태안, 대천, 좌대)"
          />
        </View>

        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sidos}>
            <Chip label={`전체 ${places.data?.length ?? ''}`} selected={sido === null} onPress={() => setSido(null)} />
            {sidos.map(([s, n]) => (
              <Chip key={s} label={`${s} ${n}`} selected={sido === s} onPress={() => setSido(sido === s ? null : s)} />
            ))}
          </ScrollView>
        </View>

        {places.isPending && <Loading />}
        {places.isError && <ErrorView message={places.error.message} onRetry={() => places.refetch()} />}
        {places.isSuccess && (
          <FlatList
            data={list}
            keyExtractor={(p) => String(p.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            initialNumToRender={20}
            ListHeaderComponent={
              !query.trim() && !sido && recent.length > 0 ? (
                <View style={styles.recent}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    최근 선택
                  </ThemedText>
                  <View style={styles.recentChips}>
                    {recent.map((p) => (
                      <Chip key={p.id} label={p.name} selected={p.id === selectedId} onPress={() => pick(p)} />
                    ))}
                  </View>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    전체
                  </ThemedText>
                </View>
              ) : undefined
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <ThemedText themeColor="textSecondary" style={styles.empty}>
                  「{query.trim()}」에 맞는 낚시터가 없어요.
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                  지역명(예: 보령, 통영)으로 찾아보거나 위 시·도를 눌러 보세요.{'\n'}
                  찾는 곳이 목록에 없다면 가장 가까운 곳을 고르고 메모에 실제 위치를 적어 주세요.
                </ThemedText>
              </View>
            }
            ListFooterComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
                목록의 장소를 낚시 허용구역으로 보증하지 않습니다. 출조 전 현장 출입 제한을 확인하세요.
              </ThemedText>
            }
            renderItem={({ item: p }) => {
              const disabled = p.id === disabledId;
              const selected = p.id === selectedId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled, selected }}
                  disabled={disabled}
                  onPress={() => pick(p)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: selected ? Brand.orange : theme.border, backgroundColor: theme.backgroundElement },
                    (pressed || disabled) && styles.dim,
                  ]}>
                  <View style={styles.thumb}>
                    <AppIcon name={PLACE_IMAGE[p.type]} size={44} />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {p.name}
                      {disabled ? ' (비교 상대)' : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {p.region_name} · {PLACE_TYPE_LABEL[p.type]}
                    </ThemedText>
                    {p.address ? (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {p.address}
                      </ThemedText>
                    ) : null}
                  </View>
                  {selected ? (
  <ThemedText type="small" themeColor="accent" style={styles.bold}>
    선택됨
  </ThemedText>
) : null}
                </Pressable>
              );
            }}
          />
        )}
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  flex: { flex: 1 },
  dim: { opacity: 0.5 },
  bold: { fontWeight: '700' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  searchWrap: { marginHorizontal: Spacing.three },
  sidos: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    padding: Spacing.two + 2,
    borderRadius: 14,
    borderWidth: 1,
  },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#F3F6F9', alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center' },
  emptyBox: { gap: Spacing.two, padding: Spacing.four },
  recent: { gap: Spacing.two, paddingBottom: Spacing.one },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  footer: { paddingTop: Spacing.three },
});
