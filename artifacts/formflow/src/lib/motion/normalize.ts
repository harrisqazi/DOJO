import type { Landmark2D, MotionSequence, MotionFrame, CalibrationProfile } from "./types";

export function getShoulderWidth(lms: Landmark2D[]): number {
  if (!lms[11] || !lms[12]) return 1;
  const dx = lms[12].x - lms[11].x;
  const dy = lms[12].y - lms[11].y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getHipWidth(lms: Landmark2D[]): number {
  if (!lms[23] || !lms[24]) return 1;
  const dx = lms[24].x - lms[23].x;
  const dy = lms[24].y - lms[23].y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getBodyHeight(lms: Landmark2D[]): number {
  const head = lms[0];
  const lAnkle = lms[27];
  const rAnkle = lms[28];
  if (!head) return 1;
  const ankleY = lAnkle && rAnkle ? (lAnkle.y + rAnkle.y) / 2 : lAnkle?.y ?? rAnkle?.y ?? 1;
  return Math.abs(ankleY - head.y) || 1;
}

export function getHipCenter(lms: Landmark2D[]): { x: number; y: number } {
  const lHip = lms[23] ?? { x: 0.5, y: 0.5 };
  const rHip = lms[24] ?? { x: 0.5, y: 0.5 };
  return { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
}

export function normalizeLandmarksByShoulderWidth(
  lms: Landmark2D[],
  targetWidth = 1
): Landmark2D[] {
  const sw = getShoulderWidth(lms);
  if (sw < 0.001) return lms;
  const scale = targetWidth / sw;
  return lms.map(l => ({ ...l, x: l.x * scale, y: l.y * scale }));
}

export function normalizeLandmarksByHipCenter(lms: Landmark2D[]): Landmark2D[] {
  const hip = getHipCenter(lms);
  return lms.map(l => ({ ...l, x: l.x - hip.x, y: l.y - hip.y }));
}

export function normalizeLandmarksByBodyHeight(lms: Landmark2D[]): Landmark2D[] {
  const h = getBodyHeight(lms);
  return lms.map(l => ({ ...l, x: l.x / h, y: l.y / h }));
}

export function mirrorLandmarks(lms: Landmark2D[]): Landmark2D[] {
  return lms.map(l => ({ ...l, x: 1 - l.x }));
}

export function normalizeForComparison(
  lms: Landmark2D[],
  calibration?: CalibrationProfile
): Landmark2D[] {
  let normalized = normalizeLandmarksByHipCenter(lms);
  const sw = calibration?.bodyScale?.shoulderWidth ?? getShoulderWidth(lms);
  if (sw > 0.001) {
    const scale = 1 / sw;
    normalized = normalized.map(l => ({ ...l, x: l.x * scale, y: l.y * scale }));
  }
  return normalized;
}

export function resampleTimeline<T extends { timestampMs: number }>(
  frames: T[],
  targetCount: number
): T[] {
  if (frames.length === 0) return [];
  if (frames.length === targetCount) return frames;
  if (frames.length === 1) return Array(targetCount).fill(frames[0]);

  const result: T[] = [];
  const step = (frames.length - 1) / (targetCount - 1);
  for (let i = 0; i < targetCount; i++) {
    const floatIdx = i * step;
    const floorIdx = Math.floor(floatIdx);
    const ceilIdx = Math.min(frames.length - 1, floorIdx + 1);
    const t = floatIdx - floorIdx;
    if (t === 0 || floorIdx === ceilIdx) {
      result.push(frames[floorIdx]);
    } else {
      result.push(frames[floorIdx]);
    }
  }
  return result;
}

export function trimToActiveMotion(
  frames: MotionFrame[],
  motionThreshold = 0.003,
  minDurationMs = 500
): MotionFrame[] {
  if (frames.length < 2) return frames;

  let startIdx = 0;
  let endIdx = frames.length - 1;

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1].poseLandmarks;
    const cur = frames[i].poseLandmarks;
    let motion = 0;
    for (let j = 0; j < Math.min(prev.length, cur.length); j++) {
      const dx = cur[j].x - prev[j].x;
      const dy = cur[j].y - prev[j].y;
      motion += Math.sqrt(dx * dx + dy * dy);
    }
    motion /= prev.length || 1;
    if (motion > motionThreshold) { startIdx = Math.max(0, i - 3); break; }
  }

  for (let i = frames.length - 2; i >= startIdx; i--) {
    const prev = frames[i].poseLandmarks;
    const cur = frames[i + 1].poseLandmarks;
    let motion = 0;
    for (let j = 0; j < Math.min(prev.length, cur.length); j++) {
      const dx = cur[j].x - prev[j].x;
      const dy = cur[j].y - prev[j].y;
      motion += Math.sqrt(dx * dx + dy * dy);
    }
    motion /= prev.length || 1;
    if (motion > motionThreshold) { endIdx = Math.min(frames.length - 1, i + 3); break; }
  }

  const trimmed = frames.slice(startIdx, endIdx + 1);
  const duration = trimmed.length > 0 ? trimmed[trimmed.length - 1].timestampMs - trimmed[0].timestampMs : 0;
  if (duration < minDurationMs) return frames;
  return trimmed;
}

export function normalizeSequenceForFingerprint(sequence: MotionSequence): MotionSequence {
  const trimmedFrames = trimToActiveMotion(sequence.frames);
  const startMs = trimmedFrames[0]?.timestampMs ?? 0;
  const normalizedFrames = trimmedFrames.map((f, i) => ({
    ...f,
    frameIndex: i,
    timestampMs: f.timestampMs - startMs,
    poseLandmarks: normalizeForComparison(f.poseLandmarks),
  }));
  return { ...sequence, frames: normalizedFrames };
}
