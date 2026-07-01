import { Router, type IRouter } from "express";
import { db, disciplinesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateDisciplineBody,
  ListDisciplinesQueryParams,
  UpdateDisciplineParams,
  UpdateDisciplineBody,
  DeleteDisciplineParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/disciplines", async (req, res): Promise<void> => {
  const queryParsed = ListDisciplinesQueryParams.safeParse(req.query);
  const dojoId = queryParsed.success ? queryParsed.data.dojo_id : undefined;

  let query = db.select().from(disciplinesTable).$dynamic();
  if (dojoId) query = query.where(eq(disciplinesTable.dojo_id, dojoId));

  const disciplines = await query.orderBy(disciplinesTable.sort_order);
  res.json(disciplines);
});

router.post("/disciplines", async (req, res): Promise<void> => {
  const parsed = CreateDisciplineBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [discipline] = await db.insert(disciplinesTable).values(parsed.data).returning();
  res.status(201).json(discipline);
});

router.patch("/disciplines/:disciplineId", async (req, res): Promise<void> => {
  const params = UpdateDisciplineParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateDisciplineBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [discipline] = await db.update(disciplinesTable)
    .set(parsed.data)
    .where(eq(disciplinesTable.id, params.data.disciplineId))
    .returning();

  if (!discipline) { res.status(404).json({ error: "Discipline not found" }); return; }
  res.json(discipline);
});

router.delete("/disciplines/:disciplineId", async (req, res): Promise<void> => {
  const params = DeleteDisciplineParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(disciplinesTable).where(eq(disciplinesTable.id, params.data.disciplineId));
  res.sendStatus(204);
});

export default router;
