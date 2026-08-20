import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addWordToWordbook, authenticateWithPin, createAnnouncement, createCalendarEvent, createClassroom, createPinAccount, createSiteAdminSession, createWordbook, getLearningSummary, getManagementInsights, getPinSession, listClassroomMembers, listClassroomsForUser, listJournalEntries, listVisibleAnnouncements, listVisibleCalendarEvents, listVisibleWordbooks, recordFocusSession, recordLearningResult, resetPinForProfile, revokePinSession, revokeSiteAdminSession, saveJournalEntry, updateClassroom } from "./db";
import { fetchTodayNewsSource, generateJournalArticle } from "./journal";
import { verifySiteAdminPassword } from "./site-admin-auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

function toUserMessage(error: unknown): never {
  const code = error instanceof Error ? error.message : "";
  if (code === "CLASSROOM_REQUIRED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "教室への参加を完了してから利用してください。" });
  if (code === "WORD_BOOK_FORBIDDEN") throw new TRPCError({ code: "FORBIDDEN", message: "この単語帳を編集する権限がありません。" });
  if (code === "CLASSROOM_MANAGER_REQUIRED") throw new TRPCError({ code: "FORBIDDEN", message: "この操作は先生または教室管理者のみが実行できます。" });
  if (code === "GLOBAL_MANAGER_REQUIRED") throw new TRPCError({ code: "FORBIDDEN", message: "全体公開は全体管理者のみが実行できます。" });
  if (code === "PIN_RATE_LIMITED") throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "ログイン試行が多すぎます。15分ほど待ってから再試行してください。" });
  if (code === "INVALID_PIN_LOGIN") throw new TRPCError({ code: "UNAUTHORIZED", message: "PINまたは教室コードが正しくありません。" });
  if (code === "PROFILE_NOT_FOUND" || code === "CLASSROOM_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "指定された情報が見つかりません。" });
  if (code === "NEWS_SOURCE_UNAVAILABLE") throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "今日の記事の取得元に接続できませんでした。通常生成をお試しください。" });
  if (code === "JOURNAL_GENERATION_FAILED") throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "記事を生成できませんでした。時間をおいて再試行してください。" });
  if (code === "DATABASE_UNAVAILABLE") throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "学習データを保存できません。時間をおいて再試行してください。" });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "処理を完了できませんでした。もう一度お試しください。" });
}

