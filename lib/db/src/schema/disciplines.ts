import { pgTable, text, timestamp, uuid, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const disciplinesTable = pgTable("disciplines", {
  id: uuid("id").primaryKey().defaultRandom(),
  dojo_id: uuid("dojo_id"),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  is_public: boolean("is_public").default(true),
  sort_order: integer("sort_order").default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDisciplineSchema = createInsertSchema(disciplinesTable).omit({ id: true, created_at: true });
export type InsertDiscipline = z.infer<typeof insertDisciplineSchema>;
export type Discipline = typeof disciplinesTable.$inferSelect;
