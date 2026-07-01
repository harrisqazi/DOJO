import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Camera, RefreshCw } from "lucide-react";
import type {
  MotionFrame, MotionSequence, ComparisonResult, DisciplineType,
  TrainingRecordingGroupData, TrainingRecordingData, CalibrationProfile, Landmark2D
} from "../lib/motion/types";
import { extractMotionFrame } from "../lib/motion/extractMotion";
import { compareMotion } from "../lib/motion/compareMotion";
import { computeCalibrationProfile } from "../lib/motion/calibration";
import { initFullBodyTracker, startTracking, stopTracking } from "../lib/motion/fullBodyTracker";
import { useSpeechSynthesis } from "../components/VoiceCommandController";
import { generateSpokenFeedbackSummary } from "../lib/motion/feedback";
import PositionCheck from "../components/PositionCheck";
import CalibrationFlow from "../components/CalibrationFlow";
import PracticeOverlay from "../components/PracticeOverlay";
import ComparisonReplay from "../components/ComparisonReplay";
import MotionScoreBreakdown from "../components/MotionScoreBreakdown";
import AvatarOverlay from "../components/AvatarOverlay";
import VoiceCommandController, { type VoiceCommand } from "../components/VoiceCommandController";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

type PracticeState =
  | "loading"
  | "calibrating"
  | "position_check"
  | "countdown"
  | "recording"
  | "processing"
  | "results"
  | "replay"
  | "error";

const COUNTDOWN_SECONDS = 3;

function useMotionGroup(groupId: string) {
  const [group, setGroup] = useState<TrainingRecordingGroupData | null>(null);
  const [recording, setRecording] = useState<TrainingRecordingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    fetch(`${BASE_URL}api/training-recording-groups/${groupId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((g: any) => {
        setGroup(g);
        const recId = g.default_view_angle === "side" ? g.side_recording_id : g.front_recording_id;
        if (!recId) throw new Error("No recording found for this group");
        return fetch(`${BASE_URL}api/training-recordings/${recId}`);
      })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((rec: any) => setRecording(rec))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [groupId]);

  return { group, recording, loading, error };
}

function useSaveAttempt() {
  const save = useCallback(async (payload: object): Promise<void> => {
    await fetch(`${BASE_URL}api/user-motion-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }, []);
  return save;
}

