export type User = {
  id: string;
  mobile: string;
  displayName: string;
  bestScore: number;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
};

export type GameTarget = {
  id: number;
  kind: 'POTATO' | 'CHICKEN' | 'SAMBOOSE';
  spawnAtMs: number;
  flightDurationMs: number;
  originX: number;
  drift: number;
  arcHeight: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  points: number;
};

export type GameSession = {
  id: string;
  startedAt: string;
  durationMs: number;
  targets: GameTarget[];
};

export type GameHit = {
  targetId: number;
  hitAtMs: number;
  swipeDistance: number;
  swipeDurationMs: number;
  gestureId: number;
};

export type GameResult = {
  score: number;
  validHitCount: number;
  rejectedHitCount: number;
  isPersonalBest: boolean;
  bestScore: number;
  rank: number;
};
