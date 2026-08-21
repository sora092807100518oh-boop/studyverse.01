export type MonsterStudyRecord = { mode: "practice" | "test" | "journal" | "ai_select"; answeredAt: Date };
export type MonsterActivity = { action: string; details: string | null; createdAt: Date };
export type MissionReward = { missionKey: string; periodKey: string; points: number; label: string };

const TOKYO = "Asia/Tokyo";
export const DAILY_MISSIONS = [
  { key: "login", label: "ログインする" },
  { key: "ai-english", label: "AIセレクト10（英語）を解く" },
  { key: "ai-kanji", label: "AIセレクト10（漢字）を解く" },
  { key: "test", label: "テストモードでテストを受ける" },
  { key: "practice", label: "単語カードで練習をする" },
] as const;

export const MONTHLY_MISSIONS = [
  { key: "login-10", label: "月に10日ログインする", threshold: 10, metric: "loginDays" },
  { key: "login-15", label: "月に15日ログインする", threshold: 15, metric: "loginDays" },
  { key: "login-20", label: "月に20日ログインする", threshold: 20, metric: "loginDays" },
  { key: "login-25", label: "月に25日ログインする", threshold: 25, metric: "loginDays" },
  { key: "login-30", label: "月に30日ログインする", threshold: 30, metric: "loginDays" },
  { key: "streak-3", label: "3日連続でログインする", threshold: 3, metric: "streak" },
  { key: "streak-5", label: "5日連続でログインする", threshold: 5, metric: "streak" },
  { key: "streak-7", label: "7日連続でログインする", threshold: 7, metric: "streak" },
  { key: "streak-10", label: "10日連続でログインする", threshold: 10, metric: "streak" },
  { key: "streak-15", label: "15日連続でログインする", threshold: 15, metric: "streak" },
  { key: "saturday-3", label: "土曜日に3回ログインする", threshold: 3, metric: "saturdays" },
  { key: "sunday-3", label: "日曜日に3回ログインする", threshold: 3, metric: "sundays" },
  { key: "answers-50", label: "今月合計50問解く", threshold: 50, metric: "answers" },
  { key: "answers-100", label: "今月合計100問解く", threshold: 100, metric: "answers" },
  { key: "answers-200", label: "今月合計200問解く", threshold: 200, metric: "answers" },
  { key: "answers-300", label: "今月合計300問解く", threshold: 300, metric: "answers" },
  { key: "answers-500", label: "今月合計500問解く", threshold: 500, metric: "answers" },
  { key: "ai-3", label: "AIセレクト10を3回クリアする", threshold: 3, metric: "aiSelects" },
  { key: "ai-5", label: "AIセレクト10を5回クリアする", threshold: 5, metric: "aiSelects" },
  { key: "ai-10", label: "AIセレクト10を10回クリアする", threshold: 10, metric: "aiSelects" },
  { key: "ai-15", label: "AIセレクト10を15回クリアする", threshold: 15, metric: "aiSelects" },
  { key: "ai-20", label: "AIセレクト10を20回クリアする", threshold: 20, metric: "aiSelects" },
  { key: "ai-25", label: "AIセレクト10を25回クリアする", threshold: 25, metric: "aiSelects" },
  { key: "ai-30", label: "AIセレクト10を30回クリアする", threshold: 30, metric: "aiSelects" },
  { key: "daily-all-1", label: "デイリーミッションを1回全クリアする", threshold: 1, metric: "dailyCompletions" },
  { key: "daily-all-5", label: "デイリーミッションを5回全クリアする", threshold: 5, metric: "dailyCompletions" },
  { key: "daily-all-10", label: "デイリーミッションを10回全クリアする", threshold: 10, metric: "dailyCompletions" },
  { key: "daily-all-15", label: "デイリーミッションを15回全クリアする", threshold: 15, metric: "dailyCompletions" },
  { key: "daily-all-20", label: "デイリーミッションを20回全クリアする", threshold: 20, metric: "dailyCompletions" },
  { key: "daily-all-25", label: "デイリーミッションを25回全クリアする", threshold: 25, metric: "dailyCompletions" },
  { key: "daily-all-30", label: "デイリーミッションを30回全クリアする", threshold: 30, metric: "dailyCompletions" },
] as const;

