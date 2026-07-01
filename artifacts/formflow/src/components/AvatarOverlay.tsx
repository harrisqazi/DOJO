import { useEffect, useRef } from "react";
import type { Landmark2D } from "../lib/motion/types";

const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
  [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32],
  [27, 31], [28, 32],
];

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

interface Props {
  poseLandmarks: Landmark2D[];
  leftHandLandmarks?: Landmark2D[];
  rightHandLandmarks?: Landmark2D[];
  width: number;
  height: number;
  color?: string;
  opacity?: number;
  showHands?: boolean;
  drawJoints?: boolean;
  mirrorX?: boolean;
  className?: string;
}

function mapX(x: number, w: number, mirror: boolean): number {
  return mirror ? (1 - x) * w : x * w;
}

function mapY(y: number, h: number): number {
  return y * h;
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lms: Landmark2D[],
  connections: number[][],
  w: number,
  h: number,
  mirror: boolean,
  color: string,
  lineWidth: number,
  dotRadius: number,
  minVis = 0.3,
  showJoints = true
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";

  for (const [a, b] of connections) {
    if (!lms[a] || !lms[b]) continue;
    if ((lms[a].visibility ?? 1) < minVis || (lms[b].visibility ?? 1) < minVis) continue;
    const alpha = Math.min(lms[a].visibility ?? 1, lms[b].visibility ?? 1);
    ctx.globalAlpha = alpha * 0.9;
    ctx.beginPath();
    ctx.moveTo(mapX(lms[a].x, w, mirror), mapY(lms[a].y, h));
    ctx.lineTo(mapX(lms[b].x, w, mirror), mapY(lms[b].y, h));
    ctx.stroke();
  }

  if (showJoints) {
    ctx.fillStyle = color;
    for (const lm of lms) {
      if (!lm || (lm.visibility ?? 1) < minVis) continue;
      ctx.globalAlpha = (lm.visibility ?? 1);
      ctx.beginPath();
      ctx.arc(mapX(lm.x, w, mirror), mapY(lm.y, h), dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export default function AvatarOverlay({
  poseLandmarks,
  leftHandLandmarks,
  rightHandLandmarks,
  width,
  height,
  color = "#3b82f6",
  opacity = 0.85,
  showHands = true,
  drawJoints = true,
  mirrorX = true,
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    if (!poseLandmarks || poseLandmarks.length === 0) return;

    ctx.save();
    ctx.globalAlpha = opacity;

    drawSkeleton(ctx, poseLandmarks, POSE_CONNECTIONS, width, height, mirrorX, color, 3, 4, 0.3, drawJoints);

    if (showHands) {
      if (leftHandLandmarks && leftHandLandmarks.length > 0) {
        drawSkeleton(ctx, leftHandLandmarks, HAND_CONNECTIONS, width, height, mirrorX, "#10b981", 2, 3, 0.2, drawJoints);
      }
      if (rightHandLandmarks && rightHandLandmarks.length > 0) {
        drawSkeleton(ctx, rightHandLandmarks, HAND_CONNECTIONS, width, height, mirrorX, "#f59e0b", 2, 3, 0.2, drawJoints);
      }
    }

    ctx.restore();
  }, [poseLandmarks, leftHandLandmarks, rightHandLandmarks, width, height, color, opacity, showHands, drawJoints, mirrorX]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`pointer-events-none ${className}`}
      style={{ position: "absolute", top: 0, left: 0 }}
    />
  );
}

export function InstructorAvatarOverlay({
  poseLandmarks,
  leftHandLandmarks,
  rightHandLandmarks,
  width,
  height,
  opacity = 0.55,
}: Omit<Props, "color" | "drawJoints" | "mirrorX">) {
  return (
    <AvatarOverlay
      poseLandmarks={poseLandmarks}
      leftHandLandmarks={leftHandLandmarks}
      rightHandLandmarks={rightHandLandmarks}
      width={width}
      height={height}
      color="#a78bfa"
      opacity={opacity}
      drawJoints={false}
      mirrorX={false}
    />
  );
}
