import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addPersonalClassroomCode, addWordToWordbook, authenticateWithPin, claimAnnouncementRecommendedTest, claimRecommendedWordbook, claimAvailableMonsterMissions, claimMonsterMission, createAnnouncement, createCalendarEvent, createClassroom, createPinAccount, createRecommendedTest, createSiteAdminSession, createTeacherAdminSession, createWordbook, deleteAnnouncement, deleteClassroom, deletePersonalCalendarEvent, deleteRecommendedTest, deleteVocabularyWord, deleteWordbook, downloadVisibleWordbookCsv, exportWordbookCsv, getClassroomMemberDetail, getSmartNotificationSettings, saveSmartNotificationSettings, saveSmartNotificationSubscription, sendSmartNotificationNow, setSmartNotificationTaskUid, getLearningDashboard, getLearningSummary, getLearningTrend, getManagementInsights, getMonsterDashboard, getPinSession, getTeacherAdminSession, getWordbookCreationPolicy, importWordbookCsv, listAnnouncementHistory, listAnnouncementRecommendedTests, listClassroomMembers, listClassroomsForUser, listManageableAnnouncements, listManageableRecommendedTests, listManageableWordbooks, listMonsterImageSettings, listPersonalClassroomCodes, removePersonalClassroomCode, listRecommendedTestsForLearner, listReviewWords, listVisibleAnnouncements, listVisibleCalendarEvents, listVisibleWordbooks, previewWordbookCsv, recordAiSelectCompletion, recordFocusSession, recordLearningResult, resetPinForProfile, revokePinSession, revokeSiteAdminSession, revokeTeacherAdminSession,     setWordbookCreationDisabled, startNewMonster, updateAnnouncement, updateClassroom, updateVocabularyWord, updateWordbook, uploadMonsterImage, uploadVocabularyWordImage } from "./db";
import { deleteSavedStudySet, getCalendarDashboard, listClassroomOnlineStatus, listSavedStudySets, listVocabularyWordNotes, resetRevivalTickets, saveStudySet, saveVocabularyWordNote, updateOwnDisplayName, uploadOwnAvatar, useRevivalTicket } from "./db";
import { verifySiteAdminPassword } from "./site-admin-auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

