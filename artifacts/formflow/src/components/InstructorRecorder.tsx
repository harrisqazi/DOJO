import { useState, useRef, useCallback, useEffect } from "react";
import { Video, StopCircle, CheckCircle, AlertTriangle, Upload, Mic, MicOff } from "lucide-react";
import type { MotionFrame, MotionSequence, MotionFingerprint, DisciplineType, RecordingViewAngle } from "../lib/motion/types";
import { extractMotionFrame } from "../lib/motion/extractMotion";
import { createMotionFingerprint } from "../lib/motion/fingerprint";
import { initFullBodyTracker, startTracking, stopTracking } from "../lib/motion/fullBodyTracker";
import AvatarOverlay from "./AvatarOverlay";
import PositionCheck from "./PositionCheck";

interface Props {
  groupId?: string;
  discipline: DisciplineType;
  viewAngle: RecordingViewAngle;
  formId?: string;
  postureId?: string;
  dojoId?: string;
  onRecordingComplete?: (data: { sequence: MotionSequence; fingerprint: MotionFingerprint }) => void;
  onSave?: (payload: object) => Promise<void>;
}

type RecordingState = "idle" | "initializing" | "position_check" | "countdown" | "recording" | "processing" | "done" | "error";

export default function InstructorRecorder({
  groupId, discipline, viewAngle, formId, postureId, dojoId, onRecordingComplete, onSave
}: Props) {
  const [state, setState] = useState<RecordingState>("idle");
  const [frames, setFrames] = useState<MotionFrame[]>([]);
  const [currentLandmarks, setCurrentLandmarks] = useState<{ pose: any[]; left?: any[]; right?: any[] }>({ pose: [] });
  const [positionReady, setPositionReady] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [durationMs, setDurationMs] = useState(0);
  const [result, setResult] = useState<{ sequence: MotionSequence; fingerprint: MotionFingerprint } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const framesRef = useRef<MotionFrame[]>([]);
  const startTimeRef = useRef(0);
  const prevFramesRef = useRef<MotionFrame[]>([]);

  const initCamera = useCallback(async () => {
    setState("initializing");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await initFullBodyTracker();
      startTracking(videoRef.current!, (trackResult) => {
        setCurrentLandmarks({ pose: trackResult.poseLandmarks, left: trackResult.leftHandLandmarks, right: trackResult.rightHandLandmarks });
      });
      setState("position_check");
    } catch (err) {
      setError(`Camera error: ${(err as Error).message}`);
      setState("error");
    }
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(3);
    setState("countdown");
    let c = 3;
    const iv = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(iv);
        framesRef.current = [];
        prevFramesRef.current = [];
        startTimeRef.current = performance.now();
        setState("recording");
      }
    }, 1000);
  }, []);

  useEffect(() => {
    if (state !== "recording") return;

    const interval = setInterval(() => {
      const now = performance.now();
      const timestampMs = now - startTimeRef.current;
      setDurationMs(timestampMs);

      if (currentLandmarks.pose.length === 0) return;

      const frame = extractMotionFrame({
        poseLandmarks: currentLandmarks.pose,
        leftHandLandmarks: currentLandmarks.left,
        rightHandLandmarks: currentLandmarks.right,
        timestampMs,
        frameIndex: framesRef.current.length,
        previousFrames: prevFramesRef.current,
      });

      framesRef.current.push(frame);
      prevFramesRef.current = [...framesRef.current.slice(-10)];
    }, 33);

    return () => clearInterval(interval);
  }, [state, currentLandmarks]);

  const stopRecording = useCallback(async () => {
    setState("processing");
    const recordedFrames = [...framesRef.current];

    if (recordedFrames.length < 10) {
      setError("Recording too short. Please record at least 1 second.");
      setState("error");
      return;
    }

    const durationMs = recordedFrames[recordedFrames.length - 1].timestampMs;
    const sequence: MotionSequence = {
      title: title || `${discipline} ${viewAngle} recording`,
      discipline: discipline as DisciplineType,
      viewAngle,
      durationMs,
      fps: Math.round(recordedFrames.length / (durationMs / 1000)),
      frames: recordedFrames,
      segments: [],
    };

    const fingerprint = createMotionFingerprint(sequence, discipline as DisciplineType);
    const r = { sequence, fingerprint };
    setResult(r);
    setFrames(recordedFrames);
    setState("done");
    onRecordingComplete?.(r);
  }, [title, discipline, viewAngle, onRecordingComplete]);

  const saveRecording = useCallback(async () => {
    if (!result || !consentConfirmed) return;
    setSaving(true);
    try {
      await onSave?.({
        training_recording_group_id: groupId,
        title: title || `${discipline} ${viewAngle} recording`,
        description,
        discipline,
        view_angle: viewAngle,
        form_id: formId,
        posture_id: postureId,
        dojo_id: dojoId,
        motion_data: result.sequence,
        motion_fingerprint: result.fingerprint,
        duration_ms: result.sequence.durationMs,
        fps: result.sequence.fps,
        frame_count: result.sequence.frames.length,
        consent_confirmed: consentConfirmed,
        privacy_mode: "private",
      });
    } catch (err) {
      setError(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [result, title, description, discipline, viewAngle, consentConfirmed, groupId, formId, postureId, dojoId, onSave]);

  const cleanup = useCallback(() => {
    stopTracking();
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  }, []);

  useEffect(() => () => { cleanup(); }, []);

  return (
    <div className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-white">Instructor Recorder</span>
          <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-400 capitalize">
            {viewAngle} view · {discipline.replace(/_/g, " ")}
          </span>
        </div>
        {state === "recording" && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400 font-mono">{(durationMs / 1000).toFixed(1)}s</span>
          </div>
        )}
      </div>

      <div className="relative bg-gray-900 aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
        {currentLandmarks.pose.length > 0 && (
          <div className="absolute inset-0">
            <AvatarOverlay
              poseLandmarks={currentLandmarks.pose}
              leftHandLandmarks={currentLandmarks.left}
              rightHandLandmarks={currentLandmarks.right}
              width={640}
              height={480}
              color="#ef4444"
              opacity={0.8}
              mirrorX
            />
          </div>
        )}

        {state === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-7xl font-bold text-white animate-pulse">{countdown}</span>
          </div>
        )}

        {state === "position_check" && currentLandmarks.pose.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4">
            <PositionCheck
              poseLandmarks={currentLandmarks.pose}
              viewAngle={viewAngle}
              requireHands
              requireFeet
              onReady={() => setPositionReady(true)}
              onOverride={() => setPositionReady(true)}
              autoSpeak
            />
          </div>
        )}

        {state === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={initCamera}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-medium transition-colors"
            >
              <Video className="w-5 h-5" />
              Start Camera
            </button>
          </div>
        )}

        {state === "initializing" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-400 animate-pulse">Initializing AI tracker…</p>
          </div>
        )}
      </div>

      {(state === "idle" || state === "done") && (
        <div className="p-4 space-y-3 border-b border-gray-800">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Recording title…"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Instructions for students (optional)…"
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 resize-none"
          />
        </div>
      )}

      {state === "done" && result && (
        <div className="p-4 space-y-3 border-b border-gray-800">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Recording captured!</span>
            <span className="text-xs text-gray-500 ml-auto">{result.sequence.frames.length} frames · {(result.sequence.durationMs / 1000).toFixed(1)}s</span>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentConfirmed}
              onChange={e => setConsentConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-gray-400">
              I confirm this recording is for instructional use, I have consent to upload it, and I understand it will be used to train students using AI motion comparison.
            </span>
          </label>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <div className="p-4 flex flex-wrap gap-2">
        {state === "position_check" && (
          <button
            onClick={startCountdown}
            disabled={!positionReady}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-xl text-sm font-medium text-white transition-colors"
          >
            <Video className="w-4 h-4" />
            {positionReady ? "Start Recording" : "Get in position…"}
          </button>
        )}

        {state === "recording" && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 rounded-xl text-sm font-medium text-white transition-colors"
          >
            <StopCircle className="w-4 h-4" />
            Stop Recording
          </button>
        )}

        {state === "done" && (
          <>
            <button
              onClick={saveRecording}
              disabled={!consentConfirmed || saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 rounded-xl text-sm font-medium text-white transition-colors"
            >
              <Upload className="w-4 h-4" />
              {saving ? "Saving…" : "Save Recording"}
            </button>
            <button
              onClick={() => { setState("position_check"); setPositionReady(false); }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium text-white transition-colors"
            >
              Record Again
            </button>
          </>
        )}

        {(state === "position_check" || state === "recording" || state === "done") && (
          <button
            onClick={() => { cleanup(); setState("idle"); setPositionReady(false); setResult(null); }}
            className="ml-auto px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