function getRequestCookie(cookieHeader: string | undefined, name: string) {
  return (cookieHeader ?? "").split(";").map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

export const appRouter = router({
  system: systemRouter,
  siteAdmin: router({
    check: publicProcedure.input(z.object({ password: z.string().min(1).max(256) })).query(({ input }) => ({ valid: verifySiteAdminPassword(input.password) })),
    login: publicProcedure.input(z.object({ password: z.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
      if (!verifySiteAdminPassword(input.password)) throw new TRPCError({ code: "UNAUTHORIZED", message: "全体管理者パスワードが正しくありません。" });
      try {
        const session = await createSiteAdminSession();
        const options = getSessionCookieOptions(ctx.req);
        ctx.res.cookie("studyverse_admin", session.token, { ...options, maxAge: 8 * 60 * 60 * 1000 });
        return { user: { id: session.user.id, name: session.user.name, role: session.user.role }, expiresAt: session.expiresAt };
      } catch (error) { return toUserMessage(error); }
    }),
    me: publicProcedure.query(({ ctx }) => ctx.user?.role === "admin" ? { id: ctx.user.id, name: ctx.user.name, role: ctx.user.role } : null),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const token = getRequestCookie(ctx.req.headers.cookie, "studyverse_admin");
      if (token) await revokeSiteAdminSession(token);
      const options = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie("studyverse_admin", { ...options, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const pinToken = getRequestCookie(ctx.req.headers.cookie, "studyverse_pin");
      const adminToken = getRequestCookie(ctx.req.headers.cookie, "studyverse_admin");
      if (pinToken) await revokePinSession(pinToken);
      if (adminToken) await revokeSiteAdminSession(adminToken);
      ctx.res.clearCookie("studyverse_pin", { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie("studyverse_admin", { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    pinLogin: publicProcedure.input(z.object({ pin: z.string().regex(/^\d{4}$/), classroomCode: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9-]+$/) })).mutation(async ({ ctx, input }) => {
      try {
        const fingerprint = ctx.req.ip ?? ctx.req.socket.remoteAddress ?? "unknown";
        const result = await authenticateWithPin({ ...input, clientFingerprint: fingerprint });
        const options = getSessionCookieOptions(ctx.req);
        ctx.res.cookie("studyverse_pin", result.token, { ...options, maxAge: 12 * 60 * 60 * 1000 });
        return { profile: result.profile, classroom: result.classroom, expiresAt: result.expiresAt };
      } catch (error) { return toUserMessage(error); }
    }),
    pinMe: publicProcedure.query(async ({ ctx }) => {
      const token = ctx.req.cookies?.studyverse_pin as string | undefined;
      if (!token) return null;
      const result = await getPinSession(token);
      if (!result) return null;
      return { profile: { id: result.profile.id, userId: result.profile.userId, displayName: result.profile.displayName, classroomRole: result.profile.classroomRole }, classroom: { id: result.classroom.id, code: result.classroom.code, name: result.classroom.name } };
    }),
    pinLogout: publicProcedure.mutation(async ({ ctx }) => {
      const token = ctx.req.cookies?.studyverse_pin as string | undefined;
      if (token) await revokePinSession(token);
      const options = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie("studyverse_pin", { ...options, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  learning: router({
    summary: protectedProcedure.query(async ({ ctx }) => getLearningSummary(ctx.user.id)),
    saveFocusSession: protectedProcedure.input(z.object({ startedAt: z.date(), completedAt: z.date(), focusSeconds: z.number().int().min(1).max(4 * 60 * 60) })).mutation(async ({ ctx, input }) => {
      try { await recordFocusSession(ctx.user.id, input); return { success: true }; } catch (error) { return toUserMessage(error); }
    }),
    recordAnswer: protectedProcedure.input(z.object({ wordId: z.number().int().positive().optional(), mode: z.enum(["practice", "test", "journal", "ai_select"]), isCorrect: z.boolean() })).mutation(async ({ ctx, input }) => {
      try { await recordLearningResult(ctx.user.id, input); return { success: true }; } catch (error) { return toUserMessage(error); }
    }),
  }),
  management: router({
    insights: protectedProcedure.query(async ({ ctx }) => {
      try { return await getManagementInsights(ctx.user.id); } catch (error) { return toUserMessage(error); }
    }),
  }),
  journal: router({
    list: protectedProcedure.query(async ({ ctx }) => listJournalEntries(ctx.user.id)),
    generate: protectedProcedure.input(z.object({ subject: z.enum(["english", "kanji"]), difficulty: z.string().trim().min(1).max(40), mode: z.enum(["normal", "today"]) })).mutation(async ({ ctx, input }) => {
      try {
        const source = input.mode === "today" ? await fetchTodayNewsSource() : undefined;
        const article = await generateJournalArticle({ subject: input.subject, difficulty: input.difficulty, source });
        const saved = await saveJournalEntry(ctx.user.id, { subject: input.subject, difficulty: input.difficulty, sourceType: source ? "news" : "ai", sourceTitle: source?.title, sourceUrl: source?.url, articleTitle: article.title, articleBody: article.body, questions: article.questions });
        return { id: saved?.id, ...article, source: source ? { title: source.title, url: source.url, domain: source.domain } : null };
      } catch (error) { return toUserMessage(error); }
    }),
  }),
  wordbooks: router({
    list: protectedProcedure.input(z.object({ subject: z.enum(["english", "kanji"]).optional() }).optional()).query(async ({ ctx, input }) => listVisibleWordbooks(ctx.user.id, input?.subject)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(160), subject: z.enum(["english", "kanji"]), visibility: z.enum(["private", "classroom"]).default("private") })).mutation(async ({ ctx, input }) => {
      try { return await createWordbook(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
    }),
    addWord: protectedProcedure.input(z.object({ wordbookId: z.number().int().positive(), front: z.string().trim().min(1).max(500), back: z.string().trim().min(1).max(500), reading: z.string().trim().max(500).optional(), source: z.enum(["manual", "csv", "admin"]).optional() })).mutation(async ({ ctx, input }) => {
      try { return await addWordToWordbook(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
    }),
  }),
  classroom: router({
    rooms: router({
      list: protectedProcedure.input(z.object({ query: z.string().trim().max(120).optional() }).optional()).query(async ({ ctx, input }) => {
        try { return await listClassroomsForUser(ctx.user.id, input?.query); } catch (error) { return toUserMessage(error); }
      }),
      create: protectedProcedure.input(z.object({ code: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9-]+$/), name: z.string().trim().min(1).max(120), teacherUserId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
        try { return await createClassroom(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
      }),
      update: protectedProcedure.input(z.object({ classroomId: z.number().int().positive(), name: z.string().trim().min(1).max(120).optional(), teacherUserId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
        const { classroomId, ...update } = input;
        try { await updateClassroom(ctx.user.id, classroomId, update); return { success: true }; } catch (error) { return toUserMessage(error); }
      }),
    }),
    members: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        try { return await listClassroomMembers(ctx.user.id); } catch (error) { return toUserMessage(error); }
      }),
      createPinAccount: protectedProcedure.input(z.object({ classroomId: z.number().int().positive(), displayName: z.string().trim().min(1).max(80), pin: z.string().regex(/^\d{4}$/), classroomRole: z.enum(["student", "teacher", "owner"]).optional() })).mutation(async ({ ctx, input }) => {
        try { return await createPinAccount(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
      }),
      resetPin: protectedProcedure.input(z.object({ profileId: z.number().int().positive(), pin: z.string().regex(/^\d{4}$/) })).mutation(async ({ ctx, input }) => {
        try { await resetPinForProfile(ctx.user.id, input); return { success: true }; } catch (error) { return toUserMessage(error); }
      }),
    }),
    announcements: router({
      list: protectedProcedure.query(async ({ ctx }) => listVisibleAnnouncements(ctx.user.id)),
      create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(5000), visibility: z.enum(["classroom", "global"]).default("classroom"), expiresAt: z.date().optional() })).mutation(async ({ ctx, input }) => {
        try { return await createAnnouncement(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
      }),
    }),
    calendar: router({
      list: protectedProcedure.query(async ({ ctx }) => listVisibleCalendarEvents(ctx.user.id)),
      create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(160), startsAt: z.date(), endsAt: z.date().optional(), visibility: z.enum(["classroom", "global"]).default("classroom") })).mutation(async ({ ctx, input }) => {
        if (input.endsAt && input.endsAt < input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "終了時刻は開始時刻より後にしてください。" });
        try { return await createCalendarEvent(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
