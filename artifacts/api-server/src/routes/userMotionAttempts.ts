import { Router, type IRouter } from "express";
import { db, userMotionAttemptsTable, trainingRecordingGroupsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const CreateAttemptBody = z.object({
  training_recording_group_id: z.string().uuid(),
  training_recording_id: z.string().uuid(),
  view_angle: z.enum(["front", "side"]),
  discipline: z.string().min(1),
  motion_data: z.unknown(),
  comparison_result: z.unknown(),
  duration_ms: z.number().int().positive(),
  fps: z.number().int().positive(),
  overall_score: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
});

router.post("/user-motion-attempts", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const parsed = CreateAttemptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [attempt] = await db.insert(userMotionAttemptsTable).values({
    user_id: userId,
    training_recording_group_id: parsed.data.training_recording_group_id,
    training_recording_id: parsed.data.training_recording_id,
    view_angle: parsed.data.view_angle,
    discipline: parsed.data.discipline,
    motion_data: parsed.data.motion_data as Record<string, unknown>,
    comparison_result: parsed.data.comparison_result as Record<string, unknown>,
    duration_ms: parsed.data.duration_ms,
    fps: parsed.data.fps,
    overall_score: parsed.data.overall_score,
    confidence: String(parsed.data.confidence),
  }).returning();

  res.status(201).json(attempt);
});

router.get("/user-motion-attempts/mine", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const attempts = await db.select({
    id: userMotionAttemptsTable.id,
    training_recording_group_id: userMotionAttemptsTable.training_recording_group_id,
    training_recording_id: userMotionAttemptsTable.training_recording_id,
    view_angle: userMotionAttemptsTable.view_angle,
    discipline: userMotionAttemptsTable.discipline,
    overall_score: userMotionAttemptsTable.overall_score,
    confidence: userMotionAttemptsTable.confidence,
    duration_ms: userMotionAttemptsTable.duration_ms,
    created_at: userMotionAttemptsTable.created_at,
  })
    .from(userMotionAttemptsTable)
    .where(eq(userMotionAttemptsTable.user_id, userId))
    .orderBy(desc(userMotionAttemptsTable.created_at))
    .limit(20);

  res.json(attempts);
});

router.get("/user-motion-attempts", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const groupId = req.query.trainingRecordingGroupId as string | undefined;
  const conditions = [eq(userMotionAttemptsTable.user_id, userId)];
  if (groupId) conditions.push(eq(userMotionAttemptsTable.training_recording_group_id, groupId));

  const attempts = await db.select()
    .from(userMotionAttemptsTable)
    .where(and(...conditions))
    .orderBy(desc(userMotionAttemptsTable.created_at))
    .limit(10);

  res.json(attempts);
});

router.get("/user-motion-attempts/:id", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const [attempt] = await db.select()
    .from(userMotionAttemptsTable)
    .where(eq(userMotionAttemptsTable.id, req.params.id));

  if (!attempt) { res.status(404).json({ error: "Not found" }); return; }
  if (attempt.user_id !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  res.json(attempt);
});

export default router;
