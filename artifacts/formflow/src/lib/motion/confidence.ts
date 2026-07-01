import type { Landmark2D, LandmarkVisibility } from "./types";

const VISIBILITY_THRESHOLD = 0.5;
const HIGH_CONFIDENCE = 0.7;

export function computeLandmarkConfidence(lm: Landmark2D): number {
  return lm.visibility ?? (lm.confidence ?? 0);
}

export function computeBodyRegionConfidence(lms: Landmark2D[], indices: number[]): number {
  if (!lms || lms.length === 0) return 0;
  const valid = indices.filter(i => i < lms.length);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, i) => sum + computeLandmarkConfidence(lms[i]), 0) / valid.length;
}

const BODY_REGIONS = {
  head: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  shoulders: [11, 12],
  elbows: [13, 14],
  wrists: [15, 16],
  hips: [23, 24],
  knees: [25, 26],
  ankles: [27, 28],
  feet: [29, 30, 31, 32],
};

export function computeFrameConfidence(
  poseLandmarks: Landmark2D[],
  leftHandLandmarks?: Landmark2D[],
  rightHandLandmarks?: Landmark2D[]
): number {
  if (!poseLandmarks || poseLandmarks.length === 0) return 0;

  const coreIndices = [...BODY_REGIONS.shoulders, ...BODY_REGIONS.hips, ...BODY_REGIONS.knees];
  const coreConf = computeBodyRegionConfidence(poseLandmarks, coreIndices);

  const handConf = leftHandLandmarks || rightHandLandmarks ? 1 : 0.85;
  return coreConf * handConf;
}

export function computeLandmarkVisibility(
  poseLandmarks: Landmark2D[],
  leftHandLandmarks?: Landmark2D[],
  rightHandLandmarks?: Landmark2D[]
): LandmarkVisibility {
  const reasons: string[] = [];
  const body = computeBodyRegionConfidence(poseLandmarks, [...BODY_REGIONS.shoulders, ...BODY_REGIONS.hips, ...BODY_REGIONS.knees, ...BODY_REGIONS.ankles]);
  const leftHand = leftHandLandmarks && leftHandLandmarks.length > 0
    ? computeBodyRegionConfidence(leftHandLandmarks, [0, 5, 9, 13, 17]) : 0;
  const rightHand = rightHandLandmarks && rightHandLandmarks.length > 0
    ? computeBodyRegionConfidence(rightHandLandmarks, [0, 5, 9, 13, 17]) : 0;
  const feet = computeBodyRegionConfidence(poseLandmarks, BODY_REGIONS.feet);

  if (body < VISIBILITY_THRESHOLD) reasons.push("Core body landmarks not clearly visible");
  if (leftHand < VISIBILITY_THRESHOLD) reasons.push("Left hand not visible");
  if (rightHand < VISIBILITY_THRESHOLD) reasons.push("Right hand not visible");
  if (feet < VISIBILITY_THRESHOLD) reasons.push("Feet not clearly visible");

  const ankleConf = computeBodyRegionConfidence(poseLandmarks, BODY_REGIONS.ankles);
  const hipConf = computeBodyRegionConfidence(poseLandmarks, BODY_REGIONS.hips);
  if (ankleConf < VISIBILITY_THRESHOLD) reasons.push("Step back from camera to show full body");
  if (hipConf < VISIBILITY_THRESHOLD) reasons.push("Move camera to show full body");

  return { body, leftHand, rightHand, feet, lowConfidenceReasons: reasons };
}

export function computeSequenceConfidence(frameConfidences: number[]): number {
  if (frameConfidences.length === 0) return 0;
  const avg = frameConfidences.reduce((a, b) => a + b, 0) / frameConfidences.length;
  const framesAboveThreshold = frameConfidences.filter(c => c >= VISIBILITY_THRESHOLD).length;
  const coverage = framesAboveThreshold / frameConfidences.length;
  return avg * 0.5 + coverage * 0.5;
}

export function getLowConfidenceReasons(
  poseLandmarks: Landmark2D[],
  leftHandLandmarks?: Landmark2D[],
  rightHandLandmarks?: Landmark2D[]
): string[] {
  const reasons: string[] = [];
  const vis = computeLandmarkVisibility(poseLandmarks, leftHandLandmarks, rightHandLandmarks);
  return [...reasons, ...vis.lowConfidenceReasons];
}

export function shouldSuppressFeedbackForBodyPart(
  bodyPart: string,
  poseLandmarks: Landmark2D[],
  leftHandLandmarks?: Landmark2D[],
  rightHandLandmarks?: Landmark2D[]
): boolean {
  const partLower = bodyPart.toLowerCase();

  if (partLower.includes("left hand") || partLower.includes("left finger") || partLower.includes("left palm")) {
    return !leftHandLandmarks || leftHandLandmarks.length === 0 ||
      computeBodyRegionConfidence(leftHandLandmarks, [0, 5, 9, 13, 17]) < HIGH_CONFIDENCE;
  }
  if (partLower.includes("right hand") || partLower.includes("right finger") || partLower.includes("right palm")) {
    return !rightHandLandmarks || rightHandLandmarks.length === 0 ||
      computeBodyRegionConfidence(rightHandLandmarks, [0, 5, 9, 13, 17]) < HIGH_CONFIDENCE;
  }
  if (partLower.includes("left wrist")) {
    return computeBodyRegionConfidence(poseLandmarks, [15]) < HIGH_CONFIDENCE;
  }
  if (partLower.includes("right wrist")) {
    return computeBodyRegionConfidence(poseLandmarks, [16]) < HIGH_CONFIDENCE;
  }
  if (partLower.includes("left elbow")) {
    return computeBodyRegionConfidence(poseLandmarks, [13]) < VISIBILITY_THRESHOLD;
  }
  if (partLower.includes("right elbow")) {
    return computeBodyRegionConfidence(poseLandmarks, [14]) < VISIBILITY_THRESHOLD;
  }
  if (partLower.includes("left knee")) {
    return computeBodyRegionConfidence(poseLandmarks, [25]) < VISIBILITY_THRESHOLD;
  }
  if (partLower.includes("right knee")) {
    return computeBodyRegionConfidence(poseLandmarks, [26]) < VISIBILITY_THRESHOLD;
  }
  if (partLower.includes("foot") || partLower.includes("toe") || partLower.includes("ankle")) {
    return computeBodyRegionConfidence(poseLandmarks, BODY_REGIONS.feet) < VISIBILITY_THRESHOLD;
  }

  return false;
}

export function confidenceWarningMessage(bodyPart: string): string {
  return `I could not confidently track your ${bodyPart} during this phase. Try better lighting and keep your ${bodyPart} visible.`;
}
