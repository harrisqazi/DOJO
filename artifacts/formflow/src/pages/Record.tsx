import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useListDisciplines, useCreateForm, usePublishForm, getListFormsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { initPoseDetector, getPoseLandmarker } from "@/lib/poseDetector";
import { detectStillness, extractAnglesFromLandmarks } from "@/lib/gradePosture";
import SkeletonCanvas from "@/components/SkeletonCanvas";
import { Circle, Square, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";

const LANDMARK_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28],
];

const JOINT_LABEL_MAP: Record<string, string> = {
  spine: "Spine upright",
  front_knee: "Front knee bend",
  rear_knee: "Back leg straightness",
  push_arm: "Push arm extension",
  pull_arm: "Draw arm position",
  high_arm: "Upper arm height",
  low_arm: "Lower arm position",
  front_elbow: "Lead arm bend",
  left_elbow: "Left arm bend",
  right_elbow: "Right arm bend",
  right_spine: "Right spine alignment",
};

const JOINT_TRIPLETS: Array<{ id: string; a: string; b: string; c: string; landmark_a: string; landmark_b: string; landmark_c: string }> = [
  { id: "spine", a: "LEFT_SHOULDER", b: "LEFT_HIP", c: "LEFT_KNEE", landmark_a: "LEFT_SHOULDER", landmark_b: "LEFT_HIP", landmark_c: "LEFT_KNEE" },
  { id: "front_knee", a: "LEFT_HIP", b: "LEFT_KNEE", c: "LEFT_ANKLE", landmark_a: "LEFT_HIP", landmark_b: "LEFT_KNEE", landmark_c: "LEFT_ANKLE" },
  { id: "rear_knee", a: "RIGHT_HIP", b: "RIGHT_KNEE", c: "RIGHT_ANKLE", landmark_a: "RIGHT_HIP", landmark_b: "RIGHT_KNEE", landmark_c: "RIGHT_ANKLE" },
  { id: "left_elbow", a: "LEFT_SHOULDER", b: "LEFT_ELBOW", c: "LEFT_WRIST", landmark_a: "LEFT_SHOULDER", landmark_b: "LEFT_ELBOW", landmark_c: "LEFT_WRIST" },
  { id: "right_elbow", a: "RIGHT_SHOULDER", b: "RIGHT_ELBOW", c: "RIGHT_WRIST", landmark_a: "RIGHT_SHOULDER", landmark_b: "RIGHT_ELBOW", landmark_c: "RIGHT_WRIST" },
  { id: "right_spine", a: "RIGHT_SHOULDER", b: "RIGHT_HIP", c: "RIGHT_KNEE", landmark_a: "RIGHT_SHOULDER", landmark_b: "RIGHT_HIP", landmark_c: "RIGHT_KNEE" },
];

interface CapturedPosture {
  name: string;
  audioCue: string;
  tips: string;
  landmarks: any[];
  angles: Record<string, number>;
  tolerances: Record<string, number>;
  landmarkHistory: any[][];
}

type RecordStep = 1 | 2 | 3;

