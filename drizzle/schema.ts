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
  marketCoins: int("marketCoins").default(0).notNull(),
});

export const siteSettings = mysqlTable("siteSettings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: varchar("value", { length: 255 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const classrooms = mysqlTable("classrooms", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  teacherUserId: int("teacherUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("classrooms_teacher_user_id_unique").on(table.teacherUserId)]);

export const studentProfiles = mysqlTable("studentProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  classroomId: int("classroomId").notNull(),
  pinHash: varchar("pinHash", { length: 128 }).notNull(),
  pinLookupHash: varchar("pinLookupHash", { length: 64 }).notNull(),
  classroomRole: mysqlEnum("classroomRole", ["student", "teacher", "owner"]).default("student").notNull(),
  displayName: varchar("displayName", { length: 80 }),
  avatarUrl: varchar("avatarUrl", { length: 2048 }),
  revivalTickets: int("revivalTickets").default(2).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("studentProfiles_classroom_pin_lookup_unique").on(table.classroomId, table.pinLookupHash)]);

export const oauthClassroomApplications = mysqlTable("oauthClassroomApplications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  classroomId: int("classroomId").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy"),
}, table => [uniqueIndex("oauth_classroom_applications_user_classroom_unique").on(table.userId, table.classroomId)]);

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

export const teacherAdminSessions = mysqlTable("teacherAdminSessions", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  classroomId: int("classroomId").notNull(),
  teacherId: int("teacherId").notNull(),
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
  imageUrl: varchar("imageUrl", { length: 2048 }),
  exampleSentence: varchar("exampleSentence", { length: 1200 }),
  exampleTranslation: varchar("exampleTranslation", { length: 1200 }),
  source: mysqlEnum("source", ["manual", "csv", "admin"]).default("manual").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const vocabularyWordNotes = mysqlTable("vocabularyWordNotes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  wordId: int("wordId").notNull(),
  note: varchar("note", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("vocabulary_word_notes_user_word_unique").on(table.userId, table.wordId)]);

export const smartNotificationSettings = mysqlTable("smartNotificationSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  wordbookId: int("wordbookId").notNull(),
  direction: mysqlEnum("direction", ["question", "answer"]).default("question").notNull(),
  startTime: varchar("startTime", { length: 5 }).default("08:00").notNull(),
  endTime: varchar("endTime", { length: 5 }).default("21:00").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const smartNotificationSubscriptions = mysqlTable("smartNotificationSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: varchar("endpoint", { length: 2048 }).notNull().unique(),
  subscriptionJson: text("subscriptionJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const studyRecords = mysqlTable("studyRecords", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  classroomId: int("classroomId").notNull(),
  wordId: int("wordId"),
  mode: mysqlEnum("mode", ["practice", "test", "journal", "ai_select"]).notNull(),
  isCorrect: boolean("isCorrect").notNull(),
  practiceRating: mysqlEnum("practiceRating", ["known", "review", "instant", "slow"]).default("known").notNull(),
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
});

export const focusSessions = mysqlTable("focusSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  classroomId: int("classroomId").notNull(),
  clientSessionId: varchar("clientSessionId", { length: 96 }),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt").notNull(),
  focusSeconds: int("focusSeconds").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("focus_sessions_client_session_id_unique").on(table.clientSessionId)]);

export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  classroomId: int("classroomId"),
  authorUserId: int("authorUserId").notNull(),
  visibility: mysqlEnum("visibility", ["classroom", "global"]).default("classroom").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  grantCoins: int("grantCoins").default(0).notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  scheduledAt: timestamp("scheduledAt"),
  expiresAt: timestamp("expiresAt"),
});

