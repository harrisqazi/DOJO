import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  name: text("name"),
  role: text("role").default("student"),
  dojo_id: uuid("dojo_id"),
  stripe_customer_id: text("stripe_customer_id"),
  subscription_status: text("subscription_status").default("free"),
  camera_side: text("camera_side").default("left"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ created_at: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
