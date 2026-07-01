import { Router, type IRouter } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq, count, avg } from "drizzle-orm";
import {
  UpdateProfileBody,
  UpdateUserBody,
  UpdateUserParams,
  GetUserSessionsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.patch("/users/profile", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.get("/users", async (req, res): Promise<void> => {
  const role = req.query.role as string | undefined;
  const dojo_id = req.query.dojo_id as string | undefined;

  let query = db.select().from(usersTable).$dynamic();
  if (role) query = query.where(eq(usersTable.role, role));
  if (dojo_id) query = query.where(eq(usersTable.dojo_id, dojo_id));

  const users = await query;
  res.json(users);
});

router.patch("/users/:userId", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, params.data.userId))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.get("/users/:userId/sessions", async (req, res): Promise<void> => {
  const params = GetUserSessionsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const sessions = await db.select().from(sessionsTable)
    .where(eq(sessionsTable.user_id, params.data.userId))
    .orderBy(sessionsTable.started_at);

  res.json(sessions);
});

export default router;