function toUserMessage(error: unknown): never {
  const code = error instanceof Error ? error.message : "";
  if (code === "CLASSROOM_REQUIRED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "教室への参加を完了してから利用してください。" });
  if (code === "WORD_BOOK_FORBIDDEN") throw new TRPCError({ code: "FORBIDDEN", message: "この単語帳を編集する権限がありません。" });
  if (code === "INVALID_CLASSROOM_CODE") throw new TRPCError({ code: "BAD_REQUEST", message: "個人利用コードは英数字とハイフンの3〜32文字で入力してください。" });
  if (code === "CLASSROOM_CODE_ALREADY_USED") throw new TRPCError({ code: "CONFLICT", message: "そのコードは既存の教室で使用されています。" });
  if (code === "WORD_BOOK_NOT_FOUND" || code === "ANNOUNCEMENT_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "指定された情報が見つかりません。" });
  if (code === "CLASSROOM_MANAGER_REQUIRED") throw new TRPCError({ code: "FORBIDDEN", message: "この操作は先生または教室管理者のみが実行できます。" });
  if (code === "MEMBER_DETAIL_FORBIDDEN") throw new TRPCError({ code: "FORBIDDEN", message: "この利用者の詳細を閲覧する権限がありません。" });
  if (code === "MEMBER_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "対象の利用者が見つかりません。" });
  if (code === "GLOBAL_MANAGER_REQUIRED") throw new TRPCError({ code: "FORBIDDEN", message: "全体公開は全体管理者のみが実行できます。" });
  if (code === "RECOMMENDED_TEST_NOT_AVAILABLE") throw new TRPCError({ code: "BAD_REQUEST", message: "この教材の受取期間は終了しています。" });
  if (code === "TEST_PERIOD_REQUIRED") throw new TRPCError({ code: "BAD_REQUEST", message: "お知らせ配布では表示終了日時を設定してください。" });
  if (code === "TEST_PERIOD_INVALID") throw new TRPCError({ code: "BAD_REQUEST", message: "表示終了日時は表示開始日時より後に設定してください。" });
  if (code === "WORD_BOOK_DELIVERY_RANGE_INVALID") throw new TRPCError({ code: "BAD_REQUEST", message: "単語帳配布では単語帳全体を選択してください。" });
  if (code === "WORDBOOK_CREATION_DISABLED") throw new TRPCError({ code: "FORBIDDEN", message: "現在、利用者による新しい単語帳の作成は停止されています。" });
  if (code === "PIN_RATE_LIMITED") throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "ログイン試行が多すぎます。15分ほど待ってから再試行してください。" });
  if (code === "INVALID_PIN_LOGIN") throw new TRPCError({ code: "UNAUTHORIZED", message: "PINまたは教室コードが正しくありません。" });
  if (code === "TEACHER_ID_NOT_FOUND") throw new TRPCError({ code: "UNAUTHORIZED", message: "先生IDが正しくないか、担当教室が設定されていません。" });
  if (code === "PROFILE_NOT_FOUND" || code === "CLASSROOM_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "指定された情報が見つかりません。" });
  if (code === "CALENDAR_EVENT_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "指定された予定が見つかりません。" });
  if (code === "CALENDAR_EVENT_FORBIDDEN") throw new TRPCError({ code: "FORBIDDEN", message: "この予定を削除する権限がありません。" });
  if (code === "MONSTER_MISSION_NOT_READY") throw new TRPCError({ code: "BAD_REQUEST", message: "このミッションはまだ達成されていません。" });
  if (code === "MONSTER_MISSION_ALREADY_CLAIMED") throw new TRPCError({ code: "CONFLICT", message: "この報酬はすでに受け取っています。" });
  if (code === "MONSTER_NOT_COMPLETE") throw new TRPCError({ code: "BAD_REQUEST", message: "最終進化に達してから新しいモンスターを育成できます。" });
  if (code === "MONSTER_EGG_UNAVAILABLE") throw new TRPCError({ code: "BAD_REQUEST", message: "選択した卵を持っていません。" });
  if (code === "MONSTER_CYCLE_ORDER_REQUIRED") throw new TRPCError({ code: "BAD_REQUEST", message: "周回育成は卵1、卵2、卵3の順で始めてください。" });
  if (code === "MONSTER_IMAGE_INVALID") throw new TRPCError({ code: "BAD_REQUEST", message: "画像は5MB以下のPNG・JPEG・WebPを指定してください。" });
  if (code === "PROFILE_IMAGE_INVALID") throw new TRPCError({ code: "BAD_REQUEST", message: "プロフィール画像は3MB以下のPNG・JPEG・WebPを指定してください。" });
  if (code === "DATABASE_UNAVAILABLE") throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "学習データを保存できません。時間をおいて再試行してください。" });
  if (code === "CSV_INVALID_ROWS") throw new TRPCError({ code: "BAD_REQUEST", message: "形式が正しくない行があります。プレビューを確認して修正してください。" });
  if (code === "CSV_LIMIT_EXCEEDED") throw new TRPCError({ code: "BAD_REQUEST", message: "CSVは3,000行以内にしてください。" });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "処理を完了できませんでした。もう一度お試しください。" });
}

