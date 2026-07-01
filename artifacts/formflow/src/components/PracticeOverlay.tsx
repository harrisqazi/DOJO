import { useRef, useEffect } from "react";
import type { Landmark2D, ComparisonResult } from "../lib/motion/types";
import AvatarOverlay, { InstructorAvatarOverlay } from "./AvatarOverlay";

interface Props {
  userPoseLandmarks: Landmark2D[];
  userLeftHandLandmarks?: Landmark2D[];
  userRightHandLandmarks?: Landmark2D[];
  instructorPoseLandmarks?: Landmark2D[];
  instructorLeftHandLandmarks?: Landmark2D[];
  instructorRightHandLandmarks?: Landmark2D[];
  width: number;
  height: number;
  mode: "live_with_instructor_overlay" | "skeleton_only" | "side_by_side";
  currentScore?: number;
  currentFeedbackLine?: string;
  showScore?: boolean;
}

function ScoreHUD({ score, feedbackLine }: { score: number; feedbackLine?: string }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="absolute top-3 right-3 flex flex-col items-end gap-1 pointer-events-none">
      <div
        className="rounded-xl px-3 py-1.5 text-white font-bold text-xl shadow-lg"
        style={{ background: `${color}22`, border: `1.5px solid ${color}55` }}
      >
        <span style={{ color }}>{score}</span>
        <span className="text-xs text-gray-400 ml-1">/ 100</span>
      </div>
      {feedbackLine && (
        <div className="bg-black/70 rounded-lg px-2 py-1 max-w-[200px] text-right">
          <p className="text-xs text-gray-200 leading-snug">{feedbackLine}</p>
        </div>
      )}
    </div>
  );
}

export default function PracticeOverlay({
  userPoseLandmarks,
  userLeftHandLandmarks,
  userRightHandLandmarks,
  instructorPoseLandmarks,
  instructorLeftHandLandmarks,
  instructorRightHandLandmarks,
  width,
  height,
  mode,
  currentScore,
  currentFeedbackLine,
  showScore = true,
}: Props) {
  if (mode === "skeleton_only") {
    return (
      <div style={{ position: "relative", width, height }}>
        <div style={{ position: "absolute", inset: 0, background: "#111" }} />
        {instructorPoseLandmarks && instructorPoseLandmarks.length > 0 && (
          <InstructorAvatarOverlay
            poseLandmarks={instructorPoseLandmarks}
            leftHandLandmarks={instructorLeftHandLandmarks}
            rightHandLandmarks={instructorRightHandLandmarks}
            width={width}
            height={height}
            opacity={0.5}
          />
        )}
        {userPoseLandmarks.length > 0 && (
          <AvatarOverlay
            poseLandmarks={userPoseLandmarks}
            leftHandLandmarks={userLeftHandLandmarks}
            rightHandLandmarks={userRightHandLandmarks}
            width={width}
            height={height}
            color="#3b82f6"
            opacity={0.9}
            mirrorX
          />
        )}
        {showScore && currentScore != null && (
          <ScoreHUD score={currentScore} feedbackLine={currentFeedbackLine} />
        )}
      </div>
    );
  }

  if (mode === "side_by_side") {
    const half = Math.floor(width / 2);
    return (
      <div style={{ position: "relative", width, height, display: "flex" }}>
        <div style={{ position: "relative", width: half, height, background: "#0a0a0a", borderRight: "1px solid #222" }}>
          <div className="absolute top-2 left-2 text-xs text-purple-400 font-medium bg-black/50 px-2 py-0.5 rounded z-10">Instructor</div>
          {instructorPoseLandmarks && (
            <AvatarOverlay poseLandmarks={instructorPoseLandmarks} leftHandLandmarks={instructorLeftHandLandmarks} rightHandLandmarks={instructorRightHandLandmarks} width={half} height={height} color="#a78bfa" opacity={0.9} mirrorX={false} />
          )}
        </div>
        <div style={{ position: "relative", width: half, height, background: "#050505" }}>
          <div className="absolute top-2 left-2 text-xs text-blue-400 font-medium bg-black/50 px-2 py-0.5 rounded z-10">You</div>
          {userPoseLandmarks.length > 0 && (
            <AvatarOverlay poseLandmarks={userPoseLandmarks} leftHandLandmarks={userLeftHandLandmarks} rightHandLandmarks={userRightHandLandmarks} width={half} height={height} color="#3b82f6" opacity={0.9} mirrorX />
          )}
        </div>
        {showScore && currentScore != null && (
          <ScoreHUD score={currentScore} feedbackLine={currentFeedbackLine} />
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width, height }}>
      {instructorPoseLandmarks && instructorPoseLandmarks.length > 0 && (
        <InstructorAvatarOverlay
          poseLandmarks={instructorPoseLandmarks}
          leftHandLandmarks={instructorLeftHandLandmarks}
          rightHandLandmarks={instructorRightHandLandmarks}
          width={width}
          height={height}
          opacity={0.5}
        />
      )}
      {userPoseLandmarks.length > 0 && (
        <AvatarOverlay
          poseLandmarks={userPoseLandmarks}
          leftHandLandmarks={userLeftHandLandmarks}
          rightHandLandmarks={userRightHandLandmarks}
          width={width}
          height={height}
          color="#3b82f6"
          opacity={0.85}
          mirrorX
        />
      )}
      {showScore && currentScore != null && (
        <ScoreHUD score={currentScore} feedbackLine={currentFeedbackLine} />
      )}
    </div>
  );
}
