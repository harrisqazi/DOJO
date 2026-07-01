import type { Landmark2D, Landmark3D, JointAngleMap } from "./types";

const DEG = 180 / Math.PI;

export function angleBetweenThreePoints(
  a: Landmark2D | Landmark3D,
  b: Landmark2D | Landmark3D,
  c: Landmark2D | Landmark3D
): number {
  const baX = a.x - b.x, baY = a.y - b.y;
  const bcX = c.x - b.x, bcY = c.y - b.y;
  const dot = baX * bcX + baY * bcY;
  const magBA = Math.sqrt(baX * baX + baY * baY);
  const magBC = Math.sqrt(bcX * bcX + bcY * bcY);
  if (magBA < 1e-8 || magBC < 1e-8) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (magBA * magBC)))) * DEG;
}

export function angleOfSegment(a: Landmark2D, b: Landmark2D): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * DEG;
}

function lmv(lms: Landmark2D[], idx: number): number {
  return (lms[idx]?.visibility ?? 0);
}

function lm(lms: Landmark2D[], idx: number): Landmark2D {
  return lms[idx] ?? { x: 0, y: 0 };
}

function conf(lms: Landmark2D[], ...idxs: number[]): number {
  return Math.min(...idxs.map(i => lmv(lms, i)));
}

export function computeShoulderAngle(lms: Landmark2D[], side: "left" | "right"): number | undefined {
  if (side === "left") {
    if (conf(lms, 12, 11, 13) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 12), lm(lms, 11), lm(lms, 13));
  } else {
    if (conf(lms, 11, 12, 14) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 11), lm(lms, 12), lm(lms, 14));
  }
}

export function computeElbowAngle(lms: Landmark2D[], side: "left" | "right"): number | undefined {
  if (side === "left") {
    if (conf(lms, 11, 13, 15) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 11), lm(lms, 13), lm(lms, 15));
  } else {
    if (conf(lms, 12, 14, 16) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 12), lm(lms, 14), lm(lms, 16));
  }
}

export function computeWristAngle(lms: Landmark2D[], side: "left" | "right"): number | undefined {
  if (side === "left") {
    if (conf(lms, 13, 15, 17) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 13), lm(lms, 15), lm(lms, 17));
  } else {
    if (conf(lms, 14, 16, 18) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 14), lm(lms, 16), lm(lms, 18));
  }
}

export function computeHipAngle(lms: Landmark2D[], side: "left" | "right"): number | undefined {
  if (side === "left") {
    if (conf(lms, 24, 23, 25) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 24), lm(lms, 23), lm(lms, 25));
  } else {
    if (conf(lms, 23, 24, 26) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 23), lm(lms, 24), lm(lms, 26));
  }
}

export function computeKneeAngle(lms: Landmark2D[], side: "left" | "right"): number | undefined {
  if (side === "left") {
    if (conf(lms, 23, 25, 27) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 23), lm(lms, 25), lm(lms, 27));
  } else {
    if (conf(lms, 24, 26, 28) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 24), lm(lms, 26), lm(lms, 28));
  }
}

export function computeAnkleAngle(lms: Landmark2D[], side: "left" | "right"): number | undefined {
  if (side === "left") {
    if (conf(lms, 25, 27, 31) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 25), lm(lms, 27), lm(lms, 31));
  } else {
    if (conf(lms, 26, 28, 32) < 0.3) return undefined;
    return angleBetweenThreePoints(lm(lms, 26), lm(lms, 28), lm(lms, 32));
  }
}

export function computeTorsoLean(lms: Landmark2D[]): number | undefined {
  if (conf(lms, 11, 12, 23, 24) < 0.3) return undefined;
  const shoulderMid = { x: (lm(lms, 11).x + lm(lms, 12).x) / 2, y: (lm(lms, 11).y + lm(lms, 12).y) / 2 };
  const hipMid = { x: (lm(lms, 23).x + lm(lms, 24).x) / 2, y: (lm(lms, 23).y + lm(lms, 24).y) / 2 };
  return Math.atan2(shoulderMid.x - hipMid.x, hipMid.y - shoulderMid.y) * DEG;
}

export function computeSpineAngle(lms: Landmark2D[]): number | undefined {
  if (conf(lms, 11, 12, 23, 24) < 0.3) return undefined;
  const shoulderMid = { x: (lm(lms, 11).x + lm(lms, 12).x) / 2, y: (lm(lms, 11).y + lm(lms, 12).y) / 2 };
  const hipMid = { x: (lm(lms, 23).x + lm(lms, 24).x) / 2, y: (lm(lms, 23).y + lm(lms, 24).y) / 2 };
  const vertical = { x: hipMid.x, y: hipMid.y - 1 };
  return angleBetweenThreePoints(shoulderMid, hipMid, vertical);
}

export function computeNeckAlignment(lms: Landmark2D[]): number | undefined {
  if (conf(lms, 0, 11, 12) < 0.3) return undefined;
  const shoulderMid = { x: (lm(lms, 11).x + lm(lms, 12).x) / 2, y: (lm(lms, 11).y + lm(lms, 12).y) / 2 };
  return angleBetweenThreePoints(lm(lms, 0), shoulderMid, { x: shoulderMid.x, y: shoulderMid.y - 1 });
}

