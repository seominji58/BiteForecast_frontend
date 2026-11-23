import assert from 'node:assert/strict';
import test from 'node:test';

import { areaPath, dayPoints, linePath, nowX, valueAt, yRange } from './chart.ts';

const iso = (h: number) => new Date(`2026-11-23T${String(h).padStart(2, '0')}:00:00`).toISOString();

test('dayPoints: 그날 0~24시만, null 은 뺀다, 시간순', () => {
  const pts = dayPoints(
    [
      { t: iso(6), v: 1 },
      { t: iso(3), v: 2 },
      { t: iso(9), v: null },
    ],
    '2026-11-23',
  );
  assert.deepEqual(pts, [
    { x: 3, v: 2 },
    { x: 6, v: 1 },
  ]);
  assert.deepEqual(dayPoints(null, '2026-11-23'), []);
});

test('yRange: 여유를 두고, 같은 값이면 ±1, floor 아래로 안 내림', () => {
  assert.deepEqual(yRange([5, 5]), { min: 3.76, max: 6.24 });
  const r = yRange([0, 10], 0);
  assert.equal(r.min, 0);
  assert.ok(r.max > 10);
});

test('valueAt: 사이 값은 직선 보간, 범위 밖은 null', () => {
  const pts = [
    { x: 0, v: 0 },
    { x: 10, v: 100 },
  ];
  assert.equal(valueAt(pts, 5), 50);
  assert.equal(valueAt(pts, 11), null);
});

test('linePath/areaPath: 점 수만큼 곡선, 영역은 닫힘', () => {
  const b = { w: 240, h: 100, min: 0, max: 10 };
  const pts = [
    { x: 0, v: 0 },
    { x: 12, v: 10 },
    { x: 24, v: 0 },
  ];
  const d = linePath(pts, b);
  assert.ok(d.startsWith('M0.0,100.0'));
  assert.equal((d.match(/C/g) ?? []).length, 2);
  assert.ok(areaPath(pts, b).endsWith('Z'));
  assert.equal(linePath([], b), '');
});

test('nowX: 그날이면 시각, 아니면 null', () => {
  assert.equal(nowX('2026-11-23', new Date('2026-11-23T06:30:00')), 6.5);
  assert.equal(nowX('2026-11-22', new Date('2026-11-23T06:30:00')), null);
});
