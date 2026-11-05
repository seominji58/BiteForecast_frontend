import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/form';
import { ErrorView, Loading } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getRecent, pushRecent } from '@/lib/prefs';

export type SearchSelectProps<T> = {
  visible: boolean;
  title: string;
  items: T[] | undefined;
  loading?: boolean;
  error?: { message: string; retry: () => void } | null;
  keyOf: (item: T) => string;
  /** 검색 대상 문자열 (공백으로 나눈 단어가 모두 들어가면 일치) */
  searchText: (item: T) => string;
  /** 목록 한 줄. 선택·비활성 표시는 시트가 처리한다 */
  renderRow: (item: T) => ReactNode;
  /** 짧은 이름 (최근 선택 칩에 표시) */
  shortLabel: (item: T) => string;
  /** 필터 칩 (예: 시·도). 항목이 어느 필터에 속하는지 */
  filterOf?: (item: T) => string;
  initialFilter?: string | null;
  /** 최근 선택 저장 키 (없으면 최근 영역 없음) */
  recentKey?: string;
  selectedKey?: string | null;
  disabledKey?: string | null;
  disabledLabel?: string;
  placeholder: string;
  /** 검색 결과가 없을 때 안내 */
  emptyHint: string;
  /** 목록에 없을 때 직접 입력 (예: 어종) */
  custom?: { label: (query: string) => string; onPick: (query: string) => void };
  footer?: ReactNode;
  onSelect: (item: T) => void;
  onClose: () => void;
};

/**
 * 공용 검색 선택 시트 (재설계 v2 §2): 검색 → 최근 선택 → 필터 칩 → 목록 → 「목록에 없어요」.
 * 낚시터·어종 등 「고르기」는 모두 이 시트를 쓴다.
 */
export function SearchSelect<T>(p: SearchSelectProps<T>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(p.initialFilter ?? null);
  const [recentKeys, setRecentKeys] = useState<string[]>([]);

  // 열릴 때마다 초기 필터와 최근 선택을 다시 읽는다
  useEffect(() => {
    if (!p.visible) return;
    let alive = true;
    if (p.recentKey) getRecent(p.recentKey).then((r) => alive && setRecentKeys(r));
    return () => {
      alive = false;
    };
  }, [p.visible, p.recentKey]);
  const [lastInitial, setLastInitial] = useState(p.initialFilter);
  if (p.initialFilter !== lastInitial) {
    setLastInitial(p.initialFilter);
    setFilter(p.initialFilter ?? null);
  }

  const items = useMemo(() => p.items ?? [], [p.items]);
  const filters = useMemo(() => {
    if (!p.filterOf) return [];
    const counts = new Map<string, number>();
    for (const it of items) counts.set(p.filterOf(it), (counts.get(p.filterOf(it)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items, p]);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = items.filter(
    (it) =>
      (!filter || p.filterOf?.(it) === filter) &&
      (words.length === 0 || words.every((w) => p.searchText(it).toLowerCase().includes(w))),
  );
  const recent = recentKeys.map((k) => items.find((it) => p.keyOf(it) === k)).filter((x): x is T => !!x);
  const showRecent = !query.trim() && !filter && recent.length > 0;

  const pick = (it: T) => {
    if (p.recentKey) pushRecent(p.recentKey, p.keyOf(it));
    setQuery('');
    p.onSelect(it);
    p.onClose();
  };

  return (
    <Modal visible={p.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={p.onClose}>
      <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <ThemedText type="sectionTitle">{p.title}</ThemedText>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={p.onClose}>
            <ThemedText type="smallBold" themeColor="tint">
              닫기
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.pad}>
          <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder={p.placeholder} />
        </View>

        {filters.length > 0 ? (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Chip label={`전체 ${items.length}`} selected={filter === null} onPress={() => setFilter(null)} />
              {filters.map(([f, n]) => (
                <Chip key={f} label={`${f} ${n}`} selected={filter === f} onPress={() => setFilter(filter === f ? null : f)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {p.loading ? <Loading /> : null}
        {p.error ? <ErrorView message={p.error.message} onRetry={p.error.retry} /> : null}
        {!p.loading && !p.error ? (
          <FlatList
            data={list}
            keyExtractor={p.keyOf}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            initialNumToRender={20}
            ListHeaderComponent={
              showRecent || (p.custom && query.trim()) ? (
                <View style={styles.headerBlock}>
                  {showRecent ? (
                    <>
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        최근 선택
                      </ThemedText>
                      <View style={styles.chips}>
                        {recent.map((it) => (
                          <Chip
                            key={p.keyOf(it)}
                            label={p.shortLabel(it)}
                            selected={p.keyOf(it) === p.selectedKey}
                            onPress={() => pick(it)}
                          />
                        ))}
                      </View>
                    </>
                  ) : null}
                  {p.custom && query.trim() ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        p.custom!.onPick(query.trim());
                        setQuery('');
                        p.onClose();
                      }}
                      style={[styles.customRow, { borderColor: theme.tint }]}>
                      <ThemedText type="smallBold" themeColor="tint">
                        {p.custom.label(query.trim())}
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              ) : undefined
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <ThemedText themeColor="textSecondary" style={styles.center}>
                  {query.trim() ? `「${query.trim()}」에 맞는 항목이 없어요.` : '항목이 없어요.'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {p.emptyHint}
                </ThemedText>
              </View>
            }
            ListFooterComponent={p.footer ? <View style={styles.footer}>{p.footer}</View> : undefined}
            renderItem={({ item }) => {
              const key = p.keyOf(item);
              const disabled = key === p.disabledKey;
              const selected = key === p.selectedKey;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled, selected }}
                  disabled={disabled}
                  onPress={() => pick(item)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: selected ? Brand.orange : theme.border, backgroundColor: theme.backgroundElement },
                    (pressed || disabled) && styles.dim,
                  ]}>
                  <View style={styles.flex}>{p.renderRow(item)}</View>
                  {disabled && p.disabledLabel ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {p.disabledLabel}
                    </ThemedText>
                  ) : null}
                  {selected ? (
                    <ThemedText type="smallBold" themeColor="accent">
                      선택됨
                    </ThemedText>
                  ) : null}
                </Pressable>
              );
            }}
          />
        ) : null}
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  flex: { flex: 1 },
  dim: { opacity: 0.5 },
  center: { textAlign: 'center' },
  pad: { paddingHorizontal: Layout.screenPadding },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 20,
    paddingBottom: 8,
  },
  filters: { gap: 8, paddingHorizontal: Layout.screenPadding, paddingVertical: 10 },
  list: { paddingHorizontal: Layout.screenPadding, gap: 8, paddingBottom: 32 },
  headerBlock: { gap: 8, paddingBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customRow: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: Layout.cardRadius,
    borderWidth: 1,
  },
  empty: { gap: 8, padding: 24 },
  footer: { paddingTop: 12 },
});
