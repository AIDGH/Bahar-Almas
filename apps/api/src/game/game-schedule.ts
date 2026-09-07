export const GAME_DURATION_MS = 60_000;
export const POINTS_PER_HIT = 10;
export const VALIDATION_VERSION = 7;
export const COMBO_WINDOW_MS = 300;

const LEGACY_GAME_DURATION_MS = 180_000;

export type TargetKind = 'POTATO' | 'CHICKEN' | 'SAMBOOSE';

export type GameTarget = {
  id: number;
  kind: TargetKind;
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

export type SubmittedHit = {
  targetId: number;
  hitAtMs: number;
  swipeDistance: number;
  swipeDurationMs: number;
  gestureId?: number;
};

export type ValidatedHit = SubmittedHit & { points: number };

export function generateSchedule(
  seed: number,
  validationVersion = VALIDATION_VERSION,
): GameTarget[] {
  const random = mulberry32(seed);
  const targets: GameTarget[] = [];
  const durationMs =
    validationVersion >= 4 ? GAME_DURATION_MS : LEGACY_GAME_DURATION_MS;
  let spawnAtMs = 900;
  let id = 1;
  let burstCooldown = 0;

  while (spawnAtMs < durationMs - 900) {
    const progress = spawnAtMs / durationMs;
    const burstRoll = validationVersion >= 6 ? random() : 1;
    let burstSize: number;
    if (validationVersion >= 7 && burstCooldown > 0) {
      burstSize = 1;
      burstCooldown -= 1;
    } else if (validationVersion >= 7) {
      burstSize =
        burstRoll < 0.07 ? 4 : burstRoll < 0.17 ? 3 : burstRoll < 0.35 ? 2 : 1;
      burstCooldown = burstSize >= 3 ? 2 : burstSize === 2 ? 1 : 0;
    } else {
      burstSize =
        burstRoll < 0.12 ? 4 : burstRoll < 0.28 ? 3 : burstRoll < 0.5 ? 2 : 1;
    }
    let burstOffsetMs = 0;

    for (let burstIndex = 0; burstIndex < burstSize; burstIndex += 1) {
      if (burstIndex > 0) burstOffsetMs += 55 + random() * 65;
      const targetSpawnAtMs = spawnAtMs + burstOffsetMs;
      if (targetSpawnAtMs >= durationMs - 500) break;

      const itemRoll = random();
      const kind: TargetKind =
        validationVersion >= 2
          ? itemRoll < 0.34
            ? 'POTATO'
            : itemRoll < 0.68
              ? 'CHICKEN'
              : 'SAMBOOSE'
          : itemRoll > 0.52
            ? 'CHICKEN'
            : 'POTATO';
      const flightDurationRoll = random();
      const originRoll = random();
      const driftRoll = random();
      const arcHeightRoll = random();
      const rotationRoll = random();
      const rotationSpeedRoll = random();
      const scaleRoll = random();
      const originX = round(0.12 + originRoll * 0.76);
      const driftDirection = driftRoll < 0.5 ? -1 : 1;
      const rawDrift =
        validationVersion >= 5
          ? driftDirection * (0.12 + Math.abs(driftRoll - 0.5) * 0.56)
          : (driftRoll - 0.5) * (validationVersion >= 4 ? 0.68 : 0.42);
      const drift =
        validationVersion >= 4
          ? Math.max(0.06 - originX, Math.min(0.94 - originX, rawDrift))
          : rawDrift;
      targets.push({
        id,
        kind,
        spawnAtMs: Math.round(targetSpawnAtMs),
        flightDurationMs: Math.round(
          validationVersion >= 5
            ? 1_520 - progress * 320 + flightDurationRoll * 220
            : validationVersion >= 4
              ? 1_900 - progress * 450 + flightDurationRoll * 240
              : validationVersion >= 3
                ? 2_700 + flightDurationRoll * 500
                : 1_550 + flightDurationRoll * 520,
        ),
        originX,
        drift: round(drift),
        arcHeight:
          validationVersion >= 4
            ? round(0.62 + arcHeightRoll * 0.08)
            : validationVersion >= 3
              ? round(0.64 + arcHeightRoll * 0.08)
              : round(1.04 + arcHeightRoll * 0.18),
        rotation: round(
          (rotationRoll - 0.5) * (validationVersion >= 5 ? 1.7 : 1.2),
        ),
        rotationSpeed: round(
          (rotationSpeedRoll - 0.5) *
            (validationVersion >= 4 ? 4.2 : validationVersion >= 3 ? 3.2 : 5),
        ),
        scale: round(0.86 + scaleRoll * 0.25),
        points: POINTS_PER_HIT,
      });
      id += 1;
    }
    const baseInterval =
      validationVersion >= 4 ? 860 - progress * 390 : 920 - progress * 230;
    spawnAtMs += baseInterval + random() * (validationVersion >= 4 ? 170 : 260);
  }

  return targets;
}

export function validateHits(
  schedule: GameTarget[],
  submittedHits: SubmittedHit[],
): ValidatedHit[] {
  const targets = new Map(schedule.map((target) => [target.id, target]));
  const usedTargets = new Set<number>();
  const accepted: ValidatedHit[] = [];

  for (const hit of [...submittedHits].sort((a, b) => a.hitAtMs - b.hitAtMs)) {
    const target = targets.get(hit.targetId);
    if (!target || usedTargets.has(hit.targetId)) continue;
    if (
      !Number.isFinite(hit.swipeDistance) ||
      hit.swipeDistance < 8 ||
      hit.swipeDistance > 2_000
    )
      continue;
    if (hit.swipeDurationMs < 8 || hit.swipeDurationMs > 1_500) continue;
    if (hit.hitAtMs < target.spawnAtMs - 150) continue;
    if (hit.hitAtMs > target.spawnAtMs + target.flightDurationMs + 150)
      continue;

    const recentHits = accepted.filter(
      (acceptedHit) => hit.hitAtMs - acceptedHit.hitAtMs <= 120,
    ).length;
    if (recentHits >= 6) continue;

    usedTargets.add(hit.targetId);
    accepted.push({ ...hit, points: target.points });
  }

  return accepted;
}

export function applyComboMultipliers(
  validatedHits: ValidatedHit[],
): ValidatedHit[] {
  const scoredHits = validatedHits.map((hit) => ({ ...hit }));
  const gestures = new Map<number, number[]>();

  scoredHits.forEach((hit, index) => {
    if (hit.gestureId === undefined) return;
    const indices = gestures.get(hit.gestureId) ?? [];
    indices.push(index);
    gestures.set(hit.gestureId, indices);
  });

  for (const indices of gestures.values()) {
    let cluster: number[] = [];
    for (const index of indices) {
      const firstHit = cluster.length > 0 ? scoredHits[cluster[0]] : undefined;
      if (
        firstHit &&
        scoredHits[index].hitAtMs - firstHit.hitAtMs > COMBO_WINDOW_MS
      ) {
        applyComboToCluster(scoredHits, cluster);
        cluster = [];
      }
      cluster.push(index);
    }
    applyComboToCluster(scoredHits, cluster);
  }

  return scoredHits;
}

function applyComboToCluster(hits: ValidatedHit[], indices: number[]) {
  if (indices.length < 3) return;
  const multiplier = indices.length / 2;
  for (const index of indices) {
    hits[index].points = Math.round(hits[index].points * multiplier);
  }
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
