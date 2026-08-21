import React, { useState } from "react";
import { Download } from "lucide-react";
import { jsPDF } from "jspdf";
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

export function buildLearningTrendPdfImage(period: "day" | "week" | "month", points: LearningTrendCsvPoint[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600; canvas.height = 1000;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF_CANVAS_UNAVAILABLE");
  const label = { day: "日別", week: "週別", month: "月別" }[period];
  const palette = { background: "#081227", panel: "#102544", grid: "#2a476b", text: "#eef8ff", muted: "#aabfd7", cyan: "#6ee7df", violet: "#c4b5fd" };
  context.fillStyle = palette.background; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = palette.panel; context.fillRect(60, 60, 1480, 860);
  context.fillStyle = palette.cyan; context.font = "700 28px sans-serif"; context.fillText("STUDYVERSE  LEARNING TELEMETRY", 110, 130);
  context.fillStyle = palette.text; context.font = "700 52px sans-serif"; context.fillText(`学習の推移（${label}）`, 110, 205);
  context.fillStyle = palette.muted; context.font = "28px sans-serif"; context.fillText("学習時間（分）と正答率（%）を保存済み記録から集計", 110, 250);
  const chart = { left: 130, top: 320, width: 1340, height: 350, bottom: 670 };
  const maximumMinutes = Math.max(1, ...points.map(point => point.focusMinutes));
  context.strokeStyle = palette.grid; context.lineWidth = 2;
  for (let index = 0; index <= 4; index += 1) { const y = chart.top + chart.height * index / 4; context.beginPath(); context.moveTo(chart.left, y); context.lineTo(chart.left + chart.width, y); context.stroke(); }
  const gap = chart.width / Math.max(1, points.length); const barWidth = Math.min(76, gap * 0.48);
  context.font = "20px sans-serif"; context.textAlign = "center";
  const accuracyPoints: Array<{ x: number; y: number }> = [];
  points.forEach((point, index) => {
    const x = chart.left + gap * (index + .5); const height = Math.max(0, (point.focusMinutes / maximumMinutes) * chart.height);
    context.fillStyle = palette.cyan; context.fillRect(x - barWidth / 2, chart.bottom - height, barWidth, height);
    accuracyPoints.push({ x, y: chart.bottom - Math.max(0, Math.min(100, point.accuracy)) / 100 * chart.height });
    context.fillStyle = palette.muted; context.fillText(point.label, x, chart.bottom + 34);
  });
  if (accuracyPoints.length) { context.strokeStyle = palette.violet; context.lineWidth = 8; context.lineJoin = "round"; context.beginPath(); accuracyPoints.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke(); context.fillStyle = palette.violet; accuracyPoints.forEach(point => { context.beginPath(); context.arc(point.x, point.y, 7, 0, Math.PI * 2); context.fill(); }); }
  context.textAlign = "left"; context.fillStyle = palette.cyan; context.fillRect(110, 750, 28, 12); context.fillStyle = palette.text; context.font = "24px sans-serif"; context.fillText("学習時間（分）", 150, 763); context.fillStyle = palette.violet; context.fillRect(390, 750, 28, 12); context.fillStyle = palette.text; context.fillText("正答率（%）", 430, 763);
  context.fillStyle = palette.muted; context.font = "22px sans-serif"; context.fillText(`出力日時：${new Date().toLocaleString("ja-JP")}　　合計回答数：${points.reduce((sum, point) => sum + point.answers, 0)}件`, 110, 850);
  return canvas.toDataURL("image/png");
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
  const downloadPdf = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    pdf.addImage(buildLearningTrendPdfImage(period, trend.data ?? []), "PNG", 0, 0, 297, 210);
    pdf.save(`studyverse-learning-trend-${period}.pdf`);
  };
  return <section className="glass-card rounded-[26px] p-4"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">learning telemetry</p><h2 className="mt-1 text-base font-bold">学習の推移</h2><p className="mt-1 text-xs text-slate-400">学習時間と正答率を、保存済み記録から集計します。</p></div><div className="flex flex-col items-end gap-2"><div className="flex rounded-xl bg-slate-950/35 p-1">{([['day','日'],['week','週'],['month','月']] as const).map(([value,label]) => <button key={value} onClick={() => setPeriod(value)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${period === value ? "bg-cyan-200 text-slate-950" : "text-slate-400"}`}>{label}</button>)}</div><div className="flex gap-1"><button type="button" onClick={downloadCsv} disabled={trend.isLoading || trend.isError} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200/25 px-2.5 py-1.5 text-[10px] font-bold text-cyan-100 disabled:opacity-50"><Download className="h-3.5 w-3.5" />CSV出力</button><button type="button" onClick={downloadPdf} disabled={trend.isLoading || trend.isError} className="inline-flex items-center gap-1 rounded-lg border border-violet-200/30 px-2.5 py-1.5 text-[10px] font-bold text-violet-100 disabled:opacity-50"><Download className="h-3.5 w-3.5" />PDF出力</button></div></div></div>{trend.isLoading ? <p className="mt-6 text-center text-xs text-slate-400">学習記録を集計しています…</p> : trend.isError ? <div className="mt-5 rounded-xl bg-red-400/10 p-3"><p className="text-xs text-red-100">学習グラフを取得できませんでした。</p><button onClick={() => void trend.refetch()} className="mt-2 text-xs font-bold text-red-100 underline">再試行</button></div> : <ChartContainer config={chartConfig} className="mt-5 h-52 w-full"><ComposedChart data={trend.data ?? []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.1)" /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} /><YAxis yAxisId="minutes" tickLine={false} axisLine={false} width={28} /><YAxis yAxisId="accuracy" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} width={28} /><ChartTooltip content={<ChartTooltipContent indicator="dot" />} /><Bar yAxisId="minutes" dataKey="focusMinutes" name="focusMinutes" fill="var(--color-focusMinutes)" radius={[5,5,0,0]} /><Line yAxisId="accuracy" type="monotone" dataKey="accuracy" name="accuracy" stroke="var(--color-accuracy)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-accuracy)" }} /></ComposedChart></ChartContainer>}</section>;
}
