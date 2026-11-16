/**
 * 「내 조건에 맞는 곳」 판정 테스트 (2026-11-10 작업 메모 3번: 추천 후보 판정 확인)
 * 실행: npm run test:unit  (Node 내장 테스트 — 앱 번들에는 들어가지 않는다)
 */
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { PlaceSummary } from '@/api/types';

import { breakdown, checkPlace, DEFAULT_CRITERIA, type Criteria } from './criteria.ts';

const C: Criteria = DEFAULT_CRITERIA; // 파고 ≤1.0m · 풍속 ≤7m/s · 지수 조건 없음

/** 조건을 모두 만족하는 장소 하나 (필요한 칸만 바꿔 쓴다) */
function place(over: Partial<PlaceSummary> = {}): PlaceSummary {
  return {
    place_id: 1,
    warning_level: 'none',
    warning_types: [],
    wave_fc_max: { v: 0.5 },
    wind_fc_max: { v: 4 },
    index: { best: '좋음' },
    ...over,
  } as unknown as PlaceSummary;
}

test('조건을 모두 만족하면 meets', () => {
  assert.equal(checkPlace(place(), C).status, 'meets');
});

test('특보 발효 중이면 낚시지수가 「좋음」이어도 제외 (fails)', () => {
  const r = checkPlace(place({ warning_level: 'warning', warning_types: ['풍랑주의보'] }), C);
  assert.equal(r.status, 'fails');
  assert.ok(r.notes.some((n) => n.includes('풍랑주의보')));
});

test('지수 조건을 「좋음 이상」으로 걸어도 특보 발효 중이면 제외', () => {
  const r = checkPlace(place({ warning_level: 'warning', index: { best: '매우좋음' } as PlaceSummary['index'] }), {
    ...C,
    minIndex: '좋음',
  });
  assert.equal(r.status, 'fails');
});

test('특보 확인 불가는 통과로 치지 않는다 (unknown)', () => {
  assert.equal(checkPlace(place({ warning_level: 'unknown' }), C).status, 'unknown');
});

test('다른 날짜: 지금 특보 발효 중이면 그날은 판단하지 않는다 (meets 아님)', () => {
  const r = checkPlace(place({ warning_level: 'warning' }), C, { future: true });
  assert.equal(r.status, 'unknown');
});

test('다른 날짜에 통과해도 「그날 특보는 발표 전」을 함께 적는다', () => {
  const r = checkPlace(place(), C, { future: true });
  assert.equal(r.status, 'meets');
  assert.ok(r.notes.some((n) => n.includes('발표 전')));
});

test('인근 해역 특보·예비특보는 제외하지 않되 안내를 붙인다', () => {
  const near = checkPlace(place({ warning_level: 'nearby' }), C);
  assert.equal(near.status, 'meets');
  assert.ok(near.notes.some((n) => n.includes('인근 해역 특보')));
  const pre = checkPlace(place({ warning_level: 'preliminary' }), C);
  assert.equal(pre.status, 'meets');
  assert.ok(pre.notes.some((n) => n.includes('예비특보')));
});

test('파고·풍속 예보가 없으면 값을 만들지 않고 자료 부족', () => {
  assert.equal(checkPlace(place({ wave_fc_max: null }), C).status, 'unknown');
  assert.equal(checkPlace(place({ wind_fc_max: null }), C).status, 'unknown');
  assert.equal(checkPlace(undefined, C).status, 'unknown');
});

test('파고 0.0m 는 결측이 아니라 값이다 (통과)', () => {
  assert.equal(checkPlace(place({ wave_fc_max: { v: 0 } as PlaceSummary['wave_fc_max'] }), C).status, 'meets');
});

test('상한을 넘으면 fails, 상한과 같으면 통과', () => {
  assert.equal(checkPlace(place({ wave_fc_max: { v: 1.1 } as PlaceSummary['wave_fc_max'] }), C).status, 'fails');
  assert.equal(checkPlace(place({ wave_fc_max: { v: 1.0 } as PlaceSummary['wave_fc_max'] }), C).status, 'meets');
  assert.equal(checkPlace(place({ wind_fc_max: { v: 7.1 } as PlaceSummary['wind_fc_max'] }), C).status, 'fails');
});

test('지수 조건이 있는데 지수가 없으면 자료 부족, 낮으면 제외', () => {
  const c = { ...C, minIndex: '좋음' as const };
  assert.equal(checkPlace(place({ index: null }), c).status, 'unknown');
  assert.equal(checkPlace(place({ index: { best: '보통' } as PlaceSummary['index'] }), c).status, 'fails');
});

test('묶음 집계: 특보 발효 장소는 meets 에 들어가지 않는다', () => {
  const list = [
    place({ place_id: 1 }),
    place({ place_id: 2, warning_level: 'warning' }),
    place({ place_id: 3, warning_level: 'unknown' }),
  ];
  const b = breakdown(list, C);
  assert.deepEqual(
    b.meets.map((s) => s.place_id),
    [1],
  );
  assert.equal(b.warning, 1);
});
