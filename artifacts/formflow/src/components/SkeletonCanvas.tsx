import { useEffect, useRef } from "react";

type SkeletonCanvasProps = {
  landmarks: any[];
  jointResults: Array<{id: string; actual: number; target: number; status: 'good'|'close'|'off'}>;
  isActive: boolean;
};

// Full body + hand connections (MediaPipe BlazePose indices)
const BODY_CONNECTIONS: [number,number][] = [
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left arm
  [11, 13], [13, 15],
  // Right arm
  [12, 14], [14, 16],
  // Left leg
  [23, 25], [25, 27], [27, 29], [27, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [28, 32],
];

// Wrist → finger connections (left: 15, right: 16)
const HAND_CONNECTIONS: [number,number][] = [
  [15, 17], [15, 19], [15, 21], // left wrist → pinky, index, thumb
  [16, 18], [16, 20], [16, 22], // right wrist → pinky, index, thumb
];

// Index → landmark for status colouring (rough approximation)
const JOINT_STATUS_MAP: Record<string, number[]> = {
  front_knee: [25, 27], rear_knee: [26, 28],
  left_elbow: [13, 15], right_elbow: [14, 16],
  spine: [11, 23], right_spine: [12, 24],
};

function statusColor(j: {status:string}|undefined) {
  if (!j) return null;
  if (j.status === 'good')  return '#22c55e';
  if (j.status === 'close') return '#eab308';
  return '#ef4444';
}

function drawCapsule(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  r: number, color: string
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len   = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
  if (len < 1) return;
  ctx.save();
  ctx.translate((x1+x2)/2, (y1+y2)/2);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.roundRect(-len/2, -r, len, r*2, r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function SkeletonCanvas({ landmarks, jointResults, isActive }: SkeletonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;

    const W = canvas.width;
    const H = canvas.height;

    // Build a quick status lookup: landmark index → color
    const idxColor: Record<number, string> = {};
    jointResults.forEach(j => {
      const c = statusColor(j);
      if (!c) return;
      (JOINT_STATUS_MAP[j.id] ?? []).forEach(idx => { idxColor[idx] = c; });
    });

    const render = () => {
      ctx.clearRect(0, 0, W, H);

      if (landmarks && landmarks.length >= 17) {
        const lm = landmarks;

        const px = (i: number) => lm[i] ? lm[i].x * W : 0;
        const py = (i: number) => lm[i] ? lm[i].y * H : 0;
        const vis = (i: number) => (lm[i]?.visibility ?? 0) > 0.4;

        // ── Body capsule limbs ──
        BODY_CONNECTIONS.forEach(([a, b]) => {
          if (!vis(a) || !vis(b)) return;
          const col = idxColor[a] ?? idxColor[b] ?? 'rgba(99,102,241,0.75)';
          // Vary thickness: torso wider, extremities thinner
          const isLeg = [25,26,27,28,29,30,31,32].includes(a) || [25,26,27,28,29,30,31,32].includes(b);
          const isTorso = [11,12,23,24].includes(a) && [11,12,23,24].includes(b);
          const r = isTorso ? 9 : isLeg ? 7 : 5;
          drawCapsule(ctx, px(a), py(a), px(b), py(b), r, col + "BF"); // BF = 75% opacity suffix trick (already rgba)
          // Simpler: use ctx.globalAlpha
          ctx.globalAlpha = 0.82;
          drawCapsule(ctx, px(a), py(a), px(b), py(b), r,
            isTorso ? 'rgb(148,163,184)' : col.startsWith('#') ? col : '#818cf8');
          ctx.globalAlpha = 1;
        });

        // ── Hand connections (thinner) ──
        HAND_CONNECTIONS.forEach(([a, b]) => {
          if (!vis(a) || !vis(b)) return;
          ctx.globalAlpha = 0.7;
          drawCapsule(ctx, px(a), py(a), px(b), py(b), 3, '#c7d2fe');
          ctx.globalAlpha = 1;
        });

        // ── Joints (spheres with highlight) ──
        const allJointIdx = new Set<number>([
          11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28
        ]);
        allJointIdx.forEach(i => {
          if (!vis(i)) return;
          const x = px(i), y = py(i);
          const isHand = i >= 17;
          const r = isHand ? 4 : i <= 16 ? 7 : 6;
          const col = idxColor[i] ?? (isHand ? '#a5b4fc' : '#6366f1');

          // Outer sphere
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.fill();

          // Highlight dot
          ctx.beginPath();
          ctx.arc(x - r*0.3, y - r*0.3, r * 0.38, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.fill();
        });

        // ── Head circle ──
        if (vis(0)) {
          const hx = px(0), hy = py(0);
          const grad = ctx.createRadialGradient(hx-6, hy-6, 2, hx, hy, 14);
          grad.addColorStop(0, '#e0e7ff');
          grad.addColorStop(0.5, '#818cf8');
          grad.addColorStop(1, '#3730a3');
          ctx.beginPath();
          ctx.arc(hx, hy, 14, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(rafId);
  }, [landmarks, jointResults, isActive]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      width={1280}
      height={720}
    />
  );
}

export default SkeletonCanvas;
