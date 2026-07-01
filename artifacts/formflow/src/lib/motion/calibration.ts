import type { CalibrationProfile, Landmark2D } from "./types";
import { getShoulderWidth, getHipWidth, getBodyHeight, getHipCenter } from "./normalize";
import { computeLandmarkVisibility } from "./confidence";

export interface CalibrationStep {
  id: string;
  label: string;
  instruction: string;
  speechText: string;
  holdMs: number;
  requiredLandmarks: number[];
}

export const CALIBRATION_STEPS: CalibrationStep[] = [
  {
    id: "neutral",
    label: "Neutral Stand",
    instruction: "Stand naturally, arms at your sides, facing the camera",
    speechText: "Stand naturally with your arms at your sides and face the camera",
    holdMs: 2000,
    requiredLandmarks: [11, 12, 23, 24, 27, 28],
  },
  {
    id: "tpose",
    label: "T-Pose",
    instruction: "Extend both arms out to the sides at shoulder height",
    speechText: "Extend both arms straight out to the sides, like the letter T",
    holdMs: 2500,
    requiredLandmarks: [11, 12, 13, 14, 15, 16, 23, 24],
  },
  {
    id: "side",
    label: "Side Pose",
    instruction: "Turn your left shoulder toward the camera",
    speechText: "Turn sideways so your left shoulder faces the camera",
    holdMs: 2000,
    requiredLandmarks: [11, 12, 23, 24],
  },
  {
    id: "squat",
    label: "Squat / Stance",
    instruction: "Take a comfortable wide stance and lower slightly",
    speechText: "Take a wide comfortable stance and bend your knees slightly",
    holdMs: 2500,
    requiredLandmarks: [23, 24, 25, 26, 27, 28],
  },
  {
    id: "raise_hands",
    label: "Raise Hands",
    instruction: "Raise both hands above your head",
    speechText: "Raise both hands above your head",
    holdMs: 2000,
    requiredLandmarks: [15, 16, 11, 12],
  },
  {
    id: "show_palms",
    label: "Show Palms",
    instruction: "Hold both palms open facing the camera",
    speechText: "Hold both hands up with palms open and facing the camera",
    holdMs: 2000,
    requiredLandmarks: [15, 16],
  },
  {
    id: "show_feet",
    label: "Show Feet",
    instruction: "Step back so your feet are fully visible",
    speechText: "Step back until both feet are fully visible on screen",
    holdMs: 2000,
    requiredLandmarks: [27, 28, 29, 30, 31, 32],
  },
];

function estimateBodyScale(
  neutralLandmarks: Landmark2D[],
  tposeLandmarks?: Landmark2D[]
): CalibrationProfile["bodyScale"] {
  const shoulderWidth = getShoulderWidth(neutralLandmarks);
  const hipWidth = getHipWidth(neutralLandmarks);
  const height = getBodyHeight(neutralLandmarks);

  const lShoulder = neutralLandmarks[11] ?? { x: 0, y: 0 };
  const rShoulder = neutralLandmarks[12] ?? { x: 0, y: 0 };
  const lHip = neutralLandmarks[23] ?? { x: 0, y: 0 };
  const rHip = neutralLandmarks[24] ?? { x: 0, y: 0 };
  const hipCenter = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
  const shoulderCenter = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
  const torsoLength = Math.abs(hipCenter.y - shoulderCenter.y);

  const lAnkle = neutralLandmarks[27] ?? { x: 0, y: hipCenter.y + 0.5 };
  const legLength = Math.abs(lAnkle.y - hipCenter.y);
  const armLength = tposeLandmarks ? getShoulderWidth(tposeLandmarks) / 2 : shoulderWidth * 1.2;

  return { height, shoulderWidth, hipWidth, torsoLength, legLength, armLength };
}

