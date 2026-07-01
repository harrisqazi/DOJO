import type { DisciplineType, ScoringProfile } from "./types";

const TAI_CHI: ScoringProfile = {
  discipline: "tai_chi",
  coachingLanguageStyle: "calm",
  criticalBodyRegions: ["shoulders", "hips", "wrists", "knees", "feet"],
  phaseLabels: ["inhale_open", "shift", "turn", "exhale_press", "settle"],
  safetyRules: ["No sharp impacts", "Keep knees soft", "Maintain rooted stance"],
  metricWeights: {
    smoothness: 0.25,
    balanceScore: 0.15,
    hipShoulderSeparation: 0.10,
    centerlineCoverage: 0.10,
    spineAngle: 0.08,
    torsoLean: 0.07,
    stanceWidth: 0.08,
    wristPath: 0.08,
    handSymmetry: 0.05,
    footDirection: 0.04,
  },
  commonMistakes: [
    "Rushing transitions", "Raised shoulders", "Locked knees",
    "Wrists bent instead of relaxed", "Weight not shifting fully", "Breath not matching movement",
  ],
  toleranceRanges: {
    shoulderAngle: { degrees: 15, normalized: 0.15 },
    elbowAngle: { degrees: 20, normalized: 0.2 },
    kneeAngle: { degrees: 15, normalized: 0.15 },
    torsoLean: { degrees: 8, normalized: 0.08 },
  },
  scoreCategoryWeights: {
    upperBody: 0.25, lowerBody: 0.20, handsWrists: 0.20,
    feetStance: 0.15, balanceCenterline: 0.10, smoothness: 0.25, sequencing: 0.15,
  },
};

const SHAOLIN_KUNG_FU: ScoringProfile = {
  discipline: "shaolin_kung_fu",
  coachingLanguageStyle: "precise",
  criticalBodyRegions: ["hips", "knees", "ankles", "shoulders", "wrists", "fists"],
  phaseLabels: ["guard", "step", "block", "strike", "chamber", "recovery"],
  safetyRules: ["Maintain knee alignment over toe", "Control strike extension", "Keep guard up during recovery"],
  metricWeights: {
    stanceDepth: 0.15,
    stabilityScore: 0.12,
    kineticChainSequencing: 0.12,
    guardCoverage: 0.10,
    centerlineCoverage: 0.10,
    extensionScore: 0.08,
    recoveryControl: 0.08,
    footDirection: 0.08,
    hipShoulderSeparation: 0.07,
    balanceScore: 0.10,
  },
  commonMistakes: [
    "Stance too shallow", "Guard drops after strike", "Hip not powering strike",
    "Foot pivot incomplete", "Recovery too slow", "Centerline exposed",
  ],
  toleranceRanges: {
    kneeAngle: { degrees: 15, normalized: 0.15 },
    stanceWidth: { degrees: 0, normalized: 0.12 },
    guardHeight: { degrees: 20, normalized: 0.2 },
  },
  scoreCategoryWeights: {
    upperBody: 0.20, lowerBody: 0.25, handsWrists: 0.20,
    feetStance: 0.20, balanceCenterline: 0.15, smoothness: 0.10, sequencing: 0.15,
  },
};

const BOXING: ScoringProfile = {
  discipline: "boxing",
  coachingLanguageStyle: "energetic",
  criticalBodyRegions: ["shoulders", "elbows", "wrists", "hips", "ankles"],
  phaseLabels: ["guard", "step", "punch", "slip", "recovery"],
  safetyRules: ["Keep guard up at all times", "Rotate hip through punch", "Return to guard immediately"],
  metricWeights: {
    guardCoverage: 0.20,
    centerlineCoverage: 0.15,
    hipShoulderSeparation: 0.15,
    recoveryControl: 0.12,
    balanceScore: 0.10,
    kineticChainSequencing: 0.10,
    extensionScore: 0.08,
    footDirection: 0.05,
    smoothness: 0.05,
  },
  commonMistakes: [
    "Guard drops during punch", "Hip not rotating", "Elbow flaring out",
    "No recovery after combination", "Feet too close together", "Chin exposed",
  ],
  toleranceRanges: {
    elbowAngle: { degrees: 25, normalized: 0.25 },
    shoulderAngle: { degrees: 20, normalized: 0.2 },
    hipRotation: { degrees: 20, normalized: 0.2 },
  },
  scoreCategoryWeights: {
    upperBody: 0.25, lowerBody: 0.20, handsWrists: 0.25,
    feetStance: 0.15, balanceCenterline: 0.20, smoothness: 0.05, sequencing: 0.20,
  },
};

