// 서버 응답 타입 (backend app/schemas 와 맞춘다)

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

export type TitleInfo = { name: string; min_points: number };

export type MyTitle = {
  total_points: number;
  current: TitleInfo;
  next: TitleInfo | null;
  points_to_next: number | null;
};
