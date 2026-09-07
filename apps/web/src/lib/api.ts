import type {
  GameHit,
  GameResult,
  GameSession,
  LeaderboardEntry,
  User,
} from './types';

const API_BASE = '/api/v1';

export async function getMe(): Promise<User | null> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (response.status === 401) return null;
  return unwrap<User>(response);
}

export async function requestOtp(mobile: string, displayName: string) {
  return request<{
    mobile: string;
    expiresInSeconds: number;
    resendAfterSeconds: number;
    developmentCode?: string;
  }>(`${API_BASE}/auth/otp/request`, {
    method: 'POST',
    body: JSON.stringify({ mobile, displayName }),
  });
}

export async function verifyOtp(mobile: string, code: string) {
  return request<User>(`${API_BASE}/auth/otp/verify`, {
    method: 'POST',
    body: JSON.stringify({ mobile, code }),
  });
}

export async function logout() {
  return request<{ success: boolean }>(`${API_BASE}/auth/logout`, {
    method: 'POST',
  });
}

export async function getLeaderboard() {
  return request<LeaderboardEntry[]>(`${API_BASE}/leaderboard?limit=20`);
}

export async function startGame() {
  return request<GameSession>(`${API_BASE}/games/start`, { method: 'POST' });
}

export async function finishGame(
  sessionId: string,
  hits: GameHit[],
  endedEarly = false,
) {
  return request<GameResult>(`${API_BASE}/games/${sessionId}/finish`, {
    method: 'POST',
    body: JSON.stringify({ hits, endedEarly }),
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  return unwrap<T>(response);
}

async function unwrap<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | { data?: T; message?: string | string[] }
    | null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message[0]
      : payload?.message;
    throw new Error(message ?? 'ارتباط با سرور برقرار نشد');
  }
  if (!payload || payload.data === undefined) {
    throw new Error('پاسخ سرور قابل خواندن نیست');
  }
  return payload.data;
}