const GYMNASTICS: ScoringProfile = {
  discipline: "gymnastics",
  coachingLanguageStyle: "precise",
  criticalBodyRegions: ["shoulders", "hips", "knees", "ankles", "spine"],
  phaseLabels: ["preparation", "takeoff", "extension", "flight_or_control", "landing", "stabilization"],
  safetyRules: ["Land with bent knees", "Maintain body tension", "Control speed of rotation"],
  metricWeights: {
    leftRightSymmetry: 0.20,
    extensionScore: 0.18,
    stabilityScore: 0.15,
    balanceScore: 0.12,
    spineAngle: 0.10,
    kneeTrackingOverToe: 0.10,
    smoothness: 0.08,
    upperLowerBodyCoordination: 0.07,
  },
  commonMistakes: [
    "Knees bending before landing", "Asymmetrical arms", "Lack of full extension",
    "Body not tight", "Uncontrolled landing", "Head position incorrect",
  ],
  toleranceRanges: {
    shoulderAngle: { degrees: 10, normalized: 0.1 },
    kneeAngle: { degrees: 10, normalized: 0.1 },
    spineAngle: { degrees: 8, normalized: 0.08 },
  },
  scoreCategoryWeights: {
    upperBody: 0.25, lowerBody: 0.25, handsWrists: 0.15,
    feetStance: 0.20, balanceCenterline: 0.15, smoothness: 0.15, sequencing: 0.10,
  },
};

const GOLF: ScoringProfile = {
  discipline: "golf",
  coachingLanguageStyle: "calm",
  criticalBodyRegions: ["spine", "hips", "shoulders", "lead_arm", "wrists"],
  phaseLabels: ["address", "takeaway", "backswing", "transition", "downswing", "impact_zone", "follow_through", "finish"],
  safetyRules: ["Protect lower back", "Maintain spine angle", "No excessive lateral sway"],
  metricWeights: {
    spineAngle: 0.20,
    hipShoulderSeparation: 0.18,
    torsoLean: 0.12,
    leftRightSymmetry: 0.10,
    balanceScore: 0.12,
    kineticChainSequencing: 0.12,
    upperLowerBodyCoordination: 0.10,
    smoothness: 0.06,
  },
  commonMistakes: [
    "Early extension", "Reverse pivot", "Casting from top", "Chicken wing",
    "Weight not transferring", "Head moving forward", "Over-the-top swing path",
  ],
  toleranceRanges: {
    spineAngle: { degrees: 5, normalized: 0.05 },
    hipSeparation: { degrees: 15, normalized: 0.15 },
  },
  scoreCategoryWeights: {
    upperBody: 0.25, lowerBody: 0.20, handsWrists: 0.15,
    feetStance: 0.15, balanceCenterline: 0.15, smoothness: 0.15, sequencing: 0.25,
  },
};

const YOGA: ScoringProfile = {
  discipline: "yoga",
  coachingLanguageStyle: "calm",
  criticalBodyRegions: ["spine", "hips", "shoulders", "knees", "ankles"],
  phaseLabels: ["enter_pose", "hold", "adjust", "exit_pose"],
  safetyRules: ["Never force range of motion", "Keep joints safe", "Respect individual limits"],
  metricWeights: {
    spineAngle: 0.18,
    leftRightSymmetry: 0.15,
    balanceScore: 0.15,
    stabilityScore: 0.12,
    kneeTrackingOverToe: 0.10,
    smoothness: 0.12,
    footDirection: 0.08,
    torsoLean: 0.10,
  },
  commonMistakes: [
    "Collapsing into the pose", "Holding breath", "Forcing deeper than comfortable",
    "Knees locking", "Hip not leveling", "Shoulders raised",
  ],
  toleranceRanges: {
    all: { degrees: 20, normalized: 0.2 },
  },
  scoreCategoryWeights: {
    upperBody: 0.20, lowerBody: 0.20, handsWrists: 0.15,
    feetStance: 0.20, balanceCenterline: 0.15, smoothness: 0.20, sequencing: 0.05,
  },
};

const PHYSICAL_THERAPY: ScoringProfile = {
  discipline: "physical_therapy",
  coachingLanguageStyle: "therapeutic",
  criticalBodyRegions: ["knees", "hips", "spine", "shoulders"],
  phaseLabels: ["enter_pose", "hold", "adjust", "exit_pose"],
  safetyRules: [
    "Stop if pain occurs", "Stay within prescribed range", "Move slowly and controlled",
    "Maintain joint alignment", "Do not compensate with other body parts",
  ],
  metricWeights: {
    stabilityScore: 0.20,
    leftRightSymmetry: 0.18,
    smoothness: 0.18,
    kneeTrackingOverToe: 0.12,
    spineAngle: 0.10,
    balanceScore: 0.10,
    compressionScore: 0.07,
    torsoLean: 0.05,
  },
  commonMistakes: [
    "Compensating with unaffected side", "Moving too fast", "Exceeding pain-free range",
    "Losing neutral spine", "Holding breath", "Incomplete movement pattern",
  ],
  toleranceRanges: {
    all: { degrees: 25, normalized: 0.25 },
  },
  scoreCategoryWeights: {
    upperBody: 0.15, lowerBody: 0.25, handsWrists: 0.10,
    feetStance: 0.20, balanceCenterline: 0.15, smoothness: 0.25, sequencing: 0.10,
  },
};

