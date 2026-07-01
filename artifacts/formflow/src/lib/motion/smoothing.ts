import type { Landmark2D } from "./types";

export function ema(current: number, previous: number, alpha: number): number {
  return alpha * current + (1 - alpha) * previous;
}

export function smoothLandmark(cur: Landmark2D, prev: Landmark2D, alpha: number): Landmark2D {
  const conf = cur.visibility ?? 1;
  const a = conf > 0.6 ? alpha : alpha * 0.3;
  return {
    x: ema(cur.x, prev.x, a),
    y: ema(cur.y, prev.y, a),
    visibility: cur.visibility,
    confidence: cur.confidence,
  };
}

export function smoothLandmarks(
  current: Landmark2D[],
  previous: Landmark2D[],
  alpha = 0.7
): Landmark2D[] {
  if (!previous || previous.length === 0) return current;
  return current.map((lm, i) => {
    if (!previous[i]) return lm;
    return smoothLandmark(lm, previous[i], alpha);
  });
}

export function medianFilter(values: number[], windowSize = 5): number[] {
  const half = Math.floor(windowSize / 2);
  return values.map((_, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    const window = values.slice(start, end).sort((a, b) => a - b);
    return window[Math.floor(window.length / 2)];
  });
}

export function jitterReduction(
  current: Landmark2D,
  previous: Landmark2D,
  threshold = 0.005
): Landmark2D {
  const dx = Math.abs(current.x - previous.x);
  const dy = Math.abs(current.y - previous.y);
  if (dx < threshold && dy < threshold) {
    return { ...current, x: previous.x, y: previous.y };
  }
  return current;
}

export function jitterReduceLandmarks(
  current: Landmark2D[],
  previous: Landmark2D[],
  threshold = 0.005
): Landmark2D[] {
  if (!previous || previous.length === 0) return current;
  return current.map((lm, i) => {
    if (!previous[i]) return lm;
    return jitterReduction(lm, previous[i], threshold);
  });
}

export function confidenceAwareSmooth(
  current: number | undefined,
  previous: number | undefined,
  confidence: number,
  alpha = 0.6
): number | undefined {
  if (current == null) return previous;
  if (previous == null) return current;
  const effectiveAlpha = alpha * Math.max(0.1, confidence);
  return ema(current, previous, effectiveAlpha);
}

export function interpolateMissing(
  values: Array<number | undefined>,
): number[] {
  const filled = [...values] as Array<number | undefined>;
  for (let i = 0; i < filled.length; i++) {
    if (filled[i] == null) {
      const prevIdx = [...filled.slice(0, i)].reverse().findIndex(v => v != null);
      const nextIdx = filled.slice(i).findIndex(v => v != null);
      const prevVal = prevIdx >= 0 ? filled[i - 1 - prevIdx] : undefined;
      const nextVal = nextIdx >= 0 ? filled[i + nextIdx] : undefined;
      if (prevVal != null && nextVal != null) {
        const t = nextIdx / (nextIdx + prevIdx + 1);
        filled[i] = prevVal + t * (nextVal - prevVal);
      } else if (prevVal != null) {
        filled[i] = prevVal;
      } else if (nextVal != null) {
        filled[i] = nextVal;
      } else {
        filled[i] = 0;
      }
    }
  }
  return filled as number[];
}

export function smoothAngles(
  angles: Array<number | undefined>,
  windowSize = 5
): number[] {
  const defined = angles.map(a => a ?? 0);
  return medianFilter(defined, windowSize);
}

export function createLandmarkBuffer(size: number): Landmark2D[][] {
  return [];
}

export function rollingAverageLandmarks(
  buffer: Landmark2D[][],
  current: Landmark2D[],
  maxFrames = 3
): Landmark2D[] {
  buffer.push(current);
  if (buffer.length > maxFrames) buffer.shift();
  if (buffer.length === 0) return current;
  return current.map((_, i) => {
    const xs = buffer.map(f => f[i]?.x ?? 0);
    const ys = buffer.map(f => f[i]?.y ?? 0);
    return {
      x: xs.reduce((a, b) => a + b, 0) / xs.length,
      y: ys.reduce((a, b) => a + b, 0) / ys.length,
      visibility: current[i]?.visibility,
    };
  });
}
