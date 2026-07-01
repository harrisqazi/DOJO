import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coachReviewsTable = pgTable("coach_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_motion_attempt_id: uuid("user_motion_attempt_id").notNull(),
  coach_user_id: uuid("coach_user_id").notNull(),
  status: text("status").default("pending"),
  coach_notes: text("coach_notes"),
  voice_note_url: text("voice_note_url"),
  annotations: jsonb("annotations"),
  assigned_drills: jsonb("assigned_drills"),
  approval_status: text("approval_status").default("not_reviewed"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCoachReviewSchema = createInsertSchema(coachReviewsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertCoachReview = z.infer<typeof insertCoachReviewSchema>;
export type CoachReview = typeof coachReviewsTable.$inferSelect;
