import type { Landmark2D, BiomechanicsMetrics, JointAngleMap } from "./types";

function lm(lms: Landmark2D[], i: number): Landmark2D {
  return lms[i] ?? { x: 0, y: 0, visibility: 0 };
}

function vis(lms: Landmark2D[], i: number): number {
  return lms[i]?.visibility ?? 0;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export interface DefenseMetrics {
  guardHeight: number;
  guardSymmetry: number;
  centerlineCoverage: number;
  blockPath: number;
  strikeExtension: number;
  hipShoulderCoordination: number;
  recoveryTime: number;
  balanceAfterStrike: number;
  footPivot: number;
  stanceDepth: number;
  stanceStability: number;
  shoulderProtection: number;
  returnToGuardQuality: number;
  overallDefenseScore: number;
  notes: string[];
}

export function computeGuardHeight(poseLandmarks: Landmark2D[]): number {
  if (vis(poseLandmarks, 15) < 0.3 || vis(poseLandmarks, 16) < 0.3) return 0.5;
  const lWrist = lm(poseLandmarks, 15);
  const rWrist = lm(poseLandmarks, 16);
  const lShoulder = lm(poseLandmarks, 11);
  const rShoulder = lm(poseLandmarks, 12);

  const lHeight = Math.max(0, lShoulder.y - lWrist.y);
  const rHeight = Math.max(0, rShoulder.y - rWrist.y);
  const maxHeight = 0.3;
  return Math.min(1, (lHeight + rHeight) / 2 / maxHeight);
}

export function computeGuardSymmetry(poseLandmarks: Landmark2D[]): number {
  if (vis(poseLandmarks, 15) < 0.3 || vis(poseLandmarks, 16) < 0.3) return 0.5;
  const lWrist = lm(poseLandmarks, 15);
  const rWrist = lm(poseLandmarks, 16);
  const lShoulder = lm(poseLandmarks, 11);
  const rShoulder = lm(poseLandmarks, 12);

  const lOffset = lShoulder.y - lWrist.y;
  const rOffset = rShoulder.y - rWrist.y;
  const asymmetry = Math.abs(lOffset - rOffset);
  return Math.max(0, 1 - asymmetry / 0.15);
}

export function computeBlockPath(jointAngles: JointAngleMap): number {
  const le = jointAngles.leftElbow ?? 90;
  const re = jointAngles.rightElbow ?? 90;
  const idealBlockAngle = 100;
  const tolerance = 25;
  const lScore = Math.max(0, 1 - Math.abs(le - idealBlockAngle) / tolerance);
  const rScore = Math.max(0, 1 - Math.abs(re - idealBlockAngle) / tolerance);
  return (lScore + rScore) / 2;
}

export function computeStrikeExtension(poseLandmarks: Landmark2D[], jointAngles: JointAngleMap): number {
  const lElbow = jointAngles.leftElbow ?? 90;
  const rElbow = jointAngles.rightElbow ?? 90;
  const maxElbow = Math.max(lElbow, rElbow);
  return Math.min(1, Math.max(0, (maxElbow - 90) / 80));
}

export function computeHipShoulderCoordination(
  jointAngles: JointAngleMap,
  prevAngles: JointAngleMap
): number {
  const hipChange = Math.abs((jointAngles.hipLineTilt ?? 0) - (prevAngles.hipLineTilt ?? 0));
  const shoulderChange = Math.abs((jointAngles.shoulderLineTilt ?? 0) - (prevAngles.shoulderLineTilt ?? 0));
  if (hipChange + shoulderChange < 0.5) return 0.5;
  const ratio = Math.min(hipChange, shoulderChange) / Math.max(hipChange, shoulderChange);
  return ratio;
}

export function computeFootPivot(poseLandmarks: Landmark2D[], prevLandmarks: Landmark2D[]): number {
  if (vis(poseLandmarks, 31) < 0.3 || vis(poseLandmarks, 32) < 0.3) return 0.5;
  const lToe = lm(poseLandmarks, 31);
  const rToe = lm(poseLandmarks, 32);
  const lHeel = lm(poseLandmarks, 29);
  const rHeel = lm(poseLandmarks, 30);
  const prevLToe = lm(prevLandmarks, 31);
  const prevRToe = lm(prevLandmarks, 32);
  const prevLHeel = lm(prevLandmarks, 29);
  const prevRHeel = lm(prevLandmarks, 30);

  const lPivot = dist(lToe, prevLToe) > 0.01 && dist(lHeel, prevLHeel) < 0.01 ? 1 : 0;
  const rPivot = dist(rToe, prevRToe) > 0.01 && dist(rHeel, prevRHeel) < 0.01 ? 1 : 0;
  return Math.max(lPivot, rPivot);
}

export function computeShoulderProtection(poseLandmarks: Landmark2D[], jointAngles: JointAngleMap): number {
  const lShoulder = lm(poseLandmarks, 11);
  const rShoulder = lm(poseLandmarks, 12);
  const lElbow = lm(poseLandmarks, 13);
  const rElbow = lm(poseLandmarks, 14);

  if (vis(poseLandmarks, 11) < 0.3) return 0.5;
  const lProtect = lElbow.x > lShoulder.x - 0.08 ? 1 : 0.5;
  const rProtect = rElbow.x < rShoulder.x + 0.08 ? 1 : 0.5;
  return (lProtect + rProtect) / 2;
}

export function computeDefenseMetrics(
  poseLandmarks: Landmark2D[],
  prevLandmarks: Landmark2D[],
  jointAngles: JointAngleMap,
  prevAngles: JointAngleMap,
  biomechanics: BiomechanicsMetrics
): DefenseMetrics {
  const guardHeight = computeGuardHeight(poseLandmarks);
  const guardSymmetry = computeGuardSymmetry(poseLandmarks);
  const centerlineCoverage = biomechanics.centerlineCoverage;
  const blockPath = computeBlockPath(jointAngles);
  const strikeExtension = computeStrikeExtension(poseLandmarks, jointAngles);
  const hipShoulderCoord = computeHipShoulderCoordination(jointAngles, prevAngles);
  const stanceDepth = Math.min(1, biomechanics.stanceDepth / 0.15);
  const stanceStability = biomechanics.stabilityScore;
  const shoulderProtection = computeShoulderProtection(poseLandmarks, jointAngles);
  const balanceAfterStrike = biomechanics.balanceScore;
  const footPivot = prevLandmarks.length > 0 ? computeFootPivot(poseLandmarks, prevLandmarks) : 0.5;
  const returnToGuardQuality = (guardHeight + guardSymmetry + shoulderProtection) / 3;
  const recoveryTime = returnToGuardQuality;

  const notes: string[] = [];
  if (guardHeight < 0.4) notes.push("Guard is low — raise wrists to chin level");
  if (guardSymmetry < 0.5) notes.push("Guard is uneven — balance both hands");
  if (centerlineCoverage < 0.5) notes.push("Centerline exposed — keep hands in front of body");
  if (strikeExtension > 0.8) notes.push("Over-extending — stop before full lock-out");
  if (stanceDepth < 0.3) notes.push("Stance too shallow — lower your base");
  if (shoulderProtection < 0.5) notes.push("Elbows flaring — tuck them to protect shoulders");

  const overallDefenseScore = (
    guardHeight * 0.20 +
    guardSymmetry * 0.10 +
    centerlineCoverage * 0.15 +
    stanceStability * 0.15 +
    balanceAfterStrike * 0.10 +
    shoulderProtection * 0.10 +
    returnToGuardQuality * 0.10 +
    hipShoulderCoord * 0.10
  );

  return {
    guardHeight, guardSymmetry, centerlineCoverage, blockPath,
    strikeExtension, hipShoulderCoordination: hipShoulderCoord,
    recoveryTime, balanceAfterStrike, footPivot, stanceDepth,
    stanceStability, shoulderProtection, returnToGuardQuality,
    overallDefenseScore, notes,
  };
}
