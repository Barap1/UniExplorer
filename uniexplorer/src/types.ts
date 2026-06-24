export interface CelestialBody {
  name: string;
  baseUrl: string;
  attribution: string;
  maxZoom: number;
  emoji: string;
}

export interface Annotation {
  id: string;
  lat: number;
  lng: number;
  text: string;
  details?: string;
  author: string;
  celestialBody: string;
}

export interface LeaderboardItem {
  author: string;
  count: number;
}
