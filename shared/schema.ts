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
  favoriteNFLCoach: text("favorite_nfl_coach"),
  offensiveSchemePreference: text("offensive_scheme_preference"),
  defensiveSchemePreference: text("defensive_scheme_preference"),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").default(false),
  googleDriveTokens: jsonb("google_drive_tokens"),
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

export const GAME_FORMATS = ["5v5", "7v7", "9v9", "11v11"] as const;
export type GameFormat = typeof GAME_FORMATS[number];

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  year: text("year").default("2025"),
  gameFormat: text("game_format").default("5v5"),
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
  concept: text("concept"),
  formation: text("formation"),
  personnel: text("personnel"),
  situation: text("situation"),
  data: jsonb("data"),
  tags: text("tags").array(),
  isFavorite: boolean("is_favorite").default(false),
  isPublic: boolean("is_public").default(false),
  isArchived: boolean("is_archived").default(false),
  clonedFromId: integer("cloned_from_id"),
  createdAt: timestamp("created_at").defaultNow(),
  thumbnailBase64: text("thumbnail_base64"),
  notes: text("notes"),
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
  uploadedImage: text("uploaded_image"),
  status: text("status").notNull().default("success"),
  timestamp: timestamp("timestamp").defaultNow(),
  previewJson: jsonb("preview_json"),
  feedbackNotes: text("feedback_notes"),
  rating: integer("rating").default(0),
  correctDiagram: text("correct_diagram"),
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

// Junction table for many-to-many play-team relationships
export const playTeams = pgTable("play_teams", {
  id: serial("id").primaryKey(),
  playId: integer("play_id").notNull().references(() => plays.id, { onDelete: 'cascade' }),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: 'cascade' }),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlayTeamSchema = createInsertSchema(playTeams).omit({
  id: true,
  createdAt: true,
});

export type InsertPlayTeam = z.infer<typeof insertPlayTeamSchema>;
export type PlayTeam = typeof playTeams.$inferSelect;