export const announcementCoinClaims = mysqlTable("announcementCoinClaims", {
  id: int("id").autoincrement().primaryKey(),
  announcementId: int("announcementId").notNull(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(),
  claimedAt: timestamp("claimedAt").defaultNow().notNull(),
}, table => [uniqueIndex("announcement_coin_claims_announcement_user_unique").on(table.announcementId, table.userId)]);

export const calendarEvents = mysqlTable("calendarEvents", {
  id: int("id").autoincrement().primaryKey(),
  classroomId: int("classroomId"),
  authorUserId: int("authorUserId").notNull(),
  visibility: mysqlEnum("visibility", ["personal", "classroom", "global"]).default("classroom").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const recommendedTests = mysqlTable("recommendedTests", {
  id: int("id").autoincrement().primaryKey(),
  classroomId: int("classroomId").notNull(),
  authorUserId: int("authorUserId").notNull(),
  wordbookId: int("wordbookId").notNull(),
  rangeStart: int("rangeStart").notNull(),
  rangeEnd: int("rangeEnd").notNull(),
  questionCount: int("questionCount").notNull(),
  deliveryMode: mysqlEnum("deliveryMode", ["normal", "announcement"]).default("normal").notNull(),
  deliveryType: mysqlEnum("deliveryType", ["test", "wordbook"]).default("test").notNull(),
  availableFrom: timestamp("availableFrom").defaultNow().notNull(),
  availableUntil: timestamp("availableUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const recommendedTestClaims = mysqlTable("recommendedTestClaims", {
  id: int("id").autoincrement().primaryKey(),
  recommendedTestId: int("recommendedTestId").notNull(),
  userId: int("userId").notNull(),
  receivedWordbookId: int("receivedWordbookId").notNull(),
  claimedAt: timestamp("claimedAt").defaultNow().notNull(),
}, table => [uniqueIndex("recommended_test_claims_test_user_unique").on(table.recommendedTestId, table.userId)]);

export const savedStudySets = mysqlTable("savedStudySets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  wordbookId: int("wordbookId").notNull(),
  rangeStart: int("rangeStart").notNull(),
  rangeEnd: int("rangeEnd").notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const marketItems = mysqlTable("marketItems", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  wordbookId: int("wordbookId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 2048 }).notNull(),
  price: int("price").default(0).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewNote: varchar("reviewNote", { length: 500 }),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const marketTerms = mysqlTable("marketTerms", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 2048 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const marketTermConsents = mysqlTable("marketTermConsents", {
  id: int("id").autoincrement().primaryKey(),
  termId: int("termId").notNull(),
  userId: int("userId").notNull(),
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
}, table => [uniqueIndex("market_term_consents_term_user_unique").on(table.termId, table.userId)]);

export const marketDownloads = mysqlTable("marketDownloads", {
  id: int("id").autoincrement().primaryKey(),
  marketItemId: int("marketItemId").notNull(),
  userId: int("userId").notNull(),
  sellerUserId: int("sellerUserId"),
  pricePaid: int("pricePaid").default(0).notNull(),
  downloadedWordbookId: int("downloadedWordbookId").notNull(),
  downloadedAt: timestamp("downloadedAt").defaultNow().notNull(),
}, table => [uniqueIndex("market_downloads_item_user_unique").on(table.marketItemId, table.userId)]);

export const marketReviews = mysqlTable("marketReviews", {
  id: int("id").autoincrement().primaryKey(),
  marketItemId: int("marketItemId").notNull(),
  userId: int("userId").notNull(),
  stars: int("stars").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("market_reviews_item_user_unique").on(table.marketItemId, table.userId)]);

export const marketCoinTransactions = mysqlTable("marketCoinTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  counterpartyUserId: int("counterpartyUserId"),
  marketItemId: int("marketItemId"),
  amount: int("amount").notNull(),
  type: mysqlEnum("type", ["welcome", "market_purchase", "market_sale", "coin_transfer_send", "coin_transfer_receive", "admin_grant", "announcement_grant"]).notNull(),
  referenceKey: varchar("referenceKey", { length: 160 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const marketCoinTransfers = mysqlTable("marketCoinTransfers", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 80 }).notNull().unique(),
  senderUserId: int("senderUserId").notNull(),
  recipientUserId: int("recipientUserId"),
  status: mysqlEnum("status", ["pending", "recipient_confirmed", "completed", "cancelled", "expired"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const revivalDays = mysqlTable("revivalDays", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  dateKey: varchar("dateKey", { length: 10 }).notNull(),
  usedAt: timestamp("usedAt").defaultNow().notNull(),
}, table => [uniqueIndex("revival_days_user_date_unique").on(table.userId, table.dateKey)]);

export const activityLogs = mysqlTable("activityLogs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  classroomId: int("classroomId"),
  category: mysqlEnum("category", ["classroom", "member", "learning", "journal"]).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const monsterImageSettings = mysqlTable("monsterImageSettings", {
  id: int("id").autoincrement().primaryKey(),
  slotKey: varchar("slotKey", { length: 32 }).notNull(),
  imageType: mysqlEnum("imageType", ["egg", "evolution"]).notNull(),
  eggNumber: int("eggNumber"),
  evolutionStage: int("evolutionStage"),
  imageUrl: varchar("imageUrl", { length: 2048 }).notNull(),
  updatedByUserId: int("updatedByUserId").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("monster_image_settings_slot_key_unique").on(table.slotKey)]);

export const monsterProfiles = mysqlTable("monsterProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eggNumber: mysqlEnum("eggNumber", ["1", "2", "3"]).notNull(),
  active: boolean("active").default(true).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const monsterEggs = mysqlTable("monsterEggs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eggNumber: mysqlEnum("eggNumber", ["1", "2", "3"]).notNull(),
  source: mysqlEnum("source", ["starter", "focus_260", "focus_520", "completion"]).notNull(),
  acquiredAt: timestamp("acquiredAt").defaultNow().notNull(),
  consumedAt: timestamp("consumedAt"),
  monsterProfileId: int("monsterProfileId"),
});

export const monsterMissionClaims = mysqlTable("monsterMissionClaims", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  missionKey: varchar("missionKey", { length: 96 }).notNull(),
  periodKey: varchar("periodKey", { length: 16 }).notNull(),
  points: int("points").notNull(),
  coins: int("coins").default(0).notNull(),
  claimedAt: timestamp("claimedAt").defaultNow().notNull(),
}, table => [uniqueIndex("monster_mission_claims_user_mission_period_unique").on(table.userId, table.missionKey, table.periodKey)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Wordbook = typeof wordbooks.$inferSelect;
