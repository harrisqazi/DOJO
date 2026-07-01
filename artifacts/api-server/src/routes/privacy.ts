import { Router, type IRouter } from "express";
import { db, privacyConsentsTable, userMotionAttemptsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const ConsentBody = z.object({
  consent_type: z.string().min(1),
  accepted: z.boolean(),
  details: z.unknown().optional(),
});

router.post("/privacy/consent", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const parsed = ConsentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [consent] = await db.insert(privacyConsentsTable).values({
    user_id: userId,
    consent_type: parsed.data.consent_type,
    accepted: parsed.data.accepted,
    accepted_at: parsed.data.accepted ? new Date() : null,
    revoked_at: !parsed.data.accepted ? new Date() : null,
    details: parsed.data.details as Record<string, unknown> ?? null,
  }).returning();

  res.status(201).json(consent);
});

router.get("/privacy/consent", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const consents = await db.select()
    .from(privacyConsentsTable)
    .where(eq(privacyConsentsTable.user_id, userId))
    .orderBy(desc(privacyConsentsTable.accepted_at));

  res.json(consents);
});

router.post("/privacy/export", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const attempts = await db.select({
    id: userMotionAttemptsTable.id,
    training_recording_group_id: userMotionAttemptsTable.training_recording_group_id,
    discipline: userMotionAttemptsTable.discipline,
    overall_score: userMotionAttemptsTable.overall_score,
    duration_ms: userMotionAttemptsTable.duration_ms,
    created_at: userMotionAttemptsTable.created_at,
  }).from(userMotionAttemptsTable)
    .where(eq(userMotionAttemptsTable.user_id, userId))
    .orderBy(desc(userMotionAttemptsTable.created_at));

  const consents = await db.select()
    .from(privacyConsentsTable)
    .where(eq(privacyConsentsTable.user_id, userId));

  res.json({
    userId,
    exportedAt: new Date().toISOString(),
    motionAttempts: attempts,
    privacyConsents: consents,
    note: "Motion landmark data excluded from export for storage efficiency. Contact support for full data export.",
  });
});

router.post("/privacy/delete-motion-data", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const attempts = await db.select({ id: userMotionAttemptsTable.id })
    .from(userMotionAttemptsTable)
    .where(eq(userMotionAttemptsTable.user_id, userId));

  for (const attempt of attempts) {
    await db.update(userMotionAttemptsTable)
      .set({ motion_data: {}, comparison_result: {} })
      .where(eq(userMotionAttemptsTable.id, attempt.id));
  }

  res.json({ success: true, deletedCount: attempts.length });
});

export default router;
