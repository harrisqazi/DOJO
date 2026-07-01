import { Router, type IRouter } from "express";
import { db, jointsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListJointsParams,
  CreateJointParams,
  CreateJointBody,
  UpdateJointParams,
  UpdateJointBody,
  DeleteJointParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/postures/:postureId/joints", async (req, res): Promise<void> => {
  const params = ListJointsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const joints = await db.select().from(jointsTable)
    .where(eq(jointsTable.posture_id, params.data.postureId));

  res.json(joints);
});

router.post("/postures/:postureId/joints", async (req, res): Promise<void> => {
  const params = CreateJointParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = CreateJointBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // After insert, normalize weights for this posture
  const [joint] = await db.insert(jointsTable).values({
    ...parsed.data,
    posture_id: params.data.postureId,
  }).returning();

  // Normalize weights
  const allJoints = await db.select().from(jointsTable).where(eq(jointsTable.posture_id, params.data.postureId));
  const totalWeight = allJoints.reduce((sum, j) => sum + (j.weight ?? 0), 0);
  if (totalWeight > 0) {
    for (const j of allJoints) {
      await db.update(jointsTable).set({ weight: (j.weight ?? 0) / totalWeight }).where(eq(jointsTable.id, j.id));
    }
  }

  res.status(201).json(joint);
});

router.patch("/joints/:jointId", async (req, res): Promise<void> => {
  const params = UpdateJointParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateJointBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [joint] = await db.update(jointsTable)
    .set(parsed.data)
    .where(eq(jointsTable.id, params.data.jointId))
    .returning();

  if (!joint) { res.status(404).json({ error: "Joint not found" }); return; }

  // Normalize weights for the posture
  const allJoints = await db.select().from(jointsTable).where(eq(jointsTable.posture_id, joint.posture_id));
  const totalWeight = allJoints.reduce((sum, j) => sum + (j.weight ?? 0), 0);
  if (totalWeight > 0) {
    for (const j of allJoints) {
      await db.update(jointsTable).set({ weight: (j.weight ?? 0) / totalWeight }).where(eq(jointsTable.id, j.id));
    }
  }

  res.json(joint);
});

router.delete("/joints/:jointId", async (req, res): Promise<void> => {
  const params = DeleteJointParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(jointsTable).where(eq(jointsTable.id, params.data.jointId));
  res.sendStatus(204);
});

export default router;
