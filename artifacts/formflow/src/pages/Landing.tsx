import { useRef, useEffect } from "react";
import { Link } from "wouter";

function AnimatedSkeleton() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw(t: number) {
      ctx!.clearRect(0, 0, 220, 300);
      const s = Math.sin(t * 0.0011);
      const s2 = Math.sin(t * 0.0008 + 1.2);
      const s3 = Math.sin(t * 0.0006 + 0.5);
      const cx = 110, head = 36;
      const neck = head + 22 + s * 3;
      const torsoEnd = neck + 62;
      const hips = torsoEnd + 8;

      const grad = ctx!.createLinearGradient(cx - 30, 0, cx + 30, 300);
      grad.addColorStop(0, "#a78bfa");
      grad.addColorStop(0.4, "#818cf8");
      grad.addColorStop(1, "#6366f1");

      ctx!.strokeStyle = grad;
      ctx!.fillStyle = "#c4b5fd";
      ctx!.lineWidth = 3;
      ctx!.lineCap = "round";
      ctx!.lineJoin = "round";
      ctx!.shadowColor = "#818cf8";
      ctx!.shadowBlur = 18;

      // Head
      ctx!.beginPath();
      ctx!.arc(cx, head, 14, 0, Math.PI * 2);
      ctx!.stroke();

      // Neck to torso
      ctx!.beginPath();
      ctx!.moveTo(cx, neck);
      ctx!.lineTo(cx, torsoEnd);
      ctx!.stroke();

      // Shoulders
      const shL = cx - 40 + s * 4, shR = cx + 40 - s * 4;
      ctx!.beginPath();
      ctx!.moveTo(shL, neck + 12);
      ctx!.lineTo(shR, neck + 12);
      ctx!.stroke();

      // Left arm — flowing pose
      const elL = { x: shL - 12 + s2 * 6, y: neck + 46 };
      const wL = { x: shL - 6 + s2 * 14, y: neck + 78 + s * 5 };
      ctx!.beginPath();
      ctx!.moveTo(shL, neck + 12);
      ctx!.lineTo(elL.x, elL.y);
      ctx!.lineTo(wL.x, wL.y);
      ctx!.stroke();

      // Right arm
      const elR = { x: shR + 12 - s2 * 6, y: neck + 46 };
      const wR = { x: shR + 6 - s2 * 14, y: neck + 78 - s * 5 };
      ctx!.beginPath();
      ctx!.moveTo(shR, neck + 12);
      ctx!.lineTo(elR.x, elR.y);
      ctx!.lineTo(wR.x, wR.y);
      ctx!.stroke();

      // Hips
      const hipL = cx - 24, hipR = cx + 24;
      ctx!.beginPath();
      ctx!.moveTo(hipL, hips);
      ctx!.lineTo(hipR, hips);
      ctx!.stroke();

      // Left leg
      const kneeL = { x: hipL - 8 + s3 * 4, y: hips + 50 };
      const ankL = { x: hipL - 4 + s3 * 8, y: hips + 98 };
      ctx!.beginPath();
      ctx!.moveTo(hipL, hips);
      ctx!.lineTo(kneeL.x, kneeL.y);
      ctx!.lineTo(ankL.x, ankL.y);
      ctx!.stroke();

      // Right leg
      const kneeR = { x: hipR + 8 - s3 * 4, y: hips + 50 };
      const ankR = { x: hipR + 4 - s3 * 8, y: hips + 98 };
      ctx!.beginPath();
      ctx!.moveTo(hipR, hips);
      ctx!.lineTo(kneeR.x, kneeR.y);
      ctx!.lineTo(ankR.x, ankR.y);
      ctx!.stroke();

      // Joints glow
      ctx!.shadowBlur = 20;
      for (const [x, y] of [
        [cx, neck], [shL, neck + 12], [shR, neck + 12],
        [elL.x, elL.y], [elR.x, elR.y],
        [wL.x, wL.y], [wR.x, wR.y],
        [hipL, hips], [hipR, hips],
        [kneeL.x, kneeL.y], [kneeR.x, kneeR.y],
        [ankL.x, ankL.y], [ankR.x, ankR.y],
      ]) {
        ctx!.beginPath();
        ctx!.arc(x, y, 4, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function loop(t: number) { draw(t); rafRef.current = requestAnimationFrame(loop); }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} width={220} height={300} />;
}

function FloatingOrb({ className }: { className?: string }) {
  return (
    <div className={`absolute rounded-full pointer-events-none ${className}`}
      style={{ filter: "blur(80px)", animation: "pulse 4s ease-in-out infinite" }} />
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#06060f] text-white overflow-hidden" style={{
      backgroundImage: "radial-gradient(ellipse 100% 60% at 50% -5%, #1e1b4b55 0%, transparent 70%)"
    }}>
      {/* Ambient orbs */}
      <FloatingOrb className="w-[600px] h-[600px] bg-indigo-600/10 -top-64 -left-32" />
      <FloatingOrb className="w-[400px] h-[400px] bg-purple-600/10 top-1/2 -right-32" />
      <FloatingOrb className="w-[300px] h-[300px] bg-cyan-600/8 bottom-0 left-1/3" />

      {/* Nav */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 text-lg">⚡</span>
          <span className="text-xl font-extrabold tracking-tight text-white">Dojo</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth">
            <button className="text-sm text-slate-400 hover:text-white transition-colors">Log In</button>
          </Link>
          <Link href="/auth">
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold transition-colors shadow-[0_0_20px_#6366f130]">
              Start Training
            </button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-24">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

          {/* Left — text */}
          <div className="flex-1 text-center lg:text-left space-y-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300 font-medium">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
              AI motion analysis · real-time
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]">
              <span className="text-white">Enter</span>{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                The Dojo.
              </span>
            </h1>

            <p className="text-lg text-slate-400 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Your body is the controller. Dojo watches every joint, scores every movement, and coaches you like a master in the room — in real time.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
              <Link href="/auth">
                <button className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-base font-semibold transition-all shadow-[0_0_30px_#6366f140] hover:shadow-[0_0_40px_#6366f160]">
                  ▶ Begin Your Journey
                </button>
              </Link>
              <Link href="/auth">
                <button className="w-full sm:w-auto px-8 py-3.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-2xl text-base font-semibold transition-colors">
                  See a Demo
                </button>
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex flex-wrap gap-6 justify-center lg:justify-start pt-2">
              {[
                { icon: "🧍", label: "Full-body AI tracking" },
                { icon: "🥋", label: "10+ disciplines" },
                { icon: "📊", label: "Live score feedback" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-sm text-slate-400">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — animated skeleton */}
          <div className="flex-shrink-0 relative">
            <div className="relative w-[280px] h-[360px] flex items-center justify-center">
              {/* Glow halo */}
              <div className="absolute inset-0 rounded-full"
                style={{ background: "radial-gradient(ellipse 70% 80% at 50% 50%, #6366f122 0%, transparent 70%)" }} />
              {/* Glass card backing */}
              <div className="absolute inset-8 rounded-3xl border border-slate-700/40 bg-slate-900/30 backdrop-blur-sm" />
              <AnimatedSkeleton />
            </div>
          </div>
        </div>

        {/* Feature strip */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: "🌊",
              title: "Motion AI",
              desc: "DTW-based comparison against instructor recordings. Frame-by-frame accuracy.",
              color: "indigo",
            },
            {
              icon: "🎙️",
              title: "Voice Coaching",
              desc: "Hands-free voice commands and spoken real-time feedback while you train.",
              color: "purple",
            },
            {
              icon: "📹",
              title: "Replay & Review",
              desc: "Watch your attempt side-by-side with the instructor. Coach review mode included.",
              color: "cyan",
            },
          ].map(f => (
            <div key={f.title}
              className="relative rounded-2xl border border-slate-700/50 bg-slate-900/50 backdrop-blur p-5 overflow-hidden group hover:border-slate-600/70 transition-colors">
              <div className={`absolute inset-0 bg-gradient-to-br from-${f.color}-500/5 to-transparent pointer-events-none`} />
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA strip */}
        <div className="mt-16 relative rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-8 text-center overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 80% at 50% 50%, #6366f110 0%, transparent 70%)" }} />
          <p className="relative text-slate-400 text-sm mb-4">No equipment needed. Just a camera and the will to train.</p>
          <Link href="/auth">
            <button className="relative px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold transition-colors shadow-[0_0_20px_#6366f130]">
              Enter The Dojo — it's free
            </button>
          </Link>
        </div>
      </main>

      <footer className="relative z-10 border-t border-slate-800/60 py-6 px-6 text-center">
        <p className="text-xs text-slate-600">
          &copy; {new Date().getFullYear()} Dojo. Your body is the controller.
        </p>
      </footer>
    </div>
  );
}
