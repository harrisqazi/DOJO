import { Router, type IRouter } from "express";
import { db, coachReviewsTable, userMotionAttemptsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

async function getUserRole(userId: string): Promise<string | null> {
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.role ?? null;
}

const CreateReviewBody = z.object({
  user_motion_attempt_id: z.string().uuid(),
  coach_notes: z.string().optional(),
  annotations: z.unknown().optional(),
  assigned_drills: z.unknown().optional(),
  approval_status: z.enum(["not_reviewed", "approved", "needs_work"]).default("not_reviewed"),
});

const UpdateReviewBody = z.object({
  coach_notes: z.string().optional(),
  annotations: z.unknown().optional(),
  assigned_drills: z.unknown().optional(),
  approval_status: z.enum(["not_reviewed", "approved", "needs_work"]).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
});

router.post("/coach-reviews", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const role = await getUserRole(userId);
  if (role !== "platform_admin" && role !== "dojo_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [attempt] = await db.select({ id: userMotionAttemptsTable.id })
    .from(userMotionAttemptsTable)
    .where(eq(userMotionAttemptsTable.id, parsed.data.user_motion_attempt_id));
  if (!attempt) { res.status(404).json({ error: "Attempt not found" }); return; }

  const [review] = await db.insert(coachReviewsTable).values({
    user_motion_attempt_id: parsed.data.user_motion_attempt_id,
    coach_user_id: userId,
    coach_notes: parsed.data.coach_notes,
    annotations: parsed.data.annotations as Record<string, unknown> ?? null,
    assigned_drills: parsed.data.assigned_drills as Record<string, unknown> ?? null,
    approval_status: parsed.data.approval_status,
    status: "in_progress",
  }).returning();

  res.status(201).json(review);
});

router.get("/coach-reviews/:id", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const [review] = await db.select().from(coachReviewsTable)
    .where(eq(coachReviewsTable.id, req.params.id));

  if (!review) { res.status(404).json({ error: "Not found" }); return; }

  const [attempt] = await db.select({ user_id: userMotionAttemptsTable.user_id })
    .from(userMotionAttemptsTable)
    .where(eq(userMotionAttemptsTable.id, review.user_motion_attempt_id));

  const role = await getUserRole(userId);
  const isAdmin = role === "platform_admin" || role === "dojo_admin";
  if (!isAdmin && attempt?.user_id !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  res.json(review);
});

router.get("/coach-reviews", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const attemptId = req.query.attemptId as string | undefined;
  if (!attemptId) { res.status(400).json({ error: "attemptId required" }); return; }

  const [attempt] = await db.select({ user_id: userMotionAttemptsTable.user_id })
    .from(userMotionAttemptsTable)
    .where(eq(userMotionAttemptsTable.id, attemptId));

  const role = await getUserRole(userId);
  const isAdmin = role === "platform_admin" || role === "dojo_admin";
  if (!isAdmin && attempt?.user_id !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const reviews = await db.select()
    .from(coachReviewsTable)
    .where(eq(coachReviewsTable.user_motion_attempt_id, attemptId))
    .orderBy(desc(coachReviewsTable.created_at));

  res.json(reviews);
});

router.patch("/coach-reviews/:id", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const role = await getUserRole(userId);
  if (role !== "platform_admin" && role !== "dojo_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = UpdateReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { updated_at: new Date() };
  if (parsed.data.coach_notes != null) updateData.coach_notes = parsed.data.coach_notes;
  if (parsed.data.annotations != null) updateData.annotations = parsed.data.annotations;
  if (parsed.data.assigned_drills != null) updateData.assigned_drills = parsed.data.assigned_drills;
  if (parsed.data.approval_status != null) updateData.approval_status = parsed.data.approval_status;
  if (parsed.data.status != null) updateData.status = parsed.data.status;

  const [updated] = await db.update(coachReviewsTable)
    .set(updateData)
    .where(and(eq(coachReviewsTable.id, req.params.id), eq(coachReviewsTable.coach_user_id, userId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
