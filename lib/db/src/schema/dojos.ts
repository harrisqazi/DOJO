import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dojosTable = pgTable("dojos", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logo_url: text("logo_url"),
  accent_color: text("accent_color").default("#6366f1"),
  invite_code: text("invite_code").unique(),
  stripe_customer_id: text("stripe_customer_id"),
  subscription_status: text("subscription_status").default("trialing"),
  subscription_tier: text("subscription_tier").default("free"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDojoSchema = createInsertSchema(dojosTable).omit({ id: true, created_at: true });
export type InsertDojo = z.infer<typeof insertDojoSchema>;
export type Dojo = typeof dojosTable.$inferSelect;
