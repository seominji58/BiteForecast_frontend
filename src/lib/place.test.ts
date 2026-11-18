/**
 * 장소 표시 이름 테스트 (2026-11-18): 바다 위 지수 지점이 낚시터처럼 보이지 않게
 * 실행: npm run test:unit
 */
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { placeKindNote, placeName } from './place.ts';

test('선상 지수 지점: 항구·방향·거리 → 「○○항 ○쪽 Nkm 바다」', () => {
  assert.equal(placeName({ name: '목포북항서측(53km)', type: 'boat' }), '목포북항 서쪽 53km 바다');
  assert.equal(placeName({ name: '안흥항북북서(27km)', type: 'boat' }), '안흥항 북북서쪽 27km 바다');
  assert.equal(placeName({ name: '강릉항북동(2km)', type: 'boat' }), '강릉항 북동쪽 2km 바다');
});

test('규칙에 안 맞거나 낚시터면 원래 이름 그대로', () => {
  assert.equal(placeName({ name: '부산동부', type: 'boat' }), '부산동부');
  assert.equal(placeName({ name: '대부도바다낚시터', type: 'paid' }), '대부도바다낚시터');
  assert.equal(placeName({ name: '가거도', type: 'point' }), '가거도');
});

test('지수 지점만 종류 안내', () => {
  assert.ok(placeKindNote({ type: 'boat' })?.includes('바다 위'));
  assert.ok(placeKindNote({ type: 'point' })?.includes('공식 낚시지수'));
  assert.equal(placeKindNote({ type: 'paid' }), null);
});
