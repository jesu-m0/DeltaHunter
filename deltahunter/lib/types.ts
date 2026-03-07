export interface ParsedLap {
  lap_time: number;
  lap_number: number;
  is_best: boolean;
  speed: number[];
  dist: number[];
  throttle: number[];
  brake: number[];
  gear: number[];
  steering: number[];
  coord_x: number[] | null;
  coord_y: number[] | null;
}

export interface ParsedSession {
  driver: string;
  car: string;
  track: string;
  best_index: number;
  laps: ParsedLap[];
}

export interface SectorData {
  id: number;
  name: string;
  start: number;
  end: number;
  delta: number;
  user_min_speed: number;
  ref_min_speed: number;
  user_trail_score: number;
  ref_trail_score: number;
  tip: string;
}

export interface ChartData {
  dist: number[];
  user_speed: number[];
  ref_speed: number[];
  user_throttle: number[];
  ref_throttle: number[];
  user_brake: number[];
  ref_brake: number[];
  user_gear: number[];
  ref_gear: number[];
  user_steering: number[];
  ref_steering: number[];
  delta_speed: number[];
  time_delta: number[];
  map_x: number[];
  map_y: number[];
}

export interface HdData {
  dist: number[];
  user_x: number[];
  user_y: number[];
  ref_x: number[];
  ref_y: number[];
  user_speed: number[];
  ref_speed: number[];
  user_brake: number[];
  ref_brake: number[];
  user_throttle: number[];
  ref_throttle: number[];
  user_steering: number[];
  ref_steering: number[];
}

export interface MetaData {
  user_driver: string;
  ref_driver: string;
  car: string;
  track: string;
  circuit_name: string | null;
  user_lap_time: number;
  ref_lap_time: number;
  total_delta: number;
}

export interface AnalysisResponse {
  meta: MetaData;
  chart: ChartData;
  hd: HdData;
  sectors: SectorData[];
}
