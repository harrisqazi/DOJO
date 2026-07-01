import { Router, type IRouter } from "express";
import { db, sessionsTable, postureScoresTable, formsTable, posturesTable, usersTable } from "@workspace/db";
import { eq, avg, count, desc, sql } from "drizzle-orm";
import {
  CreateSessionBody,
  GetSessionParams,
  CompleteSessionParams,
  CompleteSessionBody,
  SavePostureScoreParams,
  SavePostureScoreBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const sessions = await db.select({
    id: sessionsTable.id,
    user_id: sessionsTable.user_id,
    form_id: sessionsTable.form_id,
    form_name: formsTable.name,
    total_score: sessionsTable.total_score,
    postures_completed: sessionsTable.postures_completed,
    started_at: sessionsTable.started_at,
    completed_at: sessionsTable.completed_at,
  }).from(sessionsTable)
    .leftJoin(formsTable, eq(sessionsTable.form_id, formsTable.id))
    .where(eq(sessionsTable.user_id, userId))
    .orderBy(desc(sessionsTable.started_at));

  res.json(sessions);
});

router.post("/sessions", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [session] = await db.insert(sessionsTable).values({
    user_id: userId,
    form_id: parsed.data.form_id,
  }).returning();

  res.status(201).json({ ...session, form_name: null });
});

router.get("/sessions/:sessionId", async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [session] = await db.select({
    id: sessionsTable.id,
    user_id: sessionsTable.user_id,
    form_id: sessionsTable.form_id,
    form_name: formsTable.name,
    total_score: sessionsTable.total_score,
    postures_completed: sessionsTable.postures_completed,
    started_at: sessionsTable.started_at,
    completed_at: sessionsTable.completed_at,
  }).from(sessionsTable)
    .leftJoin(formsTable, eq(sessionsTable.form_id, formsTable.id))
    .where(eq(sessionsTable.id, params.data.sessionId));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const scores = await db.select({
    id: postureScoresTable.id,
    session_id: postureScoresTable.session_id,
    posture_id: postureScoresTable.posture_id,
    posture_name: posturesTable.name,
    score: postureScoresTable.score,
    joint_angles_json: postureScoresTable.joint_angles_json,
    feedback_given: postureScoresTable.feedback_given,
    captured_at: postureScoresTable.captured_at,
  }).from(postureScoresTable)
    .leftJoin(posturesTable, eq(postureScoresTable.posture_id, posturesTable.id))
    .where(eq(postureScoresTable.session_id, params.data.sessionId));

  res.json({ ...session, scores });
});

router.patch("/sessions/:sessionId", async (req, res): Promise<void> => {
  const params = CompleteSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = CompleteSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.total_score != null) updateData.total_score = parsed.data.total_score;
  if (parsed.data.postures_completed != null) updateData.postures_completed = parsed.data.postures_completed;
  if (parsed.data.completed_at != null) updateData.completed_at = new Date(parsed.data.completed_at);

  const [session] = await db.update(sessionsTable)
    .set(updateData)
    .where(eq(sessionsTable.id, params.data.sessionId))
    .returning();

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json({ ...session, form_name: null });
});

router.post("/sessions/:sessionId/scores", async (req, res): Promise<void> => {
  const params = SavePostureScoreParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = SavePostureScoreBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [score] = await db.insert(postureScoresTable).values({
    session_id: params.data.sessionId,
    posture_id: parsed.data.posture_id,
    score: parsed.data.score,
    joint_angles_json: parsed.data.joint_angles_json ?? null,
    feedback_given: parsed.data.feedback_given ?? [],
  }).returning();

  res.status(201).json({ ...score, posture_name: null });
});

// Dashboard stats
router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const sessions = await db.select({
    started_at: sessionsTable.started_at,
    total_score: sessionsTable.total_score,
  }).from(sessionsTable)
    .where(eq(sessionsTable.user_id, userId))
    .orderBy(desc(sessionsTable.started_at));

  const total_sessions = sessions.length;
  const scores = sessions.filter(s => s.total_score != null).map(s => s.total_score as number);
  const avg_score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  // Calculate streak
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionDays = new Set(sessions.map(s => {
    const d = new Date(s.started_at);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }));

  for (let i = 0; i < 365; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    if (sessionDays.has(day.getTime())) streak++;
    else if (i > 0) break;
  }

  res.json({ streak, total_sessions, avg_score });
});

// Progress data
router.get("/dashboard/progress", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const recentSessions = await db.select({
    id: sessionsTable.id,
    form_id: sessionsTable.form_id,
    form_name: formsTable.name,
    total_score: sessionsTable.total_score,
    started_at: sessionsTable.started_at,
  }).from(sessionsTable)
    .leftJoin(formsTable, eq(sessionsTable.form_id, formsTable.id))
    .where(eq(sessionsTable.user_id, userId))
    .orderBy(desc(sessionsTable.started_at))
    .limit(10);

  // Build sparklines per form
  const sparklineMap: Record<string, { form_id: string; form_name: string; scores: number[] }> = {};
  for (const s of recentSessions) {
    if (!s.form_id) continue;
    if (!sparklineMap[s.form_id]) {
      sparklineMap[s.form_id] = { form_id: s.form_id, form_name: s.form_name ?? "Unknown", scores: [] };
    }
    if (s.total_score != null) sparklineMap[s.form_id].scores.push(s.total_score);
  }

  // Get posture scores for most improved / weakest
  const postureAggs = await db.select({
    posture_id: postureScoresTable.posture_id,
    posture_name: posturesTable.name,
    avg_score: avg(postureScoresTable.score),
  }).from(postureScoresTable)
    .leftJoin(sessionsTable, eq(postureScoresTable.session_id, sessionsTable.id))
    .leftJoin(posturesTable, eq(postureScoresTable.posture_id, posturesTable.id))
    .where(eq(sessionsTable.user_id, userId))
    .groupBy(postureScoresTable.posture_id, posturesTable.name);

  const sorted = postureAggs
    .filter(p => p.avg_score != null)
    .sort((a, b) => Number(a.avg_score) - Number(b.avg_score));

  res.json({
    most_improved_posture: sorted.length > 0 ? sorted[sorted.length - 1].posture_name : null,
    weakest_posture: sorted.length > 0 ? sorted[0].posture_name : null,
    sparklines: Object.values(sparklineMap),
  });
});

export default router;
