import { Router, type IRouter } from "express";
import { db, trainingRecordingGroupsTable, trainingRecordingsTable, usersTable } from "@workspace/db";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

async function getUserRole(userId: string): Promise<string | null> {
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.role ?? null;
}

const CreateGroupBody = z.object({
  title: z.string().min(1),
  discipline: z.string().min(1),
  difficulty: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  form_id: z.string().uuid().optional(),
  posture_id: z.string().uuid().optional(),
  dojo_id: z.string().uuid().optional(),
  default_view_angle: z.enum(["front", "side"]).default("front"),
});

const UpdateGroupBody = z.object({
  title: z.string().optional(),
  discipline: z.string().optional(),
  difficulty: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  front_recording_id: z.string().uuid().optional().nullable(),
  side_recording_id: z.string().uuid().optional().nullable(),
  default_view_angle: z.enum(["front", "side"]).optional(),
  is_published: z.boolean().optional(),
});

router.get("/training-recording-groups", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const role = await getUserRole(userId);
  const isAdmin = role === "platform_admin" || role === "dojo_admin";

  const rows = await db
    .select({
      id: trainingRecordingGroupsTable.id,
      title: trainingRecordingGroupsTable.title,
      discipline: trainingRecordingGroupsTable.discipline,
      difficulty: trainingRecordingGroupsTable.difficulty,
      instructor_user_id: trainingRecordingGroupsTable.instructor_user_id,
      front_recording_id: trainingRecordingGroupsTable.front_recording_id,
      side_recording_id: trainingRecordingGroupsTable.side_recording_id,
      default_view_angle: trainingRecordingGroupsTable.default_view_angle,
      description: trainingRecordingGroupsTable.description,
      instructions: trainingRecordingGroupsTable.instructions,
      is_published: trainingRecordingGroupsTable.is_published,
      created_at: trainingRecordingGroupsTable.created_at,
      updated_at: trainingRecordingGroupsTable.updated_at,
    })
    .from(trainingRecordingGroupsTable)
    .where(isAdmin ? undefined : eq(trainingRecordingGroupsTable.is_published, true))
    .orderBy(desc(trainingRecordingGroupsTable.created_at));

  const withViewInfo = rows.map(r => ({
    ...r,
    hasFrontView: r.front_recording_id != null,
    hasSideView: r.side_recording_id != null,
  }));

  res.json(withViewInfo);
});

router.get("/training-recording-groups/:id", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  const { id } = req.params;

  const [group] = await db.select().from(trainingRecordingGroupsTable)
    .where(eq(trainingRecordingGroupsTable.id, id));

  if (!group) { res.status(404).json({ error: "Not found" }); return; }

  const role = await getUserRole(userId);
  const isAdmin = role === "platform_admin" || role === "dojo_admin";
  if (!group.is_published && !isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  const frontRec = group.front_recording_id
    ? await db.select({ id: trainingRecordingsTable.id, title: trainingRecordingsTable.title, view_angle: trainingRecordingsTable.view_angle, duration_ms: trainingRecordingsTable.duration_ms, is_published: trainingRecordingsTable.is_published })
        .from(trainingRecordingsTable)
        .where(eq(trainingRecordingsTable.id, group.front_recording_id))
        .then(r => r[0])
    : null;

  const sideRec = group.side_recording_id
    ? await db.select({ id: trainingRecordingsTable.id, title: trainingRecordingsTable.title, view_angle: trainingRecordingsTable.view_angle, duration_ms: trainingRecordingsTable.duration_ms, is_published: trainingRecordingsTable.is_published })
        .from(trainingRecordingsTable)
        .where(eq(trainingRecordingsTable.id, group.side_recording_id))
        .then(r => r[0])
    : null;

  res.json({
    ...group,
    hasFrontView: group.front_recording_id != null,
    hasSideView: group.side_recording_id != null,
    frontRecording: frontRec,
    sideRecording: sideRec,
  });
});

router.post("/training-recording-groups", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  const role = await getUserRole(userId);
  if (role !== "platform_admin" && role !== "dojo_admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [group] = await db.insert(trainingRecordingGroupsTable).values({
    ...parsed.data,
    instructor_user_id: userId,
  }).returning();

  res.status(201).json({ ...group, hasFrontView: false, hasSideView: false });
});

router.patch("/training-recording-groups/:id", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  const role = await getUserRole(userId);
  if (role !== "platform_admin" && role !== "dojo_admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = UpdateGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db.update(trainingRecordingGroupsTable)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(trainingRecordingGroupsTable.id, req.params.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...updated, hasFrontView: updated.front_recording_id != null, hasSideView: updated.side_recording_id != null });
});

router.delete("/training-recording-groups/:id", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  const role = await getUserRole(userId);
  if (role !== "platform_admin" && role !== "dojo_admin") { res.status(403).json({ error: "Forbidden" }); return; }

  await db.update(trainingRecordingGroupsTable)
    .set({ is_published: false, updated_at: new Date() })
    .where(eq(trainingRecordingGroupsTable.id, req.params.id));

  res.json({ success: true });
});

export default router;
