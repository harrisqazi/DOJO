import {
  PoseLandmarker,
  HandLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { Landmark2D, FullBodyTrackingResult, LandmarkVisibility } from "./types";
import { computeLandmarkVisibility } from "./confidence";

const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";

let poseLandmarker: PoseLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;
let tracking = false;
let animFrameId: number | null = null;
let lastVideoTime = -1;
let latestResult: FullBodyTrackingResult | null = null;
let initializingPromise: Promise<void> | null = null;

function mpToLm(lm: NormalizedLandmark): Landmark2D {
  return { x: lm.x, y: lm.y, visibility: lm.visibility ?? 1 };
}

function identifyHands(
  rawHandLms: NormalizedLandmark[][],
  rawHandedness: Array<Array<{ categoryName: string; score: number }>>
): { left?: Landmark2D[]; right?: Landmark2D[] } {
  let left: Landmark2D[] | undefined;
  let right: Landmark2D[] | undefined;

  for (let i = 0; i < rawHandLms.length; i++) {
    const hand = rawHandLms[i].map(mpToLm);
    const category = rawHandedness[i]?.[0]?.categoryName ?? "Right";
    if (category === "Left") {
      left = hand;
    } else {
      right = hand;
    }
  }

  return { left, right };
}

export async function initFullBodyTracker(): Promise<void> {
  if (poseLandmarker && handLandmarker) return;
  if (initializingPromise) return initializingPromise;

  initializingPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: POSE_MODEL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    try {
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: HAND_MODEL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    } catch (err) {
      console.warn("[fullBodyTracker] HandLandmarker unavailable:", err);
      handLandmarker = null;
    }
  })();

  return initializingPromise;
}

export function startTracking(
  videoEl: HTMLVideoElement,
  onFrame: (result: FullBodyTrackingResult) => void
): void {
  if (tracking) return;
  tracking = true;

  function loop() {
    if (!tracking) return;
    if (!poseLandmarker) { animFrameId = requestAnimationFrame(loop); return; }
    if (videoEl.readyState < 2) { animFrameId = requestAnimationFrame(loop); return; }
    if (videoEl.currentTime === lastVideoTime) { animFrameId = requestAnimationFrame(loop); return; }
    lastVideoTime = videoEl.currentTime;

    const nowMs = performance.now();

    const poseResult = poseLandmarker.detectForVideo(videoEl, nowMs);
    const poseLandmarks: Landmark2D[] = (poseResult.landmarks[0] ?? []).map(mpToLm);
    const poseWorldLandmarks = poseResult.worldLandmarks?.[0]?.map(l => ({
      x: l.x, y: l.y, z: l.z ?? 0, visibility: l.visibility ?? 1,
    }));

    let leftHandLandmarks: Landmark2D[] | undefined;
    let rightHandLandmarks: Landmark2D[] | undefined;

    if (handLandmarker && poseLandmarks.length > 0) {
      try {
        const handResult = handLandmarker.detectForVideo(videoEl, nowMs);
        const hands = identifyHands(handResult.landmarks, handResult.handedness);
        leftHandLandmarks = hands.left;
        rightHandLandmarks = hands.right;
      } catch {
        // hand detection failed silently
      }
    }

    const visibility = computeLandmarkVisibility(poseLandmarks, leftHandLandmarks, rightHandLandmarks);

    const result: FullBodyTrackingResult = {
      poseLandmarks,
      poseWorldLandmarks,
      leftHandLandmarks,
      rightHandLandmarks,
      visibility,
      timestampMs: nowMs,
    };

    latestResult = result;
    onFrame(result);

    animFrameId = requestAnimationFrame(loop);
  }

  animFrameId = requestAnimationFrame(loop);
}

export function stopTracking(): void {
  tracking = false;
  if (animFrameId != null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

export function disposeTracker(): void {
  stopTracking();
  poseLandmarker?.close();
  handLandmarker?.close();
  poseLandmarker = null;
  handLandmarker = null;
  latestResult = null;
  initializingPromise = null;
}

export function getLatestFrame(): FullBodyTrackingResult | null {
  return latestResult;
}

export function getTrackerStatus(): {
  initialized: boolean;
  tracking: boolean;
  hasHands: boolean;
} {
  return {
    initialized: poseLandmarker != null,
    tracking,
    hasHands: handLandmarker != null,
  };
}