export function getRequestCookie(cookieHeader: string | undefined, name: string) {
  return (cookieHeader ?? "").split(";").map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

export const appRouter = router({
  studySets: router({
    list: protectedProcedure.query(async ({ ctx }) => listSavedStudySets(ctx.user.id)),
    create: protectedProcedure.input(z.object({ wordbookId: z.number().int().positive(), rangeStart: z.number().int().positive(), rangeEnd: z.number().int().positive(), label: z.string().trim().max(160).optional() })).mutation(async ({ ctx, input }) => {
      try { return await saveStudySet(ctx.user.id, { ...input, label: input.label ?? "" }); } catch (error) { return toUserMessage(error); }
    }),
    delete: protectedProcedure.input(z.object({ savedStudySetId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await deleteSavedStudySet(ctx.user.id, input.savedStudySetId); return { success: true }; }),
  }),
  profile: router({
    updateName: protectedProcedure.input(z.object({ displayName: z.string().trim().min(1).max(80) })).mutation(async ({ ctx, input }) => { try { return await updateOwnDisplayName(ctx.user.id, input.displayName); } catch (error) { return toUserMessage(error); } }),
    uploadAvatar: protectedProcedure.input(z.object({ dataUrl: z.string().max(4_500_000) })).mutation(async ({ ctx, input }) => { try { return await uploadOwnAvatar(ctx.user.id, input.dataUrl); } catch (error) { return toUserMessage(error); } }),
  }),
  wordNotes: router({
    list: protectedProcedure.query(async ({ ctx }) => { try { return await listVocabularyWordNotes(ctx.user.id); } catch (error) { return toUserMessage(error); } }),
    save: protectedProcedure.input(z.object({ wordId: z.number().int().positive(), note: z.string().max(500) })).mutation(async ({ ctx, input }) => { try { return await saveVocabularyWordNote(ctx.user.id, input.wordId, input.note); } catch (error) { return toUserMessage(error); } }),
  }),
  calendar: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => getCalendarDashboard(ctx.user.id)),
    useRevivalTicket: protectedProcedure.input(z.object({ dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).mutation(async ({ ctx, input }) => { try { await useRevivalTicket(ctx.user.id, input.dateKey); return { success: true }; } catch (error) { return toUserMessage(error); } }),
  }),
  smartNotifications: router({
    publicKey: protectedProcedure.query(() => ({ publicKey: ENV.vapidPublicKey })),
    settings: protectedProcedure.query(async ({ ctx }) => getSmartNotificationSettings(ctx.user.id)),
    subscribe: protectedProcedure.input(z.object({ endpoint: z.string().url().max(2048), keys: z.record(z.string(), z.string()).optional() })).mutation(async ({ ctx, input }) => { try { return await saveSmartNotificationSubscription(ctx.user.id, input); } catch (error) { return toUserMessage(error); } }),
    save: protectedProcedure.input(z.object({ wordbookId: z.number().int().positive(), direction: z.enum(["question", "answer"]), enabled: z.boolean(), startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/) })).mutation(async ({ ctx, input }) => {
      try {
        const current = await getSmartNotificationSettings(ctx.user.id);
        const saved = await saveSmartNotificationSettings(ctx.user.id, input);
        const sessionToken = getRequestCookie(ctx.req.headers.cookie, "app_session_id") ?? "";
        if (input.enabled) {
          if (current?.scheduleCronTaskUid) await updateHeartbeatJob(current.scheduleCronTaskUid, { enable: true, cron: "0 0 * * * *", path: "/api/scheduled/smart-notifications" }, sessionToken);
          else {
            const job = await createHeartbeatJob({ name: `smart-notifications-${ctx.user.id}`, cron: "0 0 * * * *", path: "/api/scheduled/smart-notifications", description: "StudyVerse smart notification learning" }, sessionToken);
            await setSmartNotificationTaskUid(ctx.user.id, job.taskUid);
          }
        } else if (current?.scheduleCronTaskUid) await updateHeartbeatJob(current.scheduleCronTaskUid, { enable: false }, sessionToken);
        return getSmartNotificationSettings(ctx.user.id);
      } catch (error) { return toUserMessage(error); }
    }),
    sendTest: protectedProcedure.mutation(async ({ ctx }) => {
      try { return await sendSmartNotificationNow(ctx.user.id); }
      catch (error) {
        console.error("[SmartNotification] immediate delivery failed", { userId: ctx.user.id, error });
        if (error instanceof Error && error.message === "DATABASE_UNAVAILABLE") return toUserMessage(error);
        throw new TRPCError({ code: "BAD_GATEWAY", message: "通知を送信できませんでした。通知設定と端末の通知許可を確認して、もう一度お試しください。" });
      }
    }),
  }),
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
    wordbookCreationPolicy: protectedProcedure.query(async () => getWordbookCreationPolicy()),
    setWordbookCreationDisabled: protectedProcedure.input(z.object({ disabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      try { return await setWordbookCreationDisabled(ctx.user.id, input.disabled); } catch (error) { return toUserMessage(error); }
    }),
    personalClassroomCodes: router({
      list: protectedProcedure.query(async ({ ctx }) => { try { return await listPersonalClassroomCodes(ctx.user.id); } catch (error) { return toUserMessage(error); } }),
      add: protectedProcedure.input(z.object({ code: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9-]+$/) })).mutation(async ({ ctx, input }) => { try { return await addPersonalClassroomCode(ctx.user.id, input.code); } catch (error) { return toUserMessage(error); } }),
      remove: protectedProcedure.input(z.object({ code: z.string().trim().min(3).max(32) })).mutation(async ({ ctx, input }) => { try { return await removePersonalClassroomCode(ctx.user.id, input.code); } catch (error) { return toUserMessage(error); } }),
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const token = getRequestCookie(ctx.req.headers.cookie, "studyverse_admin");
      if (token) await revokeSiteAdminSession(token);
      const options = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie("studyverse_admin", { ...options, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  teacherAdmin: router({
    login: publicProcedure.input(z.object({ teacherId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const session = await createTeacherAdminSession(input.teacherId);
        const options = getSessionCookieOptions(ctx.req);
        ctx.res.cookie("studyverse_teacher", session.token, { ...options, maxAge: 8 * 60 * 60 * 1000 });
        return { teacher: { id: session.user.id, name: session.user.name, classroomId: session.classroom.id, classroomName: session.classroom.name, classroomCode: session.classroom.code }, expiresAt: session.expiresAt };
      } catch (error) { return toUserMessage(error); }
    }),
    me: publicProcedure.query(async ({ ctx }) => {
      const token = ctx.req.cookies?.studyverse_teacher as string | undefined;
      if (!token) return null;
      const session = await getTeacherAdminSession(token);
      return session ? { teacher: { id: session.user.id, name: session.user.name, classroomId: session.classroom.id, classroomName: session.classroom.name, classroomCode: session.classroom.code } } : null;
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const token = getRequestCookie(ctx.req.headers.cookie, "studyverse_teacher");
      if (token) await revokeTeacherAdminSession(token);
      const options = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie("studyverse_teacher", { ...options, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const pinToken = getRequestCookie(ctx.req.headers.cookie, "studyverse_pin");
      const adminToken = getRequestCookie(ctx.req.headers.cookie, "studyverse_admin");
      const teacherToken = getRequestCookie(ctx.req.headers.cookie, "studyverse_teacher");
      if (pinToken) await revokePinSession(pinToken);
      if (adminToken) await revokeSiteAdminSession(adminToken);
      if (teacherToken) await revokeTeacherAdminSession(teacherToken);
      ctx.res.clearCookie("studyverse_pin", { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie("studyverse_admin", { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie("studyverse_teacher", { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    pinLogin: publicProcedure.input(z.object({ pin: z.string().regex(/^\d{4}$/), classroomCode: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9-]+$/), personalClientId: z.string().trim().min(16).max(128).optional() })).mutation(async ({ ctx, input }) => {
      try {
        const fingerprint = ctx.req.ip ?? ctx.req.socket.remoteAddress ?? "unknown";
        const result = await authenticateWithPin({ ...input, clientFingerprint: fingerprint });
        const options = getSessionCookieOptions(ctx.req);
        ctx.res.cookie("studyverse_pin", result.token, { ...options, maxAge: 30 * 24 * 60 * 60 * 1000 });
        return { profile: result.profile, classroom: result.classroom, expiresAt: result.expiresAt };
      } catch (error) { return toUserMessage(error); }
    }),
    pinMe: publicProcedure.query(async ({ ctx }) => {
      const token = getRequestCookie(ctx.req.headers.cookie, "studyverse_pin");
      if (!token) return null;
      const result = await getPinSession(token);
      if (!result) return null;
      return { profile: { id: result.profile.id, userId: result.profile.userId, displayName: result.profile.displayName, avatarUrl: result.profile.avatarUrl, classroomRole: result.profile.classroomRole }, classroom: { id: result.classroom.id, code: result.classroom.code, name: result.classroom.name } };
    }),
    pinLogout: publicProcedure.mutation(async ({ ctx }) => {
      const token = getRequestCookie(ctx.req.headers.cookie, "studyverse_pin");
      if (token) await revokePinSession(token);
      const options = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie("studyverse_pin", { ...options, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  learning: router({
    summary: protectedProcedure.query(async ({ ctx }) => getLearningSummary(ctx.user.id)),
    dashboard: protectedProcedure.query(async ({ ctx }) => getLearningDashboard(ctx.user.id)),
    saveFocusSession: protectedProcedure.input(z.object({ clientSessionId: z.string().trim().min(8).max(96), startedAt: z.date(), completedAt: z.date(), focusSeconds: z.number().int().min(1).max(4 * 60 * 60) })).mutation(async ({ ctx, input }) => {
      try { const result = await recordFocusSession(ctx.user.id, input); return { success: true, ...result }; } catch (error) { return toUserMessage(error); }
    }),
    recordAnswer: protectedProcedure.input(z.object({ wordId: z.number().int().positive().optional(), mode: z.enum(["practice", "test", "journal", "ai_select"]), isCorrect: z.boolean(), practiceRating: z.enum(["known", "review", "instant", "slow"]).optional() })).mutation(async ({ ctx, input }) => {
      try { await recordLearningResult(ctx.user.id, input); return { success: true }; } catch (error) { return toUserMessage(error); }
    }),
    completeAiSelect: protectedProcedure.input(z.object({ subject: z.enum(["english", "kanji"]) })).mutation(async ({ ctx, input }) => {
      try { await recordAiSelectCompletion(ctx.user.id, input.subject); return { success: true }; } catch (error) { return toUserMessage(error); }
    }),
    review: protectedProcedure.query(async ({ ctx }) => {
      try { return await listReviewWords(ctx.user.id); } catch (error) { return toUserMessage(error); }
    }),
    trend: protectedProcedure.input(z.object({ period: z.enum(["day", "week", "month"]) })).query(async ({ ctx, input }) => {
      try { return await getLearningTrend(ctx.user.id, input.period); } catch (error) { return toUserMessage(error); }
    }),
  }),
  management: router({
    insights: protectedProcedure.query(async ({ ctx }) => {
      try { return await getManagementInsights(ctx.user.id); } catch (error) { return toUserMessage(error); }
    }),
  }),
  monster: router({
    images: protectedProcedure.query(async ({ ctx }) => {
      try { return await listMonsterImageSettings(ctx.user.id); } catch (error) { return toUserMessage(error); }
    }),
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      try { return await getMonsterDashboard(ctx.user.id); } catch (error) { return toUserMessage(error); }
    }),
    claim: protectedProcedure.input(z.object({ missionKey: z.string().min(1).max(96), periodKey: z.string().min(1).max(16) })).mutation(async ({ ctx, input }) => {
      try { return await claimMonsterMission(ctx.user.id, input.missionKey, input.periodKey); } catch (error) { return toUserMessage(error); }
    }),
    claimAll: protectedProcedure.mutation(async ({ ctx }) => {
      try { return await claimAvailableMonsterMissions(ctx.user.id); } catch (error) { return toUserMessage(error); }
    }),
    startNew: protectedProcedure.input(z.object({ eggNumber: z.enum(["1", "2", "3"]) })).mutation(async ({ ctx, input }) => {
      try { return await startNewMonster(ctx.user.id, input.eggNumber); } catch (error) { return toUserMessage(error); }
    }),
    uploadImage: protectedProcedure.input(z.object({ slotKey: z.string().regex(/^(?:egg-[1-3]|evolution-(?:[1-9]|1[0-3])|monster-[1-3]-egg|monster-[1-3]-evolution-(?:[1-9]|1[0-3]))$/), imageType: z.enum(["egg", "evolution"]), eggNumber: z.number().int().min(1).max(3).optional(), evolutionStage: z.number().int().min(1).max(13).optional(), dataUrl: z.string().max(7_000_000) })).mutation(async ({ ctx, input }) => {
      try { return await uploadMonsterImage(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
    }),
  }),
  wordbooks: router({
    list: protectedProcedure.input(z.object({ subject: z.enum(["english", "kanji"]).optional() }).optional()).query(async ({ ctx, input }) => listVisibleWordbooks(ctx.user.id, input?.subject)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(160), subject: z.enum(["english", "kanji"]), visibility: z.enum(["private", "classroom", "global"]).default("private"), classroomId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      try { return await createWordbook(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
    }),
    addWord: protectedProcedure.input(z.object({ wordbookId: z.number().int().positive(), front: z.string().trim().min(1).max(500), back: z.string().trim().min(1).max(500), reading: z.string().trim().max(500).optional(), source: z.enum(["manual", "csv", "admin"]).optional() })).mutation(async ({ ctx, input }) => {
      try { return await addWordToWordbook(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
    }),
    updateWord: protectedProcedure.input(z.object({ vocabularyWordId: z.number().int().positive(), front: z.string().trim().min(1).max(500).optional(), back: z.string().trim().min(1).max(500).optional(), reading: z.string().trim().max(500).nullable().optional(), imageUrl: z.string().max(2048).refine(value => /^https?:\/\//i.test(value) || value.startsWith("/manus-storage/"), "Invalid URL").nullable().optional(), exampleSentence: z.string().trim().max(1200).nullable().optional(), exampleTranslation: z.string().trim().max(1200).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const { vocabularyWordId, ...update } = input;
      try { await updateVocabularyWord(ctx.user.id, vocabularyWordId, update); return { success: true }; } catch (error) { return toUserMessage(error); }
    }),
    uploadImage: protectedProcedure.input(z.object({ vocabularyWordId: z.number().int().positive(), dataUrl: z.string().max(7_000_000) })).mutation(async ({ ctx, input }) => {
      try { return await uploadVocabularyWordImage(ctx.user.id, input.vocabularyWordId, input.dataUrl); } catch (error) { return toUserMessage(error); }
    }),
    deleteWord: protectedProcedure.input(z.object({ vocabularyWordId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { await deleteVocabularyWord(ctx.user.id, input.vocabularyWordId); return { success: true }; } catch (error) { return toUserMessage(error); }
    }),
    previewCsv: protectedProcedure.input(z.object({ wordbookId: z.number().int().positive(), csvText: z.string().min(1).max(2_000_000) })).mutation(async ({ ctx, input }) => {
      try { return await previewWordbookCsv(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
    }),
    importCsv: protectedProcedure.input(z.object({ wordbookId: z.number().int().positive(), csvText: z.string().min(1).max(2_000_000) })).mutation(async ({ ctx, input }) => {
      try { return await importWordbookCsv(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
    }),
    exportCsv: protectedProcedure.input(z.object({ wordbookId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { return await exportWordbookCsv(ctx.user.id, input.wordbookId); } catch (error) { return toUserMessage(error); }
    }),
    downloadCsv: protectedProcedure.input(z.object({ wordbookId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { return await downloadVisibleWordbookCsv(ctx.user.id, input.wordbookId); } catch (error) { return toUserMessage(error); }
    }),
    managed: protectedProcedure.query(async ({ ctx }) => {
      try { return await listManageableWordbooks(ctx.user.id); } catch (error) { return toUserMessage(error); }
    }),
    update: protectedProcedure.input(z.object({ wordbookId: z.number().int().positive(), title: z.string().trim().min(1).max(160).optional(), visibility: z.enum(["private", "classroom"]).optional() })).mutation(async ({ ctx, input }) => {
      const { wordbookId, ...update } = input;
      try { await updateWordbook(ctx.user.id, wordbookId, update); return { success: true }; } catch (error) { return toUserMessage(error); }
    }),
    delete: protectedProcedure.input(z.object({ wordbookId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { await deleteWordbook(ctx.user.id, input.wordbookId); return { success: true }; } catch (error) { return toUserMessage(error); }
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
      delete: protectedProcedure.input(z.object({ classroomId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try { return await deleteClassroom(ctx.user.id, input.classroomId); } catch (error) { return toUserMessage(error); }
      }),
    }),
    members: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        try { return await listClassroomMembers(ctx.user.id); } catch (error) { return toUserMessage(error); }
      }),
      detail: protectedProcedure.input(z.object({ profileId: z.number().int().positive() })).query(async ({ ctx, input }) => {
        try { return await getClassroomMemberDetail(ctx.user.id, input.profileId); } catch (error) { return toUserMessage(error); }
      }),
      createPinAccount: protectedProcedure.input(z.object({ classroomId: z.number().int().positive(), displayName: z.string().trim().min(1).max(80), pin: z.string().regex(/^\d{4}$/), classroomRole: z.enum(["student", "teacher", "owner"]).optional() })).mutation(async ({ ctx, input }) => {
        try { return await createPinAccount(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
      }),
      resetPin: protectedProcedure.input(z.object({ profileId: z.number().int().positive(), pin: z.string().regex(/^\d{4}$/) })).mutation(async ({ ctx, input }) => {
        try { await resetPinForProfile(ctx.user.id, input); return { success: true }; } catch (error) { return toUserMessage(error); }
      }),
      resetRevivalTickets: protectedProcedure.input(z.object({ profileId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try { return await resetRevivalTickets(ctx.user.id, input.profileId); } catch (error) { return toUserMessage(error); }
      }),
    }),
    online: router({
      list: protectedProcedure.query(async ({ ctx }) => { try { return await listClassroomOnlineStatus(ctx.user.id); } catch (error) { return toUserMessage(error); } }),
      ping: protectedProcedure.mutation(() => ({ online: true, at: new Date() })),
    }),
    announcements: router({
      list: protectedProcedure.query(async ({ ctx }) => listVisibleAnnouncements(ctx.user.id)),
      manage: protectedProcedure.query(async ({ ctx }) => {
        try { return await listManageableAnnouncements(ctx.user.id); } catch (error) { return toUserMessage(error); }
      }),
      history: protectedProcedure.query(async ({ ctx }) => {
        try { return await listAnnouncementHistory(ctx.user.id); } catch (error) { return toUserMessage(error); }
      }),
      create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(5000), visibility: z.enum(["classroom", "global"]).default("classroom"), classroomId: z.number().int().positive().optional(), scheduledAt: z.date().optional(), expiresAt: z.date().optional() })).mutation(async ({ ctx, input }) => {
        try { return await createAnnouncement(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
      }),
      update: protectedProcedure.input(z.object({ announcementId: z.number().int().positive(), title: z.string().trim().min(1).max(160).optional(), body: z.string().trim().min(1).max(5000).optional(), visibility: z.enum(["classroom", "global"]).optional(), classroomId: z.number().int().positive().optional(), scheduledAt: z.date().nullable().optional(), expiresAt: z.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
        const { announcementId, ...update } = input;
        try { await updateAnnouncement(ctx.user.id, announcementId, update); return { success: true }; } catch (error) { return toUserMessage(error); }
      }),
      delete: protectedProcedure.input(z.object({ announcementId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try { await deleteAnnouncement(ctx.user.id, input.announcementId); return { success: true }; } catch (error) { return toUserMessage(error); }
      }),
    }),
    calendar: router({
      list: protectedProcedure.query(async ({ ctx }) => listVisibleCalendarEvents(ctx.user.id)),
      create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(160), startsAt: z.date(), endsAt: z.date().optional(), visibility: z.enum(["personal", "classroom", "global"]).default("classroom") })).mutation(async ({ ctx, input }) => {
        if (input.endsAt && input.endsAt < input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "終了時刻は開始時刻より後にしてください。" });
        try { return await createCalendarEvent(ctx.user.id, input); } catch (error) { return toUserMessage(error); }
      }),
      deletePersonal: protectedProcedure.input(z.object({ calendarEventId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try { await deletePersonalCalendarEvent(ctx.user.id, input.calendarEventId); return { success: true }; } catch (error) { return toUserMessage(error); }
      }),
    }),
    recommendedTests: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        try { return await listRecommendedTestsForLearner(ctx.user.id); } catch (error) { return toUserMessage(error); }
      }),
      announcements: protectedProcedure.query(async ({ ctx }) => {
        try { return await listAnnouncementRecommendedTests(ctx.user.id); } catch (error) { return toUserMessage(error); }
      }),
      manage: protectedProcedure.query(async ({ ctx }) => {
        try { return await listManageableRecommendedTests(ctx.user.id); } catch (error) { return toUserMessage(error); }
      }),
      create: protectedProcedure.input(z.object({ wordbookId: z.number().int().positive(), rangeStart: z.number().int().positive(), rangeEnd: z.number().int().positive(), questionCount: z.number().int().positive(), deliveryMode: z.enum(["normal", "announcement"]).default("normal"), deliveryType: z.enum(["test", "wordbook"]).default("test"), classroomId: z.number().int().positive().optional(), allClassrooms: z.boolean().optional(), availableFrom: z.date().optional(), availableUntil: z.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
        try { return await createRecommendedTest(ctx.user.id, { ...input, availableUntil: input.availableUntil ?? undefined }); } catch (error) { return toUserMessage(error); }
      }),
      claim: protectedProcedure.input(z.object({ recommendedTestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try { return await claimAnnouncementRecommendedTest(ctx.user.id, input.recommendedTestId); } catch (error) { return toUserMessage(error); }
      }),
      claimWordbook: protectedProcedure.input(z.object({ recommendedTestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try { return await claimRecommendedWordbook(ctx.user.id, input.recommendedTestId); } catch (error) { return toUserMessage(error); }
      }),
      delete: protectedProcedure.input(z.object({ recommendedTestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try { await deleteRecommendedTest(ctx.user.id, input.recommendedTestId); return { success: true }; } catch (error) { return toUserMessage(error); }
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
