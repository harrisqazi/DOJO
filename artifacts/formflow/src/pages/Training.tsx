import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useGetForm, getGetFormQueryKey, useCreateSession, useCompleteSession, useSavePostureScore } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { initPoseDetector, getPoseLandmarker } from "@/lib/poseDetector";
import { gradePose } from "@/lib/gradePosture";
import SkeletonCanvas from "@/components/SkeletonCanvas";
import CameraSetup from "@/components/CameraSetup";
import PostureDemo from "@/components/PostureDemo";
import FormIntro from "@/components/FormIntro";
import { Button } from "@/components/ui/button";
import { getPostureGuide } from "@/lib/postureGuides";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, ChevronRight, Mic, MicOff, RotateCcw, Eye } from "lucide-react";

type TrainingState = "INTRO" | "SETUP" | "READY" | "PRACTICE" | "COUNTDOWN" | "SCORING" | "TRANSITION" | "SUMMARY";

interface PostureResult {
  postureId: string;
  postureName: string;
  score: number;
  feedback: string[];
  jointAngles: Record<string, number>;
}

function beep(freq: number, duration: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playAudio(src: string) {
  try { new Audio(src).play().catch(() => {}); } catch {}
}

function scoreGrade(s: number) {
  if (s >= 90) return { letter: "A", color: "#22c55e", label: "Excellent" };
  if (s >= 75) return { letter: "B", color: "#22c55e", label: "Good form" };
  if (s >= 55) return { letter: "C", color: "#eab308", label: "Keep practicing" };
  if (s >= 35) return { letter: "D", color: "#f97316", label: "Needs work" };
  return { letter: "F", color: "#ef4444", label: "Try again" };
}

export default function Training() {
  const { formId } = useParams<{ formId: string }>();
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: form, isLoading } = useGetForm(formId!, {
    query: { enabled: !!formId, queryKey: getGetFormQueryKey(formId!) },
  });

  const createSession = useCreateSession();
  const completeSession = useCompleteSession();
  const savePostureScore = useSavePostureScore();

  const [state, setState] = useState<TrainingState>("INTRO");
  const [postureIndex, setPostureIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [liveScore, setLiveScore] = useState(0);
  const [liveFeedback, setLiveFeedback] = useState<string[]>([]);
  const [jointResults, setJointResults] = useState<any[]>([]);
  const [results, setResults] = useState<PostureResult[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scoringTimeLeft, setScoringTimeLeft] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [smoothedScore, setSmoothedScore] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarksRef = useRef<any[]>([]);
  const rafRef = useRef<number>(0);
  const lastScoreTime = useRef(0);
  const scoreSamplesRef = useRef<number[]>([]);
  const feedbackSamplesRef = useRef<string[][]>([]);
  const anglesSamplesRef = useRef<Record<string, number>[]>([]);
  const stateRef = useRef<TrainingState>("INTRO");
  stateRef.current = state;
  const settleEndRef = useRef(0);
  const smoothRef = useRef(0);

  const postures = (form as any)?.postures ?? [];
  const currentPosture = postures[postureIndex];

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => { return () => { stopCamera(); }; }, [stopCamera]);

  const runDetectionLoop = useCallback(() => {
    const lm = getPoseLandmarker();
    const video = videoRef.current;
    if (!lm || !video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runDetectionLoop);
      return;
    }
    const result = lm.detectForVideo(video, performance.now());
    if (result.landmarks?.[0]) landmarksRef.current = result.landmarks[0];
    rafRef.current = requestAnimationFrame(runDetectionLoop);
  }, []);

  const MIN_HOLD_MS = 8000;

  // Score update during SCORING — 2s settle then EMA-smoothed
  useEffect(() => {
    if (state !== "SCORING") return;
    settleEndRef.current = performance.now() + 2000;
    smoothRef.current = 0;
    const interval = setInterval(() => {
      if (!currentPosture?.joints || !landmarksRef.current.length) return;
      if (performance.now() < settleEndRef.current) return; // settling
      const now = performance.now();
      if (now - lastScoreTime.current < 300) return;
      lastScoreTime.current = now;
      const graded = gradePose(landmarksRef.current, currentPosture.joints);
      // Exponential moving average — smooths erratic jumps
      smoothRef.current = 0.78 * smoothRef.current + 0.22 * graded.score;
      const display = Math.round(smoothRef.current);
      setSmoothedScore(display);
      setLiveScore(Math.round(graded.score));
      setLiveFeedback(graded.feedback);
      setJointResults(graded.jointResults);
      scoreSamplesRef.current.push(graded.score);
      feedbackSamplesRef.current.push(graded.feedback);
    }, 300);
    return () => clearInterval(interval);
  }, [state, currentPosture]);

  // Scoring timer — minimum 8s hold
  useEffect(() => {
    if (state !== "SCORING") return;
    const duration = Math.max(currentPosture?.hold_duration_ms ?? 0, MIN_HOLD_MS);
    setScoringTimeLeft(duration);
    const start = Date.now();
    const interval = setInterval(() => {
      const remaining = Math.max(0, duration - (Date.now() - start));
      setScoringTimeLeft(remaining);
      if (remaining === 0) { clearInterval(interval); finishPostureScoring(); }
    }, 100);
    return () => clearInterval(interval);
  }, [state, postureIndex]);

  const finishPostureScoring = useCallback(() => {
    const samples = scoreSamplesRef.current;
    const avgScore = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
    const allFeedback = feedbackSamplesRef.current.flat().filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
    setResults(prev => [...prev, {
      postureId: currentPosture.id,
      postureName: currentPosture.name,
      score: Math.round(avgScore),
      feedback: allFeedback,
      jointAngles: {},
    }]);
    scoreSamplesRef.current = [];
    feedbackSamplesRef.current = [];
    anglesSamplesRef.current = [];
    beep(avgScore >= 75 ? 880 : avgScore >= 50 ? 660 : 440, 0.3);
    setState("TRANSITION");
  }, [currentPosture]);

  const handleBeginPosture = useCallback(() => {
    setCountdown(3);
    setState("COUNTDOWN");
    let count = 3;
    const interval = setInterval(() => {
      beep(count === 1 ? 1320 : 880, count === 1 ? 0.15 : 0.1);
      count--;
      setCountdown(count);
      if (count === 0) {
        clearInterval(interval);
        playAudio("/audio/check_allset.mp3");
        setState("SCORING");
      }
    }, 1000);
  }, [currentPosture]);

  const handleEnterPractice = useCallback(() => { setState("PRACTICE"); }, []);

  // Keep stable refs so voice callbacks always see the latest version
  const beginRef = useRef(handleBeginPosture);
  beginRef.current = handleBeginPosture;
  const practiceRef = useRef(handleEnterPractice);
  practiceRef.current = handleEnterPractice;

  // Voice recognition — active in READY and PRACTICE states
  // READY:    "practice" → PRACTICE   |   "begin"/"start"/"go" → COUNTDOWN
  // PRACTICE: "ready"/"begin"/"start"/"go" → COUNTDOWN
  useEffect(() => {
    if (state !== "READY" && state !== "PRACTICE") {
      setVoiceActive(false);
      return;
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) { setVoiceError("Voice commands not supported in this browser"); return; }

    let dead = false;
    let retries = 0;
    const MAX_RETRIES = 10;

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 3;

    rec.onstart = () => { setVoiceActive(true); setVoiceError(null); retries = 0; };
    rec.onerror = (e: any) => {
      setVoiceActive(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        dead = true;
        setVoiceError("Microphone access denied — tap the button below");
      }
    };
    rec.onend = () => {
      setVoiceActive(false);
      if (!dead && retries < MAX_RETRIES) {
        retries++;
        setTimeout(() => { try { rec.start(); } catch {} }, 250);
      }
    };
    rec.onresult = (event: any) => {
      // Collect ALL alternatives from ALL results for best matching
      let combined = "";
      for (let i = 0; i < event.results.length; i++)
        for (let j = 0; j < event.results[i].length; j++)
          combined += " " + event.results[i][j].transcript;
      combined = combined.toLowerCase();

      const cur = stateRef.current;
      if (cur === "READY") {
        if (combined.includes("practice")) {
          dead = true; try { rec.stop(); } catch {}
          practiceRef.current(); return;
        }
        if (combined.includes("begin") || combined.includes("start") || combined.includes("go")) {
          dead = true; try { rec.stop(); } catch {}
          beginRef.current(); return;
        }
      } else if (cur === "PRACTICE") {
        if (combined.includes("ready") || combined.includes("begin") ||
            combined.includes("start") || combined.includes("go")) {
          dead = true; try { rec.stop(); } catch {}
          beginRef.current();
        }
      }
    };

    try { rec.start(); } catch {}
    return () => { dead = true; try { rec.stop(); } catch {}; };
  }, [state]);

  const handleTryAgain = useCallback(() => {
    setResults(prev => prev.slice(0, -1));
    scoreSamplesRef.current = [];
    feedbackSamplesRef.current = [];
    anglesSamplesRef.current = [];
    setLiveScore(0);
    setLiveFeedback([]);
    setJointResults([]);
    setState("READY");
  }, []);

  const handleNextPosture = useCallback(() => {
    if (postureIndex + 1 >= postures.length) {
      setState("SUMMARY");
    } else {
      setPostureIndex(i => i + 1);
      setState("READY");
    }
  }, [postureIndex, postures]);

  const handleSaveSession = useCallback(async () => {
    if (!profile || !formId) return;
    setIsSaving(true);
    try {
      const avgTotal = results.length ? results.reduce((a, r) => a + r.score, 0) / results.length : 0;
      const session = await new Promise<any>((resolve, reject) => {
        createSession.mutate({ data: { form_id: formId } }, { onSuccess: resolve, onError: reject });
      });
      const sid = session.id;
      setSessionId(sid);
      for (const r of results) {
        await new Promise<void>((resolve, reject) => {
          savePostureScore.mutate({
            sessionId: sid,
            data: { posture_id: r.postureId, score: r.score, feedback_given: r.feedback },
          }, { onSuccess: () => resolve(), onError: reject });
        });
      }
      await new Promise<void>((resolve, reject) => {
        completeSession.mutate({
          sessionId: sid,
          data: { total_score: Math.round(avgTotal), postures_completed: results.length, completed_at: new Date().toISOString() },
        }, { onSuccess: () => resolve(), onError: reject });
      });
      qc.invalidateQueries({ queryKey: ["listSessions"] });
      qc.invalidateQueries({ queryKey: ["getDashboardStats"] });
      toast({ title: "Session saved!" });
    } catch {
      toast({ title: "Error saving session", variant: "destructive" });
    } finally { setIsSaving(false); }
  }, [profile, formId, results, createSession, savePostureScore, completeSession, qc, toast]);

  const handleCameraReady = useCallback((stream: MediaStream) => {
    // CameraSetup already called initPoseDetector() — don't repeat it.
    // Stream ownership transfers here; CameraSetup will NOT stop these tracks.
    streamRef.current = stream;
    // The video element is always in the DOM (just hidden during SETUP), so
    // videoRef.current is already valid when this callback fires.
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
    rafRef.current = requestAnimationFrame(runDetectionLoop);
    setState("READY");
  }, [runDetectionLoop]);

  const avgScore = results.length ? Math.round(results.reduce((a, r) => a + r.score, 0) / results.length) : 0;
  const holdDuration = Math.max(currentPosture?.hold_duration_ms ?? 0, MIN_HOLD_MS);
  const scoringProgress = holdDuration > 0
    ? ((holdDuration - scoringTimeLeft) / holdDuration) * 100
    : 0;
  const lastResult = results[results.length - 1];

  if (isLoading || !form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading form…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">

      {/* ── INTRO ── */}
      {state === "INTRO" && (
        <FormIntro
          formName={form.name}
          formDescription={(form as any).description}
          postures={postures}
          onBegin={() => setState("SETUP")}
        />
      )}

      {/* ── SETUP ── */}
      {state === "SETUP" && (
        <CameraSetup onReady={handleCameraReady} formName={form.name} />
      )}

      {/* ── CAMERA FEED — always in the DOM so videoRef is valid during SETUP ── */}
      {/* Hidden during INTRO / SETUP / SUMMARY; visible for READY, COUNTDOWN, SCORING, TRANSITION */}
      <div className={`fixed inset-0 z-0 ${(state === "INTRO" || state === "SETUP" || state === "SUMMARY") ? "hidden" : ""}`}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay muted playsInline
          style={{ transform: "scaleX(-1)" }}
          data-testid="training-video"
        />
        <SkeletonCanvas
          landmarks={landmarksRef.current}
          jointResults={jointResults}
          isActive={state === "SCORING"}
        />
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div>
              <div className="text-xs text-white/60 uppercase tracking-wider">{form.name}</div>
              <div className="text-lg font-bold text-white">{currentPosture?.name}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/60">Posture</div>
              <div className="text-sm text-white">{postureIndex + 1} / {postures.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── READY ── */}
      {state === "READY" && (() => {
        const guide = getPostureGuide(currentPosture?.name ?? "");
        return (
          <>
            {/* Animated side-view figure */}
            <div className="fixed inset-0 z-10 pointer-events-none">
              <PostureDemo />
            </div>

            {/* Instructions panel */}
            <div className="fixed inset-0 flex items-end justify-center pb-6 z-20">
              <div className="bg-black/82 backdrop-blur-md rounded-3xl max-w-md w-full mx-4 border border-white/10 overflow-hidden">

                {/* Header */}
                <div className="px-6 pt-5 pb-3 border-b border-white/8">
                  <div className="text-white/50 text-xs uppercase tracking-widest font-medium">Next Posture</div>
                  <div className="text-2xl font-bold text-white leading-tight mt-0.5">{currentPosture?.name}</div>
                </div>

                {/* Step-by-step instructions */}
                <div className="px-6 py-4 space-y-2.5 max-h-44 overflow-y-auto">
                  <div className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-1">How to do it</div>
                  {guide.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-white/80 leading-snug">{step}</span>
                    </div>
                  ))}
                  <div className="mt-3 flex items-center gap-2 bg-indigo-950/60 rounded-xl px-3 py-2">
                    <span className="text-base">💨</span>
                    <span className="text-xs text-indigo-200/80 italic">{guide.breathing}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 pt-3 space-y-3 border-t border-white/8">
                  {/* Voice indicator */}
                  <div className="flex items-center justify-center gap-2 text-sm min-h-[20px]">
                    {voiceError ? (
                      <div className="flex items-center gap-2 text-amber-400/80">
                        <MicOff className="w-4 h-4" />
                        <span className="text-xs">{voiceError}</span>
                      </div>
                    ) : voiceActive ? (
                      <div className="flex items-center gap-2 text-green-400 animate-pulse">
                        <Mic className="w-4 h-4" />
                        <span>Listening… say <strong>"Practice"</strong> or <strong>"Begin"</strong></span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-white/35">
                        <Mic className="w-4 h-4" />
                        <span>Say <strong className="text-white/55">"Practice"</strong> or <strong className="text-white/55">"Begin"</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Two-button row */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-12 border-white/20 text-white hover:bg-white/10 gap-2"
                      onClick={handleEnterPractice}
                    >
                      <Eye className="w-4 h-4" />
                      Practice First
                    </Button>
                    <Button
                      className="h-12 text-base font-semibold"
                      onClick={handleBeginPosture}
                      data-testid="begin-posture-button"
                    >
                      Begin Posture
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── PRACTICE ── */}
      {state === "PRACTICE" && (
        <>
          {/* Avatar overlay — semi-transparent, guides user on what to mirror */}
          <div className="fixed inset-0 z-10 pointer-events-none">
            <PostureDemo />
          </div>

          {/* Label */}
          <div className="fixed top-20 inset-x-0 z-20 flex justify-center pointer-events-none">
            <div className="bg-indigo-950/70 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs text-indigo-300 uppercase tracking-wider border border-indigo-500/30">
              Mirror the blue figure
            </div>
          </div>

          {/* Practice panel */}
          <div className="fixed inset-0 flex items-end justify-center pb-6 z-20">
            <div className="bg-black/82 backdrop-blur-md rounded-3xl max-w-sm w-full mx-4 border border-white/10 overflow-hidden">
              <div className="px-6 pt-5 pb-3 border-b border-white/8">
                <div className="text-white/50 text-xs uppercase tracking-widest font-medium">Practicing</div>
                <div className="text-xl font-bold text-white">{currentPosture?.name}</div>
              </div>

              <div className="px-6 py-4 space-y-3">
                <p className="text-sm text-white/60 text-center leading-relaxed">
                  Watch the figure and mirror the posture with your body.<br/>
                  When you've got it, begin scoring.
                </p>

                <div className="flex items-center justify-center gap-2 text-sm min-h-[20px]">
                  {voiceError ? (
                    <div className="flex items-center gap-2 text-amber-400/80">
                      <MicOff className="w-4 h-4" />
                      <span className="text-xs">{voiceError}</span>
                    </div>
                  ) : voiceActive ? (
                    <div className="flex items-center gap-2 text-green-400 animate-pulse">
                      <Mic className="w-4 h-4" />
                      <span>Say <strong>"I'm ready"</strong> to begin scoring</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-white/35">
                      <Mic className="w-4 h-4" />
                      <span>Say <strong className="text-white/55">"I'm ready"</strong> or tap below</span>
                    </div>
                  )}
                </div>

                <Button className="w-full h-12 font-semibold" onClick={handleBeginPosture}>
                  I'm Ready — Begin Scoring
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── COUNTDOWN ── */}
      {state === "COUNTDOWN" && (
        <div className="fixed inset-0 flex items-center justify-center z-20 bg-black/60">
          <div
            className="text-[12rem] font-bold tabular-nums select-none"
            style={{
              color: countdown === 1 ? "#6366f1" : "white",
              textShadow: "0 0 80px rgba(99,102,241,0.8)",
            }}
          >
            {countdown === 0 ? "GO" : countdown}
          </div>
        </div>
      )}

      {/* ── SCORING overlay ── */}
      {state === "SCORING" && (
        <div className="fixed bottom-0 left-0 right-0 z-20 p-4">
          <div className="max-w-2xl mx-auto">
            <div className="h-1.5 bg-white/20 rounded-full mb-4">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${scoringProgress}%`,
                  backgroundColor: smoothedScore >= 75 ? "#22c55e" : smoothedScore >= 50 ? "#eab308" : "#ef4444",
                }}
              />
            </div>
            {/* Settling indicator */}
            {performance.now() < settleEndRef.current + 2000 && smoothedScore === 0 && (
              <div className="text-center text-white/40 text-xs mb-2 animate-pulse">
                Hold the position…
              </div>
            )}
            <div className="flex items-end justify-between">
              <div className="space-y-1 max-w-xs">
                {liveFeedback.slice(0, 2).map((f, i) => (
                  <div key={i} className="text-sm text-white/80 bg-black/60 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    {f}
                  </div>
                ))}
              </div>
              <div
                className="text-7xl font-bold tabular-nums"
                style={{ color: smoothedScore >= 75 ? "#22c55e" : smoothedScore >= 50 ? "#eab308" : "#ef4444" }}
                data-testid="live-score"
              >
                {smoothedScore}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSITION ── */}
      {state === "TRANSITION" && currentPosture && lastResult && (() => {
        const grade = scoreGrade(lastResult.score);
        const isLast = postureIndex + 1 >= postures.length;
        return (
          <div className="fixed inset-0 flex items-center justify-center z-20 bg-black/85 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 space-y-5">

              {/* Score + grade */}
              <div className="text-center space-y-1">
                <div className="text-white/50 text-xs uppercase tracking-widest">{lastResult.postureName}</div>
                <div
                  className="text-9xl font-bold tabular-nums leading-none"
                  style={{ color: grade.color }}
                  data-testid="transition-score"
                >
                  {lastResult.score}
                </div>
                <div className="text-lg font-semibold" style={{ color: grade.color }}>{grade.label}</div>
              </div>

              {/* Feedback bullets */}
              {lastResult.feedback.length > 0 && (
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
                  <div className="text-xs text-white/50 uppercase tracking-wider font-medium mb-2">Coaching notes</div>
                  {lastResult.feedback.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-white/80">
                      <span className="text-primary mt-0.5">▸</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Next posture preview */}
              {!isLast && (
                <div className="text-center text-sm text-white/50">
                  Next: <span className="text-white font-medium">{postures[postureIndex + 1]?.name}</span>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-12 border-white/20 text-white hover:bg-white/10 gap-2"
                  onClick={handleTryAgain}
                  data-testid="try-again-button"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </Button>
                <Button
                  className="h-12 gap-1"
                  onClick={handleNextPosture}
                  data-testid="next-posture-button"
                >
                  {isLast ? "Finish" : "Continue"}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── SUMMARY ── */}
      {state === "SUMMARY" && (
        <div className="min-h-screen bg-background p-6 overflow-y-auto">
          <div className="max-w-lg mx-auto space-y-8 pt-8">
            <div className="text-center space-y-3">
              <div className="text-white/60 text-sm uppercase tracking-widest">{form.name}</div>
              <div
                className="text-8xl font-bold"
                style={{ color: scoreGrade(avgScore).color }}
                data-testid="summary-score"
              >
                {avgScore}
              </div>
              <div className="text-xl font-semibold" style={{ color: scoreGrade(avgScore).color }}>
                {scoreGrade(avgScore).label}
              </div>
              <div className="text-muted-foreground text-sm">Overall Score · {results.length} postures</div>
            </div>

            {/* Per-posture breakdown */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Posture Breakdown</div>
              {results.map((r, i) => {
                const g = scoreGrade(r.score);
                return (
                  <div key={i} className="bg-card rounded-xl p-4 border border-border" data-testid={`posture-result-${i}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {r.score >= 75
                          ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                          : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                        <span className="text-sm font-medium">{r.postureName}</span>
                      </div>
                      <span className="text-2xl font-bold tabular-nums" style={{ color: g.color }}>{r.score}</span>
                    </div>
                    {r.feedback.length > 0 && (
                      <div className="ml-8 space-y-1">
                        {r.feedback.slice(0, 2).map((f, j) => (
                          <div key={j} className="text-xs text-muted-foreground">▸ {f}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              {!sessionId && (
                <Button
                  className="w-full h-14 text-base font-semibold"
                  onClick={handleSaveSession}
                  disabled={isSaving}
                  data-testid="save-session-button"
                >
                  {isSaving ? "Saving…" : "Save Session"}
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => {
                  setResults([]);
                  setPostureIndex(0);
                  setJointResults([]);
                  setLiveScore(0);
                  setState("READY");
                }}
                data-testid="practice-again-button"
              >
                Practice Again
              </Button>
              <Button
                variant="ghost"
                className="w-full h-12"
                onClick={() => setLocation("/dashboard")}
                data-testid="back-to-dashboard-button"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