export default function MotionPractice() {
  const { groupId } = useParams<{ groupId: string }>();
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { speak } = useSpeechSynthesis();

  const { group, recording, loading, error: loadError } = useMotionGroup(groupId!);
  const saveAttempt = useSaveAttempt();

  const [state, setState] = useState<PracticeState>("loading");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [currentLandmarks, setCurrentLandmarks] = useState<{
    pose: Landmark2D[];
    left?: Landmark2D[];
    right?: Landmark2D[];
  }>({ pose: [] });
  const [calibrationProfile, setCalibrationProfile] = useState<CalibrationProfile | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [liveFeedback, setLiveFeedback] = useState<string | undefined>(undefined);
  const [positionReady, setPositionReady] = useState(false);
  const [overlayMode, setOverlayMode] = useState<"live_with_instructor_overlay" | "skeleton_only" | "side_by_side">("live_with_instructor_overlay");

  const videoRef = useRef<HTMLVideoElement>(null);
  const framesRef = useRef<MotionFrame[]>([]);
  const prevFramesRef = useRef<MotionFrame[]>([]);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const discipline = (group?.discipline ?? "general_martial_arts") as DisciplineType;

  useEffect(() => {
    if (!loading && !loadError) setState("calibrating");
    if (loadError) setState("error");
  }, [loading, loadError]);

  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }, audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await initFullBodyTracker();
      startTracking(videoRef.current!, (r) => {
        setCurrentLandmarks({ pose: r.poseLandmarks, left: r.leftHandLandmarks, right: r.rightHandLandmarks });
      });
    } catch (err) {
      toast({ title: "Camera error", description: (err as Error).message, variant: "destructive" });
    }
  }, []);

  const handleCalibrationComplete = useCallback(async (profile: CalibrationProfile) => {
    setCalibrationProfile(profile);
    await initCamera();
    setState("position_check");
    speak("Great. Now get into position so I can see your full body.");
  }, [initCamera]);

  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS);
    setState("countdown");
    let c = COUNTDOWN_SECONDS;
    const iv = setInterval(() => {
      c--;
      setCountdown(c);
      if (c === 0) {
        clearInterval(iv);
        framesRef.current = [];
        prevFramesRef.current = [];
        startTimeRef.current = performance.now();
        setState("recording");
        speak("Begin when ready.");
      }
    }, 1000);
  }, []);

  useEffect(() => {
    if (state !== "recording") return;
    const iv = setInterval(() => {
      if (currentLandmarks.pose.length === 0) return;
      const timestampMs = performance.now() - startTimeRef.current;
      durationRef.current = timestampMs;
      const frame = extractMotionFrame({
        poseLandmarks: currentLandmarks.pose,
        leftHandLandmarks: currentLandmarks.left,
        rightHandLandmarks: currentLandmarks.right,
        timestampMs,
        frameIndex: framesRef.current.length,
        previousFrames: prevFramesRef.current,
        calibrationProfile: calibrationProfile ?? undefined,
      });
      framesRef.current.push(frame);
      prevFramesRef.current = framesRef.current.slice(-10);
    }, 33);
    return () => clearInterval(iv);
  }, [state, currentLandmarks, calibrationProfile]);

  const stopRecording = useCallback(async () => {
    setState("processing");
    const frames = [...framesRef.current];
    if (frames.length < 5) {
      toast({ title: "Recording too short", description: "Practice at least 1 second.", variant: "destructive" });
      setState("position_check");
      return;
    }

    const fingerprint = recording?.motionFingerprint;
    if (!fingerprint) {
      toast({ title: "No instructor fingerprint found", variant: "destructive" });
      setState("error");
      return;
    }

    const durationMs = frames[frames.length - 1].timestampMs;
    const userSeq: MotionSequence = {
      title: "User practice attempt",
      discipline,
      viewAngle: (group?.defaultViewAngle ?? "front") as "front" | "side",
      durationMs,
      fps: Math.round(frames.length / (durationMs / 1000)),
      frames,
      segments: [],
      calibrationProfile: calibrationProfile ?? undefined,
    };

    const result = compareMotion(userSeq, fingerprint as any, { discipline, sequenceConfidence: 0.8 });
    setComparisonResult(result);
    setState("results");

    const summary = generateSpokenFeedbackSummary(result, discipline);
    speak(summary, 0.95);

    try {
      await saveAttempt({
        training_recording_group_id: groupId,
        training_recording_id: recording?.id ?? "",
        view_angle: group?.defaultViewAngle ?? "front",
        discipline,
        motion_data: { frameCount: frames.length, durationMs },
        comparison_result: { ...result, replayData: [] },
        duration_ms: durationMs,
        fps: Math.round(frames.length / (durationMs / 1000)),
        overall_score: result.overallScore,
        confidence: result.confidence,
      });
    } catch {}
  }, [recording, group, discipline, calibrationProfile, groupId, saveAttempt, speak, toast]);

  const handleVoiceCommand = useCallback((cmd: VoiceCommand) => {
    switch (cmd) {
      case "begin":
      case "practice": if (state === "position_check" && positionReady) startCountdown(); break;
      case "done": if (state === "recording") stopRecording(); break;
      case "restart": if (state === "results" || state === "replay") {
        setState("position_check"); setPositionReady(false); setComparisonResult(null);
      } break;
      case "overlay_on": setOverlayMode("live_with_instructor_overlay"); break;
      case "overlay_off": setOverlayMode("skeleton_only"); break;
      case "skeleton_only": setOverlayMode("skeleton_only"); break;
    }
  }, [state, positionReady, startCountdown, stopRecording]);

  const cleanup = useCallback(() => {
    stopTracking();
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => () => { cleanup(); }, []);

  const instructorFrameAtTime = useCallback((timestampMs: number) => {
    const fingerprint = recording?.motionFingerprint ?? (recording as any)?.motion_fingerprint;
    if (!fingerprint?.normalizedIdealJointPaths) return undefined;
    return undefined;
  }, [recording]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading movement…</p>
      </div>
    );
  }

  if (state === "error" || loadError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center p-8">
        <div className="space-y-4">
          <p className="text-red-400">{loadError ?? "An error occurred"}</p>
          <button onClick={() => setLocation("/dashboard")} className="px-4 py-2 bg-gray-800 rounded-xl text-sm text-white">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => { cleanup(); setLocation("/dashboard"); }} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">{group?.title ?? "Motion Practice"}</h1>
          <p className="text-xs text-gray-500 capitalize">{discipline.replace(/_/g, " ")} · {group?.defaultViewAngle ?? "front"} view</p>
        </div>
        <VoiceCommandController onCommand={handleVoiceCommand} enabled={state !== "calibrating"} />
        {state === "recording" && (
          <button onClick={stopRecording} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-xl text-xs font-medium transition-colors">
            Done
          </button>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {state === "calibrating" && (
          <div className="flex justify-center">
            <CalibrationFlow
              poseLandmarks={currentLandmarks.pose}
              onComplete={handleCalibrationComplete}
              onSkip={async () => {
                await initCamera();
                setState("position_check");
              }}
            />
          </div>
        )}

        {(state === "position_check" || state === "countdown" || state === "recording") && (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video max-w-2xl mx-auto">
              <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />

              {currentLandmarks.pose.length > 0 && (state === "recording" || state === "countdown") && (
                <div className="absolute inset-0">
                  <PracticeOverlay
                    userPoseLandmarks={currentLandmarks.pose}
                    userLeftHandLandmarks={currentLandmarks.left}
                    userRightHandLandmarks={currentLandmarks.right}
                    width={640}
                    height={360}
                    mode={overlayMode}
                    currentScore={liveScore ?? undefined}
                    currentFeedbackLine={liveFeedback}
                    showScore={state === "recording"}
                  />
                </div>
              )}

              {state === "countdown" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-8xl font-bold text-white animate-pulse">{countdown}</span>
                </div>
              )}

              {state === "position_check" && currentLandmarks.pose.length > 0 && (
                <div className="absolute bottom-4 left-4 right-4">
                  <PositionCheck
                    poseLandmarks={currentLandmarks.pose}
                    viewAngle={(group?.defaultViewAngle ?? "front") as "front" | "side"}
                    requireFeet
                    onReady={() => setPositionReady(true)}
                    onOverride={() => setPositionReady(true)}
                    autoSpeak
                  />
                </div>
              )}

              {state === "position_check" && currentLandmarks.pose.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Camera className="w-8 h-8 text-gray-500 mx-auto" />
                    <p className="text-sm text-gray-400">Stand in front of the camera</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between max-w-2xl mx-auto">
              <div className="flex gap-2">
                {(["live_with_instructor_overlay", "skeleton_only", "side_by_side"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setOverlayMode(m)}
                    className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                      overlayMode === m ? "border-blue-500 text-blue-400 bg-blue-500/10" : "border-gray-700 text-gray-500 hover:border-gray-500"
                    }`}
                  >
                    {m === "live_with_instructor_overlay" ? "Overlay" : m === "skeleton_only" ? "Skeleton" : "Split"}
                  </button>
                ))}
              </div>

              {state === "position_check" && (
                <button
                  onClick={startCountdown}
                  disabled={!positionReady}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors"
                >
                  {positionReady ? "Start Practice" : "Get in position…"}
                </button>
              )}
            </div>
          </div>
        )}

        {state === "processing" && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-400 mx-auto animate-spin" />
              <p className="text-sm text-gray-400">Analyzing your movement…</p>
            </div>
          </div>
        )}

        {state === "results" && comparisonResult && (
          <div className="space-y-4">
            <MotionScoreBreakdown
              result={comparisonResult}
              discipline={discipline}
              onReplay={() => setState("replay")}
              onPracticeAgain={() => {
                setState("position_check");
                setPositionReady(false);
                setComparisonResult(null);
              }}
            />
          </div>
        )}

        {state === "replay" && comparisonResult && (
          <ComparisonReplay
            result={comparisonResult}
            discipline={discipline}
            width={720}
            height={405}
            onPracticeAgain={() => {
              setState("position_check");
              setPositionReady(false);
              setComparisonResult(null);
            }}
          />
        )}
      </main>
    </div>
  );
}
