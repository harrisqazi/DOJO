import type {
  MotionSequence, MotionFingerprint, ComparisonResult, FeedbackItem,
  MistakeDetection, PhaseScore, MotionFrame, DisciplineType
} from "./types";
import { normalizeSequenceForFingerprint } from "./normalize";
import { segmentMotion } from "./segmentMotion";
import { getScoringProfile } from "./scoringProfiles";
import { shouldSuppressFeedbackForBodyPart, confidenceWarningMessage } from "./confidence";

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b);
  if (d > 180) d = 360 - d;
  return d;
}

function scoreAngleDiff(diff: number, tolerance: number): number {
  if (diff <= tolerance) return 100;
  if (diff > tolerance * 4) return 0;
  return clamp(100 * (1 - (diff - tolerance) / (tolerance * 3)));
}

function dtwDistance(a: number[], b: number[]): number {
  const n = a.length, m = b.length;
  if (n === 0 || m === 0) return 0;
  const INF = 1e9;
  const dp: number[][] = Array.from({ length: n }, () => Array(m).fill(INF));
  dp[0][0] = Math.abs(a[0] - b[0]);
  for (let i = 1; i < n; i++) dp[i][0] = dp[i - 1][0] + Math.abs(a[i] - b[0]);
  for (let j = 1; j < m; j++) dp[0][j] = dp[0][j - 1] + Math.abs(a[0] - b[j]);
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      dp[i][j] = Math.abs(a[i] - b[j]) + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[n - 1][m - 1] / Math.max(n, m);
}

function resampleArray(arr: number[], targetLen: number): number[] {
  if (arr.length === 0) return Array(targetLen).fill(0);
  if (arr.length === targetLen) return arr;
  const result: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const t = i / (targetLen - 1);
    const srcIdx = t * (arr.length - 1);
    const lo = Math.floor(srcIdx);
    const hi = Math.min(arr.length - 1, lo + 1);
    const frac = srcIdx - lo;
    result.push(arr[lo] + frac * (arr[hi] - arr[lo]));
  }
  return result;
}

function extractJointSeries(seq: MotionSequence, joint: string): number[] {
  return seq.frames.map(f => (f.jointAngles as Record<string, number | undefined>)[joint] ?? 0);
}

function compareJointPaths(
  userSeq: MotionSequence,
  fingerprint: MotionFingerprint,
  joints: string[],
  tolerance: number
): Record<string, { score: number; dtwDist: number }> {
  const results: Record<string, { score: number; dtwDist: number }> = {};
  const targetLen = Math.min(200, userSeq.frames.length);

  for (const joint of joints) {
    const userSeries = resampleArray(extractJointSeries(userSeq, joint), targetLen);
    const idealPath = fingerprint.normalizedIdealJointPaths.find(p => p.joint === joint);
    if (!idealPath || idealPath.points.length === 0) {
      results[joint] = { score: 50, dtwDist: 0 };
      continue;
    }
    const idealSeries = resampleArray(idealPath.points.map(p => p.angle), targetLen);
    const dtwDist = dtwDistance(userSeries, idealSeries);
    const maxDist = tolerance * targetLen;
    const score = clamp(100 * (1 - dtwDist / maxDist));
    results[joint] = { score, dtwDist };
  }

  return results;
}

