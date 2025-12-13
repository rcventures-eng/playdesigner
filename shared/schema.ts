import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  favoriteNFLTeam: text("favorite_nfl_team"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  firstName: true,
  favoriteNFLTeam: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  year: text("year").default("2025"),
  coverImageUrl: text("cover_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  ownerId: true,
  createdAt: true,
});

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export const plays = pgTable("plays", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  teamId: integer("team_id").references(() => teams.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  category: text("category"),
  formation: text("formation"),
  personnel: text("personnel"),
  data: jsonb("data"),
  tags: text("tags").array(),
  isFavorite: boolean("is_favorite").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlaySchema = createInsertSchema(plays).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertPlay = z.infer<typeof insertPlaySchema>;
export type Play = typeof plays.$inferSelect;

export const aiLogs = pgTable("ai_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  promptText: text("prompt_text"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiLogSchema = createInsertSchema(aiLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAiLog = z.infer<typeof insertAiLogSchema>;
export type AiLog = typeof aiLogs.$inferSelect;

export const aiGenerationLogs = pgTable("ai_generation_logs", {
  id: serial("id").primaryKey(),
  prompt: text("prompt"),
  hasImage: boolean("has_image").default(false),
  status: text("status").notNull().default("success"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertAiGenerationLogSchema = createInsertSchema(aiGenerationLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertAiGenerationLog = z.infer<typeof insertAiGenerationLogSchema>;
export type AiGenerationLog = typeof aiGenerationLogs.$inferSelect;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const featureRequests = pgTable("feature_requests", {
  id: serial("id").primaryKey(),
  userType: text("user_type").notNull(),
  featureDescription: text("feature_description").notNull(),
  useCase: text("use_case").notNull(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFeatureRequestSchema = createInsertSchema(featureRequests).omit({
  id: true,
  createdAt: true,
});

export type InsertFeatureRequest = z.infer<typeof insertFeatureRequestSchema>;
export type FeatureRequest = typeof featureRequests.$inferSelect;
