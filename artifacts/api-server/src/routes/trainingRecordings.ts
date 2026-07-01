import { Router, type IRouter } from "express";
import { db, trainingRecordingsTable, trainingRecordingGroupsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

async function getUserRole(userId: string): Promise<string | null> {
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.role ?? null;
}

const CreateRecordingBody = z.object({
  training_recording_group_id: z.string().uuid().optional(),
  form_id: z.string().uuid().optional(),
  posture_id: z.string().uuid().optional(),
  dojo_id: z.string().uuid().optional(),
  title: z.string().min(1),
  discipline: z.string().min(1),
  movement_name: z.string().optional(),
  view_angle: z.enum(["front", "side"]),
  description: z.string().optional(),
  instructions: z.string().optional(),
  breathing_cues: z.unknown().optional(),
  video_url: z.string().optional(),
  video_storage_key: z.string().optional(),
  motion_data: z.unknown(),
  motion_fingerprint: z.unknown(),
  duration_ms: z.number().int().positive(),
  fps: z.number().int().positive(),
  frame_count: z.number().int().positive(),
  consent_confirmed: z.boolean().default(false),
  privacy_mode: z.enum(["private", "dojo_only", "published"]).default("private"),
});

const UpdateRecordingBody = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  breathing_cues: z.unknown().optional(),
  video_url: z.string().optional(),
  is_published: z.boolean().optional(),
  privacy_mode: z.enum(["private", "dojo_only", "published"]).optional(),
});

router.get("/training-recordings/:id", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const [recording] = await db.select().from(trainingRecordingsTable)
    .where(eq(trainingRecordingsTable.id, req.params.id));

  if (!recording) { res.status(404).json({ error: "Not found" }); return; }

  const role = await getUserRole(userId);
  const isAdmin = role === "platform_admin" || role === "dojo_admin";
  if (!recording.is_published && !isAdmin && recording.instructor_user_id !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  res.json(recording);
});

router.post("/training-recordings", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  const role = await getUserRole(userId);
  if (role !== "platform_admin" && role !== "dojo_admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = CreateRecordingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { training_recording_group_id, ...recordingData } = parsed.data;

  const [recording] = await db.insert(trainingRecordingsTable).values({
    ...recordingData,
    instructor_user_id: userId,
    motion_data: recordingData.motion_data as Record<string, unknown>,
    motion_fingerprint: recordingData.motion_fingerprint as Record<string, unknown>,
    breathing_cues: recordingData.breathing_cues as Record<string, unknown> ?? null,
  }).returning();

  if (training_recording_group_id && recording) {
    const field = parsed.data.view_angle === "front" ? "front_recording_id" : "side_recording_id";
    await db.update(trainingRecordingGroupsTable)
      .set({ [field]: recording.id, updated_at: new Date() })
      .where(eq(trainingRecordingGroupsTable.id, training_recording_group_id));
  }

  res.status(201).json(recording);
});

router.patch("/training-recordings/:id", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  const role = await getUserRole(userId);
  if (role !== "platform_admin" && role !== "dojo_admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = UpdateRecordingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db.update(trainingRecordingsTable)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(trainingRecordingsTable.id, req.params.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/training-recordings/:id", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  const role = await getUserRole(userId);
  if (role !== "platform_admin" && role !== "dojo_admin") { res.status(403).json({ error: "Forbidden" }); return; }

  await db.update(trainingRecordingsTable)
    .set({ is_published: false, updated_at: new Date() })
    .where(eq(trainingRecordingsTable.id, req.params.id));

  res.json({ success: true });
});

router.post("/training-recordings/:id/publish", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  const role = await getUserRole(userId);
  if (role !== "platform_admin" && role !== "dojo_admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const [recording] = await db.select().from(trainingRecordingsTable)
    .where(eq(trainingRecordingsTable.id, req.params.id));
  if (!recording) { res.status(404).json({ error: "Not found" }); return; }
  if (!recording.consent_confirmed) { res.status(400).json({ error: "Consent must be confirmed before publishing" }); return; }

  const [updated] = await db.update(trainingRecordingsTable)
    .set({ is_published: true, privacy_mode: "published", updated_at: new Date() })
    .where(eq(trainingRecordingsTable.id, req.params.id))
    .returning();

  res.json(updated);
});

export default router;
