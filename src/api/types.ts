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
  /** 좌표 오류 의심(D등급) → 해황 연결·지도·거리순·추천 등 정밀 위치 기능에서 뺀다 (원본·일반 정보는 그대로) */
  location_suspect?: boolean;
  /** 좌표 품질 (가장 최근 검증 기록). 없으면 판단 안 됨 */
  coord?: CoordQuality | null;
  /** 낚시터가 알린 대상 어종 원문 (전국낚시터정보표준데이터, 예: 「우럭+참돔+농어 등」). 조황 아님 */
  info_species?: string | null;
  /** 주소 칸이 없는 곳의 좌표 근처 주소 (카카오 좌표→주소). region 이면 동·리 이름만 → 「근처」로 표시 */
  near_address?: string | null;
  near_address_kind?: 'address' | 'region' | null;
};

/** 좌표 품질 (docs/03_데이터/2026-11-09_좌표품질_검증보고서.md) */
export type CoordQuality = {
  grade: 'A' | 'B' | 'C' | 'D';
  sub_grade: string | null;
  location_type: string;
  status: string;
  /** 대략 위치(대표 주소·반올림·공유 좌표) → 거리·위치를 「약」으로만 */
  approx: boolean;
  label: string;
  /** 좌표 불일치 의심(추가 검증 필요) — 검증 전까지 추천에서 뺀다 */
  recommend_hold?: boolean;
  checked_at: string;
};

export type Species = { code: string; name_ko: string };

export type TitleInfo = { name: string; min_points: number };

export type MyTitle = {
  total_points: number;
  current: TitleInfo;
  next: TitleInfo | null;
  points_to_next: number | null;
};

/** 일지 환경정보(관측소 자료)에 쓰는 지표 */
export type Metric = 'tide_level' | 'wave_height' | 'wind_speed' | 'water_temp';
/** 기상청 단기예보 육상 날씨 (TMP·POP·SKY·PTY). SKY·PTY 는 기상청 코드 그대로 */
export type WeatherMetric = 'air_temp' | 'precipitation_probability' | 'sky_state' | 'precipitation_type' | 'wind_direction';
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
  /** 출조계획 장소에서 쓴 기록이면 그 장소 ID */
  trip_stop_id?: number | null;
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
  /** 출조계획 장소에서 「기록 남기기」로 쓸 때 (본인 계획·같은 낚시터) */
  trip_stop_id?: number | null;
};

export type JournalMutation = {
  journal: Journal | null;
  point_delta: number;
  total_points: number;
  title: MyTitle;
  title_changed: boolean;
  /** 방금 저장으로 생긴 첫 포획·최대어 갱신 */
  milestone?: Milestone | null;
};

export type Milestone = {
  kind: 'first_catch' | 'personal_best';
  species_name: string;
  length_cm: number | null;
  previous_cm: number | null;
};

