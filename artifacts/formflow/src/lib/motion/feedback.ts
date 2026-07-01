import type { ComparisonResult, FeedbackItem, DisciplineType, ScoringProfile } from "./types";
import { getScoringProfile } from "./scoringProfiles";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function calmPrefix(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Fair";
  return "Needs work on";
}

export function generateSpokenFeedbackSummary(
  result: ComparisonResult,
  discipline: DisciplineType
): string {
  const profile = getScoringProfile(discipline);
  const score = result.overallScore;

  const opening = score >= 75
    ? "Great work! "
    : score >= 55
    ? "Good effort! "
    : "Keep practicing! ";

  const goodLine = result.goodFeedback[0]
    ? `${result.goodFeedback[0].message} `
    : "";

  const improveLine = result.improvementFeedback[0]
    ? `Focus next on: ${result.improvementFeedback[0].message} `
    : "";

  const drillLine = result.recommendedDrills[0]
    ? `Suggested drill: ${result.recommendedDrills[0]}.`
    : "";

  return `${opening}Your overall score is ${score} out of 100. ${goodLine}${improveLine}${drillLine}`;
}

export function generateScoreNarrative(result: ComparisonResult, discipline: DisciplineType): string {
  const profile = getScoringProfile(discipline);
  const style = profile.coachingLanguageStyle;

  const lines: string[] = [];

  if (result.overallScore >= 80) {
    lines.push("Outstanding performance. Your movement closely matched the instructor.");
  } else if (result.overallScore >= 65) {
    lines.push("Solid effort. You captured the main shape of the movement.");
  } else if (result.overallScore >= 50) {
    lines.push("Good start. There are clear areas to refine.");
  } else {
    lines.push("Keep going. Every rep builds the pattern.");
  }

  return lines.join(" ");
}

export function formatFeedbackForDisplay(result: ComparisonResult, discipline: DisciplineType): {
  headline: string;
  narrative: string;
  goodPoints: string[];
  improvements: string[];
  drills: string[];
  confidenceNote?: string;
} {
  const profile = getScoringProfile(discipline);
  const good = result.goodFeedback.map(f => f.message);
  const improvements = result.improvementFeedback
    .filter(f => f.type !== "confidence")
    .map(f => f.message);
  const confidenceItems = result.improvementFeedback
    .filter(f => f.type === "confidence")
    .map(f => f.message);

  const headline = result.overallScore >= 75
    ? "Well done! Solid form."
    : result.overallScore >= 55
    ? "Good effort, a few things to sharpen."
    : "Keep practicing — you're building the pattern.";

  return {
    headline,
    narrative: generateScoreNarrative(result, discipline),
    goodPoints: good.length > 0 ? good : ["Movement captured — see details below"],
    improvements,
    drills: result.recommendedDrills,
    confidenceNote: confidenceItems.length > 0 ? confidenceItems.join(" ") : undefined,
  };
}

export function generateBodyPartSummary(result: ComparisonResult): Array<{
  bodyPart: string;
  score: number;
  label: string;
}> {
  return [
    { bodyPart: "Upper Body", score: result.upperBodyScore, label: calmPrefix(result.upperBodyScore) },
    { bodyPart: "Lower Body", score: result.lowerBodyScore, label: calmPrefix(result.lowerBodyScore) },
    { bodyPart: "Hands & Wrists", score: result.handsWristsScore, label: calmPrefix(result.handsWristsScore) },
    { bodyPart: "Feet & Stance", score: result.feetStanceScore, label: calmPrefix(result.feetStanceScore) },
    { bodyPart: "Balance", score: result.balanceCenterlineScore, label: calmPrefix(result.balanceCenterlineScore) },
    { bodyPart: "Smoothness", score: result.smoothnessScore, label: calmPrefix(result.smoothnessScore) },
    { bodyPart: "Sequencing", score: result.sequencingScore, label: calmPrefix(result.sequencingScore) },
  ];
}

export function getTopPriority(result: ComparisonResult): FeedbackItem | undefined {
  return result.improvementFeedback.find(f => f.severity === "high") ??
    result.improvementFeedback[0];
}

export function getRankLabel(overallScore: number): string {
  if (overallScore >= 90) return "Master";
  if (overallScore >= 80) return "Advanced";
  if (overallScore >= 70) return "Proficient";
  if (overallScore >= 60) return "Developing";
  if (overallScore >= 45) return "Beginner";
  return "Novice";
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 65) return "#3b82f6";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}