export default function Record() {
  const { profile } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: disciplines } = useListDisciplines({ dojo_id: profile?.dojo_id ?? undefined });
  const createForm = useCreateForm();
  const publishForm = usePublishForm();

  const [step, setStep] = useState<RecordStep>(1);
  const [formName, setFormName] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [cameraSide, setCameraSide] = useState<"left" | "right">("left");
  const [acknowledged, setAcknowledged] = useState(false);

  const [postures, setPostures] = useState<CapturedPosture[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedFormId, setPublishedFormId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const landmarksRef = useRef<any[]>([]);
  const historyRef = useRef<any[][]>([]);
  const [displayLandmarks, setDisplayLandmarks] = useState<any[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [postureCount, setPostureCount] = useState(0);
  const [flashGreen, setFlashGreen] = useState(false);
  const recordStartRef = useRef<number>(0);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
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
    } catch {
      toast({ title: "Camera error", description: "Could not access camera", variant: "destructive" });
    }
  }, [toast]);

  const runLoop = useCallback(() => {
    const lm = getPoseLandmarker();
    const video = videoRef.current;
    if (!lm || !video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runLoop);
      return;
    }
    const result = lm.detectForVideo(video, performance.now());
    const pts = result.landmarks?.[0] ?? [];
    landmarksRef.current = pts;

    if (recording && pts.length > 0) {
      historyRef.current.push([...pts]);
      if (historyRef.current.length > 90) historyRef.current = historyRef.current.slice(-90);

      if (detectStillness(historyRef.current)) {
        const angles = extractAnglesFromLandmarks(historyRef.current);
        const snapshot = [...pts];
        const history = [...historyRef.current];

        setPostures(prev => [...prev, {
          name: `Posture ${prev.length + 1}`,
          audioCue: "",
          tips: "",
          landmarks: snapshot,
          angles,
          tolerances: Object.fromEntries(Object.keys(angles).map(k => [k, 15])),
          landmarkHistory: history,
        }]);

        setPostureCount(c => c + 1);
        setFlashGreen(true);
        setTimeout(() => setFlashGreen(false), 500);
        historyRef.current = [];

        // Chime
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 523;
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          osc.start(); osc.stop(ctx.currentTime + 0.2);
        } catch {}
      }
    }

    // Throttle display update
    if (Math.random() < 0.3) setDisplayLandmarks([...pts]);
    rafRef.current = requestAnimationFrame(runLoop);
  }, [recording]);

  useEffect(() => {
    if (step === 2) {
      startCamera().then(() => {
        rafRef.current = requestAnimationFrame(runLoop);
      });
    }
    return () => {
      if (step !== 2) stopCamera();
    };
  }, [step]);

  useEffect(() => {
    if (step === 2) {
      rafRef.current = requestAnimationFrame(runLoop);
    }
  }, [recording, runLoop]);

  useEffect(() => {
    if (!recording) return;
    recordStartRef.current = Date.now();
    const interval = setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - recordStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [recording]);

  const handleStartRecording = () => {
    historyRef.current = [];
    setRecording(true);
    setPostureCount(postures.length);
  };

  const handleFinishRecording = () => {
    setRecording(false);
    stopCamera();
    setStep(3);
    setReviewIndex(0);
  };

  const handlePublish = async () => {
    if (!disciplineId || !formName) return;
    setIsPublishing(true);
    try {
      const form = await new Promise<any>((resolve, reject) => {
        createForm.mutate({
          data: {
            discipline_id: disciplineId,
            slug: formName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
            name: formName,
          },
        }, { onSuccess: resolve, onError: reject });
      });

      const posturePayload = postures.map((p, i) => ({
        sequence_number: i + 1,
        name: p.name,
        audio_cue_text: p.audioCue || undefined,
        tips: p.tips || undefined,
        joints: JOINT_TRIPLETS
          .filter(jt => p.angles[jt.id] != null)
          .map(jt => ({
            joint_id: jt.id,
            joint_label: JOINT_LABEL_MAP[jt.id] ?? jt.id,
            landmark_a: jt.landmark_a,
            landmark_b: jt.landmark_b,
            landmark_c: jt.landmark_c,
            target_angle: p.angles[jt.id] ?? 90,
            tolerance_degrees: p.tolerances[jt.id] ?? 15,
            weight: 1 / JOINT_TRIPLETS.filter(jt => p.angles[jt.id] != null).length,
            cue_too_low: null,
            cue_too_high: null,
            cue_correct: null,
          })),
      }));

      await new Promise<void>((resolve, reject) => {
        publishForm.mutate({
          formId: form.id,
          data: { postures: posturePayload },
        }, { onSuccess: () => resolve(), onError: reject });
      });

      qc.invalidateQueries({ queryKey: getListFormsQueryKey() });
      setPublishedFormId(form.id);
      toast({ title: "Form published successfully" });
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally {
      setIsPublishing(false);
    }
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const reviewPosture = postures[reviewIndex];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Step 1 — Setup */}
      {step === 1 && (
        <div className="max-w-lg mx-auto px-4 py-10 space-y-8">
          <div>
            <button onClick={() => setLocation("/dojo-admin")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-2xl font-bold">Record New Form</h1>
            <p className="text-muted-foreground mt-1 text-sm">Record an expert demonstration to create a training form for your students.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="form-name">Form Name</Label>
              <Input
                id="form-name"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Yang-24 Tai Chi Form"
                data-testid="input-form-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Discipline</Label>
              <Select value={disciplineId} onValueChange={setDisciplineId}>
                <SelectTrigger data-testid="select-discipline">
                  <SelectValue placeholder="Select discipline" />
                </SelectTrigger>
                <SelectContent>
                  {(disciplines ?? []).map(d => (
                    <SelectItem key={d.id} value={d.id} data-testid={`discipline-option-${d.id}`}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Camera position</Label>
              <div className="flex gap-2">
                {(["left", "right"] as const).map(side => (
                  <button
                    key={side}
                    onClick={() => setCameraSide(side)}
                    data-testid={`camera-side-${side}`}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
                      cameraSide === side
                        ? "bg-primary border-primary text-white"
                        : "bg-card border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {side.charAt(0).toUpperCase() + side.slice(1)} side
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border space-y-3">
              <div className="text-sm font-medium">Before you begin</div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>Stand where your full body is clearly visible</li>
                <li>The system will auto-capture each posture when you hold still for 1.5 seconds</li>
                <li>A green flash + chime means a posture was captured</li>
                <li>Perform each posture slowly and deliberately</li>
              </ul>
              <div className="flex items-start gap-3 pt-2 border-t border-border">
                <Checkbox
                  id="acknowledged"
                  checked={acknowledged}
                  onCheckedChange={v => setAcknowledged(!!v)}
                  data-testid="checkbox-acknowledge"
                />
                <label htmlFor="acknowledged" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                  I understand that I am recording this form as an expert demonstration for student training.
                </label>
              </div>
            </div>

            <Button
              className="w-full h-14 text-base font-semibold"
              disabled={!formName || !disciplineId || !acknowledged}
              onClick={() => setStep(2)}
              data-testid="button-start-recording"
            >
              Start Recording
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Recording */}
      {step === 2 && (
        <div className="fixed inset-0 bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay muted playsInline
            style={{ transform: "scaleX(-1)" }}
            data-testid="record-video"
          />

          <SkeletonCanvas landmarks={displayLandmarks} jointResults={[]} isActive={recording} />

          {/* Green flash on capture */}
          {flashGreen && (
            <div className="absolute inset-0 border-4 border-green-500 pointer-events-none animate-pulse" />
          )}

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
            <div className="text-white font-medium">{formName}</div>
            {recording && (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white font-mono">{formatTime(recordingSeconds)}</span>
              </div>
            )}
          </div>

          {/* Counter */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-full px-5 py-2 border border-white/20">
            <span className="text-white text-sm">Postures captured: <span className="font-bold text-primary">{postures.length}</span></span>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
            <div className="max-w-sm mx-auto flex gap-3">
              {!recording ? (
                <Button
                  className="flex-1 h-14 text-base gap-2"
                  onClick={handleStartRecording}
                  data-testid="button-start-capture"
                >
                  <Circle className="w-4 h-4 fill-red-500 text-red-500" />
                  Begin Recording
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="h-14 px-6 border-white/20 text-white hover:bg-white/10"
                    onClick={() => setRecording(false)}
                    data-testid="button-pause"
                  >
                    Pause
                  </Button>
                  <Button
                    className="flex-1 h-14 gap-2"
                    onClick={handleFinishRecording}
                    disabled={postures.length === 0}
                    data-testid="button-finish-recording"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Finish ({postures.length})
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Review Postures</h2>
            <span className="text-sm text-muted-foreground">{reviewIndex + 1} of {postures.length}</span>
          </div>

          {publishedFormId ? (
            <div className="text-center space-y-6 py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <div>
                <div className="text-xl font-bold">Form Published</div>
                <div className="text-muted-foreground mt-1">{formName} is now available for training</div>
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => setLocation(`/training/${publishedFormId}`)} data-testid="button-try-form">
                  Try This Form
                </Button>
                <Button variant="outline" onClick={() => setLocation("/dojo-admin")} data-testid="button-back-dojo-admin">
                  Back to Admin
                </Button>
              </div>
            </div>
          ) : reviewPosture ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Skeleton preview */}
                <div className="bg-black rounded-2xl aspect-[4/3] relative overflow-hidden">
                  <SkeletonCanvas
                    landmarks={reviewPosture.landmarks}
                    jointResults={[]}
                    isActive={false}
                  />
                  <div className="absolute bottom-2 left-2 text-xs text-white/50">Posture {reviewIndex + 1}</div>
                </div>

                {/* Edit fields */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Posture Name</Label>
                    <Input
                      value={reviewPosture.name}
                      onChange={e => {
                        const updated = [...postures];
                        updated[reviewIndex] = { ...updated[reviewIndex], name: e.target.value };
                        setPostures(updated);
                      }}
                      data-testid={`input-posture-name-${reviewIndex}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Audio cue</Label>
                    <Input
                      value={reviewPosture.audioCue}
                      placeholder="e.g. Sink your weight..."
                      onChange={e => {
                        const updated = [...postures];
                        updated[reviewIndex] = { ...updated[reviewIndex], audioCue: e.target.value };
                        setPostures(updated);
                      }}
                      data-testid={`input-audio-cue-${reviewIndex}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tips</Label>
                    <Input
                      value={reviewPosture.tips}
                      placeholder="e.g. Keep your knee over your toes"
                      onChange={e => {
                        const updated = [...postures];
                        updated[reviewIndex] = { ...updated[reviewIndex], tips: e.target.value };
                        setPostures(updated);
                      }}
                      data-testid={`input-tips-${reviewIndex}`}
                    />
                  </div>
                </div>
              </div>

              {/* Joint tolerance sliders */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">Joint Tolerances</div>
                {Object.entries(reviewPosture.angles).slice(0, 5).map(([joint, angle]) => {
                  const tol = reviewPosture.tolerances[joint] ?? 15;
                  const label = JOINT_LABEL_MAP[joint] ?? joint;
                  return (
                    <div key={joint} className="bg-card rounded-xl p-4 border border-border">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">Target: {Math.round(angle)}° ± {tol}°</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-16">Strict</span>
                        <Slider
                          min={5}
                          max={25}
                          step={5}
                          value={[tol]}
                          onValueChange={([v]) => {
                            const updated = [...postures];
                            updated[reviewIndex] = {
                              ...updated[reviewIndex],
                              tolerances: { ...updated[reviewIndex].tolerances, [joint]: v },
                            };
                            setPostures(updated);
                          }}
                          className="flex-1"
                          data-testid={`slider-tolerance-${joint}`}
                        />
                        <span className="text-xs text-muted-foreground w-20">Forgiving</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  disabled={reviewIndex === 0}
                  onClick={() => setReviewIndex(i => i - 1)}
                  data-testid="button-prev-posture"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                {reviewIndex < postures.length - 1 ? (
                  <Button
                    className="flex-1 h-12"
                    onClick={() => setReviewIndex(i => i + 1)}
                    data-testid="button-next-posture"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    className="flex-1 h-12 font-semibold"
                    onClick={handlePublish}
                    disabled={isPublishing}
                    data-testid="button-publish-form"
                  >
                    {isPublishing ? "Publishing..." : "Publish Form"}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-12">No postures captured</div>
          )}
        </div>
      )}
    </div>
  );
}
