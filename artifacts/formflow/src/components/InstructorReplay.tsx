import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import type { MotionFrame, MotionSequence } from "../lib/motion/types";
import AvatarOverlay from "./AvatarOverlay";

interface Props {
  sequence: MotionSequence;
  videoUrl?: string;
  width?: number;
  height?: number;
  showSkeleton?: boolean;
  loop?: boolean;
  onFrameChange?: (frame: MotionFrame, idx: number) => void;
}

export default function InstructorReplay({
  sequence,
  videoUrl,
  width = 640,
  height = 480,
  showSkeleton = true,
  loop = false,
  onFrameChange,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const totalFrames = sequence.frames.length;
  const currentFrame = sequence.frames[frameIdx];

  const tick = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
    const elapsed = (timestamp - lastTimeRef.current) * speed;
    const frames = sequence.frames;

    if (frameIdx >= totalFrames - 1) {
      if (loop) {
        setFrameIdx(0);
        lastTimeRef.current = timestamp;
      } else {
        setPlaying(false);
        lastTimeRef.current = 0;
        return;
      }
    }

    const curMs = frames[frameIdx]?.timestampMs ?? 0;
    const nextMs = frames[Math.min(frameIdx + 1, totalFrames - 1)]?.timestampMs ?? curMs + 33;
    const frameDuration = (nextMs - curMs) / speed;

    if (elapsed >= frameDuration) {
      lastTimeRef.current = timestamp;
      const nextIdx = Math.min(frameIdx + 1, totalFrames - 1);
      setFrameIdx(nextIdx);
      if (onFrameChange) onFrameChange(frames[nextIdx], nextIdx);
    }

    animRef.current = requestAnimationFrame(tick);
  }, [frameIdx, totalFrames, speed, loop, sequence, onFrameChange]);

  useEffect(() => {
    if (playing) {
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(tick);
    } else {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    }
    return () => { if (animRef.current != null) cancelAnimationFrame(animRef.current); };
  }, [playing, tick]);

  useEffect(() => {
    if (videoRef.current && videoUrl && playing) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed, playing, videoUrl]);

  const togglePlay = () => {
    if (frameIdx >= totalFrames - 1) setFrameIdx(0);
    setPlaying(p => !p);
  };

  const timeMs = currentFrame?.timestampMs ?? 0;
  const totalMs = sequence.durationMs;

  const phaseLabelAtFrame = currentFrame?.phaseLabel ??
    sequence.segments.find(s => timeMs >= s.startMs && timeMs <= s.endMs)?.label;

  return (
    <div className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="relative bg-gray-900" style={{ width, height }}>
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        ) : (
          <div className="w-full h-full bg-gray-900" />
        )}

        {showSkeleton && currentFrame && (
          <AvatarOverlay
            poseLandmarks={currentFrame.poseLandmarks}
            leftHandLandmarks={currentFrame.leftHandLandmarks}
            rightHandLandmarks={currentFrame.rightHandLandmarks}
            width={width}
            height={height}
            color="#a78bfa"
            opacity={0.9}
            mirrorX={false}
          />
        )}

        {phaseLabelAtFrame && (
          <div className="absolute top-3 left-3 bg-black/50 text-purple-300 text-xs font-medium px-2.5 py-1 rounded-full">
            {phaseLabelAtFrame.replace(/_/g, " ")}
          </div>
        )}

        <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded">
          {(timeMs / 1000).toFixed(2)}s / {(totalMs / 1000).toFixed(2)}s
        </div>
      </div>

      <div className="p-3 space-y-2">
        <input
          type="range"
          min={0}
          max={Math.max(totalFrames - 1, 1)}
          value={frameIdx}
          onChange={e => {
            const i = Number(e.target.value);
            setFrameIdx(i);
            setPlaying(false);
            if (onFrameChange) onFrameChange(sequence.frames[i], i);
          }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-700"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setFrameIdx(0); setPlaying(false); }} className="p-1.5 text-gray-400 hover:text-white transition-colors"><SkipBack className="w-4 h-4" /></button>
          <button onClick={togglePlay} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-colors">
            {playing ? <><Pause className="w-4 h-4" />Pause</> : <><Play className="w-4 h-4" />Play</>}
          </button>
          <button onClick={() => { setFrameIdx(totalFrames - 1); setPlaying(false); }} className="p-1.5 text-gray-400 hover:text-white transition-colors"><SkipForward className="w-4 h-4" /></button>
          <div className="ml-auto flex gap-1">
            {[0.25, 0.5, 1.0].map(s => (
              <button key={s} onClick={() => setSpeed(s)} className={`text-xs px-1.5 py-0.5 rounded ${speed === s ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>{s}x</button>
            ))}
          </div>
          <div className="text-xs text-gray-500 font-mono ml-2">
            Frame {frameIdx + 1}/{totalFrames}
          </div>
        </div>
      </div>

      {sequence.segments.length > 0 && (
        <div className="px-3 pb-3 flex gap-1 flex-wrap">
          {sequence.segments.map((seg, i) => {
            const segFrameIdx = sequence.frames.findIndex(f => f.timestampMs >= seg.startMs);
            const isActive = timeMs >= seg.startMs && timeMs <= seg.endMs;
            return (
              <button
                key={i}
                onClick={() => { setFrameIdx(Math.max(0, segFrameIdx)); setPlaying(false); }}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  isActive ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-gray-700 text-gray-500 hover:border-gray-500"
                }`}
              >
                {seg.label.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
