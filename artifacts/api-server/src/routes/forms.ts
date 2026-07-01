import { Router, type IRouter } from "express";
import { db, formsTable, posturesTable, jointsTable, postureScoresTable, sessionsTable } from "@workspace/db";
import { eq, count, avg, and } from "drizzle-orm";
import {
  CreateFormBody,
  ListFormsQueryParams,
  GetFormParams,
  UpdateFormParams,
  UpdateFormBody,
  DeleteFormParams,
  PublishFormParams,
  PublishFormBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/forms", async (req, res): Promise<void> => {
  const userId = req.headers["x-user-id"] as string;
  const queryParsed = ListFormsQueryParams.safeParse(req.query);
  const disciplineId = queryParsed.success ? queryParsed.data.discipline_id : undefined;

  let query = db.select().from(formsTable).$dynamic();
  if (disciplineId) query = query.where(eq(formsTable.discipline_id, disciplineId));

  const forms = await query.orderBy(formsTable.sort_order);

  // Get posture counts
  const postureCounts = await db.select({
    form_id: posturesTable.form_id,
    count: count(),
  }).from(posturesTable).groupBy(posturesTable.form_id);

  const postureCountMap = Object.fromEntries(postureCounts.map(p => [p.form_id, Number(p.count)]));

  // Get best scores per form for current user
  let bestScoreMap: Record<string, number | null> = {};
  if (userId) {
    const scores = await db.select({
      form_id: sessionsTable.form_id,
      best: avg(sessionsTable.total_score),
    }).from(sessionsTable)
      .where(eq(sessionsTable.user_id, userId))
      .groupBy(sessionsTable.form_id);
    bestScoreMap = Object.fromEntries(scores.map(s => [s.form_id, s.best != null ? Number(s.best) : null]));
  }

  res.json(forms.map(f => ({
    ...f,
    posture_count: postureCountMap[f.id] ?? 0,
    best_score: bestScoreMap[f.id] ?? null,
  })));
});

router.post("/forms", async (req, res): Promise<void> => {
  const parsed = CreateFormBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [form] = await db.insert(formsTable).values(parsed.data).returning();
  res.status(201).json({ ...form, posture_count: 0, best_score: null });
});

router.get("/forms/:formId", async (req, res): Promise<void> => {
  const params = GetFormParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [form] = await db.select().from(formsTable).where(eq(formsTable.id, params.data.formId));
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }

  const postures = await db.select().from(posturesTable)
    .where(eq(posturesTable.form_id, params.data.formId))
    .orderBy(posturesTable.sequence_number);

  const posturesWithJoints = await Promise.all(postures.map(async p => {
    const joints = await db.select().from(jointsTable).where(eq(jointsTable.posture_id, p.id));
    return { ...p, joints };
  }));

  res.json({ ...form, postures: posturesWithJoints });
});

router.patch("/forms/:formId", async (req, res): Promise<void> => {
  const params = UpdateFormParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateFormBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [form] = await db.update(formsTable)
    .set(parsed.data)
    .where(eq(formsTable.id, params.data.formId))
    .returning();

  if (!form) { res.status(404).json({ error: "Form not found" }); return; }
  res.json({ ...form, posture_count: 0, best_score: null });
});

router.delete("/forms/:formId", async (req, res): Promise<void> => {
  const params = DeleteFormParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(formsTable).where(eq(formsTable.id, params.data.formId));
  res.sendStatus(204);
});

router.post("/forms/:formId/publish", async (req, res): Promise<void> => {
  const params = PublishFormParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = PublishFormBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [form] = await db.select().from(formsTable).where(eq(formsTable.id, params.data.formId));
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }

  const isUpdate = (form.recording_count ?? 0) > 0;

  for (const p of parsed.data.postures) {
    const [posture] = await db.insert(posturesTable).values({
      form_id: params.data.formId,
      sequence_number: p.sequence_number,
      name: p.name,
      audio_cue_text: p.audio_cue_text ?? null,
      tips: p.tips ?? null,
    }).returning();

    for (const j of p.joints) {
      if (isUpdate) {
        // Rolling average
        const [existing] = await db.select().from(jointsTable)
          .where(and(eq(jointsTable.posture_id, posture.id), eq(jointsTable.joint_id, j.joint_id)));
        if (existing) {
          const newTarget = (existing.target_angle * (form.recording_count ?? 0) + (j.target_angle ?? 0)) / ((form.recording_count ?? 0) + 1);
          await db.update(jointsTable).set({ target_angle: newTarget }).where(eq(jointsTable.id, existing.id));
          continue;
        }
      }

      await db.insert(jointsTable).values({
        posture_id: posture.id,
        joint_id: j.joint_id,
        joint_label: j.joint_label,
        landmark_a: j.landmark_a,
        landmark_b: j.landmark_b,
        landmark_c: j.landmark_c,
        target_angle: j.target_angle,
        tolerance_degrees: j.tolerance_degrees ?? 15,
        weight: j.weight ?? 0.25,
        cue_too_low: j.cue_too_low ?? null,
        cue_too_high: j.cue_too_high ?? null,
        cue_correct: j.cue_correct ?? null,
      });
    }
  }

  const [updated] = await db.update(formsTable)
    .set({ recording_count: (form.recording_count ?? 0) + 1 })
    .where(eq(formsTable.id, params.data.formId))
    .returning();

  res.json({ ...updated, posture_count: parsed.data.postures.length, best_score: null });
});

export default router;
