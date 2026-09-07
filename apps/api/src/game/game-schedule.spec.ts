import {
  applyComboMultipliers,
  GAME_DURATION_MS,
  generateSchedule,
  validateHits,
} from './game-schedule';

describe('game schedule', () => {
  it('is deterministic and stays inside the game duration', () => {
    const first = generateSchedule(12345);
    const second = generateSchedule(12345);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(70);
    expect(first.every((target) => target.spawnAtMs < GAME_DURATION_MS)).toBe(
      true,
    );
    expect(first.some((target) => target.kind === 'SAMBOOSE')).toBe(true);
  });

  it('gets faster and denser through the one-minute version four game', () => {
    const schedule = generateSchedule(12345, 4);
    const firstFlights = schedule.slice(0, 10);
    const lastFlights = schedule.slice(-10);
    const earlyAverage = average(
      firstFlights.map((target) => target.flightDurationMs),
    );
    const lateAverage = average(
      lastFlights.map((target) => target.flightDurationMs),
    );
    const earlyIntervals = firstFlights
      .slice(1)
      .map((target, index) => target.spawnAtMs - firstFlights[index].spawnAtMs);
    const lateIntervals = lastFlights
      .slice(1)
      .map((target, index) => target.spawnAtMs - lastFlights[index].spawnAtMs);

    expect(lateAverage).toBeLessThan(earlyAverage);
    expect(average(lateIntervals)).toBeLessThan(average(earlyIntervals));
    expect(
      schedule.every(
        (target) => target.arcHeight >= 0.62 && target.arcHeight <= 0.7,
      ),
    ).toBe(true);
  });

  it('starts faster and favors steeper diagonal throws in version five', () => {
    const versionFour = generateSchedule(12345, 4);
    const versionFive = generateSchedule(12345, 5);
    const versionFourOpeningSpeed = average(
      versionFour.slice(0, 12).map((target) => target.flightDurationMs),
    );
    const versionFiveOpeningSpeed = average(
      versionFive.slice(0, 12).map((target) => target.flightDurationMs),
    );
    const diagonalShare =
      versionFive.filter((target) => Math.abs(target.drift) >= 0.1).length /
      versionFive.length;

    expect(versionFiveOpeningSpeed).toBeLessThan(versionFourOpeningSpeed);
    expect(diagonalShare).toBeGreaterThan(0.7);
  });

  it('creates occasional three and four item bursts in version six', () => {
    const schedule = generateSchedule(12345, 6);
    let largestBurst = 1;
    let currentBurst = 1;

    for (let index = 1; index < schedule.length; index += 1) {
      if (schedule[index].spawnAtMs - schedule[index - 1].spawnAtMs <= 125) {
        currentBurst += 1;
        largestBurst = Math.max(largestBurst, currentBurst);
      } else {
        currentBurst = 1;
      }
    }

    expect(largestBurst).toBeGreaterThanOrEqual(4);
  });

  it('adds recovery gaps after large bursts in version seven', () => {
    const bursts = burstSizes(generateSchedule(12345, 7));

    expect(bursts.some((size) => size >= 3)).toBe(true);
    bursts.forEach((size, index) => {
      if (size < 3) return;
      expect(bursts[index + 1]).toBe(1);
      expect(bursts[index + 2]).toBe(1);
    });
  });

  it('keeps version one sessions compatible with the original two items', () => {
    const originalSchedule = generateSchedule(12345, 1);

    expect(originalSchedule.every((target) => target.kind !== 'SAMBOOSE')).toBe(
      true,
    );
  });

  it('keeps the slower middle-height flight values for version three', () => {
    const schedule = generateSchedule(12345, 3);

    expect(
      schedule.every(
        (target) =>
          target.flightDurationMs >= 2_700 &&
          target.flightDurationMs <= 3_200 &&
          target.arcHeight >= 0.64 &&
          target.arcHeight <= 0.72,
      ),
    ).toBe(true);
  });

  it('keeps version two physics values compatible', () => {
    const schedule = generateSchedule(12345, 2);

    expect(
      schedule.every(
        (target) =>
          target.flightDurationMs >= 1_550 &&
          target.flightDurationMs <= 2_070 &&
          target.arcHeight >= 1.04 &&
          target.arcHeight <= 1.22,
      ),
    ).toBe(true);
  });

  it('accepts each plausible target hit only once', () => {
    const schedule = generateSchedule(99);
    const target = schedule[0];
    const validHit = {
      targetId: target.id,
      hitAtMs: target.spawnAtMs + 400,
      swipeDistance: 54,
      swipeDurationMs: 180,
    };

    expect(validateHits(schedule, [validHit, validHit])).toHaveLength(1);
  });

  it('rejects unknown, impossible, and out-of-window hits', () => {
    const schedule = generateSchedule(77);
    const target = schedule[0];
    const result = validateHits(schedule, [
      {
        targetId: 99999,
        hitAtMs: 1_000,
        swipeDistance: 40,
        swipeDurationMs: 120,
      },
      {
        targetId: target.id,
        hitAtMs: target.spawnAtMs + 200,
        swipeDistance: 2,
        swipeDurationMs: 120,
      },
      {
        targetId: target.id,
        hitAtMs: target.spawnAtMs + target.flightDurationMs + 500,
        swipeDistance: 40,
        swipeDurationMs: 120,
      },
    ]);

    expect(result).toEqual([]);
  });

  it('scores three-hit and four-hit swipe combos at 1.5x and 2x', () => {
    const baseHit = {
      swipeDistance: 54,
      swipeDurationMs: 90,
      points: 10,
      gestureId: 1,
    };
    const threeHitCombo = applyComboMultipliers([
      { ...baseHit, targetId: 1, hitAtMs: 1_000 },
      { ...baseHit, targetId: 2, hitAtMs: 1_090 },
      { ...baseHit, targetId: 3, hitAtMs: 1_180 },
    ]);
    const fourHitCombo = applyComboMultipliers([
      { ...baseHit, targetId: 1, hitAtMs: 1_000 },
      { ...baseHit, targetId: 2, hitAtMs: 1_080 },
      { ...baseHit, targetId: 3, hitAtMs: 1_160 },
      { ...baseHit, targetId: 4, hitAtMs: 1_240 },
    ]);

    expect(threeHitCombo.map((hit) => hit.points)).toEqual([15, 15, 15]);
    expect(fourHitCombo.map((hit) => hit.points)).toEqual([20, 20, 20, 20]);
  });
});

function burstSizes(schedule: ReturnType<typeof generateSchedule>): number[] {
  const sizes: number[] = [];
  let currentSize = 1;
  for (let index = 1; index < schedule.length; index += 1) {
    if (schedule[index].spawnAtMs - schedule[index - 1].spawnAtMs <= 125) {
      currentSize += 1;
    } else {
      sizes.push(currentSize);
      currentSize = 1;
    }
  }
  sizes.push(currentSize);
  return sizes;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
