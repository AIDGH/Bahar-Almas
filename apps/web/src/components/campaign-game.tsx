'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  finishGame,
  getLeaderboard,
  getMe,
  logout,
  startGame as createGame,
} from '@/lib/api';
import type { GameHit, GameResult, GameSession, LeaderboardEntry, User } from '@/lib/types';
import { AuthDialog } from './auth-dialog';
import { GameCanvas } from './game-canvas';
import { formatScore, Leaderboard } from './leaderboard';

export function CampaignGame() {
  const [gameMusic, setGameMusic] = useState<HTMLAudioElement | null>(null);
  const [gameCountdownSfx, setGameCountdownSfx] =
    useState<HTMLAudioElement | null>(null);
  const [user, setUser] = useState<User | null>();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [session, setSession] = useState<GameSession>();
  const [result, setResult] = useState<GameResult>();
  const [showAuth, setShowAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refreshLeaderboard = useCallback(async () => {
    try {
      setLeaderboard(await getLeaderboard());
    } catch {
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    void getMe().then(setUser).catch(() => setUser(null));
    void getLeaderboard()
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]))
      .finally(() => setLeaderboardLoading(false));
  }, [refreshLeaderboard]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'read_bahar_almas_leaderboard',
            title: 'خواندن لیدربورد بازی بهار الماس',
            description:
              'Returns the current top ten Bahar Almas campaign players and their validated high scores.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: {
              readOnlyHint: true,
              untrustedContentHint: true,
            },
            execute: () => ({
              entries: leaderboard.slice(0, 10).map((entry) => ({
                rank: entry.rank,
                displayName: entry.displayName,
                score: entry.score,
              })),
            }),
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      return;
    }

    return () => lifecycle.abort();
  }, [leaderboard]);

  async function handleStart() {
    if (!user) {
      setShowAuth(true);
      return;
    }
    setBusy(true);
    setError('');
    setResult(undefined);
    gameMusic?.pause();
    gameCountdownSfx?.pause();
    const music = new Audio('/assets/ready-set-slice.mp3');
    const countdownSfx = new Audio('/assets/countdown-sizzle.mp3');
    music.preload = 'auto';
    countdownSfx.preload = 'auto';
    music.volume = 0;
    countdownSfx.volume = 0;
    setGameMusic(music);
    setGameCountdownSfx(countdownSfx);
    void music.play().catch(() => undefined);
    void countdownSfx.play().catch(() => undefined);
    try {
      setSession(await createGame());
    } catch (startError) {
      music.pause();
      countdownSfx.pause();
      setGameMusic(null);
      setGameCountdownSfx(null);
      setError(messageOf(startError));
    } finally {
      setBusy(false);
    }
  }

  const handleFinish = useCallback(
    async (hits: GameHit[], endedEarly = false) => {
      if (!session) return;
      try {
        const nextResult = await finishGame(session.id, hits, endedEarly);
        setResult(nextResult);
        setUser((current) =>
          current ? { ...current, bestScore: nextResult.bestScore } : current,
        );
        await refreshLeaderboard();
      } catch (finishError) {
        setError(messageOf(finishError));
      } finally {
        setSession(undefined);
      }
    },
    [refreshLeaderboard, session],
  );

  async function handleLogout() {
    await logout().catch(() => undefined);
    setUser(null);
    setResult(undefined);
  }

  return (
    <main className="campaign-page">
      <header className="site-header">
        <a className="brand" href="#game" aria-label="بازی بهار الماس">
          <Image src="/assets/bahar-logo.webp" alt="بهار الماس" width={360} height={212} priority />
          <span>بازی تردِ بهار</span>
        </a>
        <nav aria-label="دسترسی سریع">
          <a href="#how-to-play">روش بازی</a>
          <a href="#leaderboard">لیدربورد</a>
        </nav>
        {user ? (
          <div className="user-chip">
            <span>{user.displayName}</span>
            <b>{formatScore(user.bestScore)}</b>
            <button type="button" onClick={handleLogout}>خروج</button>
          </div>
        ) : (
          <button className="header-login" type="button" onClick={() => setShowAuth(true)}>
            ورود به بازی
          </button>
        )}
      </header>

      <section className="play-layout" id="game">
        <div className="game-card">
          {session ? (
            <GameCanvas
              session={session}
              music={gameMusic}
              countdownSfx={gameCountdownSfx}
              onFinish={handleFinish}
            />
          ) : (
            <div className="game-intro">
              <div className="sun-rays" />
              <Image className="oil-bottle" src="/assets/oil-bottle.webp" alt="روغن سرخ‌کردنی بهار الماس" width={620} height={1387} priority />
              <Image className="floating-food floating-potato" src="/assets/potato-full.webp" alt="" width={800} height={149} priority />
              <Image className="floating-food floating-chicken" src="/assets/chicken-full.webp" alt="" width={700} height={252} priority />
              <Image className="floating-food floating-samboose" src="/assets/samboose-full.webp" alt="" width={600} height={471} priority />
              <div className="intro-copy">
                <span className="campaign-label">مسابقه‌ی آنلاین بهار الماس</span>
                <h1>
                  تردها رو بزن،
                  <strong> رکوردتو بشکن!</strong>
                </h1>
                <p>فقط یک دقیقه وقت داری؛ سوخاری‌ها را با یک حرکت سریع نصف کن.</p>
                <div className="intro-stats">
                  <span><b>۱</b> دقیقه</span>
                  <i />
                  <span><b>۱۰</b> امتیاز پایه برای هر برش</span>
                </div>
                <button className="primary-button start-button" type="button" onClick={handleStart} disabled={busy || user === undefined}>
                  <span>{busy ? 'در حال آماده‌سازی…' : user ? 'شروع بازی' : 'ورود و شروع'}</span>
                  <b>←</b>
                </button>
                {error && <div className="game-error" role="alert">{error}</div>}
              </div>
              {result && (
                <div
                  className="result-backdrop"
                  onPointerDown={(event) => {
                    if (event.target === event.currentTarget) setResult(undefined);
                  }}
                >
                  <div className="result-panel" role="status">
                    <span>{result.isPersonalBest ? 'رکورد تازه!' : 'پایان بازی'}</span>
                    <strong>{formatScore(result.score)}</strong>
                    <p>رتبه‌ی فعلی تو: {new Intl.NumberFormat('fa-IR').format(result.rank)}</p>
                    <button type="button" onClick={handleStart}>دوباره بازی کن</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Leaderboard
          entries={leaderboard}
          currentUserId={user?.id}
          loading={leaderboardLoading}
        />
      </section>

      <section className="how-to-play" id="how-to-play">
        <div className="how-heading">
          <span>خیلی ساده‌ست</span>
          <h2>چطور رکورد بزنیم؟</h2>
        </div>
        <div className="steps-grid">
          <article>
            <i>۱</i>
            <span className="step-icon">⌁</span>
            <div><h3>وارد شو</h3><p>با شماره موبایل و کد یک‌بارمصرف حسابت را بساز.</p></div>
          </article>
          <article>
            <i>۲</i>
            <span className="step-icon slash-icon">╱</span>
            <div><h3>سوایپ کن</h3><p>انگشت یا نشانگر را سریع روی آیتم‌های سوخاری بکش.</p></div>
          </article>
          <article>
            <i>۳</i>
            <span className="step-icon">♛</span>
            <div><h3>برو بالاتر</h3><p>بهترین امتیازت در جدول رکوردها ثبت می‌شود.</p></div>
          </article>
        </div>
      </section>

      <footer>
        <Image src="/assets/bahar-logo.webp" alt="بهار الماس" width={360} height={212} />
        <p>یک بازی کوتاه و ترد از بهار الماس</p>
      </footer>

      <AuthDialog
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onAuthenticated={(authenticatedUser) => {
          setUser(authenticatedUser);
          setShowAuth(false);
        }}
      />
    </main>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'خطای پیش‌بینی‌نشده‌ای رخ داد';
}
