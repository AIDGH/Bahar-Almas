export type User = {
  id: string;
  mobile: string;
  displayName: string;
  referralCode: string;
  bestScore: number;
  totalGameScore: number;
  referralPoints: number;
  totalScore: number;
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
  claimToken: string;
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
  claimed: boolean;
  isPersonalBest?: boolean;
  bestScore?: number;
  rank?: number;
};

export type LeaderboardPage = {
  entries: LeaderboardEntry[];
  total: number;
  nextOffset: number | null;
  currentPlayer: LeaderboardEntry | null;
};

export type GameHistoryEntry = {
  id: string;
  score: number;
  playedAt?: string;
};

export type Profile = User & {
  games: GameHistoryEntry[];
  totalGames: number;
  nextOffset: number | null;
};
