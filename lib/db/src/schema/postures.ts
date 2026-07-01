import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const posturesTable = pgTable("postures", {
  id: uuid("id").primaryKey().defaultRandom(),
  form_id: uuid("form_id").notNull(),
  sequence_number: integer("sequence_number").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  hold_duration_ms: integer("hold_duration_ms").default(2500),
  transition_duration_ms: integer("transition_duration_ms").default(1500),
  camera_override: text("camera_override"),
  reference_image_url: text("reference_image_url"),
  audio_cue_text: text("audio_cue_text"),
  tips: text("tips"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostureSchema = createInsertSchema(posturesTable).omit({ id: true, created_at: true });
export type InsertPosture = z.infer<typeof insertPostureSchema>;
export type Posture = typeof posturesTable.$inferSelect;
