import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const classrooms = mysqlTable("classrooms", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  teacherUserId: int("teacherUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const studentProfiles = mysqlTable("studentProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  classroomId: int("classroomId").notNull(),
  pinHash: varchar("pinHash", { length: 128 }).notNull(),
  pinLookupHash: varchar("pinLookupHash", { length: 64 }).notNull(),
  classroomRole: mysqlEnum("classroomRole", ["student", "teacher", "owner"]).default("student").notNull(),
  displayName: varchar("displayName", { length: 80 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("studentProfiles_classroom_pin_lookup_unique").on(table.classroomId, table.pinLookupHash)]);

export const pinSessions = mysqlTable("pinSessions", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  profileId: int("profileId").notNull(),
  userId: int("userId").notNull(),
  classroomId: int("classroomId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const siteAdminSessions = mysqlTable("siteAdminSessions", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const pinLoginAttempts = mysqlTable("pinLoginAttempts", {
  id: int("id").autoincrement().primaryKey(),
  attemptKeyHash: varchar("attemptKeyHash", { length: 64 }).notNull(),
  succeeded: boolean("succeeded").notNull(),
  attemptedAt: timestamp("attemptedAt").defaultNow().notNull(),
});

export const journalEntries = mysqlTable("journalEntries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  classroomId: int("classroomId").notNull(),
  subject: mysqlEnum("subject", ["english", "kanji"]).notNull(),
  difficulty: varchar("difficulty", { length: 40 }).notNull(),
  sourceType: mysqlEnum("sourceType", ["ai", "news"]).notNull(),
  sourceTitle: varchar("sourceTitle", { length: 500 }),
  sourceUrl: varchar("sourceUrl", { length: 2048 }),
  articleTitle: varchar("articleTitle", { length: 240 }).notNull(),
  articleBody: text("articleBody").notNull(),
  questionsJson: text("questionsJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const wordbooks = mysqlTable("wordbooks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  subject: mysqlEnum("subject", ["english", "kanji"]).notNull(),
  visibility: mysqlEnum("visibility", ["private", "classroom", "global"]).default("private").notNull(),
  ownerUserId: int("ownerUserId"),
  classroomId: int("classroomId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const vocabularyWords = mysqlTable("vocabularyWords", {
  id: int("id").autoincrement().primaryKey(),
  wordbookId: int("wordbookId").notNull(),
  front: varchar("front", { length: 500 }).notNull(),
  back: varchar("back", { length: 500 }).notNull(),
  reading: varchar("reading", { length: 500 }),
  source: mysqlEnum("source", ["manual", "csv", "admin"]).default("manual").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const studyRecords = mysqlTable("studyRecords", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  classroomId: int("classroomId").notNull(),
  wordId: int("wordId"),
  mode: mysqlEnum("mode", ["practice", "test", "journal", "ai_select"]).notNull(),
  isCorrect: boolean("isCorrect").notNull(),
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
});

export const focusSessions = mysqlTable("focusSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  classroomId: int("classroomId").notNull(),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt").notNull(),
  focusSeconds: int("focusSeconds").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  classroomId: int("classroomId"),
  authorUserId: int("authorUserId").notNull(),
  visibility: mysqlEnum("visibility", ["classroom", "global"]).default("classroom").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

export const calendarEvents = mysqlTable("calendarEvents", {
  id: int("id").autoincrement().primaryKey(),
  classroomId: int("classroomId"),
  authorUserId: int("authorUserId").notNull(),
  visibility: mysqlEnum("visibility", ["classroom", "global"]).default("classroom").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Wordbook = typeof wordbooks.$inferSelect;
