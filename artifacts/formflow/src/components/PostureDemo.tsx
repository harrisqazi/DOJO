import { useEffect, useRef, useState } from "react";

// ── Side-view Yang-24 humanoid figure ────────────────────────────────────────
// ViewBox 0 0 220 290. Person faces LEFT (nose dot points left).
// "f" = front / near-camera limb.  "b" = back / far limb.
// hnd = hand (palm centre). Fingers fan from this point.

export interface SidePose {
  hd:[number,number]; nk:[number,number];
  fsh:[number,number]; bsh:[number,number];
  fel:[number,number]; bel:[number,number];
  fwr:[number,number]; bwr:[number,number];
  fhnd:[number,number]; bhnd:[number,number];   // ← palm centres
  fhip:[number,number]; bhip:[number,number];
  fkn:[number,number]; bkn:[number,number];
  fan:[number,number]; ban:[number,number];
}

const POSES: SidePose[] = [
  { // 0 — Opening / neutral (arms at sides, weight even)
    hd:[110,22], nk:[110,44],
    fsh:[96,60],  bsh:[126,60],
    fel:[88,100], bel:[134,100],
    fwr:[84,142], bwr:[138,142],
    fhnd:[82,160], bhnd:[140,160],
    fhip:[100,154], bhip:[122,154],
    fkn:[98,204],   bkn:[122,204],
    fan:[95,260],   ban:[124,260],
  },
  { // 1 — Wild Horse's Mane (left bow, front arm diagonal up-forward)
    hd:[102,22], nk:[102,44],
    fsh:[88,60],  bsh:[118,60],
    fel:[52,38],  bel:[122,96],
    fwr:[32,20],  bwr:[128,136],
    fhnd:[22,10],  bhnd:[130,152],
    fhip:[92,154], bhip:[118,154],
    fkn:[62,200],  bkn:[124,194],
    fan:[46,260],  ban:[132,250],
  },
  { // 2 — White Crane (weight back, arms spread wide)
    hd:[116,22], nk:[115,44],
    fsh:[100,60], bsh:[130,60],
    fel:[76,26],  bel:[140,46],
    fwr:[64,8],   bwr:[152,68],
    fhnd:[58,0],   bhnd:[158,76],
    fhip:[106,154], bhip:[128,154],
    fkn:[80,200],   bkn:[130,206],
    fan:[68,254],   ban:[130,260],
  },
  { // 3 — Brush Knee & Push (bow stance, right hand thrusts, left brushes knee)
    hd:[100,22], nk:[100,44],
    fsh:[86,60],  bsh:[116,60],
    fel:[68,136], bel:[88,72],
    fwr:[62,184], bwr:[44,94],
    fhnd:[60,200], bhnd:[36,84],
    fhip:[90,154], bhip:[116,154],
    fkn:[60,200],  bkn:[122,194],
    fan:[44,260],  ban:[130,250],
  },
  { // 4 — Single Whip (horse stance, arms at max span)
    hd:[110,22], nk:[110,44],
    fsh:[90,60],  bsh:[128,60],
    fel:[38,62],  bel:[154,62],
    fwr:[16,68],  bwr:[174,68],
    fhnd:[6,64],   bhnd:[186,64],
    fhip:[96,154], bhip:[124,154],
    fkn:[82,204],  bkn:[138,204],
    fan:[68,260],  ban:[152,260],
  },
  { // 5 — Wave Hands Like Clouds (horse stance, one arm high one mid)
    hd:[110,22], nk:[110,44],
    fsh:[92,60],  bsh:[126,60],
    fel:[70,34],  bel:[134,88],
    fwr:[58,16],  bwr:[130,108],
    fhnd:[50,8],   bhnd:[134,120],
    fhip:[98,154], bhip:[122,154],
    fkn:[88,204],  bkn:[128,204],
    fan:[76,260],  ban:[140,260],
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

// ── Capsule limb ─────────────────────────────────────────────────────────────
function Capsule({x1,y1,x2,y2,r,fill,opacity=1}:{
  x1:number;y1:number;x2:number;y2:number;
  r:number;fill:string;opacity?:number;
}){
  const angle=Math.atan2(y2-y1,x2-x1)*180/Math.PI;
  const len=Math.sqrt((x2-x1)**2+(y2-y1)**2);
  if(len<1) return null;
  const cx=(x1+x2)/2, cy=(y1+y2)/2;
  return(
    <rect
      x={cx-len/2} y={cy-r} width={len} height={r*2}
      rx={r} ry={r} fill={fill} opacity={opacity}
      transform={`rotate(${angle} ${cx} ${cy})`}
    />
  );
}

// ── Joint sphere ─────────────────────────────────────────────────────────────
function Joint({x,y,r,fill,opacity=1}:{x:number;y:number;r:number;fill:string;opacity?:number}){
  return(
    <>
      <circle cx={x} cy={y} r={r} fill={fill} opacity={opacity}/>
      <circle cx={x-r*0.35} cy={y-r*0.35} r={r*0.4} fill="white" opacity={opacity*0.55}/>
    </>
  );
}

// ── Hand: palm circle + 3 finger capsules fanning out ────────────────────────
function Hand({wx,wy,hx,hy,fg,opacity=1}:{
  wx:number;wy:number;hx:number;hy:number;
  fg:string;opacity?:number;
}){
  // Direction from wrist to hand centre
  const dx=hx-wx, dy=hy-wy;
  const ang=Math.atan2(dy,dx);
  const spread=0.35; // radians between fingers
  const flen=12;     // finger length
  const fingers=[-spread,0,spread].map(offset=>{
    const fa=ang+offset;
    return [hx+Math.cos(fa)*flen, hy+Math.sin(fa)*flen] as [number,number];
  });
  return(
    <g opacity={opacity}>
      {/* Palm */}
      <circle cx={hx} cy={hy} r={5.5} fill={fg}/>
      <circle cx={hx-2} cy={hy-2} r={2} fill="white" opacity={0.4}/>
      {/* Fingers */}
      {fingers.map(([fx,fy],i)=>(
        <Capsule key={i} x1={hx} y1={hy} x2={fx} y2={fy} r={2.2} fill={fg}/>
      ))}
    </g>
  );
}

// ── Main exported figure ─────────────────────────────────────────────────────
export function SideFigure({p,opacity=0.68}:{p:SidePose;opacity?:number}){
  const hipMx=(p.fhip[0]+p.bhip[0])/2, hipMy=(p.fhip[1]+p.bhip[1])/2;
  const shMx=(p.fsh[0]+p.bsh[0])/2,    shMy=(p.fsh[1]+p.bsh[1])/2;

  return(
    <g opacity={opacity}>
      <defs>
        <linearGradient id="fg-lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#c7d2fe"/>
          <stop offset="45%"  stopColor="#818cf8"/>
          <stop offset="100%" stopColor="#3730a3"/>
        </linearGradient>
        <linearGradient id="bg-lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4338ca" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.55"/>
        </linearGradient>
        <linearGradient id="ts-lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e0e7ff"/>
          <stop offset="55%"  stopColor="#a5b4fc"/>
          <stop offset="100%" stopColor="#4338ca"/>
        </linearGradient>
        <radialGradient id="hd-rg" cx="38%" cy="30%" r="62%">
          <stop offset="0%"   stopColor="#e0e7ff"/>
          <stop offset="55%"  stopColor="#818cf8"/>
          <stop offset="100%" stopColor="#312e81"/>
        </radialGradient>
        <radialGradient id="fj-rg" cx="35%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#e0e7ff"/>
          <stop offset="100%" stopColor="#6366f1"/>
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx={110} cy={263} rx={52} ry={4} fill="rgba(99,102,241,0.09)"/>

      {/* ═══ BACK limbs (dim, drawn first) ═══ */}
      <Capsule x1={p.bsh[0]} y1={p.bsh[1]} x2={p.bel[0]} y2={p.bel[1]} r={4.5} fill="url(#bg-lg)" opacity={0.4}/>
      <Capsule x1={p.bel[0]} y1={p.bel[1]} x2={p.bwr[0]} y2={p.bwr[1]} r={3.5} fill="url(#bg-lg)" opacity={0.4}/>
      <Capsule x1={p.bhip[0]} y1={p.bhip[1]} x2={p.bkn[0]} y2={p.bkn[1]} r={6}   fill="url(#bg-lg)" opacity={0.4}/>
      <Capsule x1={p.bkn[0]}  y1={p.bkn[1]}  x2={p.ban[0]} y2={p.ban[1]} r={4.5} fill="url(#bg-lg)" opacity={0.4}/>
      <Capsule x1={p.ban[0]}  y1={p.ban[1]}  x2={p.ban[0]+20} y2={p.ban[1]} r={3.2} fill="url(#bg-lg)" opacity={0.4}/>
      {/* Back hand */}
      <Hand wx={p.bwr[0]} wy={p.bwr[1]} hx={p.bhnd[0]} hy={p.bhnd[1]} fg="url(#bg-lg)" opacity={0.4}/>

      {/* ═══ TORSO ═══ */}
      {/* Filled body silhouette (trapezoid: shoulders wider than hips) */}
      <polygon
        points={`${p.fsh[0]},${p.fsh[1]} ${p.bsh[0]},${p.bsh[1]} ${p.bhip[0]},${p.bhip[1]} ${p.fhip[0]},${p.fhip[1]}`}
        fill="url(#ts-lg)" opacity={0.55}
      />
      {/* Spine capsule over top for roundness */}
      <Capsule x1={shMx} y1={shMy} x2={hipMx} y2={hipMy} r={5} fill="url(#ts-lg)" opacity={0.7}/>
      {/* Shoulder girdle */}
      <Capsule x1={p.fsh[0]} y1={p.fsh[1]} x2={p.bsh[0]} y2={p.bsh[1]} r={4.5} fill="url(#ts-lg)" opacity={0.65}/>
      {/* Neck */}
      <Capsule x1={p.hd[0]} y1={p.hd[1]+13} x2={p.nk[0]} y2={p.nk[1]} r={3.8} fill="url(#ts-lg)"/>

      {/* ═══ FRONT limbs ═══ */}
      <Capsule x1={p.fsh[0]} y1={p.fsh[1]} x2={p.fel[0]} y2={p.fel[1]} r={5}   fill="url(#fg-lg)"/>
      <Capsule x1={p.fel[0]} y1={p.fel[1]} x2={p.fwr[0]} y2={p.fwr[1]} r={3.8} fill="url(#fg-lg)"/>
      <Capsule x1={p.fhip[0]} y1={p.fhip[1]} x2={p.fkn[0]} y2={p.fkn[1]} r={6.5} fill="url(#fg-lg)"/>
      <Capsule x1={p.fkn[0]}  y1={p.fkn[1]}  x2={p.fan[0]} y2={p.fan[1]} r={5}   fill="url(#fg-lg)"/>
      {/* Front foot */}
      <Capsule x1={p.fan[0]} y1={p.fan[1]} x2={p.fan[0]-24} y2={p.fan[1]} r={3.8} fill="url(#fg-lg)"/>
      {/* Front hand */}
      <Hand wx={p.fwr[0]} wy={p.fwr[1]} hx={p.fhnd[0]} hy={p.fhnd[1]} fg="url(#fg-lg)"/>

      {/* ═══ HEAD ═══ */}
      {/* Head sphere */}
      <circle cx={p.hd[0]} cy={p.hd[1]} r={15} fill="url(#hd-rg)"/>
      {/* Ear (back of head slightly visible) */}
      <ellipse cx={p.hd[0]+11} cy={p.hd[1]+2} rx={3.5} ry={5} fill="url(#hd-rg)" opacity={0.7}/>
      {/* Nose */}
      <circle cx={p.hd[0]-13} cy={p.hd[1]+2} r={2.8} fill="#c7d2fe" opacity={0.9}/>
      {/* Eye */}
      <circle cx={p.hd[0]-6} cy={p.hd[1]-3} r={2.5} fill="#1e1b4b" opacity={0.85}/>
      <circle cx={p.hd[0]-5} cy={p.hd[1]-4} r={1.1} fill="white" opacity={0.6}/>

      {/* ═══ JOINTS ═══ */}
      {/* Back joints (dim) */}
      {([p.bsh,p.bel,p.bwr,p.bhip,p.bkn,p.ban] as [number,number][]).map((j,i)=>(
        <circle key={`bj${i}`} cx={j[0]} cy={j[1]} r={3} fill="#4338ca" opacity={0.38}/>
      ))}
      {/* Front joints (bright) */}
      {([p.fsh,p.fel,p.fwr,p.fhip,p.fkn,p.fan] as [number,number][]).map((j,i)=>(
        <Joint key={`fj${i}`} x={j[0]} y={j[1]} r={4.2} fill="url(#fj-rg)"/>
      ))}
    </g>
  );
}

// ── Animated preview (default export) ────────────────────────────────────────
export default function PostureDemo() {
  const [pose, setPose] = useState<SidePose>(POSES[0]);
  const raf = useRef<number>(0);

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

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      <svg
        viewBox="0 0 220 290"
        className="h-full w-auto"
        style={{ filter: "drop-shadow(0 0 20px rgba(99,102,241,0.6))" }}
      >
        <SideFigure p={pose} opacity={0.72}/>
      </svg>
    </div>
  );
}
