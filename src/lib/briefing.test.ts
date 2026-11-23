/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { FishingIndexDay } from '@/api/types';

import { bestGrade, dayStat, speciesRanking, topSpots, weekHeadline } from './briefing.ts';

const pt = (id: number, place: number, sp: [string, string, string][]) => ({
  station_id: id,
  station_name: `지점${id}`,
  tide_phase: { 오전: '중조기', 오후: '중조기' },
  species: sp.map(([species, am, pm]) => ({ species, grades: { 오전: am, 오후: pm } })),
  places: [{ place_id: place, distance_km: 0, official: true }],
});
const day = (date: string, points: ReturnType<typeof pt>[]): FishingIndexDay => ({ date, periods: ['오전', '오후'], fetched_at: null, max_km: 20, points, disclaimer: '' });

const d25 = day('2026-11-25', [
  pt(1, 101, [['감성돔', '보통', '매우좋음'], ['우럭', '보통', '보통'], ['기타어종', '좋음', '좋음']]),
  pt(2, 102, [['감성돔', '좋음', '좋음'], ['벵에돔', '좋음', '나쁨']]),
  pt(3, 103, [['우럭', '나쁨', '매우나쁨']]),
]);
const d24 = day('2026-11-24', [pt(1, 101, [['감성돔', '매우나쁨', '매우나쁨']]), pt(2, 102, [['감성돔', '나쁨', '매우나쁨']])]);
const all = () => true;

test('그날 등급 = 오전·오후 중 좋은 쪽', () => {
  assert.equal(bestGrade({ 오전: '보통', 오후: '매우좋음' }), '매우좋음');
  assert.equal(bestGrade({ 오전: '-' }), null);
});

test('날짜 요약·한 줄', () => {
  const s25 = dayStat(d25, all);
  assert.deepEqual([s25.good, s25.veryGood, s25.bad, s25.total], [3, 1, 1, 5]); // 기타어종 제외
  const line = weekHeadline([dayStat(d24, all), s25], (d) => (d.endsWith('25') ? '수요일' : '내일'));
  assert.equal(line, '수요일이 가장 좋아요 · 내일은 대부분 나쁨');
});

test('어종 순위: 좋음 이상 지점 수 순', () => {
  assert.deepEqual(speciesRanking(d25, all).map((r) => [r.species, r.good]), [['감성돔', 2], ['벵에돔', 1], ['우럭', 0]]);
});

test('좋은 곳: 최고 등급 순, 특보 곳 제외, 어종 지정', () => {
  assert.deepEqual(topSpots(d25, all).map((s) => s.placeId), [101, 102]);
  assert.deepEqual(topSpots(d25, all, { excluded: (id) => id === 101 }).map((s) => s.placeId), [102]);
  assert.deepEqual(topSpots(d25, all, { species: '벵에돔' }).map((s) => [s.placeId, s.picks[0].species]), [[102, '벵에돔']]);
});
