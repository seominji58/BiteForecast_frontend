import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useDateRange, usePlaces, usePlacesSummary, usePosts } from '@/api/queries';
import type { Place, PostSummary } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { AppIcon } from '@/components/app-icon';
import { Card, SectionHeader, TabScreen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, IconSize, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkPlace, criteriaLabel, WARNING_SHORT } from '@/lib/criteria';
import { timeAgo } from '@/lib/format';
import { km, matches, PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';
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

  return (
    <TabScreen title="입질예보" logo>
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
  const items = useMemo(() => {
    const withPhoto = (posts.data ?? []).filter((p) => p.thumb);
    return [...withPhoto.filter((p) => p.verified), ...withPhoto.filter((p) => !p.verified)].slice(0, 8);
  }, [posts.data]);
  const cardW = Math.min(240, (Math.min(width, 600) - Layout.screenPadding * 2 - 12) / 2);

  return (
    <>
      <SectionHeader title="최근 조황" actionLabel="전체보기" onAction={() => router.push('/community')} />
      {items.length === 0 ? (
        <Card style={styles.emptyCatch}>
          <AppIcon name="cat-catch" size={36} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {posts.isPending ? '조황을 불러오는 중이에요…' : '아직 사진 조황이 없어요. 첫 조황을 올려 주세요!'}
          </ThemedText>
          {!posts.isPending ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/community/new')} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="tint">
                조황 올리기 ›
              </ThemedText>
            </Pressable>
          ) : null}
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
  const caption = [p.species_name, p.place_name].filter(Boolean).join(' · ') || p.title;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.verified ? '인증 조황, ' : ''}${caption}, ${timeAgo(p.created_at)}`}
      onPress={() => router.push({ pathname: '/community/[id]', params: { id: String(p.id) } })}
      style={({ pressed }) => [
        styles.catchCard,
        { width, borderColor: border, backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <View>
        {src ? <Image source={src} style={[styles.catchImg, { height: width }]} contentFit="cover" transition={150} /> : null}
        {p.verified ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓ 인증 조황</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.catchInfo}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {caption}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {p.author.nickname} · {timeAgo(p.created_at)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** 출조 탐색: 오늘 내 조건(파고·풍속 상한, 특보 발효 제외)에 맞는 곳이 몇 곳인지 실제 자료로 보여준다 */
function ExploreTeaser({ home }: { home: Place | null }) {
  const range = useDateRange();
  const summary = usePlacesSummary(range.data?.today);
  const places = usePlaces();
  const [criteria] = useCriteria();

  const stat = useMemo(() => {
    const list = summary.data?.places ?? [];
    const byId = new Map((places.data ?? []).map((p) => [p.id, p]));
    const meets = list.filter((s) => checkPlace(s, criteria).status === 'meets');
    const warnings = list.filter((s) => s.warning_level === 'warning').length;
    let nearest: { place: Place; dist: number } | null = null;
    if (home) {
      for (const s of meets) {
        const p = byId.get(s.place_id);
        if (!p) continue;
        const d = km(home, p);
        if (Number.isFinite(d) && (!nearest || d < nearest.dist)) nearest = { place: p, dist: d };
      }
    }
    return { meets: meets.length, warnings, total: list.length, nearest };
  }, [summary.data, places.data, criteria, home]);

  return (
    <>
      <SectionHeader
        title="오늘 출조 탐색"
        actionLabel="기준 바꾸기"
        onAction={() => router.push({ pathname: '/explore', params: { mode: 'criteria' } })}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/explore', params: { mode: 'criteria' } })}
        style={({ pressed }) => pressed && styles.pressed}>
        <Card style={styles.explore}>
          <View style={[styles.exploreArt, { backgroundColor: Brand.navy }]}>
            <AppIcon name="find-criteria" size={44} badge />
          </View>
          <View style={styles.flex}>
            {summary.isSuccess ? (
              <>
                <ThemedText type="sectionTitle">
                  내 조건에 맞는 곳 <ThemedText type="sectionTitle" themeColor="success">{stat.meets}곳</ThemedText>
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {stat.nearest
                    ? `${home?.name}에서 가장 가까운 곳: ${stat.nearest.place.name} ${Math.round(stat.nearest.dist)}km`
                    : `전국 ${stat.total}곳 중 · 특보 발효 ${stat.warnings}곳 제외`}
                </ThemedText>
              </>
            ) : (
              <ThemedText type="sectionTitle">조건 맞는 낚시터 찾아보기</ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {criteriaLabel(criteria)}
            </ThemedText>
            <ThemedText type="smallBold" themeColor="tint">
              출조 조건 확인하기 ›
            </ThemedText>
          </View>
        </Card>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        앱이 좋고 나쁨을 판정하지 않아요. 오늘 남은 시간 예보 최대값과 기상청 특보로 내 기준을 비교해요.
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
  emptyCatch: { alignItems: 'center', gap: 6, paddingVertical: 18 },
  explore: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  exploreArt: { width: 84, height: 84, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 0, paddingVertical: 4 },
  divider: { height: StyleSheet.hairlineWidth },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  infoIcon: { width: 32, alignItems: 'center' },
});
