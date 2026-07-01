import type { Landmark2D, PositionCheckResult } from "./types";
import { getShoulderWidth, getBodyHeight } from "./normalize";

interface Check {
  label: string;
  passed: boolean;
  instruction: string;
}

function vis(lms: Landmark2D[], i: number): number {
  return lms[i]?.visibility ?? 0;
}

function checkFullBodyVisible(lms: Landmark2D[]): Check {
  const headOk = vis(lms, 0) > 0.4;
  const shouldersOk = vis(lms, 11) > 0.5 && vis(lms, 12) > 0.5;
  const hipsOk = vis(lms, 23) > 0.5 && vis(lms, 24) > 0.5;
  const kneeOk = vis(lms, 25) > 0.4 && vis(lms, 26) > 0.4;
  const passed = headOk && shouldersOk && hipsOk && kneeOk;
  return { label: "Full body visible", passed, instruction: "Step back so your full body is in frame" };
}

function checkAnklesVisible(lms: Landmark2D[]): Check {
  const passed = vis(lms, 27) > 0.4 && vis(lms, 28) > 0.4;
  return { label: "Feet visible", passed, instruction: "Step back further to show your feet" };
}

function checkDistance(lms: Landmark2D[]): Check {
  const sw = getShoulderWidth(lms);
  const tooClose = sw > 0.42;
  const tooFar = sw < 0.10;
  const passed = !tooClose && !tooFar;
  const instruction = tooClose ? "Step back from the camera" : tooFar ? "Step closer to the camera" : "Distance is good";
  return { label: "Camera distance", passed, instruction };
}

function checkCentered(lms: Landmark2D[]): Check {
  const lShoulder = lms[11], rShoulder = lms[12];
  if (!lShoulder || !rShoulder) return { label: "Body centered", passed: false, instruction: "Center yourself in frame" };
  const midX = (lShoulder.x + rShoulder.x) / 2;
  const passed = midX > 0.25 && midX < 0.75;
  const instruction = midX <= 0.25 ? "Move right to center yourself" : midX >= 0.75 ? "Move left to center yourself" : "Position is centered";
  return { label: "Body centered", passed, instruction };
}

function checkBodyHeight(lms: Landmark2D[]): Check {
  const height = getBodyHeight(lms);
  const passed = height > 0.55;
  return { label: "Body height in frame", passed, instruction: "Lower the camera or step closer so more of your body is visible" };
}

function checkHandsVisible(lms: Landmark2D[], required: boolean): Check {
  const lWristOk = vis(lms, 15) > 0.4;
  const rWristOk = vis(lms, 16) > 0.4;
  const passed = lWristOk && rWristOk;
  if (!required) return { label: "Hands visible", passed: true, instruction: "" };
  return { label: "Hands visible", passed, instruction: "Keep your hands visible in the frame" };
}

function checkLighting(lms: Landmark2D[]): Check {
  const avgVis = lms.slice(0, 25).reduce((sum, l) => sum + (l?.visibility ?? 0), 0) / 25;
  const passed = avgVis > 0.45;
  return { label: "Lighting", passed, instruction: "Improve lighting — face a window or turn on more lights" };
}

function checkViewAngle(lms: Landmark2D[], requiredAngle: "front" | "side"): Check {
  const lShoulder = lms[11], rShoulder = lms[12];
  if (!lShoulder || !rShoulder) return { label: "Camera angle", passed: false, instruction: `Turn to face ${requiredAngle === "front" ? "the camera" : "sideways"}` };
  const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
  const isFront = shoulderWidth > 0.08;
  const passed = requiredAngle === "front" ? isFront : !isFront;
  const instruction = requiredAngle === "front"
    ? "Face the camera directly"
    : "Turn sideways so your left shoulder faces the camera";
  return { label: "Camera angle", passed, instruction };
}

export function checkPosition(
  poseLandmarks: Landmark2D[],
  options: {
    viewAngle?: "front" | "side";
    requireHands?: boolean;
    requireFeet?: boolean;
  } = {}
): PositionCheckResult {
  const { viewAngle = "front", requireHands = false, requireFeet = false } = options;

  if (!poseLandmarks || poseLandmarks.length === 0) {
    return {
      isReady: false,
      checks: [{ label: "Body detected", passed: false, instruction: "Stand in front of the camera" }],
      overallScore: 0,
      primaryInstruction: "Stand in front of the camera",
    };
  }

  const checks: Check[] = [
    checkFullBodyVisible(poseLandmarks),
    checkDistance(poseLandmarks),
    checkCentered(poseLandmarks),
    checkBodyHeight(poseLandmarks),
    checkLighting(poseLandmarks),
    checkViewAngle(poseLandmarks, viewAngle),
  ];

  if (requireFeet) checks.push(checkAnklesVisible(poseLandmarks));
  if (requireHands) checks.push(checkHandsVisible(poseLandmarks, true));

  const passCount = checks.filter(c => c.passed).length;
  const overallScore = Math.round((passCount / checks.length) * 100);
  const isReady = overallScore >= 75 && checks[0].passed && checks[1].passed;

  const failedChecks = checks.filter(c => !c.passed);
  const primaryInstruction = failedChecks.length > 0 ? failedChecks[0].instruction : "Ready to begin!";

  return { isReady, checks, overallScore, primaryInstruction };
}

export function getPositionSpeechFeedback(result: PositionCheckResult): string {
  if (result.isReady) return "Good position. You are ready to begin.";
  return result.primaryInstruction;
}
