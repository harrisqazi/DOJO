import { pgTable, text, timestamp, uuid, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trainingRecordingsTable = pgTable("training_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  form_id: uuid("form_id"),
  posture_id: uuid("posture_id"),
  dojo_id: uuid("dojo_id"),
  instructor_user_id: uuid("instructor_user_id").notNull(),
  title: text("title").notNull(),
  discipline: text("discipline").notNull(),
  movement_name: text("movement_name"),
  view_angle: text("view_angle").notNull(),
  description: text("description"),
  instructions: text("instructions"),
  breathing_cues: jsonb("breathing_cues"),
  video_url: text("video_url"),
  video_storage_key: text("video_storage_key"),
  motion_data: jsonb("motion_data").notNull(),
  motion_fingerprint: jsonb("motion_fingerprint").notNull(),
  duration_ms: integer("duration_ms").notNull(),
  fps: integer("fps").notNull(),
  frame_count: integer("frame_count").notNull(),
  is_published: boolean("is_published").default(false),
  consent_confirmed: boolean("consent_confirmed").default(false),
  privacy_mode: text("privacy_mode").default("private"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrainingRecordingSchema = createInsertSchema(trainingRecordingsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertTrainingRecording = z.infer<typeof insertTrainingRecordingSchema>;
export type TrainingRecording = typeof trainingRecordingsTable.$inferSelect;
