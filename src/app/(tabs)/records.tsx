import { EmptyView, Screen } from '@/components/screen';

// SCR-05 내 기록 — TODO: 일지 목록, 상세(당시 환경정보), 대시보드 (FR-08, FR-10, FR-13)
export default function RecordsScreen() {
  return (
    <Screen title="내 기록">
      <EmptyView message="아직 작성한 낚시일지가 없습니다." />
    </Screen>
  );
}
