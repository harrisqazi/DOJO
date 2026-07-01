import { Router, type IRouter } from "express";
import { db, userCalibrationProfilesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const CreateCalibrationBody = z.object({
  discipline: z.string().optional(),
  body_scale: z.unknown(),
  limb_lengths: z.unknown(),
  handedness: z.string().optional(),
  baseline_mobility: z.unknown(),
  camera_framing: z.unknown(),
  visibility_baseline: z.unknown(),
});

router.post("/calibration", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const parsed = CreateCalibrationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [profile] = await db.insert(userCalibrationProfilesTable).values({
    user_id: userId,
    discipline: parsed.data.discipline,
    body_scale: parsed.data.body_scale as Record<string, unknown>,
    limb_lengths: parsed.data.limb_lengths as Record<string, unknown>,
    handedness: parsed.data.handedness,
    baseline_mobility: parsed.data.baseline_mobility as Record<string, unknown>,
    camera_framing: parsed.data.camera_framing as Record<string, unknown>,
    visibility_baseline: parsed.data.visibility_baseline as Record<string, unknown>,
  }).returning();

  res.status(201).json(profile);
});

router.get("/calibration/mine", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const [profile] = await db.select()
    .from(userCalibrationProfilesTable)
    .where(eq(userCalibrationProfilesTable.user_id, userId))
    .orderBy(desc(userCalibrationProfilesTable.created_at))
    .limit(1);

  res.json(profile ?? null);
});

router.delete("/calibration/:id", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const [profile] = await db.select({ user_id: userCalibrationProfilesTable.user_id })
    .from(userCalibrationProfilesTable)
    .where(eq(userCalibrationProfilesTable.id, req.params.id));

  if (!profile) { res.status(404).json({ error: "Not found" }); return; }
  if (profile.user_id !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(userCalibrationProfilesTable)
    .where(eq(userCalibrationProfilesTable.id, req.params.id));

  res.json({ success: true });
});

export default router;
