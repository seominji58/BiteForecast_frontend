/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { distanceM, stampBucket } from './stamp-distance.ts';

test('거리: 위도 0.01도 ≈ 1.1km', () => {
  const m = distanceM(34.47, 127.1, 34.48, 127.1);
  assert.ok(m > 1100 && m < 1120, String(m));
  assert.equal(Math.round(distanceM(34.47, 127.1, 34.47, 127.1)), 0);
});

test('구간: 반경 안이면 100/300/500, 밖이면 안내', () => {
  assert.deepEqual(stampBucket(60, 300, '장소'), { within: 100 });
  assert.deepEqual(stampBucket(250, 300, '장소'), { within: 300 });
  assert.deepEqual(stampBucket(420, 500, '항구'), { within: 500 });
  assert.deepEqual(stampBucket(1100, 300, '장소'), { error: '장소에서 1.1km 떨어져 있어요. 300m 안에서 찍을 수 있어요' });
  assert.deepEqual(stampBucket(350, 300, '장소'), { error: '장소에서 350m 떨어져 있어요. 300m 안에서 찍을 수 있어요' });
});
