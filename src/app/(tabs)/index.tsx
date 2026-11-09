import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useDateRange, usePlaces, usePlacesSummary, usePosts } from '@/api/queries';
import type { Place, PostSummary } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { AppIcon } from '@/components/app-icon';
import { CriteriaResult } from '@/components/criteria-result';
import { Card, SectionHeader, TabScreen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, IconSize, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { breakdown, criteriaLabel, WARNING_SHORT } from '@/lib/criteria';
import { catchLine, shortDate, whereLine } from '@/lib/community';
import { timeAgo } from '@/lib/format';
import { matches, PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';
import { useCriteria, useHomePlace } from '@/lib/prefs';

// SCR-01 홈 (사용자 제안 2026-11-09): 검색·지도 중심은 그대로, 아래에 「지금 낚시판에서 일어나는 일」을 둔다.
// 최근 조황(이용자 사진) → 출조 탐색(내 조건에 맞는 곳 수) → 낚시 소식·출조 정보
export default function HomeScreen() {
  const theme = useTheme();
  const places = usePlaces();
  const [homeId, setHomeId] = useHomePlace();
  const [query, setQuery] = useState('');

  // 링크로 기준 낚시터 지정: /?place=147
  const linkPlace = useLocalSearchParams<{ place?: string }>().place;
  useEffect(() => {
    const id = Number(linkPlace);
    if (linkPlace && places.data?.some((p) => p.id === id) && id !== homeId) setHomeId(id);
  }, [linkPlace, places.data, homeId, setHomeId]);

  const home = places.data?.find((p) => p.id === homeId) ?? null;
  const results = query.trim() ? (places.data ?? []).filter((p) => matches(p, query)).slice(0, 6) : [];

  const openPlace = (p: Place) => {
    setHomeId(p.id); // 마지막으로 본 낚시터 (비교 A 자동 입력·출조 탐색 거리 기준)
    setQuery('');
    Keyboard.dismiss();
    router.push({ pathname: '/place/[id]', params: { id: String(p.id) } });
  };

  // 아래로 당기면 해황 요약·조황·낚시터를 다시 불러온다
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['places-summary'] }),
      qc.invalidateQueries({ queryKey: ['community', 'posts'] }),
      qc.invalidateQueries({ queryKey: ['meta', 'date-range'] }),
    ]);

  return (
    <TabScreen title="입질예보" logo onRefresh={refresh}>
      {/* 상단: 검색 + 내 주변 + 지도 */}
      <View style={styles.hero}>
        <Text style={styles.heroTag}>낚시 가고 싶은 날, 입질예보</Text>
        <Text style={styles.heroTitle}>오늘 어디로 낚시 가시나요?</Text>
        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder="지역·낚시터 검색 (예: 태안, 대천)" />
        <View style={styles.heroActions}>
          <HeroButton
            icon="find-gps"
            label="내 주변"
            onPress={() => router.push({ pathname: '/explore', params: { near: '1' } })}
          />
          <HeroButton icon="find-map" label="지도 탐색" onPress={() => router.push('/explore')} />
        </View>
      </View>

      {query.trim() ? (
        <Card>
          {results.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              맞는 낚시터가 없어요. 「지도 탐색」에서 지역별로 둘러보세요.
            </ThemedText>
          ) : (
            results.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => openPlace(p)}
                style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
                <AppIcon name={PLACE_IMAGE[p.type]} size={IconSize.row} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {p.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {p.region_name} · {PLACE_TYPE_LABEL[p.type]}
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            ))
          )}
        </Card>
      ) : null}

      {home ? <RecentPlace home={home} /> : null}

      <RecentCatches />

      <ExploreTeaser home={home} />

      <SectionHeader title="낚시 소식 · 출조 정보" />
      <Card style={styles.list}>
        <InfoRow
          icon="cat-tip"
          title="시즌별 어종과 낚시 팁"
          sub="낚시인들이 올린 정보·팁 글"
          onPress={() => router.push({ pathname: '/community', params: { category: 'tip' } })}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <InfoRow
          icon="regulation"
          title="금어기 · 출조 안전 정보"
          sub="수산자원관리법 시행령 기준"
          onPress={() => router.push('/info/safety')}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <InfoRow
          icon="find-compare"
          title="두 낚시터 비교하기"
          sub="같은 날 특보·파고·바람·물때 나란히"
          onPress={() => router.push(home ? { pathname: '/compare', params: { a: String(home.id) } } : '/compare')}
        />
      </Card>

      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        국립해양조사원·기상청 공공데이터 · 조과를 보장하지 않으며 출조 전 특보를 꼭 확인하세요
      </ThemedText>
    </TabScreen>
  );
}

function HeroButton({ icon, label, onPress }: { icon: AppIconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}>
      <View style={styles.heroIcon}>
        <AppIcon name={icon} size={22} />
      </View>
      <Text style={styles.heroBtnText}>{label}</Text>
    </Pressable>
  );
}

