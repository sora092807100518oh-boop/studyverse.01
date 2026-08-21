import React, { useState } from "react";
import { Download } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { trpc } from "@/lib/trpc";

const chartConfig = {
  focusMinutes: { label: "学習時間（分）", color: "#66e8de" },
  accuracy: { label: "正答率（%）", color: "#baa3ff" },
} satisfies ChartConfig;

export type LearningTrendCsvPoint = { label: string; focusMinutes: number; accuracy: number; answers: number };

const escapeCsvValue = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export function buildLearningTrendCsv(period: "day" | "week" | "month", points: LearningTrendCsvPoint[]) {
  return ["期間,ラベル,学習時間（分）,正答率（%）,回答数", ...points.map(point => [period, point.label, point.focusMinutes, point.accuracy, point.answers].map(escapeCsvValue).join(","))].join("\r\n");
}

export function LearningTrendChart() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const trend = trpc.learning.trend.useQuery({ period }, { retry: false, staleTime: 30_000 });
  const downloadCsv = () => {
    const csv = buildLearningTrendCsv(period, trend.data ?? []);
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `studyverse-learning-trend-${period}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <section className="glass-card rounded-[26px] p-4"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">learning telemetry</p><h2 className="mt-1 text-base font-bold">学習の推移</h2><p className="mt-1 text-xs text-slate-400">学習時間と正答率を、保存済み記録から集計します。</p></div><div className="flex flex-col items-end gap-2"><div className="flex rounded-xl bg-slate-950/35 p-1">{([['day','日'],['week','週'],['month','月']] as const).map(([value,label]) => <button key={value} onClick={() => setPeriod(value)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${period === value ? "bg-cyan-200 text-slate-950" : "text-slate-400"}`}>{label}</button>)}</div><button type="button" onClick={downloadCsv} disabled={trend.isLoading || trend.isError} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200/25 px-2.5 py-1.5 text-[10px] font-bold text-cyan-100 disabled:opacity-50"><Download className="h-3.5 w-3.5" />CSV出力</button></div></div>{trend.isLoading ? <p className="mt-6 text-center text-xs text-slate-400">学習記録を集計しています…</p> : trend.isError ? <div className="mt-5 rounded-xl bg-red-400/10 p-3"><p className="text-xs text-red-100">学習グラフを取得できませんでした。</p><button onClick={() => void trend.refetch()} className="mt-2 text-xs font-bold text-red-100 underline">再試行</button></div> : <ChartContainer config={chartConfig} className="mt-5 h-52 w-full"><ComposedChart data={trend.data ?? []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.1)" /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} /><YAxis yAxisId="minutes" tickLine={false} axisLine={false} width={28} /><YAxis yAxisId="accuracy" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} width={28} /><ChartTooltip content={<ChartTooltipContent indicator="dot" />} /><Bar yAxisId="minutes" dataKey="focusMinutes" name="focusMinutes" fill="var(--color-focusMinutes)" radius={[5,5,0,0]} /><Line yAxisId="accuracy" type="monotone" dataKey="accuracy" name="accuracy" stroke="var(--color-accuracy)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-accuracy)" }} /></ComposedChart></ChartContainer>}</section>;
}
