import type { Landmark2D, JointVelocityMap, JointAccelerationMap, JointAngleMap } from "./types";

export function landmarkVelocity(cur: Landmark2D, prev: Landmark2D, deltaMs: number): number {
  if (deltaMs <= 0) return 0;
  const dx = cur.x - prev.x;
  const dy = cur.y - prev.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist / (deltaMs / 1000);
}

export function angularVelocity(curAngle: number, prevAngle: number, deltaMs: number): number {
  if (deltaMs <= 0) return 0;
  let delta = curAngle - prevAngle;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta / (deltaMs / 1000);
}

export function computeJointVelocities(
  cur: JointAngleMap,
  prev: JointAngleMap,
  deltaMs: number
): JointVelocityMap {
  const av = (c?: number, p?: number) =>
    c != null && p != null ? angularVelocity(c, p, deltaMs) : undefined;
  return {
    leftShoulder: av(cur.leftShoulder, prev.leftShoulder),
    rightShoulder: av(cur.rightShoulder, prev.rightShoulder),
    leftElbow: av(cur.leftElbow, prev.leftElbow),
    rightElbow: av(cur.rightElbow, prev.rightElbow),
    leftWrist: av(cur.leftWrist, prev.leftWrist),
    rightWrist: av(cur.rightWrist, prev.rightWrist),
    leftHip: av(cur.leftHip, prev.leftHip),
    rightHip: av(cur.rightHip, prev.rightHip),
    leftKnee: av(cur.leftKnee, prev.leftKnee),
    rightKnee: av(cur.rightKnee, prev.rightKnee),
    leftAnkle: av(cur.leftAnkle, prev.leftAnkle),
    rightAnkle: av(cur.rightAnkle, prev.rightAnkle),
  };
}

export function computeJointAccelerations(
  cur: JointVelocityMap,
  prev: JointVelocityMap,
  deltaMs: number
): JointAccelerationMap {
  const da = (c?: number, p?: number) =>
    c != null && p != null && deltaMs > 0 ? (c - p) / (deltaMs / 1000) : undefined;
  return {
    leftShoulder: da(cur.leftShoulder, prev.leftShoulder),
    rightShoulder: da(cur.rightShoulder, prev.rightShoulder),
    leftElbow: da(cur.leftElbow, prev.leftElbow),
    rightElbow: da(cur.rightElbow, prev.rightElbow),
    leftWrist: da(cur.leftWrist, prev.leftWrist),
    rightWrist: da(cur.rightWrist, prev.rightWrist),
    leftHip: da(cur.leftHip, prev.leftHip),
    rightHip: da(cur.rightHip, prev.rightHip),
    leftKnee: da(cur.leftKnee, prev.leftKnee),
    rightKnee: da(cur.rightKnee, prev.rightKnee),
    leftAnkle: da(cur.leftAnkle, prev.leftAnkle),
    rightAnkle: da(cur.rightAnkle, prev.rightAnkle),
  };
}

export function computeWristSpeed(lms: Landmark2D[], prevLms: Landmark2D[], deltaMs: number): number {
  const lv = lms[15] && prevLms[15] ? landmarkVelocity(lms[15], prevLms[15], deltaMs) : 0;
  const rv = lms[16] && prevLms[16] ? landmarkVelocity(lms[16], prevLms[16], deltaMs) : 0;
  return Math.max(lv, rv);
}

export function computeAnkleSpeed(lms: Landmark2D[], prevLms: Landmark2D[], deltaMs: number): number {
  const lv = lms[27] && prevLms[27] ? landmarkVelocity(lms[27], prevLms[27], deltaMs) : 0;
  const rv = lms[28] && prevLms[28] ? landmarkVelocity(lms[28], prevLms[28], deltaMs) : 0;
  return Math.max(lv, rv);
}

export function computeHipSpeed(lms: Landmark2D[], prevLms: Landmark2D[], deltaMs: number): number {
  const lhMid = { x: (lms[23]?.x + lms[24]?.x) / 2, y: (lms[23]?.y + lms[24]?.y) / 2 };
  const phMid = { x: (prevLms[23]?.x + prevLms[24]?.x) / 2, y: (prevLms[23]?.y + prevLms[24]?.y) / 2 };
  return landmarkVelocity(lhMid as Landmark2D, phMid as Landmark2D, deltaMs);
}

export function computeCenterOfMassSpeed(
  curCoM: { x: number; y: number },
  prevCoM: { x: number; y: number },
  deltaMs: number
): number {
  return landmarkVelocity(curCoM as Landmark2D, prevCoM as Landmark2D, deltaMs);
}

export function computeSmoothness(velocityHistory: number[]): number {
  if (velocityHistory.length < 2) return 1;
  let totalVariance = 0;
  for (let i = 1; i < velocityHistory.length; i++) {
    totalVariance += Math.abs(velocityHistory[i] - velocityHistory[i - 1]);
  }
  const avgVariance = totalVariance / (velocityHistory.length - 1);
  const avgVel = velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length;
  if (avgVel === 0) return 1;
  return Math.max(0, 1 - Math.min(1, avgVariance / (avgVel + 0.001)));
}

export function computeJerk(accelerationHistory: number[]): number {
  if (accelerationHistory.length < 2) return 0;
  let jerk = 0;
  for (let i = 1; i < accelerationHistory.length; i++) {
    jerk += Math.abs(accelerationHistory[i] - accelerationHistory[i - 1]);
  }
  return jerk / (accelerationHistory.length - 1);
}

export function findVelocityPeaks(velocities: number[], threshold?: number): number[] {
  const thresh = threshold ?? (Math.max(...velocities) * 0.6);
  const peaks: number[] = [];
  for (let i = 1; i < velocities.length - 1; i++) {
    if (velocities[i] > velocities[i - 1] && velocities[i] > velocities[i + 1] && velocities[i] > thresh) {
      peaks.push(i);
    }
  }
  return peaks;
}

export function findAccelerationPeaks(accels: number[], threshold?: number): number[] {
  const thresh = threshold ?? (Math.max(...accels.map(Math.abs)) * 0.6);
  const peaks: number[] = [];
  for (let i = 1; i < accels.length - 1; i++) {
    if (Math.abs(accels[i]) > Math.abs(accels[i - 1]) && Math.abs(accels[i]) > Math.abs(accels[i + 1]) && Math.abs(accels[i]) > thresh) {
      peaks.push(i);
    }
  }
  return peaks;
}
