import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addWordToWordbook, createWordbook, getLearningSummary, listVisibleWordbooks, recordFocusSession, recordLearningResult } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

function toUserMessage(error: unknown): never {
  const code = error instanceof Error ? error.message : "";
  if (code === "CLASSROOM_REQUIRED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "教室への参加を完了してから利用してください。" });
  if (code === "WORD_BOOK_FORBIDDEN") throw new TRPCError({ code: "FORBIDDEN", message: "この単語帳を編集する権限がありません。" });
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
});

export type AppRouter = typeof appRouter;
