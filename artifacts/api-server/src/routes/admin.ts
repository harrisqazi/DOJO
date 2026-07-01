import { Router, type IRouter } from "express";
import { db, dojosTable, usersTable, sessionsTable, formsTable } from "@workspace/db";
import { eq, count, avg, desc, sql, gte } from "drizzle-orm";

const router: IRouter = Router();

router.get("/admin/stats", async (req, res): Promise<void> => {
  const [totalDojos] = await db.select({ count: count() }).from(dojosTable);
  const [activeDojos] = await db.select({ count: count() }).from(dojosTable).where(eq(dojosTable.subscription_status, "active"));
  const [trialingDojos] = await db.select({ count: count() }).from(dojosTable).where(eq(dojosTable.subscription_status, "trialing"));
  const [canceledDojos] = await db.select({ count: count() }).from(dojosTable).where(eq(dojosTable.subscription_status, "canceled"));
  const [totalStudents] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "student"));
  const [totalForms] = await db.select({ count: count() }).from(formsTable);
  const [avgScoreResult] = await db.select({ avg: avg(sessionsTable.total_score) }).from(sessionsTable);

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);

  const [todayCount] = await db.select({ count: count() }).from(sessionsTable).where(gte(sessionsTable.started_at, todayStart));
  const [weekCount] = await db.select({ count: count() }).from(sessionsTable).where(gte(sessionsTable.started_at, weekStart));
  const [allCount] = await db.select({ count: count() }).from(sessionsTable);

  res.json({
    total_dojos: Number(totalDojos?.count ?? 0),
    dojos_active: Number(activeDojos?.count ?? 0),
    dojos_trialing: Number(trialingDojos?.count ?? 0),
    dojos_canceled: Number(canceledDojos?.count ?? 0),
    total_students: Number(totalStudents?.count ?? 0),
    total_sessions_today: Number(todayCount?.count ?? 0),
    total_sessions_week: Number(weekCount?.count ?? 0),
    total_sessions_all: Number(allCount?.count ?? 0),
    total_forms: Number(totalForms?.count ?? 0),
    avg_score: avgScoreResult?.avg != null ? Number(avgScoreResult.avg) : null,
  });
});

router.get("/admin/activity", async (req, res): Promise<void> => {
  const activity = await db.select({
    session_id: sessionsTable.id,
    user_email: usersTable.email,
    form_name: formsTable.name,
    score: sessionsTable.total_score,
    started_at: sessionsTable.started_at,
  }).from(sessionsTable)
    .leftJoin(usersTable, eq(sessionsTable.user_id, usersTable.id))
    .leftJoin(formsTable, eq(sessionsTable.form_id, formsTable.id))
    .orderBy(desc(sessionsTable.started_at))
    .limit(20);

  res.json(activity.map(a => ({
    session_id: a.session_id,
    user_email: a.user_email ?? "unknown",
    form_name: a.form_name ?? "Unknown Form",
    score: a.score,
    started_at: a.started_at,
  })));
});

export default router;
