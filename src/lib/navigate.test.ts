/**
 * 길안내 주소 테스트 (2026-11-19)
 * 실행: npm run test:unit
 */
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Place } from '@/api/types';

import { appleMapsUrl, navTarget, nearLabel, navUrl } from './navigate.ts';

const base: Place = { id: 1, region_id: 1, region_name: '인천 옹진군', name: '선재낚시공원', type: 'paid', lat: 37.25, lon: 126.51, address: '인천 옹진군 영흥면' };

test('좌표가 있으면 경로 안내', () => {
  assert.deepEqual(navTarget(base, '선재낚시공원'), { kind: 'route', name: '선재낚시공원', lat: 37.25, lon: 126.51 });
});

test('배 낚시 지점은 길안내 없음', () => {
  assert.equal(navTarget({ ...base, type: 'boat' }, 'x').kind, 'none');
});

test('좌표 의심이면 주소 검색', () => {
  assert.deepEqual(navTarget({ ...base, location_suspect: true }, 'x'), { kind: 'search', query: '인천 옹진군 영흥면' });
});

test('카카오·네이버·T맵 경로 주소 · Apple 지도 대체', () => {
  const t = { kind: 'route' as const, name: '선재 낚시', lat: 37.25, lon: 126.51 };
  assert.equal(navUrl('kakao', t), 'kakaomap://route?ep=37.25,126.51&by=CAR');
  assert.equal(navUrl('naver', t), 'nmap://route/car?dlat=37.25&dlng=126.51&dname=%EC%84%A0%EC%9E%AC%20%EB%82%9A%EC%8B%9C&appname=com.seominji58.biteforecast');
  assert.equal(navUrl('tmap', t), 'tmap://route?goalname=%EC%84%A0%EC%9E%AC%20%EB%82%9A%EC%8B%9C&goalx=126.51&goaly=37.25');
  assert.equal(appleMapsUrl(t), 'https://maps.apple.com/?daddr=37.25,126.51&q=%EC%84%A0%EC%9E%AC%20%EB%82%9A%EC%8B%9C&dirflg=d');
});

test('근처 주소: 동·리만 있으면 「근처」, 번지가 있으면 「부근」', () => {
  assert.equal(nearLabel('전남 신안군 장산면 팽진리', 'region'), '전남 신안군 장산면 팽진리 근처');
  assert.equal(nearLabel('강원 고성군 토성면 아야진리 1-5', 'address'), '강원 고성군 토성면 아야진리 1-5 부근');
  assert.equal(nearLabel(null, 'region'), null);
});
