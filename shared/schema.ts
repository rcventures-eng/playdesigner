import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const aiGenerationLogs = pgTable("ai_generation_logs", {
  id: serial("id").primaryKey(),
  prompt: text("prompt"),
  hasImage: boolean("has_image").default(false),
  status: text("status").notNull().default("success"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertAiLogSchema = createInsertSchema(aiGenerationLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertAiLog = z.infer<typeof insertAiLogSchema>;
export type AiLog = typeof aiGenerationLogs.$inferSelect;
