import { useRef, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  useGetDashboardStats, useListForms, useGetProgressData, useGetDojo,
  getGetDashboardStatsQueryKey, getListFormsQueryKey, getGetProgressDataQueryKey, getGetDojoQueryKey
} from "@workspace/api-client-react";

/* ─── Idle skeleton avatar drawn on canvas ──────────────────────────── */
function IdleSkeleton({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw(t: number) {
      timeRef.current = t;
      ctx!.clearRect(0, 0, 160, 220);
      const s = Math.sin(t * 0.0013);
      const s2 = Math.sin(t * 0.0009 + 1);
      const cx = 80, head = 28;
      const neck = head + 18 + s * 2;
      const torsoEnd = neck + 48;
      const hips = torsoEnd + 6;

      const grad = ctx!.createLinearGradient(cx - 20, 0, cx + 20, 220);
      grad.addColorStop(0, "#818cf8");
      grad.addColorStop(0.5, "#6366f1");
      grad.addColorStop(1, "#4f46e5");

      ctx!.strokeStyle = grad;
      ctx!.lineWidth = 2.5;
      ctx!.lineCap = "round";
      ctx!.lineJoin = "round";
      ctx!.shadowColor = "#818cf8";
      ctx!.shadowBlur = 10;
      ctx!.globalAlpha = 0.92;

      // head
      ctx!.beginPath();
      ctx!.arc(cx, head, 11, 0, Math.PI * 2);
      ctx!.stroke();

      // spine
      ctx!.beginPath();
      ctx!.moveTo(cx, neck);
      ctx!.lineTo(cx, torsoEnd);
      ctx!.stroke();

      // shoulders
      const shL = cx - 30 + s * 3, shR = cx + 30 - s * 3;
      ctx!.beginPath();
      ctx!.moveTo(shL, neck + 10);
      ctx!.lineTo(shR, neck + 10);
      ctx!.stroke();

      // left arm — gentle idle sway
      const elL = { x: shL - 8 + s2 * 4, y: neck + 35 };
      const wL = { x: shL - 4 + s2 * 8, y: neck + 58 + s * 3 };
      ctx!.beginPath();
      ctx!.moveTo(shL, neck + 10);
      ctx!.lineTo(elL.x, elL.y);
      ctx!.lineTo(wL.x, wL.y);
      ctx!.stroke();

      // right arm
      const elR = { x: shR + 8 - s2 * 4, y: neck + 35 };
      const wR = { x: shR + 4 - s2 * 8, y: neck + 58 - s * 3 };
      ctx!.beginPath();
      ctx!.moveTo(shR, neck + 10);
      ctx!.lineTo(elR.x, elR.y);
      ctx!.lineTo(wR.x, wR.y);
      ctx!.stroke();

      // hips bar
      const hipL = cx - 18, hipR = cx + 18;
      ctx!.beginPath();
      ctx!.moveTo(hipL, hips);
      ctx!.lineTo(hipR, hips);
      ctx!.stroke();

      // left leg
      const kneeL = { x: hipL - 5 + s * 2, y: hips + 38 };
      const ankL = { x: hipL - 2 + s * 4, y: hips + 72 };
      ctx!.beginPath();
      ctx!.moveTo(hipL, hips);
      ctx!.lineTo(kneeL.x, kneeL.y);
      ctx!.lineTo(ankL.x, ankL.y);
      ctx!.stroke();

      // right leg
      const kneeR = { x: hipR + 5 - s * 2, y: hips + 38 };
      const ankR = { x: hipR + 2 - s * 4, y: hips + 72 };
      ctx!.beginPath();
      ctx!.moveTo(hipR, hips);
      ctx!.lineTo(kneeR.x, kneeR.y);
      ctx!.lineTo(ankR.x, ankR.y);
      ctx!.stroke();

      // joints
      ctx!.fillStyle = "#c7d2fe";
      ctx!.shadowBlur = 14;
      for (const [x, y] of [
        [cx, neck], [shL, neck + 10], [shR, neck + 10],
        [elL.x, elL.y], [elR.x, elR.y], [wL.x, wL.y], [wR.x, wR.y],
        [hipL, hips], [hipR, hips],
        [kneeL.x, kneeL.y], [kneeR.x, kneeR.y],
        [ankL.x, ankL.y], [ankR.x, ankR.y],
      ]) {
        ctx!.beginPath();
        ctx!.arc(x, y, 3, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function loop(t: number) {
      draw(t);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} width={160} height={220} className={className} />;
}

/* ─── Score ring ─────────────────────────────────────────────────── */
function ScoreRing({ score, label, size = 72, color = "#818cf8" }: {
  score: number; label: string; size?: number; color?: string;
}) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(score, 100) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#1e1b4b" strokeWidth={7} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={7} fill="none"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: "stroke-dasharray 0.9s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{score}</span>
        </div>
      </div>
      <span className="text-[10px] text-indigo-300 text-center leading-tight">{label}</span>
    </div>
  );
}

/* ─── Stat bar ───────────────────────────────────────────────────── */
function StatBar({ label, value, color = "#818cf8", icon }: {
  label: string; value: number; color?: string; icon?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
          {icon && <span>{icon}</span>}
          {label}
        </span>
        <span className="text-xs font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 8px ${color}44` }}
        />
      </div>
    </div>
  );
}

/* ─── Glassmorphism card ─────────────────────────────────────────── */
function GlassCard({ children, className = "", glow = false }: {
  children: React.ReactNode; className?: string; glow?: boolean;
}) {
  return (
    <div className={`relative rounded-2xl border border-slate-700/60 bg-slate-900/60 backdrop-blur-md overflow-hidden ${glow ? "shadow-[0_0_30px_#6366f120]" : ""} ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800/20 to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ─── Difficulty badge ───────────────────────────────────────────── */
function DiffBadge({ difficulty }: { difficulty?: string }) {
  const map: Record<string, { color: string; label: string }> = {
    beginner: { color: "text-green-400 border-green-500/40 bg-green-500/10", label: "Beginner" },
    intermediate: { color: "text-amber-400 border-amber-500/40 bg-amber-500/10", label: "Intermediate" },
    advanced: { color: "text-red-400 border-red-500/40 bg-red-500/10", label: "Advanced" },
    master: { color: "text-purple-400 border-purple-500/40 bg-purple-500/10", label: "Master" },
  };
  const d = map[difficulty?.toLowerCase() ?? ""] ?? { color: "text-slate-400 border-slate-600 bg-slate-800", label: difficulty ?? "Form" };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${d.color}`}>
      {d.label}
    </span>
  );
}

/* ─── Rank computation ───────────────────────────────────────────── */
function computeRank(avgScore: number | null, sessions: number): { sash: string; label: string; color: string } {
  const s = avgScore ?? 0;
  if (sessions === 0) return { sash: "⬜", label: "White Sash I", color: "#e5e7eb" };
  if (s < 30) return { sash: "⬜", label: "White Sash II", color: "#e5e7eb" };
  if (s < 45) return { sash: "🟡", label: "Yellow Sash", color: "#fbbf24" };
  if (s < 58) return { sash: "🟠", label: "Orange Sash", color: "#f97316" };
  if (s < 68) return { sash: "🟢", label: "Green Sash", color: "#22c55e" };
  if (s < 76) return { sash: "🔵", label: "Blue Sash", color: "#3b82f6" };
  if (s < 84) return { sash: "🟣", label: "Purple Sash", color: "#a855f7" };
  if (s < 91) return { sash: "🟤", label: "Brown Sash", color: "#92400e" };
  return { sash: "⬛", label: "Black Sash", color: "#1f2937" };
}

/* ─── Fighter stat derivation ────────────────────────────────────── */
function deriveStats(avgScore: number | null, progress: any) {
  const base = avgScore ?? 42;
  const jitter = (seed: number) => Math.min(100, Math.max(10, Math.round(base + (seed % 22) - 11)));
  return [
    { label: "Flow", value: jitter(7), color: "#818cf8", icon: "🌊" },
    { label: "Root", value: jitter(13), color: "#22c55e", icon: "🌱" },
    { label: "Guard", value: jitter(5), color: "#f59e0b", icon: "🛡️" },
    { label: "Hands", value: jitter(17), color: "#a78bfa", icon: "✋" },
    { label: "Footwork", value: jitter(11), color: "#06b6d4", icon: "👣" },
    { label: "Centerline", value: jitter(3), color: "#f472b6", icon: "⚡" },
    { label: "Smoothness", value: jitter(19), color: "#34d399", icon: "〰️" },
    { label: "Recovery", value: jitter(9), color: "#fb923c", icon: "🔄" },
  ];
}

/* ─── Dashboard ──────────────────────────────────────────────────── */
export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [expandedForm, setExpandedForm] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { enabled: !!profile, queryKey: getGetDashboardStatsQueryKey() }
  });
  const { data: forms, isLoading: formsLoading } = useListForms(
    { dojo_id: profile?.dojo_id || undefined },
    { query: { enabled: !!profile, queryKey: getListFormsQueryKey() } }
  );
  const { data: progress } = useGetProgressData({
    query: { enabled: !!profile, queryKey: getGetProgressDataQueryKey() }
  });
  const { data: dojo } = useGetDojo(
    profile?.dojo_id || "",
    { query: { enabled: !!profile?.dojo_id, queryKey: getGetDojoQueryKey(profile?.dojo_id || "") } }
  );

  const isAdmin = profile?.role === "platform_admin" || profile?.role === "dojo_admin";
  const avgScore = stats?.avg_score ? Math.round(stats.avg_score) : null;
  const rank = computeRank(avgScore, stats?.total_sessions ?? 0);
  const fighterStats = deriveStats(avgScore, progress);
  const firstForm = forms?.[0];

  return (
    <div className="min-h-screen bg-[#06060f] text-white" style={{ backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, #1e1b4b44 0%, transparent 70%)" }}>

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#06060f]/80 backdrop-blur px-5 py-3 flex items-center gap-4">
        <div className="text-lg font-extrabold tracking-tight text-indigo-400">⚡ The Dojo</div>
        {dojo && (
          <div className="text-xs text-slate-500 px-2 py-0.5 border border-slate-700 rounded-full">{dojo.name}</div>
        )}
        <div className="ml-auto flex items-center gap-3">
          {isAdmin && (
            <button onClick={() => setLocation("/admin")} className="text-xs text-slate-400 hover:text-white px-2 py-1 border border-slate-700 rounded-lg transition-colors">Admin</button>
          )}
          <span className="hidden sm:block text-xs text-slate-500">{profile?.name || profile?.email}</span>
          <button onClick={() => signOut()} className="text-xs text-slate-400 hover:text-white px-2 py-1 border border-slate-700 rounded-lg transition-colors">Sign Out</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── 1. Hero ── */}
        <GlassCard glow className="p-0 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse 70% 80% at 15% 50%, #4f46e522 0%, transparent 60%), radial-gradient(ellipse 40% 60% at 85% 50%, #7c3aed18 0%, transparent 60%)"
          }} />
          <div className="flex flex-col md:flex-row items-center gap-6 p-7 relative z-10">
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 40px 15px #6366f133" }} />
                <IdleSkeleton />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left space-y-3">
              <div>
                <div className="text-3xl font-extrabold tracking-tight text-white">The Dojo</div>
                <div className="text-slate-400 text-sm">Your body is the controller.</div>
              </div>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{rank.sash}</span>
                  <span className="text-sm font-semibold" style={{ color: rank.color }}>{rank.label}</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400">
                  <span className="text-base">🔥</span>
                  <span className="text-sm font-semibold">{statsLoading ? "—" : (stats?.streak ?? 0)} day streak</span>
                </div>
              </div>
              <div className="flex gap-4 justify-center md:justify-start">
                <ScoreRing score={avgScore ?? 0} label="Flow Score" size={68} color="#818cf8" />
                <ScoreRing score={stats?.total_sessions ? Math.min(100, stats.total_sessions * 5) : 0} label="Sessions" size={68} color="#06b6d4" />
              </div>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-1">
                {firstForm && (
                  <Link href={`/training/${firstForm.id}`}>
                    <button className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold transition-colors shadow-[0_0_20px_#6366f140]">
                      ▶ Begin Training
                    </button>
                  </Link>
                )}
                {firstForm && (
                  <Link href={`/training/${firstForm.id}`}>
                    <button className="px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-sm font-semibold transition-colors">
                      Free Practice
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* ── 2. Continue Card ── */}
            {firstForm && (
              <GlassCard>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Continue Your Form</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="w-16 h-16 rounded-xl bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                      🥋
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="font-semibold text-white">{firstForm.name}</div>
                      <div className="flex flex-wrap gap-1.5">
                        <DiffBadge difficulty={firstForm.difficulty ?? undefined} />
                        <span className="text-[10px] text-slate-400 border border-slate-700 bg-slate-800/50 px-2 py-0.5 rounded-full">{firstForm.posture_count ?? 0} postures</span>
                        {firstForm.is_free && <span className="text-[10px] text-green-400 border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded-full">Free</span>}
                      </div>
                      {firstForm.description && (
                        <p className="text-xs text-slate-400 line-clamp-2">{firstForm.description}</p>
                      )}
                      {progress?.most_improved_posture && (
                        <div className="text-xs text-green-400 flex items-center gap-1">
                          <span>↑</span>
                          <span>Most improved: {progress.most_improved_posture}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link href={`/training/${firstForm.id}`}>
                      <button className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold transition-colors">
                        ▶ Practice
                      </button>
                    </Link>
                    <Link href={`/training/${firstForm.id}`}>
                      <button className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-sm font-medium transition-colors">
                        Begin Trial
                      </button>
                    </Link>
                    <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium text-slate-400 transition-colors">
                      ⏮ Replay
                    </button>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* ── 3. Training Arcade ── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-4 bg-cyan-500 rounded-full" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Training Arcade</span>
              </div>
              {formsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2].map(i => (
                    <div key={i} className="h-48 rounded-2xl bg-slate-800/50 animate-pulse" />
                  ))}
                </div>
              ) : forms && forms.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {forms.map((form, idx) => (
                    <GlassCard key={form.id} className={`cursor-pointer transition-all duration-200 hover:border-indigo-500/50 ${expandedForm === form.id ? "border-indigo-500/50" : ""}`}>
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600/30 to-purple-600/30 border border-indigo-500/30 flex items-center justify-center text-lg flex-shrink-0">
                              {idx === 0 ? "🥋" : idx === 1 ? "⚔️" : idx === 2 ? "🌊" : "🔥"}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white leading-tight">{form.name}</div>
                              <div className="text-[10px] text-slate-500">{form.posture_count ?? 0} postures</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <DiffBadge difficulty={form.difficulty ?? undefined} />
                            {avgScore !== null ? (
                              <div className="text-xs font-bold text-indigo-400">{avgScore}</div>
                            ) : (
                              <div className="text-[10px] text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 rounded-full">New</div>
                            )}
                          </div>
                        </div>

                        {form.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{form.description}</p>
                        )}

                        <div className="flex gap-1.5">
                          <Link href={`/training/${form.id}`} className="flex-1">
                            <button className="w-full py-1.5 bg-indigo-600/80 hover:bg-indigo-600 rounded-lg text-xs font-semibold transition-colors">
                              ▶ Practice
                            </button>
                          </Link>
                          <Link href={`/training/${form.id}`}>
                            <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-400 transition-colors">
                              Begin
                            </button>
                          </Link>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              ) : (
                <GlassCard>
                  <div className="p-12 text-center space-y-2">
                    <div className="text-3xl">🏯</div>
                    <p className="text-sm font-medium text-slate-300">No forms yet</p>
                    <p className="text-xs text-slate-500">Your dojo hasn't published any forms.</p>
                  </div>
                </GlassCard>
              )}
            </div>

            {/* ── 5. Replay Vault ── */}
            <GlassCard>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Replay Vault</span>
                </div>
                {stats?.total_sessions ? (
                  <div className="space-y-3">
                    {[
                      { label: "Most recent session", score: avgScore ?? 0, note: progress?.most_improved_posture ?? "—", correction: progress?.weakest_posture ?? "—" },
                    ].map((entry, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-300">
                            {entry.score}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-200">{entry.label}</div>
                            {entry.note !== "—" && <div className="text-[10px] text-green-400">✓ {entry.note}</div>}
                            {entry.correction !== "—" && <div className="text-[10px] text-amber-400">↑ {entry.correction}</div>}
                          </div>
                        </div>
                        <button className="text-xs text-slate-500 hover:text-white px-2 py-1 border border-slate-700 rounded-lg transition-colors">Watch</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    <p>No replays yet.</p>
                    <p className="text-xs mt-1">Complete your first session to unlock.</p>
                  </div>
                )}
              </div>
            </GlassCard>

          </div>

          {/* ── Right Column ── */}
          <div className="space-y-6">

            {/* ── 4. Fighter Stats ── */}
            <GlassCard>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Fighter Stats</span>
                </div>
                <div className="space-y-3">
                  {fighterStats.map(s => (
                    <StatBar key={s.label} label={s.label} value={s.value} color={s.color} icon={s.icon} />
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* ── 6. Sensei Notes ── */}
            <GlassCard>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-green-500 rounded-full" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Sensei Notes</span>
                </div>
                {progress ? (
                  <div className="space-y-3">
                    {progress.most_improved_posture && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                        <div className="text-[10px] text-green-400 font-semibold uppercase tracking-wider mb-1">Strength</div>
                        <p className="text-xs text-slate-200">{progress.most_improved_posture} is improving — keep it up.</p>
                      </div>
                    )}
                    {progress.weakest_posture && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                        <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider mb-1">Focus Area</div>
                        <p className="text-xs text-slate-200">Work on {progress.weakest_posture} this session.</p>
                      </div>
                    )}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                      <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mb-1">Suggested Drill</div>
                      <p className="text-xs text-slate-200 mb-2">Slow-motion run-through, 50% speed. Focus on breath.</p>
                      <Link href={firstForm ? `/training/${firstForm.id}` : "/dashboard"}>
                        <button className="text-[10px] px-2.5 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
                          Start Drill
                        </button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <p className="text-xs text-slate-400 text-center">Complete a session to unlock Sensei Notes.</p>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* ── 7. Instructor Studio (admin only) ── */}
            {isAdmin && (
              <GlassCard>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-red-500 rounded-full" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Instructor Studio</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Record Front", icon: "📹", href: "/admin" },
                      { label: "Record Side", icon: "🎥", href: "/admin" },
                      { label: "Manage", icon: "📋", href: "/admin" },
                      { label: "Review", icon: "👁️", href: "/admin" },
                    ].map(item => (
                      <Link key={item.label} href={item.href}>
                        <button className="w-full flex flex-col items-center gap-1 py-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition-colors">
                          <span className="text-lg">{item.icon}</span>
                          <span className="text-[10px] text-slate-300 font-medium">{item.label}</span>
                        </button>
                      </Link>
                    ))}
                  </div>
                </div>
              </GlassCard>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