type DailyFlags = Record<(typeof DAILY_MISSIONS)[number]["key"], boolean>;
const dateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TOKYO, year: "numeric", month: "2-digit", day: "2-digit" });
export function tokyoDay(date: Date) {
  const parts = dateFormat.formatToParts(date); const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function tokyoMonth(date: Date) { return tokyoDay(date).slice(0, 7); }
function addTokyoDays(day: string, offset: number) { const value = new Date(`${day}T00:00:00+09:00`); value.setUTCDate(value.getUTCDate() + offset); return tokyoDay(value); }
function weekday(day: string) { return new Date(`${day}T12:00:00+09:00`).getUTCDay(); }

export function calculateMonsterStage(focusSeconds: number, missionPoints: number) {
  const progressMinutes = Math.floor(focusSeconds / 60) + missionPoints;
  const stage = Math.min(13, Math.floor(progressMinutes / (20 * 60)) + 1);
  const withinStage = progressMinutes % (20 * 60);
  return { stage, progressMinutes, minutesToNext: stage === 13 ? 0 : 20 * 60 - withinStage, stageProgress: stage === 13 ? 100 : Math.round((withinStage / (20 * 60)) * 100) };
}

export function buildMissionState(input: { startedAt: Date; records: MonsterStudyRecord[]; activities: MonsterActivity[]; now?: Date }) {
  const now = input.now ?? new Date(); const today = tokyoDay(now); const month = tokyoMonth(now); const firstDay = tokyoDay(input.startedAt);
  const flagsByDay = new Map<string, DailyFlags>();
  const ensure = (day: string) => { const current = flagsByDay.get(day) ?? { login: false, "ai-english": false, "ai-kanji": false, test: false, practice: false }; flagsByDay.set(day, current); return current; };
  for (const activity of input.activities) { const day = tokyoDay(activity.createdAt); if (day < firstDay) continue; const flags = ensure(day); if (activity.action === "login.success") flags.login = true; if (activity.action === "ai_select.completed" && activity.details === "english") flags["ai-english"] = true; if (activity.action === "ai_select.completed" && activity.details === "kanji") flags["ai-kanji"] = true; }
  for (const record of input.records) { const day = tokyoDay(record.answeredAt); if (day < firstDay) continue; const flags = ensure(day); if (record.mode === "test") flags.test = true; if (record.mode === "practice") flags.practice = true; }
  const dailyRows: Array<{ day: string; flags: DailyFlags; complete: boolean }> = [];
  for (let day = firstDay; day <= today; day = addTokyoDays(day, 1)) { const flags = ensure(day); dailyRows.push({ day, flags, complete: DAILY_MISSIONS.every(mission => flags[mission.key]) }); }
  const todayRow = dailyRows.at(-1)!;
  const dailyRewards = dailyRows.flatMap(row => [
    ...DAILY_MISSIONS.filter(mission => row.flags[mission.key]).map(mission => ({ missionKey: `daily.${mission.key}`, periodKey: row.day, points: 1, label: `${row.day}｜${mission.label}` })),
    ...(row.complete ? [{ missionKey: "daily.bonus", periodKey: row.day, points: 5, label: `${row.day}｜デイリー全達成ボーナス` }] : []),
  ]);
  const monthLogins = new Set(input.activities.filter(activity => activity.action === "login.success" && tokyoMonth(activity.createdAt) === month && tokyoDay(activity.createdAt) >= firstDay).map(activity => tokyoDay(activity.createdAt)));
  const monthRecords = input.records.filter(record => tokyoMonth(record.answeredAt) === month && tokyoDay(record.answeredAt) >= firstDay);
  const monthAiSelects = input.activities.filter(activity => activity.action === "ai_select.completed" && tokyoMonth(activity.createdAt) === month && tokyoDay(activity.createdAt) >= firstDay).length;
  let longestStreak = 0; let currentStreak = 0;
  for (let day = firstDay; day <= today; day = addTokyoDays(day, 1)) { if (monthLogins.has(day)) { currentStreak += 1; longestStreak = Math.max(longestStreak, currentStreak); } else currentStreak = 0; }
  const loginDays = Array.from(monthLogins);
  const metrics = { loginDays: monthLogins.size, streak: longestStreak, saturdays: loginDays.filter(day => weekday(day) === 6).length, sundays: loginDays.filter(day => weekday(day) === 0).length, answers: monthRecords.length, aiSelects: monthAiSelects, dailyCompletions: dailyRows.filter(row => tokyoMonth(new Date(`${row.day}T00:00:00+09:00`)) === month && row.complete).length };
  const monthly = MONTHLY_MISSIONS.map(mission => ({ ...mission, value: metrics[mission.metric], complete: metrics[mission.metric] >= mission.threshold }));
  const monthlyRewards: MissionReward[] = [
    ...monthly.filter(mission => mission.complete).map(mission => ({ missionKey: `monthly.${mission.key}`, periodKey: month, points: 1, label: mission.label })),
    ...(monthly.every(mission => mission.complete) ? [{ missionKey: "monthly.bonus", periodKey: month, points: 30, label: "マンスリー全達成ボーナス" }] : []),
  ];
  return { today, month, daily: { missions: DAILY_MISSIONS.map(mission => ({ ...mission, complete: todayRow.flags[mission.key] })), complete: todayRow.complete, progress: DAILY_MISSIONS.filter(mission => todayRow.flags[mission.key]).length, rewards: dailyRewards }, monthly: { missions: monthly, metrics, complete: monthly.every(mission => mission.complete), progress: monthly.filter(mission => mission.complete).length, rewards: monthlyRewards }, rewards: [...dailyRewards, ...monthlyRewards] };
}
