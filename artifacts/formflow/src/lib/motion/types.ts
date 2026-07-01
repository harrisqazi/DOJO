export interface Landmark2D {
  x: number;
  y: number;
  visibility?: number;
  confidence?: number;
}

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  confidence?: number;
}

export interface LandmarkVisibility {
  body: number;
  leftHand: number;
  rightHand: number;
  feet: number;
  face?: number;
  lowConfidenceReasons: string[];
}

export interface BodyLandmarks {
  poseLandmarks: Landmark2D[];
  poseWorldLandmarks?: Landmark3D[];
}

export interface HandLandmarks {
  leftHandLandmarks?: Landmark2D[];
  rightHandLandmarks?: Landmark2D[];
  handednessConfidence?: number;
}

export interface JointAngleMap {
  leftShoulder?: number;
  rightShoulder?: number;
  leftElbow?: number;
  rightElbow?: number;
  leftWrist?: number;
  rightWrist?: number;
  leftHip?: number;
  rightHip?: number;
  leftKnee?: number;
  rightKnee?: number;
  leftAnkle?: number;
  rightAnkle?: number;
  torsoLean?: number;
  spineAngle?: number;
  neckAlignment?: number;
  hipShoulderSeparation?: number;
  shoulderLineTilt?: number;
  hipLineTilt?: number;
  leftFootDirection?: number;
  rightFootDirection?: number;
  leftToeAngle?: number;
  rightToeAngle?: number;
  leftPalmAngle?: number;
  rightPalmAngle?: number;
  centerlineAlignment?: number;
  guardHeightAngle?: number;
}

export interface JointVelocityMap {
  leftShoulder?: number;
  rightShoulder?: number;
  leftElbow?: number;
  rightElbow?: number;
  leftWrist?: number;
  rightWrist?: number;
  leftHip?: number;
  rightHip?: number;
  leftKnee?: number;
  rightKnee?: number;
  leftAnkle?: number;
  rightAnkle?: number;
  wristSpeed?: number;
  ankleSpeed?: number;
  hipSpeed?: number;
  centerOfMassSpeed?: number;
}

export interface JointAccelerationMap {
  leftShoulder?: number;
  rightShoulder?: number;
  leftElbow?: number;
  rightElbow?: number;
  leftWrist?: number;
  rightWrist?: number;
  leftHip?: number;
  rightHip?: number;
  leftKnee?: number;
  rightKnee?: number;
  leftAnkle?: number;
  rightAnkle?: number;
  wristAcceleration?: number;
  ankleAcceleration?: number;
  hipAcceleration?: number;
  centerOfMassAcceleration?: number;
}

export interface Point2D { x: number; y: number; }

export interface BiomechanicsMetrics {
  jointAngles: JointAngleMap;
  angularVelocity: JointVelocityMap;
  angularAcceleration: JointAccelerationMap;
  jerk: number;
  smoothness: number;
  centerOfMassEstimate: Point2D;
  baseOfSupport: { left: Point2D; right: Point2D; width: number };
  balanceScore: number;
  stabilityScore: number;
  hipShoulderSeparation: number;
  spineAngle: number;
  torsoLean: number;
  stanceWidth: number;
  stanceDepth: number;
  kneeTrackingOverToe: { left: number; right: number };
  footDirection: { left: number; right: number };
  toeAlignment: { left: number; right: number };
  heelLift: { left: number; right: number };
  wristPath: { left: Point2D; right: Point2D };
  handShape: { leftOpen: number; rightOpen: number };
  handSymmetry: number;
  upperLowerBodyCoordination: number;
  kineticChainSequencing: number;
  leftRightSymmetry: number;
  extensionScore: number;
  compressionScore: number;
  guardCoverage: number;
  centerlineCoverage: number;
  recoveryControl: number;
  metricConfidence: Partial<Record<keyof BiomechanicsMetrics, number>>;
}

export interface MotionFrame {
  timestampMs: number;
  frameIndex: number;
  poseLandmarks: Landmark2D[];
  poseWorldLandmarks?: Landmark3D[];
  leftHandLandmarks?: Landmark2D[];
  rightHandLandmarks?: Landmark2D[];
  jointAngles: JointAngleMap;
  jointVelocities: JointVelocityMap;
  jointAccelerations: JointAccelerationMap;
  biomechanics: BiomechanicsMetrics;
  visibility: LandmarkVisibility;
  confidence: number;
  phaseLabel?: string;
  lowConfidenceReasons: string[];
}

export interface MotionSegment {
  label: string;
  startMs: number;
  endMs: number;
  confidence: number;
  primaryBodyParts: string[];
  metrics: Partial<BiomechanicsMetrics>;
}

export interface MotionSequence {
  id?: string;
  title: string;
  discipline: DisciplineType;
  viewAngle: "front" | "side";
  durationMs: number;
  fps: number;
  frames: MotionFrame[];
  segments: MotionSegment[];
  calibrationProfile?: CalibrationProfile;
  createdAt?: string;
  updatedAt?: string;
}

export interface NormalizedJointPath {
  joint: string;
  points: Array<{ t: number; angle: number; x: number; y: number }>;
}

