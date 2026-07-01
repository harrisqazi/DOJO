import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SideFigure } from "@/components/PostureDemo";
import type { SidePose } from "@/components/PostureDemo";

interface FormIntroProps {
  formName: string;
  formDescription?: string | null;
  postures: Array<{ name: string }>;
  onBegin: () => void;
}

// ── 8-pose cinematic Yang-24 sequence (side view) ───────────────────────────
// Same coordinate system as PostureDemo: 0 0 220 290, person faces LEFT.

const POSES: SidePose[] = [
  { // 0 — Opening / Preparation
    hd:[110,22], nk:[110,44],
    fsh:[96,60],  bsh:[126,60],
    fel:[88,100], bel:[134,100],
    fwr:[84,142], bwr:[138,142],
    fhnd:[82,160], bhnd:[140,160],
    fhip:[100,154], bhip:[122,154],
    fkn:[98,204],   bkn:[122,204],
    fan:[95,260],   ban:[124,260],
  },
  { // 1 — Part the Wild Horse's Mane
    hd:[102,22], nk:[102,44],
    fsh:[88,60],  bsh:[118,60],
    fel:[52,38],  bel:[122,96],
    fwr:[32,20],  bwr:[128,136],
    fhnd:[22,10],  bhnd:[130,152],
    fhip:[92,154], bhip:[118,154],
    fkn:[62,200],  bkn:[124,194],
    fan:[46,260],  ban:[132,250],
  },
  { // 2 — White Crane Spreads Wings
    hd:[116,22], nk:[115,44],
    fsh:[100,60], bsh:[130,60],
    fel:[76,26],  bel:[140,46],
    fwr:[64,8],   bwr:[152,68],
    fhnd:[58,0],   bhnd:[158,76],
    fhip:[106,154], bhip:[128,154],
    fkn:[80,200],   bkn:[130,206],
    fan:[68,254],   ban:[130,260],
  },
  { // 3 — Brush Knee and Push
    hd:[100,22], nk:[100,44],
    fsh:[86,60],  bsh:[116,60],
    fel:[68,136], bel:[88,72],
    fwr:[62,184], bwr:[44,94],
    fhnd:[60,200], bhnd:[36,84],
    fhip:[90,154], bhip:[116,154],
    fkn:[60,200],  bkn:[122,194],
    fan:[44,260],  ban:[130,250],
  },
  { // 4 — Push / Press (both hands drive forward)
    hd:[98,22],  nk:[98,44],
    fsh:[84,60],  bsh:[114,60],
    fel:[50,80],  bel:[88,84],
    fwr:[34,98],  bwr:[70,102],
    fhnd:[26,90],  bhnd:[62,94],
    fhip:[88,154], bhip:[114,154],
    fkn:[60,200],  bkn:[120,194],
    fan:[44,260],  ban:[128,250],
  },
  { // 5 — Single Whip
    hd:[110,22], nk:[110,44],
    fsh:[90,60],  bsh:[128,60],
    fel:[38,62],  bel:[154,62],
    fwr:[16,68],  bwr:[174,68],
    fhnd:[6,64],   bhnd:[186,64],
    fhip:[96,154], bhip:[124,154],
    fkn:[82,204],  bkn:[138,204],
    fan:[68,260],  ban:[152,260],
  },
  { // 6 — Wave Hands Like Clouds
    hd:[110,22], nk:[110,44],
    fsh:[92,60],  bsh:[126,60],
    fel:[70,34],  bel:[134,88],
    fwr:[58,16],  bwr:[130,108],
    fhnd:[50,8],   bhnd:[134,120],
    fhip:[98,154], bhip:[122,154],
    fkn:[88,204],  bkn:[128,204],
    fan:[76,260],  ban:[140,260],
  },
  { // 7 — Fair Lady Works Shuttles
    hd:[100,22], nk:[100,44],
    fsh:[86,60],  bsh:[116,60],
    fel:[50,34],  bel:[88,90],
    fwr:[36,16],  bwr:[68,108],
    fhnd:[28,8],   bhnd:[62,118],
    fhip:[90,154], bhip:[116,154],
    fkn:[60,200],  bkn:[122,194],
    fan:[44,260],  ban:[130,250],
  },
];

const PHASE_MS = 2400;
const TOTAL_MS = PHASE_MS * POSES.length;

function eio(t:number){return t<0.5?2*t*t:-1+(4-2*t)*t;}
function lp(a:[number,number],b:[number,number],t:number):[number,number]{
  const e=eio(t);return[a[0]+(b[0]-a[0])*e,a[1]+(b[1]-a[1])*e];
}
function lerpPose(a:SidePose,b:SidePose,t:number):SidePose{
  const out:any={};
  for(const k of Object.keys(a) as (keyof SidePose)[]) out[k]=lp(a[k],b[k],t);
  return out as SidePose;
}

const AUTO_START_SEC = 20;

