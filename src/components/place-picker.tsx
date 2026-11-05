import { StyleSheet, View } from 'react-native';

import { usePlaces } from '@/api/queries';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { SearchSelect } from '@/components/search-select';
import { ThemedText } from '@/components/themed-text';
import { PLACE_IMAGE, PLACE_TYPE_LABEL, sidoOf } from '@/lib/place';
import { RECENT_PLACES } from '@/lib/prefs';

type Props = {
  visible: boolean;
  title: string;
  selectedId?: number | null;
  disabledId?: number | null;
  /** 처음 열 때 걸어 둘 시·도 필터 (예: 첫 실행 화면의 지역 칩) */
  initialSido?: string | null;
  onSelect: (p: Place) => void;
  onClose: () => void;
};

/** 낚시터 선택 (FR-01) — 공용 SearchSelect 에 낚시터 표시 방식만 얹는다. 비교 상대는 고를 수 없다 (FR-02) */
export function PlacePicker({ visible, title, selectedId, disabledId, initialSido, onSelect, onClose }: Props) {
  const places = usePlaces();
  return (
    <SearchSelect<Place>
      visible={visible}
      title={title}
      items={places.data}
      loading={places.isPending}
      error={places.isError ? { message: places.error.message, retry: () => places.refetch() } : null}
      keyOf={(p) => String(p.id)}
      searchText={(p) => `${p.name} ${p.region_name} ${p.address ?? ''}`}
      shortLabel={(p) => p.name}
      filterOf={sidoOf}
      initialFilter={initialSido ?? null}
      recentKey={RECENT_PLACES}
      selectedKey={selectedId != null ? String(selectedId) : null}
      disabledKey={disabledId != null ? String(disabledId) : null}
      disabledLabel="비교 상대"
      placeholder="낚시터·지역 검색 (예: 태안, 대천, 좌대)"
      emptyHint={'지역명(예: 보령, 통영)으로 찾아보거나 시·도를 눌러 보세요.\n목록에 없다면 가장 가까운 곳을 고르고 메모에 실제 위치를 적어 주세요.'}
      footer={
        <ThemedText type="small" themeColor="textSecondary">
          목록의 장소를 낚시 허용구역으로 보증하지 않습니다. 출조 전 현장 출입 제한을 확인하세요.
        </ThemedText>
      }
      renderRow={(p) => (
        <View style={styles.row}>
          <View style={styles.thumb}>
            <AppIcon name={PLACE_IMAGE[p.type]} size={36} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {p.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {p.region_name} · {PLACE_TYPE_LABEL[p.type]}
              {p.address ? ` · ${p.address}` : ''}
            </ThemedText>
          </View>
        </View>
      )}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F3F6F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
