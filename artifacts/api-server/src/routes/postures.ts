import { Router, type IRouter } from "express";
import { db, posturesTable, jointsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListPosturesParams,
  CreatePostureParams,
  CreatePostureBody,
  UpdatePostureParams,
  UpdatePostureBody,
  DeletePostureParams,
  ReorderPosturesParams,
  ReorderPosturesBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/forms/:formId/postures", async (req, res): Promise<void> => {
  const params = ListPosturesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const postures = await db.select().from(posturesTable)
    .where(eq(posturesTable.form_id, params.data.formId))
    .orderBy(posturesTable.sequence_number);

  res.json(postures);
});

router.post("/forms/:formId/postures", async (req, res): Promise<void> => {
  const params = CreatePostureParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = CreatePostureBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [posture] = await db.insert(posturesTable).values({
    ...parsed.data,
    form_id: params.data.formId,
  }).returning();

  res.status(201).json(posture);
});

router.patch("/postures/:postureId", async (req, res): Promise<void> => {
  const params = UpdatePostureParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdatePostureBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [posture] = await db.update(posturesTable)
    .set(parsed.data)
    .where(eq(posturesTable.id, params.data.postureId))
    .returning();

  if (!posture) { res.status(404).json({ error: "Posture not found" }); return; }
  res.json(posture);
});

router.delete("/postures/:postureId", async (req, res): Promise<void> => {
  const params = DeletePostureParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(posturesTable).where(eq(posturesTable.id, params.data.postureId));
  res.sendStatus(204);
});

router.patch("/forms/:formId/postures/reorder", async (req, res): Promise<void> => {
  const params = ReorderPosturesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = ReorderPosturesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  for (let i = 0; i < parsed.data.order.length; i++) {
    await db.update(posturesTable)
      .set({ sequence_number: i + 1 })
      .where(eq(posturesTable.id, parsed.data.order[i]));
  }

  res.json({ success: true });
});

export default router;
