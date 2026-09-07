'use client';

import { PointerEvent, useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import type { GameHit, GameSession, GameTarget } from '@/lib/types';
import { formatScore } from './leaderboard';

type GameCanvasProps = {
  session: GameSession;
  music: HTMLAudioElement | null;
  countdownSfx: HTMLAudioElement | null;
  onFinish: (hits: GameHit[], endedEarly?: boolean) => Promise<void>;
};

type Point = { x: number; y: number; at: number };
type Particle = Point & { vx: number; vy: number; color: string; life: number };
type SpriteSet = { full: HTMLImageElement; left: HTMLImageElement; right: HTMLImageElement };
type SpriteMap = Record<GameTarget['kind'], SpriteSet>;
type CrunchSequence = { id: number; x: number; y: number; opensRight: boolean };
type GestureHit = { at: number; x: number; y: number; points: number };
type ComboEffect = { id: number; count: number; x: number; y: number };

const SLICE_ANIMATION_MS = 900;
const CRUNCH_COOLDOWN_MS = 900;
const CRUNCH_SEQUENCE_MS = 2_400;
const COMBO_WINDOW_MS = 300;
const COMBO_DISPLAY_MS = 1_250;
const MAX_PAUSE_MS = 30_000;
const START_COUNTDOWN_MS = 3_000;
const MUSIC_VOLUME = 0.38;

const SPRITE_PATHS: Record<GameTarget['kind'], Record<keyof SpriteSet, string>> = {
  POTATO: {
    full: '/assets/potato-full.webp',
    left: '/assets/potato-left.webp',
    right: '/assets/potato-right.webp',
  },
  CHICKEN: {
    full: '/assets/chicken-full.webp',
    left: '/assets/chicken-left.webp',
    right: '/assets/chicken-right.webp',
  },
  SAMBOOSE: {
    full: '/assets/samboose-full.webp',
    left: '/assets/samboose-left.webp',
    right: '/assets/samboose-right.webp',
  },
};

export function GameCanvas({
  session,
  music,
  countdownSfx,
  onFinish,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef<SpriteMap | null>(null);
  const hitsRef = useRef<GameHit[]>([]);
  const slicedRef = useRef(new Map<number, number>());
  const fallenRef = useRef(new Set<number>());
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<Point[]>([]);
  const pointerRef = useRef<Point | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const gestureIdRef = useRef(0);
  const gestureHitsRef = useRef<GestureHit[]>([]);
  const elapsedRef = useRef(0);
  const gameStartedRef = useRef(false);
  const finishingRef = useRef(false);
  const soundPoolRef = useRef<HTMLAudioElement[]>([]);
  const soundIndexRef = useRef(0);
  const pausedRef = useRef(false);
  const pauseStartedAtRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastCrunchAtRef = useRef(-CRUNCH_COOLDOWN_MS);
  const crunchTimeoutsRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const comboSequenceRef = useRef(0);
  const comboTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [score, setScore] = useState(0);
  const [remainingMs, setRemainingMs] = useState(session.durationMs);
  const [paused, setPaused] = useState(false);
  const [pauseBudgetMs, setPauseBudgetMs] = useState(MAX_PAUSE_MS);
  const [gameReady, setGameReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(3);
  const [crunches, setCrunches] = useState<CrunchSequence[]>([]);
  const [combo, setCombo] = useState<ComboEffect>();

  useEffect(() => {
    let active = true;
    const crunchTimeouts = crunchTimeoutsRef.current;
    if (countdownSfx) {
      countdownSfx.currentTime = 0;
      countdownSfx.volume = 0.5;
      if (countdownSfx.paused) {
        void countdownSfx.play().catch(() => undefined);
      }
    }
    Promise.all(
      (Object.keys(SPRITE_PATHS) as GameTarget['kind'][]).map(async (kind) => {
        const paths = SPRITE_PATHS[kind];
        const [full, left, right] = await Promise.all([
          loadImage(paths.full),
          loadImage(paths.left),
          loadImage(paths.right),
        ]);
        return [kind, { full, left, right }] as const;
      }),
    ).then((entries) => {
      if (active) spritesRef.current = Object.fromEntries(entries) as SpriteMap;
    });

    soundPoolRef.current = Array.from({ length: 4 }, () => {
      const audio = new Audio('/assets/crunch.mp3');
      audio.preload = 'auto';
      audio.volume = 0.48;
      return audio;
    });

    return () => {
      active = false;
      crunchTimeouts.forEach((timeout) => clearTimeout(timeout));
      crunchTimeouts.clear();
      clearTimeout(comboTimeoutRef.current);
      clearTimeout(countdownTimeoutRef.current);
      clearTimeout(pauseTimeoutRef.current);
      soundPoolRef.current.forEach((audio) => audio.pause());
      music?.pause();
      countdownSfx?.pause();
    };
  }, [countdownSfx, music]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let animationFrame = 0;
    const countdownStartedAt = performance.now();
    const gameplayStartedAt = countdownStartedAt + START_COUNTDOWN_MS;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const drawFrame = () => {
      if (finishingRef.current) return;
      const now = Date.now();
      const clockNow = performance.now();
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (!gameStartedRef.current) {
        const countdownRemaining = gameplayStartedAt - clockNow;
        context.clearRect(0, 0, width, height);
        drawAtmosphere(
          context,
          width,
          height,
          clockNow - countdownStartedAt,
        );
        if (countdownRemaining > 0) {
          const nextCountdown = Math.ceil(countdownRemaining / 1_000);
          setCountdown((current) =>
            current === nextCountdown ? current : nextCountdown,
          );
          animationFrame = requestAnimationFrame(drawFrame);
          return;
        }

        gameStartedRef.current = true;
        setGameReady(true);
        setCountdown(0);
        countdownSfx?.pause();
        if (music) {
          music.currentTime = 0;
          music.volume = MUSIC_VOLUME;
          if (music.paused) void music.play().catch(() => undefined);
        }
        countdownTimeoutRef.current = setTimeout(
          () => setCountdown(null),
          260,
        );
      }

      const currentPauseMs =
        pauseStartedAtRef.current === null
          ? 0
          : clockNow - pauseStartedAtRef.current;
      const elapsed =
        clockNow - gameplayStartedAt - totalPausedMsRef.current - currentPauseMs;
      elapsedRef.current = elapsed;
      if (pausedRef.current) {
        animationFrame = requestAnimationFrame(drawFrame);
        return;
      }
      context.clearRect(0, 0, width, height);

      drawAtmosphere(context, width, height, elapsed);
      const sprites = spritesRef.current;
      if (sprites) {
        for (const target of session.targets) {
          if (fallenRef.current.has(target.id)) continue;
          const slicedAt = slicedRef.current.get(target.id);
          const isAirborne =
            elapsed >= target.spawnAtMs &&
            elapsed <= target.spawnAtMs + target.flightDurationMs;
          if (!isAirborne && slicedAt === undefined) continue;

          const position = targetPosition(target, elapsed, width, height);
          if (slicedAt === undefined) {
            drawWholeTarget(context, sprites[target.kind].full, target, position);
          } else {
            const isVisible = drawSlicedTarget(
              context,
              sprites[target.kind],
              position,
              elapsed - slicedAt,
              height,
            );
            if (!isVisible) fallenRef.current.add(target.id);
          }
        }
      }

      particlesRef.current = drawParticles(context, particlesRef.current, now);
      trailRef.current = drawTrail(context, trailRef.current, now);

      const remaining = Math.max(0, session.durationMs - elapsed);
      setRemainingMs((current) =>
        Math.abs(current - remaining) > 180 || remaining === 0 ? remaining : current,
      );

      if (remaining === 0 && !finishingRef.current) {
        finishingRef.current = true;
        if (music) {
          music.volume = 0;
          music.pause();
        }
        void onFinish(hitsRef.current);
        observer.disconnect();
        return;
      }
      animationFrame = requestAnimationFrame(drawFrame);
    };

    animationFrame = requestAnimationFrame(drawFrame);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [countdownSfx, music, onFinish, session]);

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!gameStartedRef.current || pausedRef.current || finishingRef.current) return;
    if (activePointerIdRef.current !== null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPoint(event);
    activePointerIdRef.current = event.pointerId;
    gestureIdRef.current += 1;
    gestureHitsRef.current = [];
    pointerRef.current = point;
    trailRef.current = [point];
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (pausedRef.current || finishingRef.current) return;
    if (event.pointerId !== activePointerIdRef.current) return;
    const previous = pointerRef.current;
    if (!previous) return;
    const canvas = event.currentTarget;
    const next = pointerPoint(event);
    const segmentDistance = Math.hypot(next.x - previous.x, next.y - previous.y);
    if (segmentDistance < 3) return;

    const elapsed = elapsedRef.current;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const duration = Math.max(8, Math.min(1_500, next.at - previous.at));

    for (const target of session.targets) {
      if (slicedRef.current.has(target.id)) continue;
      if (elapsed < target.spawnAtMs) continue;
      if (elapsed > target.spawnAtMs + target.flightDurationMs) continue;
      const position = targetPosition(target, elapsed, width, height);
      const hitRadius = Math.max(28, position.width * 0.27);
      if (distanceToSegment(position.x, position.y, previous, next) > hitRadius) continue;

      slicedRef.current.set(target.id, elapsed);
      hitsRef.current.push({
        targetId: target.id,
        hitAtMs: Math.round(elapsed),
        swipeDistance: Math.round(Math.max(8, Math.min(2_000, segmentDistance))),
        swipeDurationMs: Math.round(duration),
        gestureId: gestureIdRef.current,
      });
      showCrunchSequence(target.id, position.x, position.y, width, elapsed);
      const comboBonus = registerComboHit(
        elapsed,
        position.x,
        position.y,
        target.points,
        width,
        height,
      );
      setScore((current) => current + target.points + comboBonus);
      addCrumbs(position.x, position.y, target.kind);
      playCrunch();
    }

    pointerRef.current = next;
    trailRef.current.push(next);
  }

  function endPointer(event?: PointerEvent<HTMLCanvasElement>) {
    if (
      event &&
      activePointerIdRef.current !== null &&
      event.pointerId !== activePointerIdRef.current
    ) {
      return;
    }
    activePointerIdRef.current = null;
    gestureHitsRef.current = [];
    pointerRef.current = null;
  }

  function addCrumbs(x: number, y: number, kind: GameTarget['kind']) {
    const colors =
      kind === 'POTATO'
        ? ['#ffd75a', '#f6a900', '#fff0ae']
        : kind === 'SAMBOOSE'
          ? ['#e9a12d', '#b96017', '#ffd180']
          : ['#f09822', '#d75a19', '#ffd078'];
    const now = Date.now();
    for (let index = 0; index < 12; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      particlesRef.current.push({
        x,
        y,
        at: now,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color: colors[index % colors.length],
        life: 420 + Math.random() * 260,
      });
    }
  }

  function playCrunch() {
    if (soundPoolRef.current.length === 0) return;
    const audio = soundPoolRef.current[soundIndexRef.current];
    soundIndexRef.current = (soundIndexRef.current + 1) % soundPoolRef.current.length;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }

  function showCrunchSequence(
    id: number,
    x: number,
    y: number,
    canvasWidth: number,
    elapsed: number,
  ) {
    if (elapsed - lastCrunchAtRef.current < CRUNCH_COOLDOWN_MS) return;
    lastCrunchAtRef.current = elapsed;
    const horizontalMargin = canvasWidth < 480 ? 145 : 180;
    const sequence = {
      id,
      x: Math.max(
        Math.min(horizontalMargin, canvasWidth / 2),
        Math.min(canvasWidth - horizontalMargin, x),
      ),
      y,
      opensRight: x < canvasWidth / 2,
    };
    setCrunches((current) => [...current, sequence].slice(-3));
    const timeout = setTimeout(() => {
      setCrunches((current) => current.filter((item) => item.id !== id));
      crunchTimeoutsRef.current.delete(timeout);
    }, CRUNCH_SEQUENCE_MS);
    crunchTimeoutsRef.current.add(timeout);
  }

  function registerComboHit(
    elapsed: number,
    x: number,
    y: number,
    points: number,
    canvasWidth: number,
    canvasHeight: number,
  ): number {
    const currentHits = gestureHitsRef.current;
    const recentHits =
      currentHits.length > 0 && elapsed - currentHits[0].at <= COMBO_WINDOW_MS
        ? [...currentHits]
        : [];
    const previousPoints = recentHits.reduce((sum, hit) => sum + hit.points, 0);
    const previousMultiplier = recentHits.length >= 3 ? recentHits.length / 2 : 1;
    const previousTotal = previousPoints * previousMultiplier;
    recentHits.push({ at: elapsed, x, y, points });
    gestureHitsRef.current = recentHits;
    if (recentHits.length < 3) return 0;

    comboSequenceRef.current += 1;
    const averageX =
      recentHits.reduce((sum, hit) => sum + hit.x, 0) / recentHits.length;
    const averageY =
      recentHits.reduce((sum, hit) => sum + hit.y, 0) / recentHits.length;
    const nextCombo = {
      id: comboSequenceRef.current,
      count: recentHits.length,
      x: Math.max(92, Math.min(canvasWidth - 92, averageX)),
      y: Math.max(145, Math.min(canvasHeight - 100, averageY - 55)),
    };
    setCombo(nextCombo);
    clearTimeout(comboTimeoutRef.current);
    comboTimeoutRef.current = setTimeout(() => {
      setCombo((current) =>
        current?.id === nextCombo.id ? undefined : current,
      );
    }, COMBO_DISPLAY_MS);
    const nextPoints = previousPoints + points;
    const nextTotal = nextPoints * (recentHits.length / 2);
    return Math.round(nextTotal - previousTotal - points);
  }

  function pauseGame() {
    if (
      !gameStartedRef.current ||
      finishingRef.current ||
      pausedRef.current ||
      pauseBudgetMs <= 0
    ) return;
    endPointer();
    pausedRef.current = true;
    pauseStartedAtRef.current = performance.now();
    setPaused(true);
    music?.pause();
    clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(resumeGame, pauseBudgetMs);
  }

  function resumeGame() {
    if (!pausedRef.current || pauseStartedAtRef.current === null) return;
    const pausedFor = Math.min(
      pauseBudgetMs,
      performance.now() - pauseStartedAtRef.current,
    );
    totalPausedMsRef.current += pausedFor;
    pauseStartedAtRef.current = null;
    pausedRef.current = false;
    clearTimeout(pauseTimeoutRef.current);
    setPauseBudgetMs((current) => Math.max(0, current - pausedFor));
    setPaused(false);
    if (music && music.currentTime < 61) {
      void music.play().catch(() => undefined);
    }
  }

  function endGameEarly() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    pausedRef.current = false;
    clearTimeout(pauseTimeoutRef.current);
    if (music) {
      music.volume = 0;
      music.pause();
    }
    void onFinish([...hitsRef.current], true);
  }

  return (
    <div className="game-shell">
      {gameReady && <div className="game-hud">
        <div className="hud-score" aria-label={`امتیاز ${formatScore(score)}`}>
          <NextImage src="/assets/oil-bottle.webp" alt="" width={620} height={1387} />
          <strong className="hud-number">{formatScore(score)}</strong>
        </div>
        <button
          className="pause-button"
          type="button"
          onClick={pauseGame}
          disabled={pauseBudgetMs <= 0}
          aria-label="توقف موقت بازی"
        >
          <span aria-hidden="true">Ⅱ</span>
        </button>
        <div className={`hud-timer ${remainingMs < 15_000 ? 'is-ending' : ''}`}>
          <span className="timer-icon" aria-hidden="true">◷</span>
          <strong className="hud-number">{formatTime(remainingMs)}</strong>
        </div>
      </div>}
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="محیط بازی؛ روی آیتم‌های سوخاری سوایپ کنید"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
      />
      {gameReady && <div className="game-tip">انگشتت را روی سوخاری‌ها بکش!</div>}
      {countdown !== null && (
        <div className={`game-countdown ${countdown === 0 ? 'is-zero' : ''}`} aria-live="assertive">
          <span key={countdown}>{countdown}</span>
        </div>
      )}
      {paused && (
        <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="بازی متوقف شده">
          <div className="pause-panel">
            <span>بازی متوقف شد</span>
            <strong>یه نفس تازه کن!</strong>
            <p>
              بازی و تایمر واقعاً متوقف شده‌اند؛ از زمان Pause این بازی{' '}
              {new Intl.NumberFormat('fa-IR').format(Math.ceil(pauseBudgetMs / 1_000))}
              {' '}ثانیه باقی مانده است.
            </p>
            <button className="resume-button" type="button" onClick={resumeGame}>ادامه بازی</button>
            <button className="end-game-button" type="button" onClick={endGameEarly}>پایان بازی</button>
          </div>
        </div>
      )}
      {crunches.map((crunch) => (
        <div
          key={crunch.id}
          className={`crunch-sequence ${crunch.opensRight ? 'opens-right' : 'opens-left'}`}
          style={{ left: crunch.x, top: crunch.y }}
          aria-hidden="true"
        >
          <NextImage
            className="crunch-word crunch-kherech"
            src="/assets/kherech.webp"
            alt=""
            width={360}
            height={273}
          />
          <NextImage
            className="crunch-word crunch-khoroch"
            src="/assets/khoroch.webp"
            alt=""
            width={360}
            height={272}
          />
        </div>
      ))}
      {combo && (
        <div
          key={combo.id}
          className="combo-pop"
          style={{ left: combo.x, top: combo.y }}
          role="status"
          aria-label={`Combo ${combo.count}x`}
        >
          <span>COMBO</span>
          <strong>{combo.count}X</strong>
        </div>
      )}
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

function pointerPoint(event: PointerEvent<HTMLCanvasElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top, at: Date.now() };
}

function targetPosition(target: GameTarget, elapsed: number, width: number, height: number) {
  const progress = Math.max(
    0,
    Math.min(1, (elapsed - target.spawnAtMs) / target.flightDurationMs),
  );
  const baseWidth = Math.max(96, Math.min(180, width * 0.26)) * target.scale;
  return {
    x: width * (target.originX + target.drift * progress),
    y: height * (1.08 - target.arcHeight * 4 * progress * (1 - progress)),
    angle: target.rotation + target.rotationSpeed * progress,
    width: baseWidth,
  };
}

function drawWholeTarget(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  target: GameTarget,
  position: ReturnType<typeof targetPosition>,
) {
  const height = position.width * (image.naturalHeight / image.naturalWidth);
  context.save();
  context.translate(position.x, position.y);
  context.rotate(position.angle);
  context.shadowColor = 'rgba(25, 5, 0, .34)';
  context.shadowBlur = 14;
  context.shadowOffsetY = 9;
  context.drawImage(image, -position.width / 2, -height / 2, position.width, height);
  context.restore();
}

function drawSlicedTarget(
  context: CanvasRenderingContext2D,
  sprites: SpriteSet,
  position: ReturnType<typeof targetPosition>,
  slicedFor: number,
  canvasHeight: number,
): boolean {
  const seconds = Math.max(0, slicedFor) / 1_000;
  const separationProgress = Math.min(1, slicedFor / SLICE_ANIMATION_MS);
  const fall = seconds * seconds * 105;
  const separation = 5 + separationProgress * 55;
  const halves = [
    { image: sprites.left, direction: -1 },
    { image: sprites.right, direction: 1 },
  ];
  const maximumHeight = Math.max(
    ...halves.map(
      (half) =>
        position.width *
        (half.image.naturalWidth / sprites.full.naturalWidth) *
        (half.image.naturalHeight / half.image.naturalWidth),
    ),
  );
  if (position.y + fall - maximumHeight / 2 > canvasHeight + 30) return false;

  for (const half of halves) {
    const width = position.width * (half.image.naturalWidth / sprites.full.naturalWidth);
    const height = width * (half.image.naturalHeight / half.image.naturalWidth);
    const alignedOffset = half.direction * (position.width - width) / 2;
    context.save();
    context.translate(position.x + alignedOffset + half.direction * separation, position.y + fall);
    context.rotate(position.angle + half.direction * seconds * 1.35);
    context.drawImage(half.image, -width / 2, -height / 2, width, height);
    context.restore();
  }
  return true;
}

function drawAtmosphere(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
) {
  const glow = context.createRadialGradient(
    width * 0.5,
    height * 0.72,
    20,
    width * 0.5,
    height * 0.72,
    height * 0.75,
  );
  glow.addColorStop(0, 'rgba(255, 198, 0, .13)');
  glow.addColorStop(1, 'rgba(255, 198, 0, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 0.32;
  context.fillStyle = '#ffca26';
  for (let index = 0; index < 16; index += 1) {
    const x = (index * 83 + elapsed * 0.012) % (width + 40) - 20;
    const y = (index * 137) % height;
    context.beginPath();
    context.arc(x, y, index % 3 === 0 ? 2 : 1, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawParticles(
  context: CanvasRenderingContext2D,
  particles: Particle[],
  now: number,
): Particle[] {
  const alive = particles.filter((particle) => now - particle.at < particle.life);
  for (const particle of alive) {
    const age = now - particle.at;
    const progress = age / particle.life;
    context.globalAlpha = 1 - progress;
    context.fillStyle = particle.color;
    context.fillRect(
      particle.x + particle.vx * age * 0.06,
      particle.y + particle.vy * age * 0.06 + age * age * 0.00012,
      5 + (1 - progress) * 4,
      3 + (1 - progress) * 3,
    );
  }
  context.globalAlpha = 1;
  return alive;
}

function drawTrail(
  context: CanvasRenderingContext2D,
  trail: Point[],
  now: number,
): Point[] {
  const recent = trail.filter((point) => now - point.at < 130);
  if (recent.length < 2) return recent;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.shadowColor = '#fff6a8';
  context.shadowBlur = 12;
  const gradient = context.createLinearGradient(
    recent[0].x,
    recent[0].y,
    recent[recent.length - 1].x,
    recent[recent.length - 1].y,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(1, '#fff8c9');
  context.strokeStyle = gradient;
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(recent[0].x, recent[0].y);
  recent.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.stroke();
  context.restore();
  return recent;
}

function distanceToSegment(
  pointX: number,
  pointY: number,
  start: Point,
  end: Point,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(pointX - start.x, pointY - start.y);
  const amount = Math.max(
    0,
    Math.min(1, ((pointX - start.x) * dx + (pointY - start.y) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(pointX - (start.x + amount * dx), pointY - (start.y + amount * dy));
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
