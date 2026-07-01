import { useState, useCallback } from "react";
import { CheckCircle, XCircle, MessageSquare, Star, AlertTriangle } from "lucide-react";
import type { ComparisonResult, DisciplineType } from "../lib/motion/types";
import { generateBodyPartSummary } from "../lib/motion/feedback";
import ComparisonReplay from "./ComparisonReplay";

interface Props {
  attemptId: string;
  result: ComparisonResult;
  discipline: DisciplineType;
  studentName?: string;
  submittedAt?: string;
  onSubmitReview: (review: {
    coach_notes: string;
    approval_status: "approved" | "needs_work" | "not_reviewed";
    assigned_drills: string[];
    annotations: Record<string, string>;
  }) => Promise<void>;
}

export default function CoachReviewPanel({
  attemptId,
  result,
  discipline,
  studentName,
  submittedAt,
  onSubmitReview,
}: Props) {
  const [coachNotes, setCoachNotes] = useState("");
  const [approval, setApproval] = useState<"approved" | "needs_work" | "not_reviewed">("not_reviewed");
  const [drills, setDrills] = useState<string[]>([...result.recommendedDrills]);
  const [newDrill, setNewDrill] = useState("");
  const [annotations, setAnnotations] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const bodyParts = generateBodyPartSummary(result);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await onSubmitReview({ coach_notes: coachNotes, approval_status: approval, assigned_drills: drills, annotations });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }, [coachNotes, approval, drills, annotations, onSubmitReview]);

  const addDrill = () => {
    if (newDrill.trim()) { setDrills(d => [...d, newDrill.trim()]); setNewDrill(""); }
  };

  if (submitted) {
    return (
      <div className="bg-gray-950 rounded-2xl border border-gray-800 p-8 text-center space-y-3">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
        <p className="text-white font-semibold">Review submitted</p>
        <p className="text-sm text-gray-400">The student will see your feedback.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">Coach Review</span>
          </div>
          {studentName && <span className="text-xs text-gray-500">{studentName}</span>}
          {submittedAt && <span className="text-xs text-gray-600 ml-2">{new Date(submittedAt).toLocaleDateString()}</span>}
        </div>
      </div>

      <div className="p-4 border-b border-gray-800">
        <ComparisonReplay result={result} discipline={discipline} width={600} height={338} />
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Score overview</p>
          <div className="grid grid-cols-2 gap-2">
            {bodyParts.map(bp => (
              <div key={bp.bodyPart} className="bg-gray-900 rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-xs text-gray-400">{bp.bodyPart}</span>
                <span className={`text-xs font-bold ${bp.score >= 75 ? "text-green-400" : bp.score >= 50 ? "text-amber-400" : "text-red-400"}`}>{bp.score}</span>
              </div>
            ))}
          </div>
        </div>

        {result.worstMismatchMoments.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Detected issues</p>
            <div className="space-y-2">
              {result.worstMismatchMoments.map((m, i) => (
                <div key={i} className="bg-red-500/10 rounded-lg p-2.5 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-red-300 font-medium capitalize">{m.bodyPart}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.correctionCue}</p>
                    <input
                      value={annotations[m.bodyPart] ?? ""}
                      onChange={e => setAnnotations(prev => ({ ...prev, [m.bodyPart]: e.target.value }))}
                      placeholder="Add your coach note…"
                      className="mt-1.5 w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Coach notes</p>
          <textarea
            value={coachNotes}
            onChange={e => setCoachNotes(e.target.value)}
            placeholder="Write personalized feedback for the student…"
            rows={4}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Assigned drills</p>
          <div className="space-y-1.5 mb-2">
            {drills.map((d, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-900 rounded-lg px-2.5 py-1.5">
                <span className="text-xs text-gray-300 flex-1">{d}</span>
                <button onClick={() => setDrills(ds => ds.filter((_, j) => j !== i))} className="text-gray-600 hover:text-red-400"><XCircle className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newDrill}
              onChange={e => setNewDrill(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addDrill(); }}
              placeholder="Add drill instruction…"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
            <button onClick={addDrill} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-white transition-colors">Add</button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Approval status</p>
          <div className="flex gap-2">
            {(["approved", "needs_work", "not_reviewed"] as const).map(s => (
              <button
                key={s}
                onClick={() => setApproval(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  approval === s
                    ? s === "approved" ? "bg-green-500/20 border-green-500/50 text-green-300"
                      : s === "needs_work" ? "bg-red-500/20 border-red-500/50 text-red-300"
                      : "bg-gray-700 border-gray-500 text-white"
                    : "bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500"
                }`}
              >
                {s === "approved" && <CheckCircle className="w-3 h-3" />}
                {s === "needs_work" && <XCircle className="w-3 h-3" />}
                {s === "not_reviewed" && <MessageSquare className="w-3 h-3" />}
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl text-sm font-medium text-white transition-colors"
        >
          {submitting ? "Submitting…" : "Submit Review"}
        </button>
      </div>
    </div>
  );
}
