import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userCalibrationProfilesTable = pgTable("user_calibration_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  discipline: text("discipline"),
  body_scale: jsonb("body_scale").notNull(),
  limb_lengths: jsonb("limb_lengths").notNull(),
  handedness: text("handedness"),
  baseline_mobility: jsonb("baseline_mobility").notNull(),
  camera_framing: jsonb("camera_framing").notNull(),
  visibility_baseline: jsonb("visibility_baseline").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserCalibrationProfileSchema = createInsertSchema(userCalibrationProfilesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertUserCalibrationProfile = z.infer<typeof insertUserCalibrationProfileSchema>;
export type UserCalibrationProfile = typeof userCalibrationProfilesTable.$inferSelect;
