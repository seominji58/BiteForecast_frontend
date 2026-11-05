import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSpecies } from '@/api/queries';
import type { Species } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { SearchSelect } from '@/components/search-select';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { RECENT_SPECIES } from '@/lib/prefs';

/** 어종 값: 목록 어종(code) 또는 목록에 없는 어종 직접 입력(etc) 중 하나. 둘 다 null 이면 미선택 */
export type SpeciesValue = { code: string | null; etc: string | null };
export const NO_SPECIES: SpeciesValue = { code: null, etc: null };

/**
 * 어종 선택 칸 (재설계 v2 §8). 칩 나열 대신 공용 검색 시트를 연다.
 * 검색 → 최근 선택 → 목록 → 결과 없음이면 「"○○" 직접 입력」. 낚시일지·커뮤니티 글쓰기가 같이 쓴다.
 */
export function SpeciesField({
  value,
  onChange,
  placeholder = '어종 검색',
}: {
  value: SpeciesValue;
  onChange: (v: SpeciesValue) => void;
  placeholder?: string;
}) {
  const species = useSpecies();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const name = value.code
    ? (species.data?.find((s) => s.code === value.code)?.name_ko ?? value.code)
    : value.etc;

  return (
    <>
      <View style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={name ? `어종: ${name}, 바꾸기` : placeholder}
          onPress={() => setOpen(true)}
          style={styles.main}>
          <AppIcon name="total-fish" size={22} />
          <View style={styles.flex}>
            <ThemedText type={name ? 'smallBold' : 'default'} themeColor={name ? 'text' : 'textSecondary'}>
              {name ?? placeholder}
            </ThemedText>
            {value.etc ? (
              <ThemedText type="small" themeColor="textSecondary">
                목록에 없는 어종 · 직접 입력
              </ThemedText>
            ) : null}
          </View>
          <ThemedText type="small" themeColor="tint">
            {name ? '바꾸기' : '찾기'}
          </ThemedText>
        </Pressable>
        {name ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="어종 선택 지우기"
            hitSlop={10}
            onPress={() => onChange(NO_SPECIES)}
            style={styles.clear}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ✕
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <SearchSelect<Species>
        visible={open}
        title="어종 선택"
        items={species.data}
        loading={species.isPending}
        error={species.isError ? { message: species.error.message, retry: () => species.refetch() } : null}
        keyOf={(s) => s.code}
        searchText={(s) => s.name_ko}
        shortLabel={(s) => s.name_ko.replace(/\(.*\)/, '')}
        renderRow={(s) => <ThemedText>{s.name_ko}</ThemedText>}
        recentKey={RECENT_SPECIES}
        selectedKey={value.code}
        placeholder="어종 이름 검색 (예: 우럭, 감성돔)"
        emptyHint="목록에 없는 어종은 위의 「직접 입력」을 눌러 그대로 저장할 수 있어요."
        custom={{
          label: (q) => `「${q}」 직접 입력하기`,
          onPick: (q) => onChange({ code: null, etc: q.slice(0, 50) }),
        }}
        onSelect={(s) => onChange({ code: s.code, etc: null })}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  clear: { paddingHorizontal: 12, paddingVertical: 10 },
});
