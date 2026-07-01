import { useState, useRef, useCallback, useEffect } from "react";
import { CheckCircle, Circle, ChevronDown, ChevronUp } from "lucide-react";
import { initPoseDetector, getPoseLandmarker } from "@/lib/poseDetector";

interface CameraSetupProps {
  formName: string;
  onReady: (stream: MediaStream) => void;
}

interface CheckState {
  fullBody: boolean;
  lighting: boolean;
  space: boolean;
}

function playClip(src: string) {
  try {
    const a = new Audio(src);
    a.volume = 0.9;
    a.play().catch(() => {});
  } catch {}
}

export default function CameraSetup({ formName, onReady }: CameraSetupProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const prevChecks = useRef<CheckState>({ fullBody: false, lighting: false, space: false });
  const allPassedSince = useRef<number | null>(null);
  const hasAutoAdvanced = useRef(false);

  const [checks, setChecks] = useState<CheckState>({ fullBody: false, lighting: false, space: false });
  const [cameraSide, setCameraSide] = useState<"left" | "right">("left");
  const [showTips, setShowTips] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    // Only stop tracks if we haven't handed the stream off to the parent —
    // once hasAutoAdvanced is true the parent owns the stream.
    if (!hasAutoAdvanced.current) {
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await initPoseDetector();
      // Pre-grant microphone permission so SpeechRecognition works during training
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(s => s.getTracks().forEach(t => t.stop()))
        .catch(() => {});

      const loop = () => {
        const lm = getPoseLandmarker();
        const video = videoRef.current;
        if (!lm || !video || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        const result = lm.detectForVideo(video, performance.now());
        const pts = result.landmarks?.[0] ?? [];

        let next: CheckState = { fullBody: false, lighting: false, space: false };

        if (pts.length >= 33) {
          const MAJOR = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
          const allVisible = MAJOR.every(i => pts[i]?.visibility != null && pts[i].visibility > 0.65);
          const avgViz = [11, 12, 23, 24].reduce((s, i) => s + (pts[i]?.visibility ?? 0), 0) / 4;
          const nose = pts[0];
          const midAnkleY = ((pts[27]?.y ?? 0) + (pts[28]?.y ?? 0)) / 2;
          const span = Math.abs((nose?.y ?? 0) - midAnkleY);

          next = {
            fullBody: allVisible,
            lighting: avgViz > 0.7,
            space: span > 0.5,
          };
        }

        setChecks(next);

        // Speak when each check newly passes
        const prev = prevChecks.current;
        if (!prev.fullBody && next.fullBody) playClip("/audio/check_fullbody.mp3");
        else if (!prev.lighting && next.lighting) playClip("/audio/check_lighting.mp3");
        else if (!prev.space && next.space) playClip("/audio/check_space.mp3");
        prevChecks.current = next;

        // Auto-advance logic
        const allPassed = next.fullBody && next.lighting && next.space;
        if (!allPassed) {
          allPassedSince.current = null;
          setCountdown(null);
        } else {
          if (allPassedSince.current === null) {
            allPassedSince.current = performance.now();
            playClip("/audio/check_allset.mp3");
          }
          const elapsed = performance.now() - allPassedSince.current;
          const remaining = Math.max(0, Math.ceil((2500 - elapsed) / 1000));
          setCountdown(remaining);

          if (elapsed >= 2500 && !hasAutoAdvanced.current && streamRef.current) {
            hasAutoAdvanced.current = true;
            cancelAnimationFrame(rafRef.current);
            onReady(streamRef.current);
            return;
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setCameraError("Could not access camera. Please grant camera permission and try again.");
    }
  }, [onReady]);

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  const allPassed = checks.fullBody && checks.lighting && checks.space;

  // cameraSide: "left" = camera is to your left (you face right), "right" = camera is to your right (you face left)
  // Flips the skeleton guide so it matches which direction you're facing
  const skeletonFlip = cameraSide === "right" ? "scaleX(-1)" : "none";

  const CheckRow = ({ label, passed }: { label: string; passed: boolean }) => (
    <div className="flex items-center gap-3">
      {passed
        ? <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
        : <Circle className="w-5 h-5 text-white/30 shrink-0" />}
      <span className={`text-sm font-medium ${passed ? "text-green-300" : "text-white/50"}`}>{label}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black">
      {/* Live camera feed */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        muted
        playsInline
        style={{ transform: "scaleX(-1)" }}
        data-testid="setup-video"
      />

      {/* Stick figure guide */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg
          width="120"
          height="240"
          viewBox="0 0 120 240"
          fill="none"
          opacity={allPassed ? 0.8 : 0.35}
          style={{ transform: skeletonFlip, transition: "opacity 0.4s" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="60" cy="24" r="18" stroke={allPassed ? "#4ade80" : "white"} strokeWidth="3" />
          <line x1="60" y1="42" x2="60" y2="130" stroke={allPassed ? "#4ade80" : "white"} strokeWidth="3" />
          <line x1="60" y1="65" x2="20" y2="100" stroke={allPassed ? "#4ade80" : "white"} strokeWidth="3" />
          <line x1="20" y1="100" x2="5" y2="135" stroke={allPassed ? "#4ade80" : "white"} strokeWidth="3" />
          <line x1="60" y1="65" x2="100" y2="100" stroke={allPassed ? "#4ade80" : "white"} strokeWidth="3" />
          <line x1="100" y1="100" x2="115" y2="135" stroke={allPassed ? "#4ade80" : "white"} strokeWidth="3" />
          <line x1="40" y1="130" x2="80" y2="130" stroke={allPassed ? "#4ade80" : "white"} strokeWidth="3" />
          <line x1="40" y1="130" x2="30" y2="185" stroke={allPassed ? "#4ade80" : "white"} strokeWidth="3" />
          <line x1="30" y1="185" x2="25" y2="235" stroke={allPassed ? "#4ade80" : "white"} strokeWidth="3" />
          <line x1="80" y1="130" x2="90" y2="185" stroke={allPassed ? "#4ade80" : "white"} strokeWidth="3" />
          <line x1="90" y1="185" x2="95" y2="235" stroke={allPassed ? "#4ade80" : "white"} strokeWidth="3" />
        </svg>
      </div>

      {/* Auto-advance countdown ring */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="mt-60 flex flex-col items-center gap-2">
            <div className="text-4xl font-bold text-green-400 drop-shadow-lg tabular-nums">
              {countdown === 0 ? "GO!" : countdown}
            </div>
            <div className="text-sm text-green-300/80">Starting automatically…</div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="text-lg font-bold text-white text-center">{formName}</div>
        <div className="text-sm text-white/60 text-center">Step back until your full body is in frame</div>
      </div>

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
        <div className="max-w-sm mx-auto space-y-3">

          {cameraError && (
            <div className="bg-red-900/60 text-red-300 rounded-xl p-3 text-sm text-center border border-red-700">
              {cameraError}
            </div>
          )}

          {/* Checklist */}
          <div className="bg-black/60 backdrop-blur-sm rounded-2xl p-4 border border-white/10 space-y-3">
            <CheckRow label="Full body visible" passed={checks.fullBody} />
            <CheckRow label="Good lighting" passed={checks.lighting} />
            <CheckRow label="Enough space behind you" passed={checks.space} />
          </div>

          {/* Camera side toggle */}
          <div className="flex items-center justify-between bg-black/40 rounded-xl p-3 border border-white/10">
            <div>
              <span className="text-sm text-white/70 block">Camera position</span>
              <span className="text-xs text-white/40">Which side is the camera on?</span>
            </div>
            <div className="flex gap-1">
              {(["left", "right"] as const).map(side => (
                <button
                  key={side}
                  onClick={() => setCameraSide(side)}
                  data-testid={`camera-side-${side}`}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    cameraSide === side
                      ? "bg-primary text-white"
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  }`}
                >
                  {side.charAt(0).toUpperCase() + side.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tips toggle */}
          <button
            onClick={() => setShowTips(s => !s)}
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
            data-testid="tips-toggle"
          >
            {showTips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Tips for best results
          </button>

          {showTips && (
            <div className="bg-black/60 rounded-xl p-4 border border-white/10 text-sm text-white/70 space-y-2">
              <p>Stand 6–8 feet from the camera so your full body is visible.</p>
              <p>Face front-on with good light in front of you — avoid windows behind you.</p>
              <p>Wear form-fitting clothing for better joint detection.</p>
              <p>Place the camera at approximately chest height.</p>
            </div>
          )}

          {/* Manual continue — shown when all pass but countdown still running */}
          {allPassed && countdown !== null && countdown > 0 && (
            <button
              onClick={() => {
                if (!streamRef.current || hasAutoAdvanced.current) return;
                hasAutoAdvanced.current = true;
                cancelAnimationFrame(rafRef.current);
                onReady(streamRef.current);
              }}
              className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-colors"
              data-testid="camera-continue-button"
            >
              Start Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
