// 서버 응답 타입 (backend app/schemas 와 맞춘다). 시각은 모두 ISO 8601 문자열(UTC, 'Z')

export type Health = { status: string; env: string };

export type Region = { id: number; name: string };

export type PlaceType = 'breakwater' | 'rock' | 'wharf' | 'beach' | 'paid' | 'point' | 'boat' | 'other';

export type Place = {
  id: number;
  region_id: number;
  /** 예: 「충남 태안군」 */
  region_name: string;
  name: string;
  type: PlaceType;
  lat: number | null;
  lon: number | null;
  address: string | null;
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
  photos: Photo[];
  verification: Verification;
  /** 이 기록을 공유한 커뮤니티 글 */
  shared_post_id: number | null;
  created_at: string;
  updated_at: string;
  env_snapshots: EnvSnapshot[];
};

/** 서버에 저장된 사진 (EXIF·위치 제거본). url 은 API 주소 기준 상대 경로 */
export type Photo = { id: number; url: string; width: number; height: number };

export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

/** 사진 인증 상태 (포인트는 approved 일 때만) */
export type Verification = {
  status: VerificationStatus;
  requested_at: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  /** 이 기록으로 현재 받은 포인트 */
  points: number;
  can_request: boolean;
  /** 신청에 빠진 조건 (예: 「사진 1장 이상」) */
  missing: string[];
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
  /** 업로드한 사진 ID (순서 = 표시 순서). 생략하면 사진 변경 없음 */
  photo_ids?: number[];
  /** 저장과 함께 인증 신청 */
  request_verification?: boolean;
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

// --- A/B 비교 (FR-02~05, FR-07) ---

export type SeriesReason = 'NO_STATION' | 'NO_DATA' | 'FUTURE_DATE' | 'NOT_CONNECTED' | 'TOO_FAR';
export type RegulationStatus = 'PROHIBITED' | 'CONDITIONAL' | 'OFFICIALLY_OPEN' | 'UNVERIFIED';

export type SeriesSource = {
  agency: string;
  dataset: string;
  station_code: string;
  station_name: string;
  distance_km: number | null;
};

export type Series = {
  metric: 'tide_extreme' | 'tide_level' | 'wave_height' | 'wind_speed' | 'water_temp';
  unit: string;
  kind: DataKind;
  status: 'ok' | 'unavailable';
  reason: SeriesReason | null;
  source: SeriesSource | null;
  issued_at: string | null;
  fetched_at: string | null;
  points: { t: string; v: number | null }[] | null;
  extremes: { t: string; type: 'high' | 'low'; v: number | null }[] | null;
};

export type Regulation = {
  status: RegulationStatus;
  stale: boolean;
  items: {
    restriction_type: 'fishing' | 'access' | 'other';
    status: RegulationStatus;
    authority: string | null;
    notice_no: string | null;
    notice_url: string | null;
    valid_from: string | null;
    valid_to: string | null;
    verified_at: string | null;
  }[];
};

/** 국립해양조사원 바다낚시지수 — 기관 발표값 그대로 (앱 자체 판정 아님) */
export type FishingIndexLevel = '매우좋음' | '좋음' | '보통' | '나쁨' | '매우나쁨';

export type FishingIndex = {
  status: 'ok' | 'unavailable';
  reason: SeriesReason | null;
  source: SeriesSource | null;
  fetched_at: string | null;
  periods:
    | { period: string; tide_phase: string | null; items: { species: string; index: FishingIndexLevel | null }[] }[]
    | null;
};

/** 기상청 해상 특보. level=unknown 이면 「특보 없음」으로 표시하지 않는다 */
export type WarningMatch = { type: string; areas: string[]; when: string | null; severe: boolean };
export type Warning = {
  level: 'warning' | 'nearby' | 'preliminary' | 'none' | 'unknown';
  reason: 'NO_DATA' | 'UNKNOWN_SEA' | null;
  seas: string[];
  active: WarningMatch[];
  preliminary: WarningMatch[];
  issued_at: string | null;
  fetched_at: string | null;
  source: string;
};

export type PlaceCompare = {
  place: Place;
  region_name: string;
  regulation: Regulation;
  warning: Warning;
  fishing_index: FishingIndex;
  series: Series[];
};

export type CompareResult = {
  date: string;
  timezone: string;
  generated_at: string;
  places: PlaceCompare[];
  disclaimer: string;
};

export type DateRange = { today: string; min: string; max: string; timezone: string };

export type PlaceConditions = {
  date: string;
  timezone: string;
  generated_at: string;
  place: PlaceCompare;
  disclaimer: string;
};

export type DataSource = { agency: string; dataset: string; kind: DataKind; connected: boolean; note: string | null };

// --- 커뮤니티 ---

export type PostCategory = 'catch' | 'question' | 'tip';
export type Author = { nickname: string; title: string };

export type PostSummary = {
  id: number;
  category: PostCategory;
  title: string;
  excerpt: string;
  author: Author;
  place_name: string | null;
  species_name: string | null;
  like_count: number;
  comment_count: number;
  liked: boolean;
  mine: boolean;
  popular: boolean;
  created_at: string;
  /** 인증 완료 기록을 공유한 글 (「인증 조황」) */
  verified: boolean;
  photo_count: number;
  thumb: Photo | null;
};

export type PostComment = { id: number; body: string; author: Author; mine: boolean; created_at: string };
export type PostCatch = {
  fished_at: string;
  species_name: string | null;
  count: number | null;
  max_length_cm: number | null;
};
export type PostDetail = PostSummary & {
  body: string;
  comments: PostComment[];
  photos: Photo[];
  catch: PostCatch | null;
};

export type PostInput = {
  category: PostCategory;
  title: string;
  body: string;
  place_id: number | null;
  species_code: string | null;
  species_etc: string | null;
  photo_ids: number[];
  /** 인증 완료된 내 기록 공유 */
  journal_id?: number | null;
};

export type ReportResult = { status: 'received' | 'already_reported'; hidden: boolean };