function scoreUpperBody(jointScores: Record<string, { score: number; dtwDist: number }>): number {
  const joints = ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist", "torsoLean", "spineAngle"];
  const scores = joints.map(j => jointScores[j]?.score ?? 50);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function scoreLowerBody(jointScores: Record<string, { score: number; dtwDist: number }>): number {
  const joints = ["leftHip", "rightHip", "leftKnee", "rightKnee", "leftAnkle", "rightAnkle"];
  const scores = joints.map(j => jointScores[j]?.score ?? 50);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function scoreHandsWrists(
  userSeq: MotionSequence,
  fingerprint: MotionFingerprint
): number {
  const userLeftOpen = userSeq.frames.map(f => f.biomechanics.handShape.leftOpen);
  const userRightOpen = userSeq.frames.map(f => f.biomechanics.handShape.rightOpen);
  const idealLeft = fingerprint.handFingerProfile.leftOpen;
  const idealRight = fingerprint.handFingerProfile.rightOpen;

  if (idealLeft.length === 0 || idealRight.length === 0) return 60;

  const targetLen = Math.min(100, userSeq.frames.length);
  const lDtw = dtwDistance(resampleArray(userLeftOpen, targetLen), resampleArray(idealLeft, targetLen));
  const rDtw = dtwDistance(resampleArray(userRightOpen, targetLen), resampleArray(idealRight, targetLen));

  const score = clamp(100 * (1 - (lDtw + rDtw) / 2 / 0.3));
  return score;
}

function scoreFeetStance(
  userSeq: MotionSequence,
  fingerprint: MotionFingerprint
): number {
  const userLeftDir = userSeq.frames.map(f => f.jointAngles.leftFootDirection ?? 0);
  const userRightDir = userSeq.frames.map(f => f.jointAngles.rightFootDirection ?? 0);
  const idealLeft = fingerprint.footToeProfile.leftDir;
  const idealRight = fingerprint.footToeProfile.rightDir;

  if (idealLeft.length === 0) return 60;

  const targetLen = Math.min(100, userSeq.frames.length);
  const lDtw = dtwDistance(resampleArray(userLeftDir, targetLen), resampleArray(idealLeft, targetLen));
  const rDtw = dtwDistance(resampleArray(userRightDir, targetLen), resampleArray(idealRight, targetLen));
  return clamp(100 * (1 - (lDtw + rDtw) / 2 / 30));
}

function scoreBalance(userSeq: MotionSequence): number {
  const balances = userSeq.frames.map(f => f.biomechanics.balanceScore * 100);
  return balances.length ? balances.reduce((a, b) => a + b, 0) / balances.length : 50;
}

function scoreSmoothness(userSeq: MotionSequence, fingerprint: MotionFingerprint): number {
  const userSmooth = userSeq.frames.map(f => f.biomechanics.smoothness);
  const avgUser = userSmooth.length ? userSmooth.reduce((a, b) => a + b, 0) / userSmooth.length : 0.5;
  const idealSmooth = fingerprint.smoothnessProfile;
  const avgIdeal = idealSmooth.length ? idealSmooth.reduce((a, b) => a + b, 0) / idealSmooth.length : 0.5;
  return clamp(100 * (1 - Math.abs(avgUser - avgIdeal)));
}

function scoreSequencing(
  userSeq: MotionSequence,
  fingerprint: MotionFingerprint,
  discipline: DisciplineType
): number {
  const userSegments = segmentMotion(userSeq, discipline);
  if (userSegments.length === 0 || fingerprint.phaseLabels.length === 0) return 60;

  const userLabels = userSegments.map(s => s.label);
  const idealLabels = fingerprint.phaseLabels;

  let matched = 0;
  let uIdx = 0;
  for (const ideal of idealLabels) {
    while (uIdx < userLabels.length && userLabels[uIdx] !== ideal) uIdx++;
    if (uIdx < userLabels.length) { matched++; uIdx++; }
  }

  return clamp(100 * matched / idealLabels.length);
}

function computePhaseScores(
  userSeq: MotionSequence,
  fingerprint: MotionFingerprint,
  discipline: DisciplineType
): PhaseScore[] {
  const segments = segmentMotion(userSeq, discipline);
  return segments.map(seg => {
    const segFrames = userSeq.frames.filter(f => f.timestampMs >= seg.startMs && f.timestampMs <= seg.endMs);
    const avgBalance = segFrames.length
      ? segFrames.reduce((a, f) => a + f.biomechanics.balanceScore, 0) / segFrames.length : 0.5;
    const avgSmooth = segFrames.length
      ? segFrames.reduce((a, f) => a + f.biomechanics.smoothness, 0) / segFrames.length : 0.5;
    const score = clamp((avgBalance + avgSmooth) / 2 * 100);
    return {
      phase: seg.label,
      score,
      confidence: seg.confidence,
      feedback: score > 70 ? `Good ${seg.label} phase` : `Work on your ${seg.label} phase`,
    };
  });
}

function findWorstMismatches(
  userSeq: MotionSequence,
  fingerprint: MotionFingerprint
): ComparisonResult["worstMismatchMoments"] {
  const moments: ComparisonResult["worstMismatchMoments"] = [];
  const idealRanges = fingerprint.idealJointAngleRanges;
  const joints = Object.keys(idealRanges);

  for (const frame of userSeq.frames) {
    for (const joint of joints) {
      const ideal = idealRanges[joint];
      const userVal = (frame.jointAngles as Record<string, number | undefined>)[joint];
      if (userVal == null) continue;
      const deviation = userVal < ideal.min ? ideal.min - userVal : userVal > ideal.max ? userVal - ideal.max : 0;
      if (deviation > 25) {
        moments.push({
          timestampMs: frame.timestampMs,
          bodyPart: joint.replace(/([A-Z])/g, " $1").toLowerCase(),
          deviation,
          correctionCue: `Adjust your ${joint.replace(/([A-Z])/g, " $1").toLowerCase()} — ideal range is ${ideal.min.toFixed(0)}°–${ideal.max.toFixed(0)}°`,
        });
      }
    }
  }

  return moments
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, 5);
}

function generateFeedback(
  jointScores: Record<string, { score: number; dtwDist: number }>,
  userSeq: MotionSequence,
  fingerprint: MotionFingerprint,
  sequenceConf: number
): { good: FeedbackItem[]; improve: FeedbackItem[] } {
  const good: FeedbackItem[] = [];
  const improve: FeedbackItem[] = [];

  const bodyPartMap: Record<string, { label: string; type: "upper" | "lower" | "hands" | "feet" }> = {
    leftElbow: { label: "left elbow", type: "upper" },
    rightElbow: { label: "right elbow", type: "upper" },
    leftKnee: { label: "left knee", type: "lower" },
    rightKnee: { label: "right knee", type: "lower" },
    leftShoulder: { label: "left shoulder", type: "upper" },
    rightShoulder: { label: "right shoulder", type: "upper" },
    leftHip: { label: "left hip", type: "lower" },
    rightHip: { label: "right hip", type: "lower" },
    torsoLean: { label: "torso alignment", type: "upper" },
    spineAngle: { label: "spine angle", type: "upper" },
  };

  const avgSmooth = userSeq.frames.reduce((a, f) => a + f.biomechanics.smoothness, 0) / (userSeq.frames.length || 1);
  if (avgSmooth > 0.7) {
    good.push({ type: "good", title: "Smooth movement", bodyPart: "full body", message: "Your movement was fluid and controlled throughout.", severity: "low", confidence: sequenceConf });
  }

  const avgBalance = userSeq.frames.reduce((a, f) => a + f.biomechanics.balanceScore, 0) / (userSeq.frames.length || 1);
  if (avgBalance > 0.7) {
    good.push({ type: "good", title: "Good balance", bodyPart: "stance", message: "Your weight stayed well-centered throughout the movement.", severity: "low", confidence: sequenceConf });
  }

  for (const [joint, { score }] of Object.entries(jointScores)) {
    const info = bodyPartMap[joint];
    if (!info) continue;

    const lastFrame = userSeq.frames[userSeq.frames.length - 1];
    if (lastFrame && shouldSuppressFeedbackForBodyPart(info.label, lastFrame.poseLandmarks, lastFrame.leftHandLandmarks, lastFrame.rightHandLandmarks)) {
      improve.push({
        type: "confidence", title: "Tracking note", bodyPart: info.label,
        message: confidenceWarningMessage(info.label), severity: "low", confidence: 0.4,
      });
      continue;
    }

    if (score >= 75) {
      good.push({ type: "good", title: `Good ${info.label}`, bodyPart: info.label, message: `Your ${info.label} position was accurate.`, severity: "low", confidence: sequenceConf });
    } else if (score < 55) {
      const ideal = fingerprint.idealJointAngleRanges[joint];
      const msg = ideal
        ? `Your ${info.label} was outside the ideal range (${ideal.min.toFixed(0)}°–${ideal.max.toFixed(0)}°).`
        : `Your ${info.label} needs adjustment.`;
      improve.push({ type: "improve", title: `Adjust ${info.label}`, bodyPart: info.label, message: msg, severity: score < 35 ? "high" : "medium", confidence: sequenceConf });
    }
  }

  return { good: good.slice(0, 4), improve: improve.slice(0, 5) };
}

export interface CompareOptions {
  discipline?: DisciplineType;
  sequenceConfidence?: number;
}

export function compareMotion(
  userSequence: MotionSequence,
  instructorFingerprint: MotionFingerprint,
  options: CompareOptions = {}
): ComparisonResult {
  const discipline = options.discipline ?? userSequence.discipline;
  const profile = getScoringProfile(discipline);

  if (userSequence.frames.length < 5) {
    return {
      overallScore: 0, confidence: 0, upperBodyScore: 0, lowerBodyScore: 0,
      handsWristsScore: 0, feetStanceScore: 0, balanceCenterlineScore: 0,
      smoothnessScore: 0, sequencingScore: 0, phaseScores: [],
      goodFeedback: [], improvementFeedback: [],
      mistakeDetections: [], worstMismatchMoments: [], replayData: [],
      recommendedDrills: ["Practice with the instructor video looped until comfortable"],
    };
  }

  const normalizedUser = normalizeSequenceForFingerprint(userSequence);
  const seqConf = options.sequenceConfidence ?? 0.75;

  const joints = [
    "leftShoulder", "rightShoulder", "leftElbow", "rightElbow",
    "leftWrist", "rightWrist", "leftHip", "rightHip",
    "leftKnee", "rightKnee", "leftAnkle", "rightAnkle",
    "torsoLean", "spineAngle",
  ];

  const tolerance = 20;
  const jointScores = compareJointPaths(normalizedUser, instructorFingerprint, joints, tolerance);

  const upperBodyScore = clamp(scoreUpperBody(jointScores) * seqConf + (1 - seqConf) * 50);
  const lowerBodyScore = clamp(scoreLowerBody(jointScores) * seqConf + (1 - seqConf) * 50);
  const handsWristsScore = clamp(scoreHandsWrists(normalizedUser, instructorFingerprint) * seqConf + (1 - seqConf) * 50);
  const feetStanceScore = clamp(scoreFeetStance(normalizedUser, instructorFingerprint) * seqConf + (1 - seqConf) * 50);
  const balanceCenterlineScore = clamp(scoreBalance(normalizedUser));
  const smoothnessScore = clamp(scoreSmoothness(normalizedUser, instructorFingerprint));
  const sequencingScore = clamp(scoreSequencing(normalizedUser, instructorFingerprint, discipline));
  const phaseScores = computePhaseScores(normalizedUser, instructorFingerprint, discipline);

  const w = profile.scoreCategoryWeights;
  const overallScore = clamp(Math.round(
    upperBodyScore * w.upperBody +
    lowerBodyScore * w.lowerBody +
    handsWristsScore * w.handsWrists +
    feetStanceScore * w.feetStance +
    balanceCenterlineScore * w.balanceCenterline +
    smoothnessScore * w.smoothness +
    sequencingScore * w.sequencing
  ) / (w.upperBody + w.lowerBody + w.handsWrists + w.feetStance + w.balanceCenterline + w.smoothness + w.sequencing));

  const { good, improve } = generateFeedback(jointScores, normalizedUser, instructorFingerprint, seqConf);
  const worstMismatches = findWorstMismatches(normalizedUser, instructorFingerprint);

  const replayData = normalizedUser.frames.map(f => ({
    timestampMs: f.timestampMs,
    userFrame: f,
    instructorFrame: undefined,
  }));

  const drills: string[] = [];
  if (smoothnessScore < 60) drills.push("Slow-motion practice: perform at 25% speed focusing on smooth transitions");
  if (balanceCenterlineScore < 60) drills.push("Single-leg balance drill: hold stance for 30 seconds each side");
  if (upperBodyScore < 60) drills.push("Mirror drill: watch your upper body in a mirror while performing");
  if (lowerBodyScore < 60) drills.push("Stance drill: practice the footwork pattern separately");

  return {
    overallScore,
    confidence: seqConf,
    upperBodyScore,
    lowerBodyScore,
    handsWristsScore,
    feetStanceScore,
    balanceCenterlineScore,
    smoothnessScore,
    sequencingScore,
    phaseScores,
    goodFeedback: good,
    improvementFeedback: improve,
    mistakeDetections: [],
    worstMismatchMoments: worstMismatches,
    replayData,
    recommendedDrills: drills,
  };
}