// Blank pages for playbook dividers/sections
export const teamBlankPages = pgTable("team_blank_pages", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: 'cascade' }),
  title: text("title").notNull().default("Blank Page 1"),
  customContent: text("custom_content"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamBlankPageSchema = createInsertSchema(teamBlankPages).omit({
  id: true,
  createdAt: true,
});

export type InsertTeamBlankPage = z.infer<typeof insertTeamBlankPageSchema>;
export type TeamBlankPage = typeof teamBlankPages.$inferSelect;

// Team coaching staff
export const teamCoaches = pgTable("team_coaches", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: 'cascade' }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamCoachSchema = createInsertSchema(teamCoaches).omit({
  id: true,
  createdAt: true,
});

export type InsertTeamCoach = z.infer<typeof insertTeamCoachSchema>;
export type TeamCoach = typeof teamCoaches.$inferSelect;

// Team players roster
export const teamPlayers = pgTable("team_players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: 'cascade' }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  position1: text("position_1"),
  position2: text("position_2"),
  defPosition1: text("def_position_1"),
  mainColor: text("main_color"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamPlayerSchema = createInsertSchema(teamPlayers).omit({
  id: true,
  createdAt: true,
});

export type InsertTeamPlayer = z.infer<typeof insertTeamPlayerSchema>;
export type TeamPlayer = typeof teamPlayers.$inferSelect;

// Team splits (Squad 1, Squad 2) - assigns players to squads
export const teamSplits = pgTable("team_splits", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: 'cascade' }),
  playerId: integer("player_id").notNull().references(() => teamPlayers.id, { onDelete: 'cascade' }),
  squadName: text("squad_name").notNull(), // "Squad 1" or "Squad 2"
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamSplitSchema = createInsertSchema(teamSplits).omit({
  id: true,
  createdAt: true,
});

export type InsertTeamSplit = z.infer<typeof insertTeamSplitSchema>;
export type TeamSplit = typeof teamSplits.$inferSelect;

export const SQUAD_NAMES = ["Squad 1", "Squad 2"] as const;
export type SquadName = typeof SQUAD_NAMES[number];

// Coach role options for dropdown
export const COACH_ROLES = [
  "Head Coach",
  "Assistant Coach", 
  "Offensive Coordinator",
  "Defensive Coordinator",
  "Special Teams",
  "Assistant",
  "Student Coach"
] as const;

export type CoachRole = typeof COACH_ROLES[number];

// Position mappings by game format - Offensive positions
export const OFFENSIVE_POSITIONS_BY_FORMAT: Record<GameFormat, { value: string; label: string }[]> = {
  "5v5": [
    { value: "QB", label: "QB" },
    { value: "RB", label: "RB" },
    { value: "X", label: "X (Outside Receiver 1)" },
    { value: "Y", label: "Y (Slot Receiver)" },
    { value: "Z", label: "Z (Outside Receiver 2)" },
  ],
  "7v7": [
    { value: "QB", label: "QB" },
    { value: "RB", label: "RB" },
    { value: "X", label: "X (Outside Receiver 1)" },
    { value: "Y", label: "Y (Slot Receiver)" },
    { value: "Z", label: "Z (Outside Receiver 2)" },
    { value: "H", label: "H (H-Back)" },
    { value: "C", label: "C (Center)" },
  ],
  "9v9": [
    { value: "QB", label: "QB" },
    { value: "RB", label: "RB" },
    { value: "FB", label: "FB" },
    { value: "X", label: "X (Outside Receiver 1)" },
    { value: "Y", label: "Y (Slot Receiver)" },
    { value: "Z", label: "Z (Outside Receiver 2)" },
    { value: "TE", label: "TE" },
    { value: "C", label: "C (Center)" },
    { value: "OL", label: "OL" },
  ],
  "11v11": [
    { value: "QB", label: "QB" },
    { value: "RB", label: "RB" },
    { value: "FB", label: "FB" },
    { value: "WR", label: "WR" },
    { value: "X", label: "X (Split End)" },
    { value: "Y", label: "Y (Slot)" },
    { value: "Z", label: "Z (Flanker)" },
    { value: "TE", label: "TE" },
    { value: "LT", label: "LT" },
    { value: "LG", label: "LG" },
    { value: "C", label: "C" },
    { value: "RG", label: "RG" },
    { value: "RT", label: "RT" },
  ],
};

// Position mappings by game format - Defensive positions
export const DEFENSIVE_POSITIONS_BY_FORMAT: Record<GameFormat, { value: string; label: string }[]> = {
  "5v5": [
    { value: "LB", label: "LB (Linebacker)" },
    { value: "CB", label: "CB (Cornerback)" },
    { value: "S", label: "S (Safety)" },
    { value: "RUSH", label: "RUSH (Pass Rusher)" },
  ],
  "7v7": [
    { value: "LB", label: "LB (Linebacker)" },
    { value: "CB", label: "CB (Cornerback)" },
    { value: "S", label: "S (Safety)" },
    { value: "FS", label: "FS (Free Safety)" },
    { value: "SS", label: "SS (Strong Safety)" },
    { value: "RUSH", label: "RUSH (Pass Rusher)" },
  ],
  "9v9": [
    { value: "DL", label: "DL (Defensive Line)" },
    { value: "DE", label: "DE (Defensive End)" },
    { value: "DT", label: "DT (Defensive Tackle)" },
    { value: "LB", label: "LB (Linebacker)" },
    { value: "MLB", label: "MLB (Middle Linebacker)" },
    { value: "OLB", label: "OLB (Outside Linebacker)" },
    { value: "CB", label: "CB (Cornerback)" },
    { value: "S", label: "S (Safety)" },
  ],
  "11v11": [
    { value: "DE", label: "DE (Defensive End)" },
    { value: "DT", label: "DT (Defensive Tackle)" },
    { value: "NT", label: "NT (Nose Tackle)" },
    { value: "OLB", label: "OLB (Outside Linebacker)" },
    { value: "ILB", label: "ILB (Inside Linebacker)" },
    { value: "MLB", label: "MLB (Middle Linebacker)" },
    { value: "CB", label: "CB (Cornerback)" },
    { value: "FS", label: "FS (Free Safety)" },
    { value: "SS", label: "SS (Strong Safety)" },
    { value: "NB", label: "NB (Nickelback)" },
    { value: "DB", label: "DB (Dime Back)" },
  ],
};