export interface MotionFingerprint {
  id?: string;
  trainingRecordingId?: string;
  discipline: DisciplineType;
  viewAngle: "front" | "side";
  normalizedIdealJointPaths: NormalizedJointPath[];
  idealJointAngleRanges: Record<string, { min: number; max: number; mean: number }>;
  velocityCurves: Record<string, number[]>;
  accelerationCurves: Record<string, number[]>;
  smoothnessProfile: number[];
  centerOfMassPath: Point2D[];
  stanceProfile: { width: number; depth: number; leftFoot: number; rightFoot: number };
  handFingerProfile: { leftOpen: number[]; rightOpen: number[]; symmetry: number[] };
  footToeProfile: { leftDir: number[]; rightDir: number[] };
  phaseLabels: string[];
  phaseKeyframes: Record<string, number>;
  commonMistakes: string[];
  coachingCues: string[];
  confidenceThresholds: Record<string, number>;
  bodyPartImportanceWeights: Record<string, number>;
  durationMs: number;
  fps: number;
  createdAt?: string;
  updatedAt?: string;
}

export type DisciplineType =
  | "tai_chi"
  | "yang_24"
  | "wing_chun"
  | "karate"
  | "wushu"
  | "shaolin_kung_fu"
  | "boxing"
  | "gymnastics"
  | "golf"
  | "yoga"
  | "dance"
  | "physical_therapy"
  | "general_martial_arts";

export interface ScoringProfile {
  discipline: DisciplineType;
  metricWeights: Record<string, number>;
  criticalBodyRegions: string[];
  toleranceRanges: Record<string, { degrees: number; normalized: number }>;
  commonMistakes: string[];
  coachingLanguageStyle: "calm" | "precise" | "energetic" | "therapeutic";
  phaseLabels: string[];
  safetyRules: string[];
  scoreCategoryWeights: {
    upperBody: number;
    lowerBody: number;
    handsWrists: number;
    feetStance: number;
    balanceCenterline: number;
    smoothness: number;
    sequencing: number;
  };
}

export interface MistakeDetection {
  id: string;
  label: string;
  bodyPart: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  startMs: number;
  endMs: number;
  explanation: string;
  correctionCue: string;
}

export interface PhaseScore {
  phase: string;
  score: number;
  confidence: number;
  feedback: string;
}

export interface ComparisonResult {
  overallScore: number;
  confidence: number;
  upperBodyScore: number;
  lowerBodyScore: number;
  handsWristsScore: number;
  feetStanceScore: number;
  balanceCenterlineScore: number;
  smoothnessScore: number;
  sequencingScore: number;
  phaseScores: PhaseScore[];
  goodFeedback: FeedbackItem[];
  improvementFeedback: FeedbackItem[];
  mistakeDetections: MistakeDetection[];
  worstMismatchMoments: Array<{ timestampMs: number; bodyPart: string; deviation: number; correctionCue: string }>;
  replayData: Array<{ timestampMs: number; userFrame: MotionFrame; instructorFrame?: MotionFrame }>;
  recommendedDrills: string[];
}

export interface FeedbackItem {
  type: "good" | "improve" | "safety" | "confidence";
  title: string;
  bodyPart: string;
  message: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  startMs?: number;
  endMs?: number;
  drillSuggestion?: string;
}

export interface CalibrationProfile {
  userId?: string;
  bodyScale: { height: number; shoulderWidth: number; hipWidth: number; torsoLength: number; legLength: number; armLength: number };
  limbLengths: { upperArm: number; forearm: number; thigh: number; shin: number };
  handedness?: "left" | "right" | "ambidextrous";
  baselineMobility: { shoulderFlex: number; hipFlex: number; kneeRange: number; ankleRange: number };
  cameraFraming: { distance: string; height: string; angle: string; bodyVisible: number };
  visibilityBaseline: { head: number; shoulders: number; hips: number; knees: number; ankles: number; hands: number; feet: number };
  createdAt?: string;
}

export interface InstructorCue {
  timestampMs: number;
  phaseLabel: string;
  text: string;
  speechText: string;
  breathingCue?: string;
}

export type RecordingViewAngle = "front" | "side";

export interface TrainingRecordingData {
  id: string;
  trainingRecordingGroupId?: string;
  title: string;
  discipline: DisciplineType;
  viewAngle: RecordingViewAngle;
  videoUrl?: string;
  motionData: MotionSequence;
  motionFingerprint: MotionFingerprint;
  durationMs: number;
  fps: number;
  isPublished: boolean;
  instructorName?: string;
  instructions?: string;
  breathingCues?: InstructorCue[];
}

export interface TrainingRecordingGroupData {
  id: string;
  title: string;
  discipline: DisciplineType;
  difficulty?: string;
  instructorUserId: string;
  instructorName?: string;
  frontRecordingId?: string;
  sideRecordingId?: string;
  defaultViewAngle: RecordingViewAngle;
  description?: string;
  instructions?: string;
  isPublished: boolean;
  hasFrontView: boolean;
  hasSideView: boolean;
}

export type ReplayMode =
  | "video_with_skeleton"
  | "video_only"
  | "skeleton_only"
  | "live_with_instructor_overlay"
  | "side_by_side"
  | "comparison_replay";

export interface FullBodyTrackingResult {
  poseLandmarks: Landmark2D[];
  poseWorldLandmarks?: Landmark3D[];
  leftHandLandmarks?: Landmark2D[];
  rightHandLandmarks?: Landmark2D[];
  visibility: LandmarkVisibility;
  timestampMs: number;
}

export interface PositionCheckResult {
  isReady: boolean;
  checks: Array<{ label: string; passed: boolean; instruction: string }>;
  overallScore: number;
  primaryInstruction: string;
}
