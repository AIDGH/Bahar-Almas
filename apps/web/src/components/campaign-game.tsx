'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import {
  claimGame,
  finishGame,
  getLeaderboard,
  getMe,
  logout,
  prefetchProfile,
  startGame as createGame,
} from '@/lib/api';
import type {
  GameHit,
  GameResult,
  GameSession,
  LeaderboardEntry,
  User,
} from '@/lib/types';
import { AdminDialog } from './admin-dialog';
import { AuthDialog } from './auth-dialog';
import { GameCanvas } from './game-canvas';
import { formatScore, Leaderboard } from './leaderboard';
import { ProfileDialog } from './profile-dialog';

const PENDING_GAME_KEY = 'bahar-almas-pending-game';
const CRUNCH_ASSET_PATHS = [
  '/assets/kherech.webp',
  '/assets/khoroch.webp',
] as const;
const retainedCrunchImages: HTMLImageElement[] = [];
let crunchAssetPromise: Promise<void> | undefined;

type PendingGame = {
  sessionId: string;
  claimToken: string;
  result: GameResult;
};

export function CampaignGame() {
  const [gameMusic, setGameMusic] = useState<HTMLAudioElement | null>(null);
  const [gameCountdownSfx, setGameCountdownSfx] =
    useState<HTMLAudioElement | null>(null);
  const [user, setUser] = useState<User | null>();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<LeaderboardEntry | null>(
    null,
  );
  const [nextLeaderboardOffset, setNextLeaderboardOffset] = useState<
    number | null
  >(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardLoadingMore, setLeaderboardLoadingMore] = useState(false);
  const [session, setSession] = useState<GameSession>();
  const [result, setResult] = useState<GameResult>();
  const [pendingGame, setPendingGame] = useState<PendingGame>();
  const [showAuth, setShowAuth] = useState(false);
  const [authDefaultMode, setAuthDefaultMode] = useState<'login' | 'register'>(
    'login',
  );
  const [showProfile, setShowProfile] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [initialReferralCode, setInitialReferralCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const overlayOpen = Boolean(result || showAuth || showProfile || showAdmin);

  const refreshLeaderboard = useCallback(async () => {
    try {
      const page = await getLeaderboard();
      setLeaderboard(page.entries);
      setCurrentPlayer(page.currentPlayer);
      setNextLeaderboardOffset(page.nextOffset);
    } catch {
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    void getMe()
      .then((nextUser) => {
        setUser(nextUser);
        if (nextUser) void prefetchProfile().catch(() => undefined);
      })
      .catch(() => setUser(null));
    void getLeaderboard()
      .then((page) => {
        setLeaderboard(page.entries);
        setCurrentPlayer(page.currentPlayer);
        setNextLeaderboardOffset(page.nextOffset);
      })
      .catch(() => setLeaderboard([]))
      .finally(() => setLeaderboardLoading(false));

    const savedGame = window.localStorage.getItem(PENDING_GAME_KEY);
    if (savedGame) {
      try {
        const parsed = JSON.parse(savedGame) as PendingGame;
        if (
          parsed.sessionId &&
          parsed.claimToken &&
          parsed.result?.score >= 0
        ) {
          window.setTimeout(() => {
            setPendingGame(parsed);
            setResult(parsed.result);
          }, 0);
        }
      } catch {
        window.localStorage.removeItem(PENDING_GAME_KEY);
      }
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('utm_source') === 'referral') {
      const referralCode = params.get('utm_campaign')?.toUpperCase() ?? '';
      window.setTimeout(() => setInitialReferralCode(referralCode), 0);
    }

    void preloadCrunchAssets();
  }, [refreshLeaderboard]);

  useEffect(() => {
    if (!overlayOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const previousStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    document.documentElement.classList.add('has-modal');
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      document.documentElement.classList.remove('has-modal');
      body.style.position = previousStyles.position;
      body.style.top = previousStyles.top;
      body.style.left = previousStyles.left;
      body.style.right = previousStyles.right;
      body.style.width = previousStyles.width;
      body.style.overflow = previousStyles.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [overlayOpen]);

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

  async function loadMoreLeaderboard() {
    if (nextLeaderboardOffset === null || leaderboardLoadingMore) return;
    setLeaderboardLoadingMore(true);
    try {
      const page = await getLeaderboard(nextLeaderboardOffset);
      setLeaderboard((current) => {
        const knownIds = new Set(current.map((entry) => entry.userId));
        return [
          ...current,
          ...page.entries.filter((entry) => !knownIds.has(entry.userId)),
        ];
      });
      setCurrentPlayer(page.currentPlayer);
      setNextLeaderboardOffset(page.nextOffset);
    } catch {
      setNextLeaderboardOffset(null);
    } finally {
      setLeaderboardLoadingMore(false);
    }
  }

  function openAuth(mode: 'login' | 'register') {
    setAuthDefaultMode(mode);
    setShowAuth(true);
  }

  function openAuthFromResult() {
    setResult(undefined);
    openAuth('register');
  }

  const registerPendingGame = useCallback(
    async (game: PendingGame, authenticatedUser: User) => {
      try {
        const claimedResult = await claimGame(game.sessionId, game.claimToken);
        window.localStorage.removeItem(PENDING_GAME_KEY);
        setPendingGame(undefined);
        setResult(claimedResult);
        const refreshedUser = await getMe();
        setUser(
          refreshedUser ?? {
            ...authenticatedUser,
            bestScore: claimedResult.bestScore ?? authenticatedUser.bestScore,
          },
        );
        await refreshLeaderboard();
        void prefetchProfile().catch(() => undefined);
      } catch (claimError) {
        setError(
          `ورود انجام شد، اما ثبت رکورد ناموفق بود: ${messageOf(claimError)}`,
        );
      }
    },
    [refreshLeaderboard],
  );

  async function handleStart() {
    if (pendingGame) {
      setResult(pendingGame.result);
      if (user) {
        await registerPendingGame(pendingGame, user);
      } else {
        openAuth('register');
      }
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
      await preloadCrunchAssets();
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
        const nextResult = await finishGame(
          session.id,
          session.claimToken,
          hits,
          endedEarly,
        );
        const nextPendingGame = {
          sessionId: session.id,
          claimToken: session.claimToken,
          result: nextResult,
        };
        setPendingGame(nextPendingGame);
        setResult(nextResult);
        window.localStorage.setItem(
          PENDING_GAME_KEY,
          JSON.stringify(nextPendingGame),
        );
        if (user) {
          await registerPendingGame(nextPendingGame, user);
        }
      } catch (finishError) {
        setError(messageOf(finishError));
      } finally {
        setSession(undefined);
      }
    },
    [registerPendingGame, session, user],
  );

  async function handleLogout() {
    await logout().catch(() => undefined);
    setUser(null);
    setShowProfile(false);
    setShowAdmin(false);
    await refreshLeaderboard();
    setResult(undefined);
  }

  return (
    <>
      <main className="campaign-page">
        <header className="site-header">
          <a className="brand" href="#game" aria-label="بازی بهار الماس">
            <Image
              src="/assets/bahar-logo.webp"
              alt="بهار الماس"
              width={360}
              height={212}
              priority
            />
            <span>بازی تردِ بهار</span>
          </a>
          <nav aria-label="دسترسی سریع">
            <a href="#how-to-play">روش بازی</a>
            <a href="#leaderboard">لیدربورد</a>
          </nav>
          {user ? (
            <div className="user-chip">
              {user.role === 'ADMIN' && (
                <button
                  className="admin-trigger"
                  type="button"
                  onClick={() => setShowAdmin(true)}
                >
                  مدیریت
                </button>
              )}
              <button
                className="profile-trigger"
                type="button"
                aria-haspopup="dialog"
                aria-label="بازکردن پروفایل من"
                onClick={() => setShowProfile(true)}
              >
                <span className="profile-avatar" aria-hidden="true">
                  {user.displayName.trim().charAt(0) || 'ب'}
                </span>
                <span className="profile-trigger-copy">
                  <small>پروفایل من</small>
                  <strong>{user.displayName}</strong>
                </span>
                <span className="profile-chevron" aria-hidden="true">
                  ‹
                </span>
              </button>
              <button
                className="logout-button"
                type="button"
                onClick={handleLogout}
              >
                خروج
              </button>
            </div>
          ) : (
            <button
              className="header-login"
              type="button"
              onClick={() => openAuth('login')}
            >
              ورود / ثبت‌نام
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
                <Image
                  className="oil-bottle"
                  src="/assets/oil-bottle.webp"
                  alt="روغن سرخ‌کردنی بهار الماس"
                  width={620}
                  height={1387}
                  priority
                />
                <Image
                  className="floating-food floating-potato"
                  src="/assets/potato-full.webp"
                  alt=""
                  width={800}
                  height={149}
                  priority
                />
                <Image
                  className="floating-food floating-chicken"
                  src="/assets/chicken-full.webp"
                  alt=""
                  width={700}
                  height={252}
                  priority
                />
                <Image
                  className="floating-food floating-samboose"
                  src="/assets/samboose-full.webp"
                  alt=""
                  width={600}
                  height={471}
                  priority
                />
                <div className="intro-copy">
                  <span className="campaign-label">
                    مسابقه‌ی آنلاین بهار الماس
                  </span>
                  <h1>
                    تردها رو بزن،
                    <strong> رکوردتو بشکن!</strong>
                  </h1>
                  <p>
                    بدون ثبت‌نام بازی کن؛ بعد از پایان، رکوردت را با شماره
                    موبایل ذخیره کن.
                  </p>
                  <div className="intro-stats">
                    <span>
                      <b>۱</b> دقیقه
                    </span>
                    <i />
                    <span>
                      <b>۱۰</b> امتیاز پایه برای هر برش
                    </span>
                  </div>
                  <button
                    className="primary-button start-button"
                    type="button"
                    onClick={handleStart}
                    disabled={busy}
                  >
                    <span>
                      {busy
                        ? 'در حال آماده‌سازی…'
                        : pendingGame
                          ? 'ثبت رکورد قبلی'
                          : 'شروع بازی'}
                    </span>
                    <b>←</b>
                  </button>
                  {error && (
                    <div className="game-error" role="alert">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Leaderboard
            entries={leaderboard}
            currentPlayer={currentPlayer}
            loading={leaderboardLoading}
            loadingMore={leaderboardLoadingMore}
            hasMore={nextLeaderboardOffset !== null}
            onLoadMore={() => void loadMoreLeaderboard()}
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
              <div>
                <h3>بازی کن</h3>
                <p>بدون ثبت‌نام وارد بازی شو و بهترین امتیازت را بگیر.</p>
              </div>
            </article>
            <article>
              <i>۲</i>
              <span className="step-icon slash-icon">╱</span>
              <div>
                <h3>رکوردت را ثبت کن</h3>
                <p>بعد از بازی با شماره موبایل وارد شو یا حساب تازه بساز.</p>
              </div>
            </article>
            <article>
              <i>۳</i>
              <span className="step-icon">♛</span>
              <div>
                <h3>برو بالاتر</h3>
                <p>رتبه‌ات را ببین و کد معرف اختصاصی‌ات را برای بقیه بفرست.</p>
              </div>
            </article>
          </div>
        </section>

        <footer>
          <Image
            src="/assets/bahar-logo.webp"
            alt="بهار الماس"
            width={360}
            height={212}
          />
          <p>یک بازی کوتاه و ترد از بهار الماس</p>
        </footer>

        <AuthDialog
          key={`${showAuth}-${authDefaultMode}-${initialReferralCode}`}
          open={showAuth}
          defaultMode={authDefaultMode}
          initialReferralCode={initialReferralCode}
          onClose={() => setShowAuth(false)}
          onAuthenticated={async (authenticatedUser) => {
            setUser(authenticatedUser);
            setShowAuth(false);
            if (pendingGame) {
              await registerPendingGame(pendingGame, authenticatedUser);
            } else {
              await refreshLeaderboard();
              void prefetchProfile().catch(() => undefined);
            }
          }}
        />
        {user && showProfile && (
          <ProfileDialog
            key={user.id}
            open={showProfile}
            user={user}
            onClose={() => setShowProfile(false)}
            onUserUpdated={setUser}
          />
        )}
        {user?.role === 'ADMIN' && showAdmin && (
          <AdminDialog
            open={showAdmin}
            currentUser={user}
            onClose={() => setShowAdmin(false)}
            onCurrentUserUpdated={setUser}
          />
        )}
      </main>
      {result &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="result-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="نتیجه بازی"
            onClick={(event) => {
              if (event.target === event.currentTarget) setResult(undefined);
            }}
          >
            <div className="result-panel" role="status">
              <span>
                {result.claimed
                  ? result.isPersonalBest
                    ? 'رکورد تازه!'
                    : 'رکورد ثبت شد'
                  : 'امتیازت آماده ثبت است'}
              </span>
              <strong>{formatScore(result.score)}</strong>
              <p>
                {result.claimed && result.rank
                  ? `رتبه‌ی فعلی تو: ${new Intl.NumberFormat('fa-IR').format(result.rank)}`
                  : 'برای موندن این امتیازت، وارد شو یا یک حساب بساز.'}
              </p>
              {result.claimed ? (
                <button type="button" onClick={handleStart}>
                  دوباره بازی کن
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    user && pendingGame
                      ? void registerPendingGame(pendingGame, user)
                      : openAuthFromResult()
                  }
                >
                  {user ? 'ثبت رکورد' : 'ورود یا ثبت‌نام و ثبت رکورد'}
                </button>
              )}
              <small className="result-dismiss-hint">
                برای بستن، بیرون کارت بزن
              </small>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'خطای پیش‌بینی‌نشده‌ای رخ داد';
}

function preloadCrunchAssets(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (crunchAssetPromise) return crunchAssetPromise;

  crunchAssetPromise = Promise.all(
    CRUNCH_ASSET_PATHS.map(
      (src) =>
        new Promise<boolean>((resolve) => {
          const image = new window.Image();
          let settled = false;
          const timeout = window.setTimeout(() => finish(false), 6_000);

          function finish(loaded: boolean) {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            resolve(loaded);
          }

          function decodeAndFinish() {
            if (typeof image.decode !== 'function') {
              finish(true);
              return;
            }
            void image
              .decode()
              .then(() => finish(true))
              .catch(() => finish(false));
          }

          image.decoding = 'async';
          image.onload = decodeAndFinish;
          image.onerror = () => finish(false);
          image.src = src;
          retainedCrunchImages.push(image);
          if (image.complete && image.naturalWidth > 0) decodeAndFinish();
        }),
    ),
  ).then((results) => {
    if (results.some((loaded) => !loaded)) crunchAssetPromise = undefined;
  });

  return crunchAssetPromise;
}