export function computeHipShoulderSeparation(lms: Landmark2D[]): number | undefined {
  if (conf(lms, 11, 12, 23, 24) < 0.3) return undefined;
  const sAngle = angleOfSegment(lm(lms, 11), lm(lms, 12));
  const hAngle = angleOfSegment(lm(lms, 23), lm(lms, 24));
  return Math.abs(sAngle - hAngle);
}

export function computeShoulderLineTilt(lms: Landmark2D[]): number | undefined {
  if (conf(lms, 11, 12) < 0.3) return undefined;
  return angleOfSegment(lm(lms, 11), lm(lms, 12));
}

export function computeHipLineTilt(lms: Landmark2D[]): number | undefined {
  if (conf(lms, 23, 24) < 0.3) return undefined;
  return angleOfSegment(lm(lms, 23), lm(lms, 24));
}

export function computeFootDirection(lms: Landmark2D[], side: "left" | "right"): number | undefined {
  if (side === "left") {
    if (conf(lms, 27, 31) < 0.3) return undefined;
    return angleOfSegment(lm(lms, 27), lm(lms, 31));
  } else {
    if (conf(lms, 28, 32) < 0.3) return undefined;
    return angleOfSegment(lm(lms, 28), lm(lms, 32));
  }
}

export function computeToeAngle(lms: Landmark2D[], side: "left" | "right"): number | undefined {
  if (side === "left") {
    if (conf(lms, 29, 31) < 0.3) return undefined;
    return angleOfSegment(lm(lms, 29), lm(lms, 31));
  } else {
    if (conf(lms, 30, 32) < 0.3) return undefined;
    return angleOfSegment(lm(lms, 30), lm(lms, 32));
  }
}

export function computePalmAngle(handLms: Landmark2D[]): number | undefined {
  if (!handLms || handLms.length < 9) return undefined;
  return angleOfSegment(handLms[0], handLms[9]);
}

export function computeCenterlineAlignment(lms: Landmark2D[]): number | undefined {
  if (conf(lms, 11, 12, 23, 24) < 0.3) return undefined;
  const shoulderMidX = (lm(lms, 11).x + lm(lms, 12).x) / 2;
  const hipMidX = (lm(lms, 23).x + lm(lms, 24).x) / 2;
  return Math.abs(shoulderMidX - hipMidX);
}

export function computeGuardHeightAngle(lms: Landmark2D[]): number | undefined {
  if (conf(lms, 15, 16, 11, 12) < 0.3) return undefined;
  const lWrist = lm(lms, 15);
  const rWrist = lm(lms, 16);
  const lShoulder = lm(lms, 11);
  return angleBetweenThreePoints(lWrist, lShoulder, rWrist);
}

export function computeAllJointAngles(
  poseLandmarks: Landmark2D[],
  leftHandLandmarks?: Landmark2D[],
  rightHandLandmarks?: Landmark2D[]
): JointAngleMap {
  return {
    leftShoulder: computeShoulderAngle(poseLandmarks, "left"),
    rightShoulder: computeShoulderAngle(poseLandmarks, "right"),
    leftElbow: computeElbowAngle(poseLandmarks, "left"),
    rightElbow: computeElbowAngle(poseLandmarks, "right"),
    leftWrist: computeWristAngle(poseLandmarks, "left"),
    rightWrist: computeWristAngle(poseLandmarks, "right"),
    leftHip: computeHipAngle(poseLandmarks, "left"),
    rightHip: computeHipAngle(poseLandmarks, "right"),
    leftKnee: computeKneeAngle(poseLandmarks, "left"),
    rightKnee: computeKneeAngle(poseLandmarks, "right"),
    leftAnkle: computeAnkleAngle(poseLandmarks, "left"),
    rightAnkle: computeAnkleAngle(poseLandmarks, "right"),
    torsoLean: computeTorsoLean(poseLandmarks),
    spineAngle: computeSpineAngle(poseLandmarks),
    neckAlignment: computeNeckAlignment(poseLandmarks),
    hipShoulderSeparation: computeHipShoulderSeparation(poseLandmarks),
    shoulderLineTilt: computeShoulderLineTilt(poseLandmarks),
    hipLineTilt: computeHipLineTilt(poseLandmarks),
    leftFootDirection: computeFootDirection(poseLandmarks, "left"),
    rightFootDirection: computeFootDirection(poseLandmarks, "right"),
    leftToeAngle: computeToeAngle(poseLandmarks, "left"),
    rightToeAngle: computeToeAngle(poseLandmarks, "right"),
    leftPalmAngle: leftHandLandmarks ? computePalmAngle(leftHandLandmarks) : undefined,
    rightPalmAngle: rightHandLandmarks ? computePalmAngle(rightHandLandmarks) : undefined,
    centerlineAlignment: computeCenterlineAlignment(poseLandmarks),
    guardHeightAngle: computeGuardHeightAngle(poseLandmarks),
  };
}
