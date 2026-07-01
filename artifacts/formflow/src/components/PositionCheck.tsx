import { useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Camera } from "lucide-react";
import type { Landmark2D, PositionCheckResult } from "../lib/motion/types";
import { checkPosition, getPositionSpeechFeedback } from "../lib/motion/positionCheck";
import { useSpeechSynthesis } from "./VoiceCommandController";

interface Props {
  poseLandmarks: Landmark2D[];
  viewAngle: "front" | "side";
  requireHands?: boolean;
  requireFeet?: boolean;
  onReady?: () => void;
  onOverride?: () => void;
  autoSpeak?: boolean;
}

export default function PositionCheck({
  poseLandmarks,
  viewAngle,
  requireHands,
  requireFeet,
  onReady,
  onOverride,
  autoSpeak = true,
}: Props) {
  const [result, setResult] = useState<PositionCheckResult | null>(null);
  const lastSpokenRef = useRef<string>("");
  const readyFiredRef = useRef(false);
  const { speak } = useSpeechSynthesis();

  useEffect(() => {
    if (!poseLandmarks || poseLandmarks.length === 0) return;
    const r = checkPosition(poseLandmarks, { viewAngle, requireHands, requireFeet });
    setResult(r);

    if (autoSpeak && r.primaryInstruction !== lastSpokenRef.current) {
      lastSpokenRef.current = r.primaryInstruction;
      speak(r.primaryInstruction, 0.9);
    }

    if (r.isReady && !readyFiredRef.current) {
      readyFiredRef.current = true;
      onReady?.();
    }
  }, [poseLandmarks, viewAngle, requireHands, requireFeet]);

  if (!result) return null;

  const { isReady, checks, overallScore, primaryInstruction } = result;

  return (
    <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-200">Position Check</span>
        </div>
        <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          isReady ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"
        }`}>
          {overallScore}%
        </div>
      </div>

      <div className="space-y-1.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-2">
            {check.passed
              ? <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
              : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            }
            <span className={`text-xs ${check.passed ? "text-gray-400" : "text-gray-200"}`}>
              {check.passed ? check.label : check.instruction}
            </span>
          </div>
        ))}
      </div>

      {!isReady && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
          <p className="text-xs text-amber-300 font-medium">{primaryInstruction}</p>
        </div>
      )}

      {isReady && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-center">
          <p className="text-xs text-green-400 font-medium">✓ Ready to begin!</p>
        </div>
      )}

      {!isReady && onOverride && (
        <button
          onClick={onOverride}
          className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
        >
          Start anyway
        </button>
      )}
    </div>
  );
}
