import type {
  Landmark2D, JointAngleMap, JointVelocityMap, JointAccelerationMap,
  BiomechanicsMetrics, Point2D, CalibrationProfile, MotionFrame
} from "./types";
import { computeAllJointAngles } from "./angles";
import { computeJointVelocities, computeJointAccelerations, computeSmoothness, computeJerk } from "./velocity";

function lm(lms: Landmark2D[], i: number): Landmark2D {
  return lms[i] ?? { x: 0, y: 0, visibility: 0 };
}

function avg(a: Landmark2D, b: Landmark2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function vis(lms: Landmark2D[], i: number): number {
  return lms[i]?.visibility ?? 0;
}

export function computeCenterOfMass(poseLandmarks: Landmark2D[]): Point2D {
  const weights: Array<[number, number]> = [
    [0, 0.05],  // head
    [11, 0.08], [12, 0.08], // shoulders
    [23, 0.12], [24, 0.12], // hips
    [25, 0.06], [26, 0.06], // knees
    [27, 0.04], [28, 0.04], // ankles
    [13, 0.04], [14, 0.04], // elbows
    [15, 0.02], [16, 0.02], // wrists
  ];
  let totalW = 0, x = 0, y = 0;
  for (const [idx, w] of weights) {
    const l = poseLandmarks[idx];
    if (l && (l.visibility ?? 1) > 0.3) {
      x += l.x * w; y += l.y * w; totalW += w;
    }
  }
  if (totalW === 0) return { x: 0.5, y: 0.5 };
  return { x: x / totalW, y: y / totalW };
}

function computeBaseOfSupport(poseLandmarks: Landmark2D[]) {
  const lAnkle = lm(poseLandmarks, 27);
  const rAnkle = lm(poseLandmarks, 28);
  const lToe = lm(poseLandmarks, 31);
  const rToe = lm(poseLandmarks, 32);
  const left: Point2D = { x: (lAnkle.x + lToe.x) / 2, y: (lAnkle.y + lToe.y) / 2 };
  const right: Point2D = { x: (rAnkle.x + rToe.x) / 2, y: (rAnkle.y + rToe.y) / 2 };
  const width = dist(left, right);
  return { left, right, width };
}

function computeBalanceScore(com: Point2D, bos: { left: Point2D; right: Point2D; width: number }): number {
  if (bos.width < 0.001) return 0.5;
  const midX = (bos.left.x + bos.right.x) / 2;
  const midY = (bos.left.y + bos.right.y) / 2;
  const deviation = Math.sqrt((com.x - midX) ** 2 + (com.y - midY) ** 2);
  return Math.max(0, 1 - deviation / (bos.width * 0.8));
}

function computeKneeOverToe(poseLandmarks: Landmark2D[]): { left: number; right: number } {
  const lKnee = lm(poseLandmarks, 25);
  const lAnkle = lm(poseLandmarks, 27);
  const lToe = lm(poseLandmarks, 31);
  const rKnee = lm(poseLandmarks, 26);
  const rAnkle = lm(poseLandmarks, 28);
  const rToe = lm(poseLandmarks, 32);

  const leftOk = vis(poseLandmarks, 25) > 0.4 && vis(poseLandmarks, 31) > 0.4
    ? Math.abs(lKnee.x - lToe.x) / Math.max(0.001, Math.abs(lAnkle.x - lToe.x)) : 1;
  const rightOk = vis(poseLandmarks, 26) > 0.4 && vis(poseLandmarks, 32) > 0.4
    ? Math.abs(rKnee.x - rToe.x) / Math.max(0.001, Math.abs(rAnkle.x - rToe.x)) : 1;

  return { left: Math.max(0, 1 - leftOk), right: Math.max(0, 1 - rightOk) };
}

function computeHandOpenness(handLms?: Landmark2D[]): number {
  if (!handLms || handLms.length < 21) return 0.5;
  const wrist = handLms[0];
  const tips = [handLms[4], handLms[8], handLms[12], handLms[16], handLms[20]];
  const bases = [handLms[2], handLms[5], handLms[9], handLms[13], handLms[17]];
  let openness = 0;
  for (let i = 0; i < tips.length; i++) {
    const tipDist = dist(tips[i], wrist);
    const baseDist = dist(bases[i], wrist);
    openness += baseDist > 0 ? Math.min(1, tipDist / baseDist) : 0.5;
  }
  return openness / tips.length;
}

function computeStanceDepth(poseLandmarks: Landmark2D[]): number {
  const lAnkle = lm(poseLandmarks, 27);
  const rAnkle = lm(poseLandmarks, 28);
  return Math.abs(lAnkle.y - rAnkle.y);
}

function computeStanceWidth(poseLandmarks: Landmark2D[]): number {
  const lAnkle = lm(poseLandmarks, 27);
  const rAnkle = lm(poseLandmarks, 28);
  return Math.abs(lAnkle.x - rAnkle.x);
}

function computeKineticChainScore(
  jointAngles: JointAngleMap,
  jointVelocities: JointVelocityMap
): number {
  const hipV = Math.abs(jointVelocities.leftHip ?? 0) + Math.abs(jointVelocities.rightHip ?? 0);
  const shoulderV = Math.abs(jointVelocities.leftShoulder ?? 0) + Math.abs(jointVelocities.rightShoulder ?? 0);
  const wristV = Math.abs(jointVelocities.leftWrist ?? 0) + Math.abs(jointVelocities.rightWrist ?? 0);
  if (hipV + shoulderV + wristV < 0.1) return 0.5;
  const expectedOrder = hipV >= shoulderV * 0.5;
  return expectedOrder ? 0.8 : 0.4;
}

function computeGuardCoverage(poseLandmarks: Landmark2D[]): number {
  const lWrist = lm(poseLandmarks, 15);
  const rWrist = lm(poseLandmarks, 16);
  const lShoulder = lm(poseLandmarks, 11);
  const rShoulder = lm(poseLandmarks, 12);
  if (vis(poseLandmarks, 15) < 0.3 || vis(poseLandmarks, 16) < 0.3) return 0.5;
  const lGuard = lWrist.y < lShoulder.y + 0.1 ? 1 : Math.max(0, 1 - (lWrist.y - lShoulder.y) / 0.3);
  const rGuard = rWrist.y < rShoulder.y + 0.1 ? 1 : Math.max(0, 1 - (rWrist.y - rShoulder.y) / 0.3);
  return (lGuard + rGuard) / 2;
}

function computeCenterlineCoverage(poseLandmarks: Landmark2D[]): number {
  const lWrist = lm(poseLandmarks, 15);
  const rWrist = lm(poseLandmarks, 16);
  if (vis(poseLandmarks, 15) < 0.3 || vis(poseLandmarks, 16) < 0.3) return 0.5;
  const shoulderMidX = (lm(poseLandmarks, 11).x + lm(poseLandmarks, 12).x) / 2;
  const wristMidX = (lWrist.x + rWrist.x) / 2;
  const deviation = Math.abs(wristMidX - shoulderMidX);
  return Math.max(0, 1 - deviation / 0.2);
}

export function computeBiomechanics(
  poseLandmarks: Landmark2D[],
  leftHandLandmarks: Landmark2D[] | undefined,
  rightHandLandmarks: Landmark2D[] | undefined,
  prevAngles: JointAngleMap,
  prevVelocities: JointVelocityMap,
  deltaMs: number,
  previousFrames?: MotionFrame[],
  calibrationProfile?: CalibrationProfile
): BiomechanicsMetrics {
  const jointAngles = computeAllJointAngles(poseLandmarks, leftHandLandmarks, rightHandLandmarks);
  const angularVelocity = computeJointVelocities(jointAngles, prevAngles, deltaMs);
  const angularAcceleration = computeJointAccelerations(angularVelocity, prevVelocities, deltaMs);

  const recentVels = previousFrames?.slice(-10).map(f =>
    Math.abs(f.jointVelocities.leftWrist ?? 0) + Math.abs(f.jointVelocities.rightWrist ?? 0)
  ) ?? [];
  const smoothness = computeSmoothness(recentVels);
  const recentAccels = previousFrames?.slice(-10).map(f =>
    Math.abs(f.jointAccelerations.leftWrist ?? 0) + Math.abs(f.jointAccelerations.rightWrist ?? 0)
  ) ?? [];
  const jerk = computeJerk(recentAccels);

  const com = computeCenterOfMass(poseLandmarks);
  const bos = computeBaseOfSupport(poseLandmarks);
  const balanceScore = computeBalanceScore(com, bos);
  const stabilityScore = balanceScore * 0.7 + (1 - Math.min(1, jerk)) * 0.3;

  const sw = computeStanceWidth(poseLandmarks);
  const sd = computeStanceDepth(poseLandmarks);

  const leftOpen = computeHandOpenness(leftHandLandmarks);
  const rightOpen = computeHandOpenness(rightHandLandmarks);

  const lHip = lm(poseLandmarks, 23);
  const rHip = lm(poseLandmarks, 24);
  const lShoulder = lm(poseLandmarks, 11);
  const rShoulder = lm(poseLandmarks, 12);
  const hipShoulderSep = Math.abs(
    Math.atan2(rShoulder.y - lShoulder.y, rShoulder.x - lShoulder.x) -
    Math.atan2(rHip.y - lHip.y, rHip.x - lHip.x)
  ) * (180 / Math.PI);

  const spineAngle = jointAngles.spineAngle ?? 0;
  const torsoLean = jointAngles.torsoLean ?? 0;
  const kneeOverToe = computeKneeOverToe(poseLandmarks);

  const footDir = { left: jointAngles.leftFootDirection ?? 0, right: jointAngles.rightFootDirection ?? 0 };
  const toeAlign = { left: jointAngles.leftToeAngle ?? 0, right: jointAngles.rightToeAngle ?? 0 };

  const lWrist = lm(poseLandmarks, 15);
  const rWrist = lm(poseLandmarks, 16);
  const heelLift = { left: 0, right: 0 };

  const leftRightSymmetry = (() => {
    const la = jointAngles.leftElbow ?? 90;
    const ra = jointAngles.rightElbow ?? 90;
    const lk = jointAngles.leftKnee ?? 160;
    const rk = jointAngles.rightKnee ?? 160;
    return 1 - (Math.abs(la - ra) / 180 + Math.abs(lk - rk) / 180) / 2;
  })();

  const upperLowerCoord = computeKineticChainScore(jointAngles, angularVelocity);
  const guardCoverage = computeGuardCoverage(poseLandmarks);
  const centerlineCoverage = computeCenterlineCoverage(poseLandmarks);

  const extensionScore = (() => {
    const le = jointAngles.leftElbow ?? 90;
    const re = jointAngles.rightElbow ?? 90;
    return (Math.max(0, le - 90) / 90 + Math.max(0, re - 90) / 90) / 2;
  })();

  const compressionScore = (() => {
    const le = jointAngles.leftElbow ?? 90;
    const re = jointAngles.rightElbow ?? 90;
    return (Math.max(0, 90 - le) / 90 + Math.max(0, 90 - re) / 90) / 2;
  })();

  const recoveryControl = guardCoverage * 0.6 + balanceScore * 0.4;

  return {
    jointAngles,
    angularVelocity,
    angularAcceleration,
    jerk,
    smoothness,
    centerOfMassEstimate: com,
    baseOfSupport: bos,
    balanceScore,
    stabilityScore,
    hipShoulderSeparation: hipShoulderSep,
    spineAngle,
    torsoLean,
    stanceWidth: sw,
    stanceDepth: sd,
    kneeTrackingOverToe: kneeOverToe,
    footDirection: footDir,
    toeAlignment: toeAlign,
    heelLift,
    wristPath: { left: { x: lWrist.x, y: lWrist.y }, right: { x: rWrist.x, y: rWrist.y } },
    handShape: { leftOpen, rightOpen },
    handSymmetry: 1 - Math.abs(leftOpen - rightOpen),
    upperLowerBodyCoordination: upperLowerCoord,
    kineticChainSequencing: upperLowerCoord,
    leftRightSymmetry,
    extensionScore,
    compressionScore,
    guardCoverage,
    centerlineCoverage,
    recoveryControl,
    metricConfidence: {},
  };
}