/** 내 낚시 기록 요약 (기록 집계, 인증 여부와 관계없는 개인 기록) */
export type SpeciesRecord = {
  key: string;
  species_code: string | null;
  species_name: string;
  first_at: string;
  first_journal_id: number;
  journal_count: number;
  catch_count: number;
  best_length_cm: number | null;
  best_journal_id: number | null;
  best_at: string | null;
  best_verified: boolean;
};
export type RecordSummary = {
  journal_count: number;
  trip_days: number;
  skunk_days: number;
  first_trip: string | null;
  last_trip: string | null;
  species: SpeciesRecord[];
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

export type SeriesReason =
  | 'NO_STATION'
  | 'NO_DATA'
  | 'FUTURE_DATE'
  | 'NOT_CONNECTED'
  | 'TOO_FAR'
  /** 원본 좌표가 의심돼 자료를 연결하지 않음 */
  | 'LOCATION_CHECK'
  /** 가까운 조위관측소가 다른 바다를 봄 */
  | 'DIFFERENT_SEA'
  /** 좌표 불일치 의심 — 좌표 기준 자료 판단 보류 */
  | 'LOCATION_REVIEW';
export type RegulationStatus = 'PROHIBITED' | 'CONDITIONAL' | 'OFFICIALLY_OPEN' | 'UNVERIFIED';

export type SeriesSource = {
  agency: string;
  dataset: string;
  station_code: string;
  station_name: string;
  distance_km: number | null;
};

export type Series = {
  metric: 'tide_extreme' | Metric | WeatherMetric;
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
    restriction_type: 'fishing' | 'access' | 'other' | 'coastal_danger';
    status: RegulationStatus;
    authority: string | null;
    notice_no: string | null;
    notice_url: string | null;
    valid_from: string | null;
    valid_to: string | null;
    verified_at: string | null;
    /** 구역 이름·거리 (예: 「구봉도 주변 해상 (연안해역) · 안에 있음 · …」) */
    remarks?: string | null;
    /** 자료 기준일 (해양경찰청 공간정보) */
    published_at?: string | null;
    geometry_source?: string | null;
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
    | {
        period: string;
        tide_phase: string | null;
        items: {
          species: string;
          index: FishingIndexLevel | null;
          min_wave_m: number | null;
          max_wave_m: number | null;
          min_water_temp: number | null;
          max_water_temp: number | null;
          min_wind_ms: number | null;
          max_wind_ms: number | null;
        }[];
      }[]
    | null;
};

/** 기상청 해상 특보. level=unknown 이면 「특보 없음」으로 표시하지 않는다 */
export type WarningMatch = { type: string; areas: string[]; when: string | null; severe: boolean };
export type Warning = {
  level: 'warning' | 'nearby' | 'preliminary' | 'none' | 'unknown';
  /** no_match: 다른 해역에만 특보 · unknown_sea: 적용 해역 모름 · collector_failed: 수집기 주기 실패(특보 API 실패와 다름) */
  status:
    | 'active'
    | 'nearby'
    | 'no_match'
    | 'no_active_warnings'
    | 'unknown_sea'
    | 'stale'
    | 'collection_failed'
    | 'collector_failed'
    | 'never_collected'
    | 'location_check';
  issues: ('stale' | 'collection_failed' | 'collector_failed')[];
  reason: 'NO_DATA' | 'UNKNOWN_SEA' | 'LOCATION_CHECK' | 'LOCATION_REVIEW' | null;
  seas: string[];
  active: WarningMatch[];
  preliminary: WarningMatch[];
  issued_at: string | null;
  fetched_at: string | null;
  source: string;
  /** 특보 연결 기준 — 등록 주소의 시·도·시군 */
  basis?: 'address';
  /** 주소 기준 특보의 한계 안내 (좌표 불일치 의심 곳) */
  note?: string | null;
  /** 참고용 특보(실제 낚시 위치의 특보는 확인 안 됨) — level 의 none 은 unknown 으로 바뀌어 온다 */
  reference_only?: boolean;
  /** 참고용일 때 주소 기준 원래 단계 */
  address_level?: Warning['level'] | null;
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

// --- 전체 낚시터 요약 (지도·주변·조건으로 찾기). 실측(obs)과 예보(fc)는 다른 필드 ---
export type SeaGroup = '서해' | '남해' | '동해' | '제주';
export type ValueAt = { v: number; t: string };
export type MidSea = {
  region: string;
  wave_min: number | null;
  wave_max: number | null;
  periods: { period: 'am' | 'pm' | 'day'; wave_min: number | null; wave_max: number | null; weather: string | null }[];
  issued_at: string;
};

export type PlaceSummary = {
  place_id: number;
  /** 원본 좌표 의심 → 출조 후보·지도에서 제외 */
  location_suspect: boolean;
  /** 특보 해역 기준 바다 권역 */
  sea_group: SeaGroup | null;
  /** 다음(또는 그날 첫) 만조·간조 — 같은 바다 조위관측소 예보일 때만 */
  next_tide: { type: 'high' | 'low'; t: string; v: number | null; station_name: string; station_km: number | null } | null;
  warning_level: Warning['level'];
  warning_types: string[];
  wave_obs: ValueAt | null;
  wave_obs_km: number | null;
  wave_fc_max: ValueAt | null;
  wind_obs: ValueAt | null;
  wind_fc_max: ValueAt | null;
  air_temp_fc_min: ValueAt | null;
  air_temp_fc_max: ValueAt | null;
  pop_fc_max: ValueAt | null;
  precipitation_types: number[];
  temp_obs: ValueAt | null;
  index: {
    period: string;
    tide_phase: string | null;
    best: FishingIndexLevel;
    worst: FishingIndexLevel;
    species_count: number;
    station_km: number | null;
  } | null;
  /** 기상청 중기해상예보 (4~10일 뒤, 해역 단위 파고 범위). 단기예보가 없는 날의 참고 — 조건 판정에 쓰지 않는다 */
  mid_sea?: MidSea | null;
  /** 물때(몇 물) — 음력 달력 계산 (서해 7물때식, 남해·동해·제주 8물때식) */
  mulddae?: string | null;
  mulddae_style?: string | null;
  /** 일출·일몰 (KST HH:MM, 좌표로 계산) */
  sunrise?: string | null;
  sunset?: string | null;
  /** 출처: 「한국천문연구원」 또는 「계산」 (공식 자료를 받지 못했을 때) */
  lunar_source?: string | null;
  sun_source?: string | null;
  /** 가장 센 바람 시각의 풍향 (16방위, 바람이 불어오는 쪽. 예: 북서) */
  wind_dir_fc?: string | null;
  /** 출입통제구역·연안사고 위험구역 짧은 안내 (금지 판정 아님) */
  zone_notes?: string[];
};
/** 자료별 마지막 수집 시각. stale 이면 출조 탐색 판단에 쓰지 않는다 */
export type DataStatus = {
  forecast_fetched_at: string | null;
  /** 받아 둔 예보의 최근 발표 시각 (오래됨 판단 기준) */
  forecast_issued_at: string | null;
  /** 예보가 다루는 마지막 시각 — 이후 날짜는 예보 없음 */
  forecast_valid_until: string | null;
  warning_fetched_at: string | null;
  buoy_fetched_at: string | null;
  tide_fetched_at: string | null;
  index_fetched_at: string | null;
  stale: boolean;
  stale_reason: string | null;
  stale_after_hours: number;
};
export type PlacesSummary = {
  date: string;
  generated_at: string;
  places: PlaceSummary[];
  disclaimer: string;
  data_status: DataStatus;
};

export type PlaceConditions = {
  date: string;
  timezone: string;
  generated_at: string;
  place: PlaceCompare;
  disclaimer: string;
};

export type DataSource = { agency: string; dataset: string; kind: DataKind; connected: boolean; note: string | null };

// --- 커뮤니티 ---

export type PostCategory = 'catch' | 'question' | 'tip' | 'free';
/** 글 목록 거르기: 시·도(예: 제주), 어종(코드 또는 직접 입력 이름), 낚시터(이름까지 공개한 글만) */
export type PostFilter = { sido?: string | null; species?: string | null; placeId?: number | null };
/** 글 위치 공개 범위: 낚시터 이름까지 / 지역만 / 숨김 */
export type LocationVisibility = 'place' | 'region' | 'hidden';
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
  /** 위치 공개 범위 — place 가 아니면 place_name·place_id 가 비고, hidden 이면 region_name 도 빈다 */
  location_visibility: LocationVisibility;
  photo_count: number;
  thumb: Photo | null;
  place_id: number | null;
  /** 예: 「제주 제주시」 */
  region_name: string | null;
  /** 기록 공유 글의 조과 (일반 글은 null) */
  catch: PostCatch | null;
};

export type PostComment = {
  id: number;
  body: string;
  author: Author;
  mine: boolean;
  created_at: string;
  /** 대댓글이면 원댓글 id (한 단계만) */
  parent_id?: number | null;
  /** 원댓글이 지워졌지만 답글이 남아 있을 때의 자리표시 (본문·작성자 비어 있음) */
  deleted?: boolean;
};
export type PostCatch = {
  fished_at: string;
  species_name: string | null;
  count: number | null;
  max_length_cm: number | null;
  /** 작성자가 「채비 같이 보여주기」를 켠 경우만 */
  bait?: string | null;
  rig?: string | null;
};
export type PostDetail = PostSummary & {
  body: string;
  comments: PostComment[];
  photos: Photo[];
};

export type PostInput = {
  category: PostCategory;
  title: string;
  body: string;
  place_id: number | null;
  /** 낚시터 없이 지역만 고를 때 */
  region_id?: number | null;
  location_visibility: LocationVisibility;
  species_code: string | null;
  species_etc: string | null;
  photo_ids: number[];
  /** 내 기록 공유 (인증 완료면 「인증 조황」 배지) */
  journal_id?: number | null;
  /** 기록 공유 글에 미끼·채비 함께 보여주기 (기본 true) */
  show_tackle?: boolean;
};

/** 내 글 고치기 (보낸 칸만 바뀜) */
export type PostEdit = {
  category?: PostCategory;
  title?: string;
  body?: string;
  location_visibility?: LocationVisibility;
};

/** 낚시터별 최근 이용자 조황 (낚시터 이름까지 공개한 조황 글만, 예보 아님) */
export type CatchSummary = {
  place_id: number;
  posts: number;
  species: string[];
  best_cm: number | null;
  last_at: string;
};

export type BlockedUser = { user_id: number; nickname: string; created_at: string };

export type ReportResult = { status: 'received' | 'already_reported'; hidden: boolean };

// --- 회원 ---
export type Agreements = { over_14: boolean; terms: boolean; privacy: boolean };
export type Account = {
  id: number;
  nickname: string;
  email: string | null;
  /** 대표 로그인 수단 */
  provider: 'email' | 'google' | 'kakao';
  /** 연결된 로그인 수단 전부 */
  providers?: string[];
  created_at: string;
};
/** 로그인 없이 이 기기에서 쓴 기록을 계정으로 옮겼는지/옮길 수 있는지 */
export type MergeInfo = { done: boolean; available: boolean; journals: number; posts: number };
export type AuthResult = { status: 'ok'; token: string; expires_at: string; account: Account; merge: MergeInfo };
export type GoogleSignupNeeded = { status: 'signup_required'; email: string | null; name: string | null };
export type AuthConfig = { google: boolean; kakao?: boolean; email: boolean };
/** 처음 보는 소셜 계정 (닉네임·약관 동의 후 가입) */
export type SignupNeeded = {
  status: 'signup_required';
  provider: 'google' | 'kakao';
  email: string | null;
  name: string | null;
};

// --- 출조계획 (설계안 2026-11-09). 로그인한 본인 것만 ---
export type TripRole = 'main' | 'alternative';
export type TideEvent = { type: 'high' | 'low'; t: string; v: number | null; station_name: string; station_km: number | null };

export type TripStop = {
  id: number;
  /** YYYY-MM-DD */
  day: string;
  place: Place;
  role: TripRole;
  sort_order: number;
  /** HH:MM:SS */
  start_time: string | null;
  end_time: string | null;
  memo: string | null;
  journal_ids: number[];
};

/** 준비물. 담당자(assignee)는 공용 준비물을 챙길 사람 — 함께 가는 사람 중 한 명 */
export type ChecklistItem = {
  id: number;
  label: string;
  checked: boolean;
  assignee_user_id: number | null;
  assignee_nickname: string | null;
};

/** 함께 가는 사람. 만든 사람(owner)은 항상 joined */
export type MemberStatus = 'joined' | 'maybe' | 'declined';
export type TripMember = {
  user_id: number;
  nickname: string;
  role: 'owner' | 'member';
  status: MemberStatus;
  mine: boolean;
};
export type TripInvite = { code: string; expires_at: string };
export type TripInvitePreview = {
  trip_id: number;
  title: string;
  start_date: string;
  end_date: string;
  owner_nickname: string;
  /** 만든 사람 포함, 참여·미정 */
  member_count: number;
  /** 이미 만든 사람이거나 참여자 */
  already: boolean;
};

export type Trip = {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  region: string | null;
  species_code: string | null;
  species_name: string | null;
  species_etc: string | null;
  memo: string | null;
  stops: TripStop[];
  checklist: ChecklistItem[];
  created_at: string;
  updated_at: string;
  /** owner 만 계획·장소를 고칠 수 있다 */
  my_role: 'owner' | 'member';
  members: TripMember[];
};

export type TripListItem = {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  region: string | null;
  stop_count: number;
  checklist_done: number;
  checklist_total: number;
  journal_count: number;
  first_stop: TripStop | null;
  my_role: 'owner' | 'member';
  /** 만든 사람 포함, 참여·미정 */
  member_count: number;
};

export type TripStopInput = {
  day: string;
  place_id: number;
  role?: TripRole;
  start_time?: string | null;
  end_time?: string | null;
  memo?: string | null;
};

export type TripInput = {
  title?: string | null;
  start_date: string;
  end_date: string;
  region?: string | null;
  species_code?: string | null;
  species_etc?: string | null;
  memo?: string | null;
  stops?: TripStopInput[];
};

export type TripPatch = Partial<Omit<TripInput, 'stops'>>;
export type TripStopPatch = Partial<TripStopInput> & { sort_order?: number };

/** 장소별 그날 해황. available 예보 있음 · pending 예보 발표 전 · past 지난 날짜 · location_check 위치 확인 필요 */
export type StopOutlook = {
  stop_id: number;
  day: string;
  place_id: number;
  forecast_status: 'available' | 'pending' | 'past' | 'location_check' | 'location_review';
  wave_fc_max: ValueAt | null;
  wind_fc_max: ValueAt | null;
  air_temp_fc_min: ValueAt | null;
  air_temp_fc_max: ValueAt | null;
  pop_fc_max: ValueAt | null;
  /** 기상청 PTY 코드(1 비·2 비/눈·3 눈·4 소나기). 0(없음)은 서버가 뺀다 */
  precipitation_types: number[];
  warning_level: Warning['level'] | null;
  warning_types: string[];
  /** 특보는 「지금」 상태 — 오늘이 아니면 false (앱은 「그날 특보 발표 전」) */
  warning_is_current: boolean;
  tides: TideEvent[];
  warning_note?: string | null;
  /** 단기예보가 없는 날의 기상청 중기해상예보 (해역 범위, 참고) */
  mid_sea?: MidSea | null;
  /** 물때(몇 물) — 음력 달력 계산 (서해 7물때식, 남해·동해·제주 8물때식) */
  mulddae?: string | null;
  mulddae_style?: string | null;
  /** 일출·일몰 (KST HH:MM, 좌표로 계산) */
  sunrise?: string | null;
  sunset?: string | null;
  /** 가장 센 바람 시각의 풍향 (16방위, 바람이 불어오는 쪽. 예: 북서) */
  wind_dir_fc?: string | null;
};

export type TripOutlook = {
  trip_id: number;
  today: string;
  forecast_last_day: string | null;
  stops: StopOutlook[];
  data_status: DataStatus;
};

/** 그날 공식 바다낚시지수 (국립해양조사원 발표값 그대로, 홈 어종 탐색) */
export type IndexPlaceLink = { place_id: number; distance_km: number | null; official: boolean };
export type IndexPoint = {
  station_id: number;
  station_name: string;
  tide_phase: Record<string, string | null>;
  species: { species: string; grades: Record<string, string> }[];
  places: IndexPlaceLink[];
};
export type FishingIndexDay = {
  date: string;
  periods: string[];
  fetched_at: string | null;
  max_km: number;
  points: IndexPoint[];
  disclaimer: string;
};

/** 낚시터 근처 낚시점·낚시배 (카카오 로컬 반경 검색, 2026-11-18) */
export type NearbyShop = {
  name: string;
  kind: 'shop' | 'boat';
  category: string | null;
  phone: string | null;
  address: string;
  lat: number;
  lon: number;
  distance_m: number;
  kakao_url: string | null;
};
export type NearbyShops = {
  shops: NearbyShop[];
  boats: NearbyShop[];
  source: string;
  fetched_at: string;
  /** 검색하지 않은 이유 (좌표 없음·의심) */
  skipped: string | null;
};

/** 주변 편의시설 (카카오 로컬, 반경 2km 가까운 순 3곳씩, 2026-11-20) */
export type Amenity = { name: string; address: string; phone: string | null; lat: number; lon: number; distance_m: number; kakao_url: string | null };
export type Amenities = {
  stores: Amenity[];
  parking: Amenity[];
  toilets: Amenity[];
  radius_m: number;
  source: string;
  fetched_at: string;
  skipped: string | null;
};

/** 낚시터 실제 사진 (한국관광공사 TourAPI 매칭, 공공누리 제3유형 — 출처 표시·변경 금지) */
/** 카카오 장소 매칭 (도로명 주소·장소 링크). 매칭된 낚시터만 있음 */
export type PlaceKakao = { name: string; url: string; road_address: string; category: string; phone: string | null; moved: boolean; source: string };

export type PlacePhotos = { title: string; source: string; license: string; images: { url: string; thumb: string }[] };
export type PlacePhotoIndex = { source: string; license: string; thumbs: Record<string, string> };

/** 참고 포인트: 해양수산부 갯바위낚시포인트 (2022). 낚시 허용·접근 여부는 확인되지 않은 참고 위치 */
export type RockPoint = {
  id: number;
  name: string;
  area: string;
  admin: string;
  lat: number;
  lon: number;
  depth: string | null;
  bottom: string | null;
  tide: string | null;
  catches: { species: string; methods: string[] }[];
  /** 연안사고 위험구역 100m 안이면 그 구역 설명 */
  danger: string | null;
  /** 좌표 근처 주소 (카카오 좌표→주소). region 이면 동·리 이름만 */
  near_address?: string | null;
  near_address_kind?: 'address' | 'region' | null;
};
export type RockPoints = { source: string; excluded: string; notice: string; points: RockPoint[] };