const DANCE: ScoringProfile = {
  discipline: "dance",
  coachingLanguageStyle: "energetic",
  criticalBodyRegions: ["shoulders", "hips", "arms", "feet", "spine"],
  phaseLabels: ["setup", "ready", "initiation", "transition", "peak", "recovery", "finish"],
  safetyRules: ["Land with bent knees", "Keep core engaged", "Control momentum"],
  metricWeights: {
    smoothness: 0.22,
    hipShoulderSeparation: 0.15,
    leftRightSymmetry: 0.13,
    upperLowerBodyCoordination: 0.13,
    balanceScore: 0.10,
    extensionScore: 0.10,
    footDirection: 0.08,
    handSymmetry: 0.09,
  },
  commonMistakes: [
    "Arms not finishing the line", "Hips not isolating", "Steps not hitting the beat",
    "Lack of extension", "Asymmetrical transitions", "Upper/lower body not coordinating",
  ],
  toleranceRanges: {
    all: { degrees: 18, normalized: 0.18 },
  },
  scoreCategoryWeights: {
    upperBody: 0.25, lowerBody: 0.20, handsWrists: 0.20,
    feetStance: 0.15, balanceCenterline: 0.10, smoothness: 0.25, sequencing: 0.15,
  },
};

const GENERAL_MARTIAL_ARTS: ScoringProfile = {
  discipline: "general_martial_arts",
  coachingLanguageStyle: "precise",
  criticalBodyRegions: ["hips", "shoulders", "knees", "wrists", "feet"],
  phaseLabels: ["guard", "step", "block", "strike", "kick", "turn", "chamber", "recovery"],
  safetyRules: ["Maintain guard", "Control extension", "Protect centerline"],
  metricWeights: {
    guardCoverage: 0.15,
    centerlineCoverage: 0.13,
    balanceScore: 0.13,
    stanceWidth: 0.10,
    hipShoulderSeparation: 0.10,
    recoveryControl: 0.10,
    kineticChainSequencing: 0.10,
    footDirection: 0.08,
    extensionScore: 0.07,
    smoothness: 0.04,
  },
  commonMistakes: [
    "Guard drops after technique", "Hip not powering strike", "Stance too narrow",
    "No recovery after attack", "Centerline exposed", "Weight on back foot after advancing",
  ],
  toleranceRanges: {
    all: { degrees: 20, normalized: 0.2 },
  },
  scoreCategoryWeights: {
    upperBody: 0.20, lowerBody: 0.25, handsWrists: 0.20,
    feetStance: 0.20, balanceCenterline: 0.15, smoothness: 0.08, sequencing: 0.15,
  },
};

export const SCORING_PROFILES: Record<DisciplineType, ScoringProfile> = {
  tai_chi: TAI_CHI,
  yang_24: TAI_CHI,
  wing_chun: GENERAL_MARTIAL_ARTS,
  karate: GENERAL_MARTIAL_ARTS,
  wushu: SHAOLIN_KUNG_FU,
  shaolin_kung_fu: SHAOLIN_KUNG_FU,
  boxing: BOXING,
  gymnastics: GYMNASTICS,
  golf: GOLF,
  yoga: YOGA,
  dance: DANCE,
  physical_therapy: PHYSICAL_THERAPY,
  general_martial_arts: GENERAL_MARTIAL_ARTS,
};

export function getScoringProfile(discipline: DisciplineType | string): ScoringProfile {
  return SCORING_PROFILES[discipline as DisciplineType] ?? GENERAL_MARTIAL_ARTS;
}

export const DISCIPLINE_LABELS: Record<DisciplineType, string> = {
  tai_chi: "Tai Chi",
  yang_24: "Yang 24",
  wing_chun: "Wing Chun",
  karate: "Karate",
  wushu: "Wushu",
  shaolin_kung_fu: "Shaolin Kung Fu",
  boxing: "Boxing",
  gymnastics: "Gymnastics",
  golf: "Golf",
  yoga: "Yoga",
  dance: "Dance",
  physical_therapy: "Physical Therapy",
  general_martial_arts: "Martial Arts",
};
