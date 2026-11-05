import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlaces, useRegions } from '@/api/queries';
import type { Place } from '@/api/types';
import { Chip, ChipGroup } from '@/components/form';
import { ErrorView, Loading } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  title: string;
  selectedId?: number | null;
  disabledId?: number | null;
  onSelect: (p: Place) => void;
  onClose: () => void;
};

/** 해역별 낚시터 선택 (FR-01). 비교 상대와 같은 장소는 고를 수 없게 한다 (FR-02) */
export function PlacePicker({ visible, title, selectedId, disabledId, onSelect, onClose }: Props) {
  const places = usePlaces();
  const regions = useRegions();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.header}>
          <ThemedText type="sectionTitle">{title}</ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={12} onPress={onClose}>
            <MaterialCommunityIcons name="close" size={26} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {places.isPending && <Loading />}
          {places.isError && <ErrorView message={places.error.message} onRetry={() => places.refetch()} />}
          {places.isSuccess &&
            (places.data.length === 0 ? (
              <ThemedText themeColor="textSecondary">지원 지역이 아닙니다</ThemedText>
            ) : (
              (regions.data ?? [{ id: -1, name: '전체' }]).map((r) => {
                const list = r.id === -1 ? places.data : places.data.filter((p) => p.region_id === r.id);
                if (list.length === 0) return null;
                return (
                  <View key={r.id} style={styles.region}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {r.name}
                    </ThemedText>
                    <ChipGroup>
                      {list.map((p) =>
                        p.id === disabledId ? (
                          <View key={p.id} style={[styles.disabled, { borderColor: theme.border }]}>
                            <ThemedText type="small" themeColor="textSecondary">
                              {p.name} (선택됨)
                            </ThemedText>
                          </View>
                        ) : (
                          <Chip
                            key={p.id}
                            label={p.name}
                            selected={p.id === selectedId}
                            onPress={() => {
                              onSelect(p);
                              onClose();
                            }}
                          />
                        ),
                      )}
                    </ChipGroup>
                  </View>
                );
              })
            ))}
          <ThemedText type="small" themeColor="textSecondary">
            목록의 장소를 낚시 허용구역으로 보증하지 않습니다. 출조 전 현장 출입 제한을 확인하세요.
          </ThemedText>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    paddingTop: Spacing.four,
  },
  body: { padding: Spacing.three, gap: Spacing.four },
  region: { gap: Spacing.two },
  disabled: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
});
