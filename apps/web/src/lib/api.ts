import type {
  AdminUser,
  AdminUserGroup,
  AdminUsersPage,
  GameHit,
  GameResult,
  GameSession,
  LeaderboardPage,
  Profile,
  User,
} from './types';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getMe(): Promise<User | null> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (response.status === 401) return null;
  return unwrap<User>(response);
}

export async function requestOtp(input: {
  mode: 'login' | 'register';
  mobile: string;
  displayName?: string;
  referralCode?: string;
}) {
  return request<{
    mobile: string;
    expiresInSeconds: number;
    developmentCode?: string;
  }>(`${API_BASE}/auth/otp/request`, {
    method: 'POST',
    body: JSON.stringify(input),
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

export async function getLeaderboard(offset = 0, limit = 10) {
  return request<LeaderboardPage>(
    `${API_BASE}/leaderboard?limit=${limit}&offset=${offset}`,
  );
}

export async function startGame() {
  return request<GameSession>(`${API_BASE}/games/start`, { method: 'POST' });
}

export async function finishGame(
  sessionId: string,
  claimToken: string,
  hits: GameHit[],
  endedEarly = false,
) {
  return request<GameResult>(`${API_BASE}/games/${sessionId}/finish`, {
    method: 'POST',
    headers: { 'X-Game-Token': claimToken },
    body: JSON.stringify({ hits, endedEarly }),
  });
}

export async function claimGame(sessionId: string, claimToken: string) {
  return request<GameResult>(`${API_BASE}/games/${sessionId}/claim`, {
    method: 'POST',
    headers: { 'X-Game-Token': claimToken },
  });
}

export async function getProfile(offset = 0, limit = 50) {
  return request<Profile>(
    `${API_BASE}/profile?limit=${limit}&offset=${offset}`,
  );
}

export async function updateProfile(displayName: string) {
  return request<User>(`${API_BASE}/profile`, {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
}

export async function getAdminUsers(
  search = '',
  offset = 0,
  limit = 25,
  group: AdminUserGroup = 'users',
) {
  const params = new URLSearchParams({
    search,
    offset: String(offset),
    limit: String(limit),
    group,
  });
  return request<AdminUsersPage>(`${API_BASE}/admin/users?${params}`);
}

export async function updateAdminUser(
  userId: string,
  input: { displayName?: string; mobile?: string; isBanned?: boolean },
) {
  return request<AdminUser>(`${API_BASE}/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
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
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    message?: string | string[];
    retryAfterSeconds?: number;
  } | null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message[0]
      : payload?.message;
    throw new ApiError(
      message ?? 'ارتباط با سرور برقرار نشد',
      payload?.retryAfterSeconds,
    );
  }
  if (!payload || payload.data === undefined) {
    throw new Error('پاسخ سرور قابل خواندن نیست');
  }
  return payload.data;
}
