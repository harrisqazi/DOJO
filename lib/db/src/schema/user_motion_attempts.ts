import { pgTable, text, timestamp, uuid, integer, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userMotionAttemptsTable = pgTable("user_motion_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  training_recording_group_id: uuid("training_recording_group_id").notNull(),
  training_recording_id: uuid("training_recording_id").notNull(),
  view_angle: text("view_angle").notNull(),
  discipline: text("discipline").notNull(),
  motion_data: jsonb("motion_data").notNull(),
  comparison_result: jsonb("comparison_result").notNull(),
  duration_ms: integer("duration_ms").notNull(),
  fps: integer("fps").notNull(),
  overall_score: integer("overall_score").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserMotionAttemptSchema = createInsertSchema(userMotionAttemptsTable).omit({
  id: true, created_at: true,
});
export type InsertUserMotionAttempt = z.infer<typeof insertUserMotionAttemptSchema>;
export type UserMotionAttempt = typeof userMotionAttemptsTable.$inferSelect;
