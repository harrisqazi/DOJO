import type { MotionSequence, MotionSegment, DisciplineType } from "./types";
import { findVelocityPeaks } from "./velocity";

function computeFrameMotion(seq: MotionSequence, idx: number): number {
  if (idx === 0 || !seq.frames[idx - 1]) return 0;
  const cur = seq.frames[idx].poseLandmarks;
  const prev = seq.frames[idx - 1].poseLandmarks;
  let motion = 0;
  for (let j = 0; j < Math.min(cur.length, prev.length); j++) {
    const dx = cur[j].x - prev[j].x;
    const dy = cur[j].y - prev[j].y;
    motion += Math.sqrt(dx * dx + dy * dy);
  }
  return motion / (cur.length || 1);
}

function computeWristMotionSeries(seq: MotionSequence): number[] {
  return seq.frames.map((f, i) => {
    if (i === 0) return 0;
    const prev = seq.frames[i - 1];
    const lWristCur = f.poseLandmarks[15];
    const rWristCur = f.poseLandmarks[16];
    const lWristPrev = prev.poseLandmarks[15];
    const rWristPrev = prev.poseLandmarks[16];
    let speed = 0;
    if (lWristCur && lWristPrev) {
      const dx = lWristCur.x - lWristPrev.x, dy = lWristCur.y - lWristPrev.y;
      speed = Math.max(speed, Math.sqrt(dx * dx + dy * dy));
    }
    if (rWristCur && rWristPrev) {
      const dx = rWristCur.x - rWristPrev.x, dy = rWristCur.y - rWristPrev.y;
      speed = Math.max(speed, Math.sqrt(dx * dx + dy * dy));
    }
    return speed;
  });
}

function computeHipMotionSeries(seq: MotionSequence): number[] {
  return seq.frames.map((f, i) => {
    if (i === 0) return 0;
    const prev = seq.frames[i - 1];
    const lHipCur = f.poseLandmarks[23], rHipCur = f.poseLandmarks[24];
    const lHipPrev = prev.poseLandmarks[23], rHipPrev = prev.poseLandmarks[24];
    if (!lHipCur || !rHipCur || !lHipPrev || !rHipPrev) return 0;
    const curMidX = (lHipCur.x + rHipCur.x) / 2;
    const prevMidX = (lHipPrev.x + rHipPrev.x) / 2;
    const curMidY = (lHipCur.y + rHipCur.y) / 2;
    const prevMidY = (lHipPrev.y + rHipPrev.y) / 2;
    return Math.sqrt((curMidX - prevMidX) ** 2 + (curMidY - prevMidY) ** 2);
  });
}

function isStill(motionSeries: number[], start: number, end: number, threshold = 0.004): boolean {
  const window = motionSeries.slice(start, end);
  return window.every(m => m < threshold);
}

function segmentGenericMotion(seq: MotionSequence): MotionSegment[] {
  const motionSeries = seq.frames.map((_, i) => computeFrameMotion(seq, i));
  const threshold = Math.max(...motionSeries) * 0.15;
  const segments: MotionSegment[] = [];
  let inMotion = false;
  let segStart = 0;

  for (let i = 0; i < motionSeries.length; i++) {
    const isMoving = motionSeries[i] > threshold;
    if (!inMotion && isMoving) {
      if (i > 0) {
        segments.push({
          label: segments.length === 0 ? "setup" : "recovery",
          startMs: seq.frames[segStart]?.timestampMs ?? 0,
          endMs: seq.frames[i - 1]?.timestampMs ?? 0,
          confidence: 0.7,
          primaryBodyParts: ["full_body"],
          metrics: {},
        });
      }
      segStart = i;
      inMotion = true;
    } else if (inMotion && !isMoving) {
      const label = segments.length === 0 ? "initiation" :
        segments.length === 1 ? "peak" : "transition";
      segments.push({
        label,
        startMs: seq.frames[segStart]?.timestampMs ?? 0,
        endMs: seq.frames[i - 1]?.timestampMs ?? 0,
        confidence: 0.75,
        primaryBodyParts: ["full_body"],
        metrics: {},
      });
      segStart = i;
      inMotion = false;
    }
  }

  if (segStart < seq.frames.length) {
    segments.push({
      label: inMotion ? "finish" : "settle",
      startMs: seq.frames[segStart]?.timestampMs ?? 0,
      endMs: seq.frames[seq.frames.length - 1]?.timestampMs ?? 0,
      confidence: 0.7,
      primaryBodyParts: ["full_body"],
      metrics: {},
    });
  }

  return segments;
}

