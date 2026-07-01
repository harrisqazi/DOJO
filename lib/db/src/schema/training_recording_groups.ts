import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trainingRecordingGroupsTable = pgTable("training_recording_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  form_id: uuid("form_id"),
  posture_id: uuid("posture_id"),
  dojo_id: uuid("dojo_id"),
  title: text("title").notNull(),
  discipline: text("discipline").notNull(),
  difficulty: text("difficulty"),
  instructor_user_id: uuid("instructor_user_id").notNull(),
  front_recording_id: uuid("front_recording_id"),
  side_recording_id: uuid("side_recording_id"),
  default_view_angle: text("default_view_angle").default("front"),
  description: text("description"),
  instructions: text("instructions"),
  is_published: boolean("is_published").default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrainingRecordingGroupSchema = createInsertSchema(trainingRecordingGroupsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertTrainingRecordingGroup = z.infer<typeof insertTrainingRecordingGroupSchema>;
export type TrainingRecordingGroup = typeof trainingRecordingGroupsTable.$inferSelect;
