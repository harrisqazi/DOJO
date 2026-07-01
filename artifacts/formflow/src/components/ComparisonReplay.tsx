import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, SlidersHorizontal } from "lucide-react";
import type { ComparisonResult, MotionFrame, DisciplineType } from "../lib/motion/types";
import AvatarOverlay, { InstructorAvatarOverlay } from "./AvatarOverlay";
import MotionScoreBreakdown from "./MotionScoreBreakdown";

interface Props {
  result: ComparisonResult;
  discipline: DisciplineType;
  width?: number;
  height?: number;
  onPracticeAgain?: () => void;
  onRequestCoachReview?: () => void;
}

type ReplayMode = "side_by_side" | "skeleton_only" | "user_only" | "instructor_only";

export default function ComparisonReplay({
  result,
  discipline,
  width = 720,
  height = 405,
  onPracticeAgain,
  onRequestCoachReview,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [mode, setMode] = useState<ReplayMode>("side_by_side");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const replayData = result.replayData;
  const totalFrames = replayData.length;
  const currentEntry = replayData[frameIdx];

  const tick = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
    const elapsed = (timestamp - lastTimeRef.current) * speed;

    if (frameIdx >= totalFrames - 1) {
      setPlaying(false);
      lastTimeRef.current = 0;
      return;
    }

    const currentMs = replayData[frameIdx]?.timestampMs ?? 0;
    const nextMs = replayData[frameIdx + 1]?.timestampMs ?? currentMs + 33;
    const frameDuration = (nextMs - currentMs) / speed;

    if (elapsed >= frameDuration) {
      lastTimeRef.current = timestamp;
      setFrameIdx(i => i + 1);
    }

    animRef.current = requestAnimationFrame(tick);
  }, [frameIdx, totalFrames, speed, replayData]);

  useEffect(() => {
    if (playing) {
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(tick);
    } else {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    }
    return () => { if (animRef.current != null) cancelAnimationFrame(animRef.current); };
  }, [playing, tick]);

  const togglePlay = () => {
    if (frameIdx >= totalFrames - 1) setFrameIdx(0);
    setPlaying(p => !p);
  };

  const currentUserFrame = currentEntry?.userFrame;
  const currentInstructorFrame = currentEntry?.instructorFrame;

  const halfW = Math.floor(width / 2);

  const badMoments = result.worstMismatchMoments.map(m => ({
    frameIdx: Math.round((m.timestampMs / (replayData[replayData.length - 1]?.timestampMs ?? 1)) * (totalFrames - 1)),
    ...m,
  }));

  return (
    <div className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="p-3 border-b border-gray-800 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-white">Comparison Replay</span>
        <div className="flex gap-1 ml-auto">
          {(["side_by_side", "skeleton_only", "user_only", "instructor_only"] as ReplayMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${mode === m ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              {m.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="relative bg-gray-900" style={{ height }}>
        {mode === "side_by_side" && (
          <div className="flex h-full">
            <div className="relative bg-gray-900" style={{ width: halfW, borderRight: "1px solid #1f2937" }}>
              <div className="absolute top-2 left-2 z-10 bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded">Instructor</div>
              {currentInstructorFrame && (
                <AvatarOverlay poseLandmarks={currentInstructorFrame.poseLandmarks} leftHandLandmarks={currentInstructorFrame.leftHandLandmarks} rightHandLandmarks={currentInstructorFrame.rightHandLandmarks} width={halfW} height={height} color="#a78bfa" opacity={0.9} mirrorX={false} />
              )}
              {!currentInstructorFrame && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-gray-600">No instructor frame</p>
                </div>
              )}
            </div>
            <div className="relative bg-gray-950" style={{ width: halfW }}>
              <div className="absolute top-2 left-2 z-10 bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded">You</div>
              {currentUserFrame && (
                <AvatarOverlay poseLandmarks={currentUserFrame.poseLandmarks} leftHandLandmarks={currentUserFrame.leftHandLandmarks} rightHandLandmarks={currentUserFrame.rightHandLandmarks} width={halfW} height={height} color="#3b82f6" opacity={0.9} mirrorX />
              )}
            </div>
          </div>
        )}

        {mode === "skeleton_only" && currentUserFrame && (
          <div className="relative h-full bg-gray-950">
            {currentInstructorFrame && <InstructorAvatarOverlay poseLandmarks={currentInstructorFrame.poseLandmarks} leftHandLandmarks={currentInstructorFrame.leftHandLandmarks} rightHandLandmarks={currentInstructorFrame.rightHandLandmarks} width={width} height={height} opacity={0.5} />}
            <AvatarOverlay poseLandmarks={currentUserFrame.poseLandmarks} leftHandLandmarks={currentUserFrame.leftHandLandmarks} rightHandLandmarks={currentUserFrame.rightHandLandmarks} width={width} height={height} color="#3b82f6" opacity={0.9} mirrorX />
          </div>
        )}

        {mode === "user_only" && currentUserFrame && (
          <AvatarOverlay poseLandmarks={currentUserFrame.poseLandmarks} leftHandLandmarks={currentUserFrame.leftHandLandmarks} rightHandLandmarks={currentUserFrame.rightHandLandmarks} width={width} height={height} color="#3b82f6" opacity={0.9} mirrorX className="relative" />
        )}

        {mode === "instructor_only" && currentInstructorFrame && (
          <AvatarOverlay poseLandmarks={currentInstructorFrame.poseLandmarks} leftHandLandmarks={currentInstructorFrame.leftHandLandmarks} rightHandLandmarks={currentInstructorFrame.rightHandLandmarks} width={width} height={height} color="#a78bfa" opacity={0.9} mirrorX={false} className="relative" />
        )}

        {currentUserFrame && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white font-bold rounded-xl px-3 py-1.5 text-sm">
            {result.overallScore}
          </div>
        )}

        {badMoments.map((m, i) => {
          const xPct = (m.frameIdx / Math.max(totalFrames - 1, 1)) * 100;
          const isNearCurrent = Math.abs(m.frameIdx - frameIdx) < 5;
          return isNearCurrent ? (
            <div key={i} className="absolute top-3 left-3 right-12 bg-red-500/20 border border-red-500/50 rounded-lg p-2 max-w-xs">
              <p className="text-xs text-red-300 font-medium capitalize">{m.bodyPart}</p>
              <p className="text-xs text-gray-400">{m.correctionCue}</p>
            </div>
          ) : null;
        })}
      </div>

      <div className="p-3 border-t border-gray-800 space-y-2">
        <div className="relative h-6">
          <input
            type="range"
            min={0}
            max={Math.max(totalFrames - 1, 1)}
            value={frameIdx}
            onChange={e => { setFrameIdx(Number(e.target.value)); setPlaying(false); }}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-700"
          />
          {badMoments.map((m, i) => (
            <div
              key={i}
              className="absolute top-1.5 w-1.5 h-1.5 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ left: `${(m.frameIdx / Math.max(totalFrames - 1, 1)) * 100}%` }}
              title={m.correctionCue}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setFrameIdx(0)} className="p-1.5 text-gray-400 hover:text-white transition-colors"><SkipBack className="w-4 h-4" /></button>
          <button onClick={togglePlay} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-colors">
            {playing ? <><Pause className="w-4 h-4" />Pause</> : <><Play className="w-4 h-4" />Play</>}
          </button>
          <button onClick={() => setFrameIdx(totalFrames - 1)} className="p-1.5 text-gray-400 hover:text-white transition-colors"><SkipForward className="w-4 h-4" /></button>
          <div className="flex items-center gap-1.5 ml-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
            {[0.25, 0.5, 1.0].map(s => (
              <button key={s} onClick={() => setSpeed(s)} className={`text-xs px-2 py-0.5 rounded ${speed === s ? "bg-gray-600 text-white" : "text-gray-500 hover:text-gray-300"}`}>{s}x</button>
            ))}
          </div>
          <div className="ml-auto text-xs text-gray-500 font-mono">
            {frameIdx + 1} / {totalFrames}
          </div>
          <button onClick={() => setShowBreakdown(b => !b)} className="px-2 py-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">
            {showBreakdown ? "Hide" : "Show"} scores
          </button>
        </div>
      </div>

      {showBreakdown && (
        <div className="border-t border-gray-800">
          <MotionScoreBreakdown result={result} discipline={discipline} onPracticeAgain={onPracticeAgain} onRequestCoachReview={onRequestCoachReview} />
        </div>
      )}
    </div>
  );
}
