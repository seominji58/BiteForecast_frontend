import { useHealth, usePlaces } from '@/api/queries';
import { Card, EmptyView, ErrorView, Loading, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

// SCR-01 홈 / 장소 선택 (초기 골격: 서버 연결 확인 + 장소 목록)
// TODO: 해역 탭, 검색, A/B 슬롯 + 날짜 선택, [비교하기] (FR-01, FR-02)
export default function HomeScreen() {
  const health = useHealth();
  const places = usePlaces();

  return (
    <Screen title="입질예보">
      <Card>
        <ThemedText type="smallBold">서버 연결</ThemedText>
        {health.isPending && <ThemedText themeColor="textSecondary">확인 중…</ThemedText>}
        {health.isSuccess && <ThemedText themeColor="success">연결됨 ({health.data.env})</ThemedText>}
        {health.isError && <ThemedText themeColor="danger">{health.error.message}</ThemedText>}
      </Card>

      <ThemedText type="smallBold">낚시 장소</ThemedText>
      {places.isPending && <Loading />}
      {places.isError && <ErrorView message={places.error.message} onRetry={() => places.refetch()} />}
      {places.isSuccess &&
        (places.data.length === 0 ? (
          // FR-01: 자료가 없으면 「지원 지역이 아닙니다」
          <EmptyView message="지원 지역이 아닙니다" />
        ) : (
          places.data.map((p) => (
            <Card key={p.id}>
              <ThemedText>{p.name}</ThemedText>
            </Card>
          ))
        ))}
    </Screen>
  );
}
