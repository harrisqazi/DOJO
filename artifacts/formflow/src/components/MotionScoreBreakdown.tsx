import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw, TrendingUp, AlertCircle } from "lucide-react";
import type { ComparisonResult, DisciplineType } from "../lib/motion/types";
import {
  formatFeedbackForDisplay,
  generateBodyPartSummary,
  getRankLabel,
  getScoreColor,
} from "../lib/motion/feedback";

interface Props {
  result: ComparisonResult;
  discipline: DisciplineType;
  onReplay?: () => void;
  onPracticeAgain?: () => void;
  onRequestCoachReview?: () => void;
}

function ScoreRing({ score, size = 80, label }: { score: number; size?: number; label: string }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#1f2937" strokeWidth={8} fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color}
            strokeWidth={8}
            fill="none"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-white">{score}</span>
        </div>
      </div>
      <span className="text-xs text-gray-400 text-center leading-tight">{label}</span>
    </div>
  );
}

function BarScore({ label, score }: { label: string; score: number }) {
  const color = getScoreColor(score);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="font-semibold" style={{ color }}>{score}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function MotionScoreBreakdown({
  result,
  discipline,
  onReplay,
  onPracticeAgain,
  onRequestCoachReview,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const display = formatFeedbackForDisplay(result, discipline);
  const bodyParts = generateBodyPartSummary(result);
  const rankLabel = getRankLabel(result.overallScore);

  return (
    <div className="bg-gray-950 text-white rounded-2xl overflow-hidden max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 p-6 text-center border-b border-gray-800">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-2">
          {discipline.replace(/_/g, " ")} · {rankLabel}
        </div>
        <div className="flex justify-center mb-3">
          <ScoreRing score={result.overallScore} size={100} label="Overall Score" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">{display.headline}</h2>
        <p className="text-sm text-gray-400">{display.narrative}</p>
        {result.confidence < 0.6 && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Tracking confidence was low — results may be approximate</span>
          </div>
        )}
      </div>

      <div className="p-6 grid grid-cols-3 gap-3 border-b border-gray-800">
        <ScoreRing score={result.upperBodyScore} size={70} label="Upper Body" />
        <ScoreRing score={result.lowerBodyScore} size={70} label="Lower Body" />
        <ScoreRing score={result.smoothnessScore} size={70} label="Smoothness" />
      </div>

      {display.goodPoints.length > 0 && (
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2.5">✓ What you did well</h3>
          <div className="space-y-1.5">
            {display.goodPoints.map((msg, i) => (
              <p key={i} className="text-sm text-gray-300 flex gap-2">
                <span className="text-green-400 mt-0.5 shrink-0">›</span>
                {msg}
              </p>
            ))}
          </div>
        </div>
      )}

      {display.improvements.length > 0 && (
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2.5">↑ Focus areas</h3>
          <div className="space-y-1.5">
            {display.improvements.map((msg, i) => (
              <p key={i} className="text-sm text-gray-300 flex gap-2">
                <span className="text-amber-400 mt-0.5 shrink-0">›</span>
                {msg}
              </p>
            ))}
          </div>
        </div>
      )}

      {display.confidenceNote && (
        <div className="px-4 py-3 bg-amber-500/5 border-b border-amber-500/20">
          <p className="text-xs text-amber-400/80 flex gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {display.confidenceNote}
          </p>
        </div>
      )}

      <div className="p-4 border-b border-gray-800">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center justify-between w-full text-sm text-gray-300 font-medium"
        >
          <span>Score breakdown</span>
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showDetails && (
          <div className="mt-3 space-y-2.5">
            {bodyParts.map(bp => (
              <BarScore key={bp.bodyPart} label={bp.bodyPart} score={bp.score} />
            ))}
            {result.phaseScores.length > 0 && (
              <div className="pt-2 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-2">Phase scores</p>
                {result.phaseScores.map(ps => (
                  <BarScore key={ps.phase} label={ps.phase.replace(/_/g, " ")} score={ps.score} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {result.worstMismatchMoments.length > 0 && (
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2.5">Top corrections</h3>
          <div className="space-y-2">
            {result.worstMismatchMoments.slice(0, 3).map((m, i) => (
              <div key={i} className="bg-gray-900 rounded-lg p-2.5">
                <p className="text-xs text-red-300 font-medium capitalize">{m.bodyPart}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.correctionCue}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {display.drills.length > 0 && (
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2.5">Suggested drills</h3>
          <div className="space-y-1.5">
            {display.drills.map((d, i) => (
              <p key={i} className="text-xs text-gray-400 flex gap-2">
                <span className="text-blue-400 shrink-0">{i + 1}.</span>
                {d}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 flex flex-wrap gap-2">
        {onPracticeAgain && (
          <button
            onClick={onPracticeAgain}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
        )}
        {onReplay && (
          <button
            onClick={onReplay}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            Watch replay
          </button>
        )}
        {onRequestCoachReview && (
          <button
            onClick={onRequestCoachReview}
            className="px-4 py-2 bg-gray-800 border border-gray-600 hover:border-gray-400 rounded-xl text-sm text-gray-300 transition-colors"
          >
            Request coach review
          </button>
        )}
      </div>
    </div>
  );
}