function estimateLimbLengths(landmarks: Landmark2D[]): CalibrationProfile["limbLengths"] {
  const lShoulder = landmarks[11], rShoulder = landmarks[12];
  const lElbow = landmarks[13], rElbow = landmarks[14];
  const lWrist = landmarks[15], rWrist = landmarks[16];
  const lHip = landmarks[23], rHip = landmarks[24];
  const lKnee = landmarks[25], rKnee = landmarks[26];
  const lAnkle = landmarks[27], rAnkle = landmarks[28];

  function d(a?: Landmark2D, b?: Landmark2D): number {
    if (!a || !b) return 0.15;
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  return {
    upperArm: (d(lShoulder, lElbow) + d(rShoulder, rElbow)) / 2,
    forearm: (d(lElbow, lWrist) + d(rElbow, rWrist)) / 2,
    thigh: (d(lHip, lKnee) + d(rHip, rKnee)) / 2,
    shin: (d(lKnee, lAnkle) + d(rKnee, rAnkle)) / 2,
  };
}

function estimateCameraFraming(landmarks: Landmark2D[]): CalibrationProfile["cameraFraming"] {
  const headVisible = (landmarks[0]?.visibility ?? 0) > 0.5;
  const anklesVisible = (landmarks[27]?.visibility ?? 0) > 0.4 && (landmarks[28]?.visibility ?? 0) > 0.4;
  const bodyVisible = headVisible && anklesVisible ? 1.0 : headVisible ? 0.7 : 0.5;

  const shoulderWidth = getShoulderWidth(landmarks);
  let distance = "appropriate";
  if (shoulderWidth > 0.4) distance = "too_close";
  else if (shoulderWidth < 0.12) distance = "too_far";

  return { distance, height: "appropriate", angle: "front", bodyVisible };
}

export function computeCalibrationProfile(
  stepData: Record<string, Landmark2D[]>,
  userId?: string
): CalibrationProfile {
  const neutralLms = stepData["neutral"] ?? [];
  const tposeLms = stepData["tpose"];
  const squatLms = stepData["squat"] ?? [];

  const bodyScale = estimateBodyScale(neutralLms, tposeLms);
  const limbLengths = estimateLimbLengths(tposeLms ?? neutralLms);
  const cameraFraming = estimateCameraFraming(neutralLms);

  const vis = computeLandmarkVisibility(neutralLms);

  const squatKneeAngle = squatLms[25] && squatLms[23] && squatLms[27]
    ? undefined : undefined;

  return {
    userId,
    bodyScale,
    limbLengths,
    handedness: undefined,
    baselineMobility: {
      shoulderFlex: 160,
      hipFlex: 90,
      kneeRange: 130,
      ankleRange: 40,
    },
    cameraFraming,
    visibilityBaseline: {
      head: neutralLms[0]?.visibility ?? 0.5,
      shoulders: ((neutralLms[11]?.visibility ?? 0) + (neutralLms[12]?.visibility ?? 0)) / 2,
      hips: ((neutralLms[23]?.visibility ?? 0) + (neutralLms[24]?.visibility ?? 0)) / 2,
      knees: ((neutralLms[25]?.visibility ?? 0) + (neutralLms[26]?.visibility ?? 0)) / 2,
      ankles: ((neutralLms[27]?.visibility ?? 0) + (neutralLms[28]?.visibility ?? 0)) / 2,
      hands: 0.5,
      feet: ((neutralLms[31]?.visibility ?? 0) + (neutralLms[32]?.visibility ?? 0)) / 2,
    },
    createdAt: new Date().toISOString(),
  };
}

export function isCalibrationStepReady(
  landmarks: Landmark2D[],
  step: CalibrationStep,
  threshold = 0.5
): boolean {
  return step.requiredLandmarks.every(i => (landmarks[i]?.visibility ?? 0) > threshold);
}

export function getCalibrationReadiness(landmarks: Landmark2D[], step: CalibrationStep): number {
  const scores = step.requiredLandmarks.map(i => landmarks[i]?.visibility ?? 0);
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}
