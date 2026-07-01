import { Router, type IRouter } from "express";
import { db, dojosTable, usersTable, formsTable, sessionsTable } from "@workspace/db";
import { eq, count, avg, sql } from "drizzle-orm";
import {
  CreateDojoBody,
  UpdateDojoBody,
  UpdateDojoParams,
  DeleteDojoParams,
  GetDojoParams,
  GetDojoBySlugParams,
  GetDojoStatsParams,
  GetDojoStudentsParams,
  RegenerateInviteCodeParams,
  LeaveDojoParams,
  RemoveStudentFromDojoParams,
  JoinDojoByInviteBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dojos", async (req, res): Promise<void> => {
  const dojos = await db.select().from(dojosTable).orderBy(dojosTable.created_at);
  res.json(dojos);
});

router.post("/dojos", async (req, res): Promise<void> => {
  const parsed = CreateDojoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const inviteCode = Math.random().toString(36).substring(2, 10);
  const [dojo] = await db.insert(dojosTable).values({
    ...parsed.data,
    invite_code: inviteCode,
  }).returning();

  res.status(201).json(dojo);
});

router.get("/dojos/by-slug/:slug", async (req, res): Promise<void> => {
  const params = GetDojoBySlugParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [dojo] = await db.select().from(dojosTable).where(eq(dojosTable.slug, params.data.slug));
  if (!dojo) { res.status(404).json({ error: "Dojo not found" }); return; }

  const [studentCountResult] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.dojo_id, dojo.id));
  const [formCountResult] = await db.select({ count: count() }).from(formsTable).where(
    eq(formsTable.discipline_id,
      sql`ANY(SELECT id FROM disciplines WHERE dojo_id = ${dojo.id})`)
  ).catch(() => [{ count: 0 }]);

  res.json({
    id: dojo.id,
    slug: dojo.slug,
    name: dojo.name,
    logo_url: dojo.logo_url,
    accent_color: dojo.accent_color,
    student_count: studentCountResult?.count ?? 0,
    form_count: formCountResult?.count ?? 0,
  });
});

router.post("/dojos/join", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const parsed = JoinDojoByInviteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [dojo] = await db.select().from(dojosTable).where(eq(dojosTable.invite_code, parsed.data.invite_code));
  if (!dojo) { res.status(404).json({ error: "Invalid invite code" }); return; }

  await db.update(usersTable).set({ dojo_id: dojo.id }).where(eq(usersTable.id, userId));
  res.json(dojo);
});

router.get("/dojos/:dojoId", async (req, res): Promise<void> => {
  const params = GetDojoParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [dojo] = await db.select().from(dojosTable).where(eq(dojosTable.id, params.data.dojoId));
  if (!dojo) { res.status(404).json({ error: "Dojo not found" }); return; }
  res.json(dojo);
});

router.patch("/dojos/:dojoId", async (req, res): Promise<void> => {
  const params = UpdateDojoParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateDojoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [dojo] = await db.update(dojosTable)
    .set(parsed.data)
    .where(eq(dojosTable.id, params.data.dojoId))
    .returning();

  if (!dojo) { res.status(404).json({ error: "Dojo not found" }); return; }
  res.json(dojo);
});

router.delete("/dojos/:dojoId", async (req, res): Promise<void> => {
  const params = DeleteDojoParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(dojosTable).where(eq(dojosTable.id, params.data.dojoId));
  res.sendStatus(204);
});

router.get("/dojos/:dojoId/stats", async (req, res): Promise<void> => {
  const params = GetDojoStatsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const dojoId = params.data.dojoId;
  const [studentCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.dojo_id, dojoId));
  const students = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.dojo_id, dojoId));
  const studentIds = students.map(s => s.id);

  let sessionCount = 0;
  let avgScore: number | null = null;

  if (studentIds.length > 0) {
    const sessionRows = await db.select({ count: count(), avg: avg(sessionsTable.total_score) })
      .from(sessionsTable)
      .where(sql`${sessionsTable.user_id} = ANY(${sql`ARRAY[${sql.join(studentIds.map(id => sql`${id}::uuid`), sql`, `)}]`})`);
    sessionCount = Number(sessionRows[0]?.count ?? 0);
    avgScore = sessionRows[0]?.avg != null ? Number(sessionRows[0].avg) : null;
  }

  const formCount = await db.select({ count: count() }).from(
    db.select().from(formsTable).as("f")
  ).catch(() => [{ count: 0 }]);

  res.json({
    student_count: Number(studentCount?.count ?? 0),
    session_count: sessionCount,
    avg_score: avgScore,
    form_count: 0,
  });
});

router.get("/dojos/:dojoId/students", async (req, res): Promise<void> => {
  const params = GetDojoStudentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const students = await db.select().from(usersTable).where(eq(usersTable.dojo_id, params.data.dojoId));
  res.json(students.map(s => ({
    id: s.id,
    email: s.email,
    name: s.name,
    sessions_count: 0,
    avg_score: null,
    last_active: null,
  })));
});

router.post("/dojos/:dojoId/invite", async (req, res): Promise<void> => {
  const params = RegenerateInviteCodeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const newCode = Math.random().toString(36).substring(2, 10);
  await db.update(dojosTable).set({ invite_code: newCode }).where(eq(dojosTable.id, params.data.dojoId));
  res.json({ invite_code: newCode });
});

router.post("/dojos/:dojoId/leave", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const params = LeaveDojoParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.update(usersTable).set({ dojo_id: null }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

router.delete("/dojos/:dojoId/remove-student/:userId", async (req, res): Promise<void> => {
  const params = RemoveStudentFromDojoParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.update(usersTable).set({ dojo_id: null }).where(eq(usersTable.id, params.data.userId));
  res.sendStatus(204);
});

export default router;
