import React, { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { trpc } from "@/lib/trpc";

const config = { focusMinutes: { label: "学習時間（分）", color: "#66e8de" }, accuracy: { label: "正答率（%）", color: "#baa3ff" } } satisfies ChartConfig;
const demoData = [{ label: "4/1", focusMinutes: 12, accuracy: 80 }, { label: "4/2", focusMinutes: 18, accuracy: 85 }, { label: "4/3", focusMinutes: 10, accuracy: 75 }, { label: "4/4", focusMinutes: 22, accuracy: 90 }, { label: "4/5", focusMinutes: 16, accuracy: 82 }];
type Period = "day" | "week" | "month";
type TrendPoint = { label: string; focusMinutes: number; accuracy: number };
type SelectedDetail = { series: "focusMinutes" | "accuracy"; point: TrendPoint };

export function Graph({ data, showBars = true }: { data: TrendPoint[]; showBars?: boolean }) {
  const [detail, setDetail] = useState<SelectedDetail | null>(null);
  const TimeBar = ({ x = 0, y = 0, width = 0, height = 0, payload }: { x?: number; y?: number; width?: number; height?: number; payload?: TrendPoint }) => <rect x={x} y={y} width={width} height={height} rx={5} ry={5} fill="var(--color-focusMinutes)" className="cursor-pointer" onClick={() => payload && setDetail({ series: "focusMinutes", point: payload })} />;
  const AccuracyDot = ({ cx = 0, cy = 0, payload }: { cx?: number; cy?: number; payload?: TrendPoint }) => <circle cx={cx} cy={cy} r={5} fill="var(--color-accuracy)" className="cursor-pointer" onClick={() => payload && setDetail({ series: "accuracy", point: payload })} />;
  const detailLabel = detail?.series === "focusMinutes" ? "学習時間" : "正答率";
  const detailValue = detail?.series === "focusMinutes" ? `${detail.point.focusMinutes}分` : `${detail?.point.accuracy}%`;
  return <><ChartContainer config={config} className="mt-5 h-52 w-full"><ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.1)"/><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8}/><YAxis yAxisId="minutes" tickLine={false} axisLine={false} width={28}/><YAxis yAxisId="accuracy" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} width={28}/><Legend verticalAlign="top" height={24} formatter={value => value === "focusMinutes" ? "学習時間（分）" : "正答率（%）"}/>{showBars && <Bar yAxisId="minutes" dataKey="focusMinutes" name="focusMinutes" shape={<TimeBar/>}/>}<Line yAxisId="accuracy" type="monotone" dataKey="accuracy" name="accuracy" stroke="var(--color-accuracy)" strokeWidth={2} dot={<AccuracyDot/>} activeDot={{ r: 6 }}/></ComposedChart></ChartContainer><p className="mt-2 text-[11px] text-slate-400">棒グラフは学習時間、折れ線の点は正答率をタップして詳細を確認できます。</p>{detail && <div className="mt-3 flex items-center justify-between rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-3 py-2 text-xs" role="status"><span><b>{detail.point.label}</b> の{detailLabel}：<b>{detailValue}</b></span><button onClick={() => setDetail(null)} className="text-cyan-700 underline">閉じる</button></div>}</>;
}

function Live({ period }: { period: Period }) { const query = trpc.learning.trend.useQuery({ period }, { retry: false, staleTime: 30_000 }); return query.isLoading ? <p className="mt-6 text-center text-xs text-slate-400">学習記録を集計しています…</p> : query.isError ? <div className="mt-5 rounded-xl bg-red-400/10 p-3"><p className="text-xs text-red-100">学習グラフを取得できませんでした。</p><button onClick={() => void query.refetch()} className="mt-2 text-xs font-bold text-red-100 underline">再試行</button></div> : <Graph data={query.data ?? []}/>; }

export function LearningTrendChart({ demoMode = false }: { demoMode?: boolean }) { const [period, setPeriod] = useState<Period>("day"); return <section className="glass-card rounded-[26px] p-4"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">learning telemetry</p><h2 className="mt-1 text-base font-bold">学習の推移</h2><p className="mt-1 text-xs text-slate-400">学習時間と正答率を、保存済み記録から集計します。</p></div><div className="flex rounded-xl bg-slate-950/35 p-1">{([ ["day", "日"], ["week", "週"], ["month", "月"] ] as const).map(([value, label]) => <button key={value} onClick={() => setPeriod(value)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${period === value ? "bg-cyan-200 text-slate-950" : "text-slate-400"}`}>{label}</button>)}</div></div>{demoMode ? <Graph data={demoData} showBars={false}/> : <Live period={period}/>}</section>; }
