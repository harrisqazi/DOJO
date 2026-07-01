import { pgTable, text, timestamp, uuid, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jointsTable = pgTable("joints", {
  id: uuid("id").primaryKey().defaultRandom(),
  posture_id: uuid("posture_id").notNull(),
  joint_id: text("joint_id").notNull(),
  joint_label: text("joint_label").notNull(),
  landmark_a: text("landmark_a").notNull(),
  landmark_b: text("landmark_b").notNull(),
  landmark_c: text("landmark_c").notNull(),
  target_angle: real("target_angle").notNull(),
  tolerance_degrees: real("tolerance_degrees").default(15),
  weight: real("weight").default(0.25),
  cue_too_low: text("cue_too_low"),
  cue_too_high: text("cue_too_high"),
  cue_correct: text("cue_correct"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJointSchema = createInsertSchema(jointsTable).omit({ id: true, created_at: true });
export type InsertJoint = z.infer<typeof insertJointSchema>;
export type Joint = typeof jointsTable.$inferSelect;
