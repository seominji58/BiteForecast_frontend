import assert from 'node:assert/strict';
import test from 'node:test';

import type { StopOutlook } from '../api/types.ts';
import { stopBrief } from './trip.ts';

const C = { maxWave: 1.0, maxWind: 7, minIndex: null };
const base = {
  forecast_status: 'available',
  wave_fc_max: { v: 0.8, t: '' },
  wind_fc_max: { v: 5, t: '' },
  warning_level: 'none',
  warning_is_current: true,
  warning_types: [],
  tides: [],
  precipitation_types: [],
} as unknown as StopOutlook;

test('stopBrief: 특보 > 내 기준 > 예보 없음 사유', () => {
  assert.deepEqual(stopBrief(base, C, null), { text: '내 기준 충족', tone: 'success', mini: '파고 0.8m · 바람 5m/s' });
  assert.equal(stopBrief({ ...base, wind_fc_max: { v: 11, t: '' } } as StopOutlook, C, null).text, '내 기준 밖');
  assert.equal(stopBrief({ ...base, warning_level: 'warning' } as StopOutlook, C, null).tone, 'danger');
  assert.deepEqual(stopBrief({ ...base, forecast_status: 'pending' } as StopOutlook, C, null), {
    text: '예보 전',
    tone: 'textSecondary',
    mini: null,
  });
  assert.equal(stopBrief(undefined, C, null).text, '확인 중');
});
