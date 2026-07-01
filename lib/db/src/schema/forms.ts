import { pgTable, text, timestamp, uuid, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const formsTable = pgTable("forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  discipline_id: uuid("discipline_id").notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  difficulty: text("difficulty").default("beginner"),
  camera_default: text("camera_default").default("side-left"),
  estimated_minutes: integer("estimated_minutes").default(5),
  is_free: boolean("is_free").default(false),
  sort_order: integer("sort_order").default(0),
  recording_count: integer("recording_count").default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFormSchema = createInsertSchema(formsTable).omit({ id: true, created_at: true });
export type InsertForm = z.infer<typeof insertFormSchema>;
export type Form = typeof formsTable.$inferSelect;
