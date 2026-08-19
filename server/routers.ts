import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addWordToWordbook, createAnnouncement, createCalendarEvent, createClassroom, createWordbook, getLearningSummary, listClassroomMembers, listClassroomsForUser, listVisibleAnnouncements, listVisibleCalendarEvents, listVisibleWordbooks, recordFocusSession, recordLearningResult, updateClassroom } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

function toUserMessage(error: unknown): never {
  const code = error instanceof Error ? error.message : "";
  if (code === "CLASSROOM_REQUIRED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "教室への参加を完了してから利用してください。" });
  if (code === "WORD_BOOK_FORBIDDEN") throw new TRPCError({ code: "FORBIDDEN", message: "この単語帳を編集する権限がありません。" });
  if (code === "CLASSROOM_MANAGER_REQUIRED") throw new TRPCError({ code: "FORBIDDEN", message: "この操作は先生または教室管理者のみが実行できます。" });
  if (code === "GLOBAL_MANAGER_REQUIRED") throw new TRPCError({ code: "FORBIDDEN", message: "全体公開は全体管理者のみが実行できます。" });
  if (code === "DATABASE_UNAVAILABLE") throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "学習データを保存できません。時間をおいて再試行してください。" });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "処理を完了できませんでした。もう一度お試しください。" });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
