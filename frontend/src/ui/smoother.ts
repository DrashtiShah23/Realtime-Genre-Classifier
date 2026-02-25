export type Probs = Record<string, number>;

export function createEmaSmoother(alpha = 0.25) {
  let state: Probs | null = null;

  return {
    update(next: Probs): Probs {
      if (!state) {
        state = { ...next };
        return state;
      }
      for (const k of Object.keys(next)) {
        const prev = state[k] ?? 0;
        state[k] = alpha * next[k] + (1 - alpha) * prev;
      }
      // normalize to sum=1 (nice for display)
      const s = Object.values(state).reduce((a, b) => a + b, 0) || 1;
      for (const k of Object.keys(state)) state[k] /= s;
      return state;
    },
    reset() {
      state = null;
    }
  };
}

export function topLabel(probs: Probs) {
  let bestK = "";
  let bestV = -1;
  for (const [k, v] of Object.entries(probs)) {
    if (v > bestV) { bestV = v; bestK = k; }
  }
  return { label: bestK, value: bestV };
}

/**
 * Stable top-class selector:
 * - keeps current label until a challenger is higher by `margin`
 *   for `holdFrames` consecutive updates.
 */
export function createStableTop(opts?: { margin?: number; holdFrames?: number }) {
  const margin = opts?.margin ?? 0.08;       // 8% probability margin
  const holdFrames = opts?.holdFrames ?? 3;  // must win 3 updates in a row

  let current = "";
  let streak = 0;

  return {
    update(probs: Probs) {
      const { label: best, value: bestV } = topLabel(probs);

      if (!current) {
        current = best;
        streak = 0;
        return current;
      }

      const curV = probs[current] ?? 0;

      if (best === current) {
        streak = 0;
        return current;
      }

      // challenger must beat current by margin consistently
      if (bestV >= curV + margin) {
        streak += 1;
        if (streak >= holdFrames) {
          current = best;
          streak = 0;
        }
      } else {
        streak = 0;
      }

      return current;
    },
    reset() {
      current = "";
      streak = 0;
    }
  };
}
