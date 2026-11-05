// 서버 응답 타입 (backend app/schemas 와 맞춘다). 시각은 모두 ISO 8601 문자열(UTC, 'Z')

export type Health = { status: string; env: string };

export type Region = { id: number; name: string };

export type PlaceType = 'breakwater' | 'rock' | 'wharf' | 'beach' | 'other';

export type Place = {
  id: number;
  region_id: number;
  name: string;
  type: PlaceType;
  lat: number | null;
  lon: number | null;
};

export type Species = { code: string; name_ko: string };

export type TitleInfo = { name: string; min_points: number };

export type MyTitle = {
  total_points: number;
  current: TitleInfo;
  next: TitleInfo | null;
  points_to_next: number | null;
};

export type Metric = 'tide_level' | 'wave_height' | 'wind_speed' | 'water_temp';
export type DataKind = 'forecast' | 'observed';

/** 일지 당시 인근 관측소 환경정보 (FR-10). value/kind 가 null 이면 「자료 없음」 */
export type EnvSnapshot = {
  metric: Metric;
  kind: DataKind | null;
  value: number | null;
  unit: string;
  value_time: string | null;
  distance_km: number | null;
  source_agency: string | null;
};

export type Journal = {
  id: number;
  place_id: number;
  place_name: string;
  fished_at: string;
  species_code: string | null;
  species_name: string | null;
  species_etc: string | null;
  count: number | null;
  max_length_cm: number | null;
  bait: string | null;
  rig: string | null;
  memo: string | null;
  photo_count: number;
  created_at: string;
  updated_at: string;
  env_snapshots: EnvSnapshot[];
};

export type JournalInput = {
  place_id: number;
  /** timezone 포함 ISO 8601 (Date.toISOString() 사용) */
  fished_at: string;
  species_code: string | null;
  species_etc: string | null;
  count: number | null;
  max_length_cm: number | null;
  bait: string | null;
  rig: string | null;
  memo: string | null;
};

export type JournalMutation = {
  journal: Journal | null;
  point_delta: number;
  total_points: number;
  title: MyTitle;
  title_changed: boolean;
};

export type PointReason = 'JOURNAL_CREATED' | 'DETAIL_FILLED' | 'PHOTO_ATTACHED' | 'FIRST_PLACE' | 'PERSONAL_BEST';

export type PointHistoryItem = {
  id: number;
  reason: PointReason;
  delta: number;
  journal_id: number | null;
  created_at: string;
};

export type MyPoints = { total_points: number; history: PointHistoryItem[] };
