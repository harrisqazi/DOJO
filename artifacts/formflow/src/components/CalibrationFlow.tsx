import { useState, useRef, useEffect, useCallback } from "react";
import { CheckCircle, ChevronRight, RotateCcw, Camera } from "lucide-react";
import type { Landmark2D, CalibrationProfile } from "../lib/motion/types";
import { CALIBRATION_STEPS, computeCalibrationProfile, isCalibrationStepReady, getCalibrationReadiness } from "../lib/motion/calibration";
import { useSpeechSynthesis } from "./VoiceCommandController";

interface Props {
  poseLandmarks: Landmark2D[];
  onComplete: (profile: CalibrationProfile) => void;
  onSkip?: () => void;
}

export default function CalibrationFlow({ poseLandmarks, onComplete, onSkip }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Record<string, Landmark2D[]>>({});
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef = useRef(0);
  const { speak } = useSpeechSynthesis();
  const spokenStepRef = useRef(-1);

  const currentStep = CALIBRATION_STEPS[stepIdx];
  const readiness = poseLandmarks.length > 0 ? getCalibrationReadiness(poseLandmarks, currentStep) : 0;
  const stepReady = isCalibrationStepReady(poseLandmarks, currentStep);

  useEffect(() => {
    if (spokenStepRef.current !== stepIdx) {
      spokenStepRef.current = stepIdx;
      speak(currentStep.speechText, 0.9);
    }
  }, [stepIdx, currentStep.speechText]);

  useEffect(() => {
    if (stepReady && !holding) {
      setHolding(true);
      holdStartRef.current = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - holdStartRef.current;
        const progress = Math.min(1, elapsed / currentStep.holdMs);
        setHoldProgress(progress);
        if (progress >= 1) {
          clearInterval(interval);
          setHolding(false);
          setHoldProgress(0);
          setCompletedSteps(prev => ({ ...prev, [currentStep.id]: [...poseLandmarks] }));
          if (stepIdx < CALIBRATION_STEPS.length - 1) {
            setStepIdx(i => i + 1);
          } else {
            const profile = computeCalibrationProfile({
              ...completedSteps,
              [currentStep.id]: poseLandmarks,
            });
            speak("Calibration complete. You are ready to train.");
            onComplete(profile);
          }
        }
      }, 80);
      holdTimerRef.current = interval;
    } else if (!stepReady && holding) {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
      setHolding(false);
      setHoldProgress(0);
    }
  }, [stepReady, holding, stepIdx, poseLandmarks]);

  useEffect(() => () => { if (holdTimerRef.current) clearInterval(holdTimerRef.current); }, []);

  const reset = () => {
    setStepIdx(0);
    setCompletedSteps({});
    setHolding(false);
    setHoldProgress(0);
    spokenStepRef.current = -1;
  };

  return (
    <div className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden max-w-md mx-auto">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Body Calibration</span>
        </div>
        <div className="text-xs text-gray-500">
          Step {stepIdx + 1} / {CALIBRATION_STEPS.length}
        </div>
      </div>

      <div className="flex gap-1 px-4 pt-3">
        {CALIBRATION_STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < stepIdx ? "bg-green-500" : i === stepIdx ? "bg-blue-400" : "bg-gray-800"
            }`}
          />
        ))}
      </div>

      <div className="p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-gray-800 mx-auto flex items-center justify-center">
          {stepIdx < Object.keys(completedSteps).length
            ? <CheckCircle className="w-8 h-8 text-green-400" />
            : <span className="text-2xl">
                {["🧍", "✋", "👈", "🦵", "🙌", "🖐️", "👣"][stepIdx] ?? "🧍"}
              </span>
          }
        </div>

        <div>
          <h3 className="text-base font-semibold text-white">{currentStep.label}</h3>
          <p className="text-sm text-gray-400 mt-1">{currentStep.instruction}</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Visibility</span>
            <span className={readiness > 0.6 ? "text-green-400" : "text-amber-400"}>
              {Math.round(readiness * 100)}%
            </span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${readiness > 0.6 ? "bg-green-500" : "bg-amber-500"}`}
              style={{ width: `${readiness * 100}%` }}
            />
          </div>
        </div>

        {holding && (
          <div className="space-y-2">
            <p className="text-xs text-blue-400 animate-pulse">Hold position…</p>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${holdProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {!stepReady && (
          <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg p-2">
            Make sure you're visible in the camera
          </p>
        )}
      </div>

      <div className="p-4 border-t border-gray-800 flex gap-2">
        <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 transition-colors">
          <RotateCcw className="w-3 h-3" /> Restart
        </button>
        {onSkip && (
          <button onClick={onSkip} className="ml-auto px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Skip calibration
          </button>
        )}
      </div>
    </div>
  );
}