/** 최근 본 낚시터 한 줄 (특보 단계는 안전 정보라 함께 표시) */
function RecentPlace({ home }: { home: Place }) {
  const theme = useTheme();
  const range = useDateRange();
  const summary = usePlacesSummary(range.data?.today);
  const s = summary.data?.places.find((x) => x.place_id === home.id);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(home.id) } })}
      style={({ pressed }) => [
        styles.recent,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <AppIcon name={PLACE_IMAGE[home.type]} size={IconSize.row} />
      <ThemedText type="small" themeColor="textSecondary">
        최근 본 곳
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
        {home.name}
      </ThemedText>
      {s ? (
        <ThemedText type="smallBold" themeColor={WARNING_SHORT[s.warning_level].color}>
          {WARNING_SHORT[s.warning_level].text}
        </ThemedText>
      ) : null}
      <ThemedText themeColor="textSecondary">›</ThemedText>
    </Pressable>
  );
}

/** 최근 조황: 이용자가 올린 사진 글 (인증 조황 먼저). 앱이 만든 사진·문구는 쓰지 않는다 */
function RecentCatches() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const posts = usePosts(null, 'latest');
  const source = usePhotoSource();
  // 사진 조황(인증 먼저) → 사진 없는 조황공유 글(글 카드). 질문·팁은 커뮤니티에서
  const items = useMemo(() => {
    const all = posts.data ?? [];
    const photo = all.filter((p) => p.thumb && p.category === 'catch');
    const text = all.filter((p) => !p.thumb && p.category === 'catch');
    return [...photo.filter((p) => p.verified), ...photo.filter((p) => !p.verified), ...text].slice(0, 8);
  }, [posts.data]);
  const full = Math.min(width, 600) - Layout.screenPadding * 2;
  // 1개뿐이면 화면 폭 전체, 여러 개면 두 장이 보이게
  const cardW = items.length === 1 ? full : Math.min(240, (full - 12) / 2);

  return (
    <>
      <SectionHeader title="최근 조황" actionLabel="전체보기" onAction={() => router.push('/community')} />
      {items.length === 0 ? (
        <Card style={styles.emptyCatch}>
          {posts.isPending ? (
            <ThemedText type="small" themeColor="textSecondary">
              조황을 불러오는 중이에요…
            </ThemedText>
          ) : (
            <>
              {/* 실제 조황이 없을 때: 가짜 조황을 보여주지 않고, 무엇이 올라오는 곳인지와 할 수 있는 일을 안내 */}
              <View style={styles.emptyHead}>
                <AppIcon name="cat-catch" size={36} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">아직 올라온 조황이 없어요</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    낚시인들이 사진과 함께 올린 조황이 여기에 모여요. 관리자가 사진을 확인한 기록에는 「✓ 인증 조황」이 붙어요.
                  </ThemedText>
                </View>
              </View>
              <View style={styles.emptyActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/journal/new')}
                  style={({ pressed }) => [styles.emptyBtn, { borderColor: theme.tint }, pressed && styles.pressed]}>
                  <AppIcon name="write" size={IconSize.inline + 2} />
                  <ThemedText type="smallBold" themeColor="tint">
                    기록 남기고 인증받기
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/community/new')}
                  style={({ pressed }) => [styles.emptyBtn, { borderColor: theme.tint }, pressed && styles.pressed]}>
                  <AppIcon name="comment" size={IconSize.inline + 2} />
                  <ThemedText type="smallBold" themeColor="tint">
                    조황 글 올리기
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </Card>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardW + 12}
          decelerationRate="fast"
          contentContainerStyle={styles.catchRow}>
          {items.map((p) => (
            <CatchCard key={p.id} p={p} width={cardW} src={p.thumb ? source(p.thumb) : null} border={theme.border} />
          ))}
        </ScrollView>
      )}
    </>
  );
}

function CatchCard({
  p,
  width,
  src,
  border,
}: {
  p: PostSummary;
  width: number;
  src: ReturnType<ReturnType<typeof usePhotoSource>>;
  border: string;
}) {
  const theme = useTheme();
  const where = whereLine(p);
  const detail = p.catch ? catchLine(p.catch) : p.species_name;
  const when = p.catch ? `${shortDate(p.catch.fished_at)} 출조` : timeAgo(p.created_at);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.verified ? '인증 조황, ' : ''}${p.title}, ${where ?? ''}, ${when}`}
      onPress={() => router.push({ pathname: '/community/[id]', params: { id: String(p.id) } })}
      style={({ pressed }) => [
        styles.catchCard,
        { width, borderColor: border, backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      {src ? (
        <View>
          <Image source={src} style={[styles.catchImg, { height: Math.min(width * 0.9, 260) }]} contentFit="cover" transition={150} />
          {p.verified ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>✓ 인증 조황</Text>
            </View>
          ) : null}
        </View>
      ) : (
        // 사진 없는 조황: 그림을 대신 넣지 않고 글로 보여준다
        <View style={[styles.textCatch, { height: Math.min(width * 0.9, 260), backgroundColor: theme.tintSoft }]}>
          <ThemedText type="small" themeColor="tint" style={styles.textCatchLabel}>
            조황 이야기
          </ThemedText>
          <ThemedText type="small" numberOfLines={5}>
            {p.excerpt}
          </ThemedText>
        </View>
      )}
      <View style={styles.catchInfo}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {p.title}
        </ThemedText>
        {detail ? (
          <ThemedText type="small" themeColor="tint" numberOfLines={1} style={styles.bold}>
            {detail}
          </ThemedText>
        ) : null}
        {where ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {where}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {when} · {p.author.nickname}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/**
 * 오늘 출조 탐색: 내 조건(파고·풍속 상한, 특보 발효 제외)으로 전국 낚시터를 실제 자료로 나눠 보여준다.
 * 맞는 곳 / 맞는 곳 없음(제외 이유) / 자료 부족 세 상태를 구분한다 (앱 판정 없음)
 */
function ExploreTeaser({ home }: { home: Place | null }) {
  const range = useDateRange();
  const summary = usePlacesSummary(range.data?.today);
  const places = usePlaces();
  const [criteria] = useCriteria();
  const b = useMemo(() => breakdown(summary.data?.places ?? [], criteria), [summary.data, criteria]);
  const openCriteria = () => router.push({ pathname: '/explore', params: { mode: 'criteria' } });

  return (
    <>
      <SectionHeader title="오늘 출조 탐색" actionLabel="기준 바꾸기" onAction={openCriteria} />
      <Card>
        <View style={styles.explore}>
          <View style={[styles.exploreArt, { backgroundColor: Brand.navy }]}>
            <AppIcon name="find-criteria" size={32} badge />
          </View>
          <View style={styles.flex}>
            {summary.isSuccess && !b.insufficient ? (
              <ThemedText type="sectionTitle">
                내 기준에 맞는 곳{' '}
                <ThemedText type="sectionTitle" themeColor={b.meets.length ? 'success' : 'textSecondary'}>
                  {b.meets.length}곳
                </ThemedText>
              </ThemedText>
            ) : (
              <ThemedText type="sectionTitle">조건으로 낚시터 찾기</ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {criteriaLabel(criteria)}
              {b.meets.length && home ? ` · ${home.name}에서 가까운 순` : ''}
            </ThemedText>
          </View>
        </View>
        {summary.isPending ? (
          <ThemedText type="small" themeColor="textSecondary">
            전국 낚시터 해황을 확인하는 중이에요…
          </ThemedText>
        ) : summary.isError ? (
          <ThemedText type="small" themeColor="danger">
            해황 자료를 불러오지 못했어요. {summary.error.message}
          </ThemedText>
        ) : (
          <CriteriaResult
            b={b}
            criteria={criteria}
            places={places.data ?? []}
            origin={home ? { lat: home.lat, lon: home.lon, label: home.name } : null}
            onChangeCriteria={openCriteria}
          />
        )}
        {b.meets.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={openCriteria} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="tint">
              {`맞는 곳 ${b.meets.length}곳 모두 지도에서 보기 ›`}
            </ThemedText>
          </Pressable>
        ) : null}
      </Card>
      <ThemedText type="small" themeColor="textSecondary">
        앱이 좋고 나쁨을 판정하지 않아요. 오늘 남은 시간 예보 최대값과 기상청 특보를 내 기준과 비교해요.
      </ThemedText>
    </>
  );
}

function InfoRow({ icon, title, sub, onPress }: { icon: AppIconName; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}>
      <View style={styles.infoIcon}>
        <AppIcon name={icon} size={IconSize.row} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {sub}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">›</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  center: { textAlign: 'center' },
  hero: { backgroundColor: Brand.navy, borderRadius: 14, padding: 14, gap: 10 },
  heroTag: { color: Brand.onNavySecondary, fontSize: 12, fontWeight: '600' },
  heroTitle: { color: Brand.onNavy, fontSize: 19, fontWeight: '800', letterSpacing: -0.3, marginTop: -4 },
  heroActions: { flexDirection: 'row', gap: 10 },
  heroBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F6F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnText: { color: Brand.onNavy, fontSize: 14, fontWeight: '700' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  catchRow: { gap: 12, paddingRight: Layout.screenPadding },
  catchCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  catchImg: { width: '100%' },
  catchInfo: { padding: 10, gap: 2 },
  bold: { fontWeight: '700' },
  textCatch: { padding: 12, gap: 6 },
  textCatchLabel: { fontWeight: '700' },
  badge: {
    position: 'absolute',
    left: 8,
    top: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(46,125,50,0.92)',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyCatch: { gap: 10 },
  emptyHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  emptyActions: { flexDirection: 'row', gap: 8 },
  emptyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 9,
  },
  explore: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  exploreArt: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 0, paddingVertical: 4 },
  divider: { height: StyleSheet.hairlineWidth },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  infoIcon: { width: 32, alignItems: 'center' },
});
