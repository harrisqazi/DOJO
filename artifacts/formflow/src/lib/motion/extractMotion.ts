import type {
  Landmark2D, Landmark3D, MotionFrame, LandmarkVisibility,
  JointAngleMap, JointVelocityMap, JointAccelerationMap, CalibrationProfile
} from "./types";
import { computeAllJointAngles } from "./angles";
import { computeJointVelocities, computeJointAccelerations, computeWristSpeed, computeAnkleSpeed, computeHipSpeed } from "./velocity";
import { smoothLandmarks, jitterReduceLandmarks } from "./smoothing";
import { computeBiomechanics, computeCenterOfMass } from "./biomechanics";
import { computeLandmarkVisibility, computeFrameConfidence, getLowConfidenceReasons } from "./confidence";

const EMPTY_ANGLES: JointAngleMap = {};
const EMPTY_VELOCITIES: JointVelocityMap = {};
const EMPTY_ACCELERATIONS: JointAccelerationMap = {};

export function extractMotionFrame(params: {
  poseLandmarks: Landmark2D[];
  poseWorldLandmarks?: Landmark3D[];
  leftHandLandmarks?: Landmark2D[];
  rightHandLandmarks?: Landmark2D[];
  timestampMs: number;
  frameIndex: number;
  previousFrames: MotionFrame[];
  calibrationProfile?: CalibrationProfile;
  phaseLabel?: string;
}): MotionFrame {
  const {
    poseLandmarks, poseWorldLandmarks, leftHandLandmarks, rightHandLandmarks,
    timestampMs, frameIndex, previousFrames, calibrationProfile, phaseLabel
  } = params;

  const prevFrame = previousFrames[previousFrames.length - 1];
  const deltaMs = prevFrame ? timestampMs - prevFrame.timestampMs : 33;

  const smoothedPose = prevFrame
    ? smoothLandmarks(
        jitterReduceLandmarks(poseLandmarks, prevFrame.poseLandmarks),
        prevFrame.poseLandmarks,
        0.72
      )
    : poseLandmarks;

  const smoothedLeftHand = leftHandLandmarks && prevFrame?.leftHandLandmarks
    ? smoothLandmarks(leftHandLandmarks, prevFrame.leftHandLandmarks, 0.68)
    : leftHandLandmarks;

  const smoothedRightHand = rightHandLandmarks && prevFrame?.rightHandLandmarks
    ? smoothLandmarks(rightHandLandmarks, prevFrame.rightHandLandmarks, 0.68)
    : rightHandLandmarks;

  const jointAngles = computeAllJointAngles(smoothedPose, smoothedLeftHand, smoothedRightHand);

  const prevAngles = prevFrame?.jointAngles ?? EMPTY_ANGLES;
  const prevVelocities = prevFrame?.jointVelocities ?? EMPTY_VELOCITIES;

  const jointVelocities = computeJointVelocities(jointAngles, prevAngles, deltaMs);
  const jointAccelerations = computeJointAccelerations(jointVelocities, prevVelocities, deltaMs);

  const wristSpeed = prevFrame ? computeWristSpeed(smoothedPose, prevFrame.poseLandmarks, deltaMs) : 0;
  const ankleSpeed = prevFrame ? computeAnkleSpeed(smoothedPose, prevFrame.poseLandmarks, deltaMs) : 0;
  const hipSpeed = prevFrame ? computeHipSpeed(smoothedPose, prevFrame.poseLandmarks, deltaMs) : 0;
  const com = computeCenterOfMass(smoothedPose);

  jointVelocities.wristSpeed = wristSpeed;
  jointVelocities.ankleSpeed = ankleSpeed;
  jointVelocities.hipSpeed = hipSpeed;
  jointVelocities.centerOfMassSpeed = prevFrame
    ? Math.sqrt((com.x - computeCenterOfMass(prevFrame.poseLandmarks).x) ** 2 + (com.y - computeCenterOfMass(prevFrame.poseLandmarks).y) ** 2) / (deltaMs / 1000)
    : 0;

  const biomechanics = computeBiomechanics(
    smoothedPose, smoothedLeftHand, smoothedRightHand,
    prevAngles, prevVelocities, deltaMs,
    previousFrames, calibrationProfile
  );

  const visibility = computeLandmarkVisibility(smoothedPose, smoothedLeftHand, smoothedRightHand);
  const confidence = computeFrameConfidence(smoothedPose, smoothedLeftHand, smoothedRightHand);
  const lowConfidenceReasons = getLowConfidenceReasons(smoothedPose, smoothedLeftHand, smoothedRightHand);

  return {
    timestampMs,
    frameIndex,
    poseLandmarks: smoothedPose,
    poseWorldLandmarks,
    leftHandLandmarks: smoothedLeftHand,
    rightHandLandmarks: smoothedRightHand,
    jointAngles,
    jointVelocities,
    jointAccelerations,
    biomechanics,
    visibility,
    confidence,
    phaseLabel,
    lowConfidenceReasons,
  };
}
