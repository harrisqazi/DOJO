import { pgTable, text, timestamp, uuid, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const privacyConsentsTable = pgTable("privacy_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  consent_type: text("consent_type").notNull(),
  accepted: boolean("accepted").notNull(),
  accepted_at: timestamp("accepted_at", { withTimezone: true }),
  revoked_at: timestamp("revoked_at", { withTimezone: true }),
  details: jsonb("details"),
});

export const insertPrivacyConsentSchema = createInsertSchema(privacyConsentsTable).omit({ id: true });
export type InsertPrivacyConsent = z.infer<typeof insertPrivacyConsentSchema>;
export type PrivacyConsent = typeof privacyConsentsTable.$inferSelect;
