import type {
  MotionSequence, MotionFingerprint, ScoringProfile, DisciplineType, NormalizedJointPath
} from "./types";
import { normalizeSequenceForFingerprint } from "./normalize";
import { segmentMotion } from "./segmentMotion";
import { getScoringProfile } from "./scoringProfiles";
import { smoothAngles } from "./smoothing";

function extractJointPath(seq: MotionSequence, joint: keyof import("./types").JointAngleMap): NormalizedJointPath {
  const n = seq.frames.length;
  const points = seq.frames.map((f, i) => ({
    t: n > 1 ? i / (n - 1) : 0,
    angle: (f.jointAngles[joint] ?? 0) as number,
    x: f.poseLandmarks[0]?.x ?? 0,
    y: f.poseLandmarks[0]?.y ?? 0,
  }));
  return { joint: joint as string, points };
}

function computeAngleRanges(seq: MotionSequence): Record<string, { min: number; max: number; mean: number }> {
  const joints = [
    "leftShoulder", "rightShoulder", "leftElbow", "rightElbow",
    "leftWrist", "rightWrist", "leftHip", "rightHip",
    "leftKnee", "rightKnee", "leftAnkle", "rightAnkle",
    "torsoLean", "spineAngle", "hipShoulderSeparation",
  ] as const;

  const ranges: Record<string, { min: number; max: number; mean: number }> = {};

  for (const joint of joints) {
    const values = seq.frames
      .map(f => f.jointAngles[joint])
      .filter((v): v is number => v != null);

    if (values.length === 0) continue;

    const smoothed = smoothAngles(values, 5);
    ranges[joint] = {
      min: Math.min(...smoothed),
      max: Math.max(...smoothed),
      mean: smoothed.reduce((a, b) => a + b, 0) / smoothed.length,
    };
  }

  return ranges;
}

function computeVelocityCurves(seq: MotionSequence): Record<string, number[]> {
  const curves: Record<string, number[]> = {};
  const joints = ["leftElbow", "rightElbow", "leftKnee", "rightKnee", "leftWrist", "rightWrist"] as const;

  for (const joint of joints) {
    curves[joint] = seq.frames.map(f => f.jointVelocities[joint] ?? 0);
  }

  curves["wristSpeed"] = seq.frames.map(f => f.jointVelocities.wristSpeed ?? 0);
  curves["hipSpeed"] = seq.frames.map(f => f.jointVelocities.hipSpeed ?? 0);
  return curves;
}

function computeAccelerationCurves(seq: MotionSequence): Record<string, number[]> {
  const curves: Record<string, number[]> = {};
  const joints = ["leftElbow", "rightElbow", "leftKnee", "rightKnee"] as const;

  for (const joint of joints) {
    curves[joint] = seq.frames.map(f => f.jointAccelerations[joint] ?? 0);
  }
  return curves;
}

function computeSmoothnessProfile(seq: MotionSequence): number[] {
  return seq.frames.map(f => f.biomechanics.smoothness);
}

function computeCenterOfMassPath(seq: MotionSequence): Array<{ x: number; y: number }> {
  return seq.frames.map(f => f.biomechanics.centerOfMassEstimate);
}

function computeStanceProfile(seq: MotionSequence) {
  const widths = seq.frames.map(f => f.biomechanics.stanceWidth);
  const depths = seq.frames.map(f => f.biomechanics.stanceDepth);
  const leftFoot = seq.frames.map(f => f.biomechanics.footDirection.left);
  const rightFoot = seq.frames.map(f => f.biomechanics.footDirection.right);
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  return { width: avg(widths), depth: avg(depths), leftFoot: avg(leftFoot), rightFoot: avg(rightFoot) };
}

function computeHandFingerProfile(seq: MotionSequence) {
  const leftOpen = seq.frames.map(f => f.biomechanics.handShape.leftOpen);
  const rightOpen = seq.frames.map(f => f.biomechanics.handShape.rightOpen);
  const symmetry = seq.frames.map(f => f.biomechanics.handSymmetry);
  return { leftOpen, rightOpen, symmetry };
}

function computeFootToeProfile(seq: MotionSequence) {
  const leftDir = seq.frames.map(f => f.jointAngles.leftFootDirection ?? 0);
  const rightDir = seq.frames.map(f => f.jointAngles.rightFootDirection ?? 0);
  return { leftDir, rightDir };
}

function computeConfidenceThresholds(profile: ScoringProfile): Record<string, number> {
  const thresholds: Record<string, number> = {};
  for (const region of profile.criticalBodyRegions) {
    thresholds[region] = 0.6;
  }
  for (const key of Object.keys(profile.metricWeights)) {
    thresholds[key] = profile.metricWeights[key] > 0.1 ? 0.65 : 0.5;
  }
  return thresholds;
}

export function createMotionFingerprint(
  sequence: MotionSequence,
  discipline?: DisciplineType
): MotionFingerprint {
  const disc = discipline ?? sequence.discipline;
  const profile = getScoringProfile(disc);

  const normalized = normalizeSequenceForFingerprint(sequence);
  const segments = segmentMotion(normalized, disc);

  const joints = [
    "leftShoulder", "rightShoulder", "leftElbow", "rightElbow",
    "leftWrist", "rightWrist", "leftHip", "rightHip",
    "leftKnee", "rightKnee", "leftAnkle", "rightAnkle",
    "torsoLean", "spineAngle",
  ] as const;

  const normalizedIdealJointPaths = joints.map(j => extractJointPath(normalized, j));

  const phaseLabels = segments.map(s => s.label);
  const phaseKeyframes: Record<string, number> = {};
  for (const seg of segments) {
    const frameIdx = normalized.frames.findIndex(f => f.timestampMs >= seg.startMs);
    if (frameIdx >= 0) phaseKeyframes[seg.label] = frameIdx;
  }

  return {
    discipline: disc,
    viewAngle: sequence.viewAngle,
    normalizedIdealJointPaths,
    idealJointAngleRanges: computeAngleRanges(normalized),
    velocityCurves: computeVelocityCurves(normalized),
    accelerationCurves: computeAccelerationCurves(normalized),
    smoothnessProfile: computeSmoothnessProfile(normalized),
    centerOfMassPath: computeCenterOfMassPath(normalized),
    stanceProfile: computeStanceProfile(normalized),
    handFingerProfile: computeHandFingerProfile(normalized),
    footToeProfile: computeFootToeProfile(normalized),
    phaseLabels,
    phaseKeyframes,
    commonMistakes: profile.commonMistakes,
    coachingCues: profile.phaseLabels.map(p => `Focus on your ${p} phase`),
    confidenceThresholds: computeConfidenceThresholds(profile),
    bodyPartImportanceWeights: profile.metricWeights,
    durationMs: sequence.durationMs,
    fps: sequence.fps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