function segmentTaiChi(seq: MotionSequence): MotionSegment[] {
  const frames = seq.frames;
  const n = frames.length;
  const wristSeries = computeWristMotionSeries(seq);
  const hipSeries = computeHipMotionSeries(seq);
  const peaks = findVelocityPeaks(wristSeries, Math.max(...wristSeries) * 0.4);

  const labels = ["inhale_open", "shift", "turn", "exhale_press", "settle"];
  const segments: MotionSegment[] = [];

  if (peaks.length === 0) return segmentGenericMotion(seq);

  let prev = 0;
  const boundaries = [...peaks, n - 1];
  for (let i = 0; i < Math.min(labels.length, boundaries.length); i++) {
    const endIdx = Math.min(boundaries[i], n - 1);
    segments.push({
      label: labels[i],
      startMs: frames[prev]?.timestampMs ?? 0,
      endMs: frames[endIdx]?.timestampMs ?? 0,
      confidence: 0.72,
      primaryBodyParts: i < 2 ? ["hands", "shoulders"] : ["hips", "feet"],
      metrics: {},
    });
    prev = endIdx + 1;
    if (prev >= n) break;
  }
  return segments;
}

function segmentMartialArts(seq: MotionSequence): MotionSegment[] {
  const wristSeries = computeWristMotionSeries(seq);
  const hipSeries = computeHipMotionSeries(seq);
  const n = seq.frames.length;
  const maxWrist = Math.max(...wristSeries);
  const wristPeaks = findVelocityPeaks(wristSeries, maxWrist * 0.5);
  const segments: MotionSegment[] = [];
  const frames = seq.frames;

  let prev = 0;
  const boundaries = [0, ...wristPeaks, n - 1].sort((a, b) => a - b);

  const phaseNames = ["guard", "chamber", "strike", "recovery"];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const label = phaseNames[Math.min(i, phaseNames.length - 1)];
    segments.push({
      label,
      startMs: frames[start]?.timestampMs ?? 0,
      endMs: frames[end]?.timestampMs ?? 0,
      confidence: 0.68,
      primaryBodyParts: label === "strike" ? ["wrists", "shoulders", "hips"] : ["legs", "feet"],
      metrics: {},
    });
  }
  return segments.length > 0 ? segments : segmentGenericMotion(seq);
}

function segmentGolf(seq: MotionSequence): MotionSegment[] {
  const hipSeries = computeHipMotionSeries(seq);
  const wristSeries = computeWristMotionSeries(seq);
  const n = seq.frames.length;
  const frames = seq.frames;

  const phases = ["address", "takeaway", "backswing", "transition", "downswing", "impact_zone", "follow_through", "finish"];
  const segSize = Math.floor(n / phases.length);
  return phases.map((label, i) => ({
    label,
    startMs: frames[Math.min(i * segSize, n - 1)]?.timestampMs ?? 0,
    endMs: frames[Math.min((i + 1) * segSize - 1, n - 1)]?.timestampMs ?? 0,
    confidence: 0.65,
    primaryBodyParts: i < 2 ? ["spine", "shoulders"] : i < 5 ? ["hips", "shoulders"] : ["follow_through"],
    metrics: {},
  }));
}

function segmentYogaPT(seq: MotionSequence): MotionSegment[] {
  const motionSeries = seq.frames.map((_, i) => computeFrameMotion(seq, i));
  const stillThreshold = Math.max(...motionSeries) * 0.1;
  const frames = seq.frames;
  const n = frames.length;

  let enterEnd = 0;
  let holdStart = 0, holdEnd = n - 1;
  let exitStart = n - 1;

  for (let i = 1; i < n; i++) {
    if (motionSeries[i] < stillThreshold) { enterEnd = i; break; }
  }
  holdStart = enterEnd;

  for (let i = n - 2; i > holdStart; i--) {
    if (motionSeries[i] < stillThreshold) { exitStart = i; break; }
  }
  holdEnd = exitStart;

  return [
    { label: "enter_pose", startMs: frames[0]?.timestampMs ?? 0, endMs: frames[Math.min(enterEnd, n - 1)]?.timestampMs ?? 0, confidence: 0.7, primaryBodyParts: ["full_body"], metrics: {} },
    { label: "hold", startMs: frames[holdStart]?.timestampMs ?? 0, endMs: frames[holdEnd]?.timestampMs ?? 0, confidence: 0.8, primaryBodyParts: ["full_body"], metrics: {} },
    { label: "exit_pose", startMs: frames[exitStart]?.timestampMs ?? 0, endMs: frames[n - 1]?.timestampMs ?? 0, confidence: 0.7, primaryBodyParts: ["full_body"], metrics: {} },
  ];
}

export function segmentMotion(seq: MotionSequence, discipline: DisciplineType | string): MotionSegment[] {
  if (seq.frames.length < 3) return [];

  switch (discipline) {
    case "tai_chi": return segmentTaiChi(seq);
    case "golf": return segmentGolf(seq);
    case "yoga":
    case "physical_therapy": return segmentYogaPT(seq);
    case "shaolin_kung_fu":
    case "boxing":
    case "general_martial_arts": return segmentMartialArts(seq);
    default: return segmentGenericMotion(seq);
  }
}