export default function FormIntro({ formName, formDescription, postures, onBegin }: FormIntroProps) {
  const [pose, setPose]           = useState<SidePose>(POSES[0]);
  const [nameIdx, setNameIdx]     = useState(0);
  const [nameVisible, setNameVisible] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);
  const [seconds, setSeconds]     = useState(AUTO_START_SEC);
  const raf   = useRef<number>(0);
  const done  = useRef(false);
  const onBeginRef = useRef(onBegin);
  onBeginRef.current = onBegin;

  // Animate figure
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() % TOTAL_MS;
      const phase   = Math.floor(elapsed / PHASE_MS) % POSES.length;
      const t       = (elapsed % PHASE_MS) / PHASE_MS;
      setPose(lerpPose(POSES[phase], POSES[(phase+1)%POSES.length], t));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  // Cycle posture names with fade
  useEffect(() => {
    if (postures.length === 0) return;
    const id = setInterval(() => {
      setNameVisible(false);
      setTimeout(() => {
        setNameIdx(i => (i+1) % postures.length);
        setNameVisible(true);
      }, 350);
    }, 2200);
    return () => clearInterval(id);
  }, [postures.length]);

  // Auto-countdown
  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(id);
          if (!done.current) { done.current = true; onBeginRef.current(); }
          return 0;
        }
        return s-1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Voice recognition — "Begin" / "Start" / "Go"
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;
    let dead = false;
    const rec = new SpeechRec();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onstart = () => setVoiceActive(true);
    rec.onerror = () => setVoiceActive(false);
    rec.onend = () => { setVoiceActive(false); if (!dead) { try { rec.start(); } catch {} } };
    rec.onresult = (event: any) => {
      const text = event.results[event.results.length-1][0].transcript.toLowerCase().trim();
      if (text.includes("begin") || text.includes("start") || text.includes("go")) {
        dead = true; done.current = true;
        try { rec.stop(); } catch {}
        onBeginRef.current();
      }
    };
    try { rec.start(); } catch {}
    return () => { dead = true; try { rec.stop(); } catch {}; };
  }, []);

  const handleBegin = () => { if (!done.current) { done.current = true; onBegin(); } };

  return (
    <div className="fixed inset-0 bg-[#07070f] flex flex-col overflow-hidden select-none">

      {/* Deep radial glow behind the figure */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 75% 65% at 50% 44%, rgba(79,70,229,0.22) 0%, rgba(99,102,241,0.06) 45%, transparent 70%)"
      }}/>

      {/* ── Top header ─────────────────────────────────────────────────── */}
      <div className="relative z-10 pt-10 text-center px-6 space-y-1">
        <div className="text-[10px] text-indigo-400/70 uppercase tracking-[0.3em] font-semibold">Dojo</div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{formName}</h1>
        {formDescription && (
          <p className="text-white/35 text-sm max-w-sm mx-auto line-clamp-2">{formDescription}</p>
        )}
        {/* Side-view instruction hint */}
        <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
          <span className="text-[10px] text-indigo-300/80 uppercase tracking-wider font-medium">
            Stand sideways to your camera for accurate tracking
          </span>
        </div>
      </div>

      {/* ── Figure — centre stage ───────────────────────────────────────── */}
      <div className="relative flex-1 flex items-center justify-center min-h-0 px-4">
        {/* Glow disc behind figure */}
        <div className="absolute w-64 h-64 rounded-full pointer-events-none" style={{
          background: "radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)",
          filter: "blur(20px)"
        }}/>
        <svg
          viewBox="0 0 220 280"
          className="relative z-10 max-h-[52vh] w-auto"
          style={{ filter: "drop-shadow(0 0 28px rgba(99,102,241,0.65))" }}
        >
          <SideFigure p={pose} opacity={0.82}/>
        </svg>
      </div>

      {/* ── Bottom controls ─────────────────────────────────────────────── */}
      <div className="relative z-10 pb-10 px-6 space-y-4 text-center">

        {/* Cycling posture name */}
        <div className="min-h-[2.5rem] flex flex-col items-center justify-center">
          <div className="text-[10px] text-white/25 uppercase tracking-widest mb-0.5">Now showing</div>
          <div
            className="text-lg font-semibold text-white/90 transition-opacity duration-300"
            style={{ opacity: nameVisible ? 1 : 0 }}
          >
            {postures[nameIdx]?.name ?? ""}
          </div>
        </div>

        {/* Voice status */}
        <div className="flex items-center justify-center gap-2 text-sm min-h-[1.5rem]">
          {voiceActive ? (
            <div className="flex items-center gap-2 text-indigo-300 animate-pulse">
              <Mic className="w-3.5 h-3.5"/>
              <span className="text-xs">Listening… say <strong>"Begin"</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white/25">
              <MicOff className="w-3.5 h-3.5"/>
              <span className="text-xs">Tap to start</span>
            </div>
          )}
        </div>

        {/* Begin button */}
        <Button
          onClick={handleBegin}
          className="w-full max-w-xs mx-auto h-13 text-base font-semibold bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30"
        >
          Begin Training
          <span className="ml-2 text-xs font-normal text-indigo-200 tabular-nums">({seconds}s)</span>
        </Button>

        <div className="text-[10px] text-white/18 pb-1">
          {postures.length} postures · side view gives most accurate scoring
        </div>
      </div>
    </div>
  );
}
