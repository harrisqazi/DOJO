import { pgTable, text, timestamp, uuid, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postureScoresTable = pgTable("posture_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  session_id: uuid("session_id").notNull(),
  posture_id: uuid("posture_id").notNull(),
  score: real("score").notNull(),
  joint_angles_json: jsonb("joint_angles_json"),
  feedback_given: text("feedback_given").array(),
  captured_at: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostureScoreSchema = createInsertSchema(postureScoresTable).omit({ id: true, captured_at: true });
export type InsertPostureScore = z.infer<typeof insertPostureScoreSchema>;
export type PostureScore = typeof postureScoresTable.$inferSelect;
