import assert from 'node:assert/strict';
import test from 'node:test';

import type { PlaceSummary } from '../api/types.ts';
import type { Spot } from './briefing.ts';
import { betterPeriod, goldenSpots, tempAlert, tempDiff } from './golden.ts';

const spot = (placeId: number, top: number, grades: Record<string, string> = { 오전: '좋음', 오후: '좋음' }): Spot => ({
  point: { station_id: placeId, station_name: `지점${placeId}`, tide_phase: {}, species: [{ species: '감성돔', grades }], places: [] },
  placeId,
  picks: [{ species: '감성돔', grade: '좋음' }],
  top,
  tide: null,
});
const iso = (h: number, m: number) => new Date(`2026-11-24T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).toISOString();
const sum = (o: Partial<PlaceSummary>) => ({ warning_level: 'none', ...o }) as PlaceSummary;
const C = { maxWave: 1.0, maxWind: 7 };

test('goldenSpots: 특보는 빼고, 기준 초과는 뒤로, 같은 등급이면 ✓ 많은 곳이 위로', () => {
  const S: Record<number, PlaceSummary> = {
    1: sum({ wave_fc_max: { v: 0.8, t: '' } as never }),
    2: sum({
      wave_fc_max: { v: 0.5, t: '' } as never,
      sunrise: '07:10',
      sunset: '17:20',
      next_tide: { type: 'low', t: iso(16, 40), v: 50, station_name: '', station_km: 3 },
    }),
    3: sum({ warning_level: 'warning' }),
    4: sum({ wave_fc_max: { v: 1.5, t: '' } as never }),
  };
  const out = goldenSpots([spot(1, 4), spot(2, 4), spot(3, 5), spot(4, 5)], (id) => S[id], C, { today: true });
  // 특보(3)는 빠지고, 기준 초과(4)는 맨 뒤에 「기준 초과」로
  assert.deepEqual(
    out.map((g) => g.placeId),
    [2, 1, 4],
  );
  assert.equal(out[2].over, true);
  assert.equal(out[2].reasons[0].text, '파고 1.5m 기준 초과');
  assert.deepEqual(
    out[0].reasons.filter((r) => r.check).map((r) => r.key),
    ['calm', 'tide'],
  );
  assert.ok(out[0].reasons.find((r) => r.key === 'tide')!.text.includes('해 질 무렵'));
});

test('betterPeriod: 오전·오후가 다를 때만', () => {
  assert.equal(betterPeriod({ 오전: '보통', 오후: '매우좋음' }), '오후가 더 좋아요 (매우좋음)');
  assert.equal(betterPeriod({ 오전: '좋음', 오후: '좋음' }), null);
  assert.equal(betterPeriod({ 일: '좋음' }), null);
});

test('tempDiff: 예년 대비 차이 (0.5°C 미만은 예년 수준)', () => {
  const n = { v: 17, station: '', km: 3, period: '2019~2025', source: '' };
  assert.equal(tempDiff({ temp_obs: { v: 18.24 } as never, temp_normal: n }), ' · 예년 +1.2°C');
  assert.equal(tempDiff({ temp_obs: { v: 15.6 } as never, temp_normal: n }), ' · 예년 -1.4°C');
  assert.equal(tempDiff({ temp_obs: { v: 17.3 } as never, temp_normal: n }), ' · 예년 수준');
  assert.equal(tempDiff({ temp_obs: null, temp_normal: n }), null);
});

test('tempAlert: 특보 기준값 참고 (공식 특보 아님), 실시간 수온 우선', () => {
  assert.equal(tempAlert(26), '참고 · 고수온 예비 기준(25℃) 이상');
  assert.equal(tempAlert(28.4), '참고 · 고수온 주의보 기준(28℃) 이상');
  assert.equal(tempAlert(6.5), '참고 · 저수온 예비 기준(7℃) 이하');
  assert.equal(tempAlert(15), null);
  const n = { v: 17, station: '', km: 3, period: '', source: '' };
  assert.equal(
    tempDiff({ temp_obs: { v: 15 } as never, temp_rt: { v: 18.2, t: '', station: '', km: 5 }, temp_normal: n }),
    ' · 예년 +1.2°C',
  );
});
