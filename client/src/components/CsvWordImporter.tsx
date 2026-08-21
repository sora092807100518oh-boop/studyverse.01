import React, { useRef, useState } from "react";
import { Download, FileUp, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export const buildVocabularyCsvTemplate = () => "単語,意味\n";
const escapeCsv = (value: string | null) => `"${(value ?? "").replace(/"/g, '""')}"`;
export const buildWordbookCsv = (words: Array<{ front: string; back: string; reading: string | null }>) => ["単語,意味,読み", ...words.map(word => [word.front, word.back, word.reading].map(escapeCsv).join(","))].join("\r\n");

export function CsvWordImporter({ wordbookId, onComplete }: { wordbookId: number; onComplete: () => Promise<unknown> | void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const preview = trpc.wordbooks.previewCsv.useMutation();
  const importCsv = trpc.wordbooks.importCsv.useMutation();
  const downloadCsv = trpc.wordbooks.downloadCsv.useMutation();

  const inspect = async (text: string) => {
    try { await preview.mutateAsync({ wordbookId, csvText: text }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "CSVを読み込めませんでした。"); }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { toast.error("CSVファイルは2MB以内にしてください。"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setCsvText(text); setFileName(file.name); void inspect(text);
    };
    reader.onerror = () => toast.error("ファイルを読み込めませんでした。");
    reader.readAsText(file, "utf-8");
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob(["\uFEFF", buildVocabularyCsvTemplate()], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "studyverse-vocabulary-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadWordbook = async () => {
    try {
      const result = await downloadCsv.mutateAsync({ wordbookId });
      const anchor = document.createElement("a");
      anchor.href = `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${buildWordbookCsv(result.words)}`)}`;
      anchor.download = `${result.title.replace(/[\\/:*?\"<>|]/g, "_")}.csv`;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      window.setTimeout(() => anchor.remove(), 1_000);
      toast.success("教材CSVをダウンロードしました。");
    } catch (error) { toast.error(error instanceof Error ? error.message : "教材CSVをダウンロードできませんでした。"); }
  };

  const commit = async () => {
    if (!csvText || !preview.data || preview.data.invalidCount) return;
    try {
      const result = await importCsv.mutateAsync({ wordbookId, csvText });
      await onComplete();
      setCsvText(""); setFileName(""); preview.reset();
      if (inputRef.current) inputRef.current.value = "";
      toast.success(`${result.importedCount}語を取り込みました。重複 ${result.skippedCount}語は追加していません。`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "CSVの取込に失敗しました。"); }
  };

  return <section className="mt-4 rounded-2xl border border-dashed border-cyan-200/25 bg-cyan-300/[.04] p-3">
    <div className="flex items-start gap-2"><FileUp className="mt-0.5 h-4 w-4 text-cyan-200" /><div><p className="text-xs font-bold text-cyan-50">CSVから単語を追加</p><p className="mt-1 text-[11px] leading-4 text-slate-400">UTF-8のCSVまたはタブ区切りで、1列目に単語・2列目に意味を指定します。最大3,000行です。</p></div></div>
    <input ref={inputRef} type="file" aria-label="CSVファイルを選ぶ" accept=".csv,text/csv,text/plain" onChange={onFileChange} className="sr-only" />
    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><button type="button" onClick={() => inputRef.current?.click()} disabled={preview.isPending || importCsv.isPending} className="rounded-xl border border-cyan-200/30 bg-slate-950/20 py-2.5 text-xs font-bold text-cyan-100 disabled:opacity-60">{preview.isPending ? <><LoaderCircle className="mr-1 inline h-3.5 w-3.5 animate-spin" />形式を確認中…</> : fileName ? `${fileName} を選択中` : "CSVファイルを選ぶ"}</button><button type="button" aria-label="CSVテンプレートをダウンロード" onClick={downloadTemplate} className="rounded-xl border border-cyan-200/30 px-3 py-2.5 text-xs font-bold text-cyan-100"><Download className="h-4 w-4" /></button></div><button type="button" aria-label="教材CSVをダウンロード" disabled={downloadCsv.isPending} onClick={() => void downloadWordbook()} className="mt-2 w-full rounded-xl border border-violet-200/30 bg-violet-300/10 py-2.5 text-xs font-bold text-violet-100 disabled:opacity-60">{downloadCsv.isPending ? "CSVを準備しています…" : "この教材をCSVで保存"} <Download className="ml-1 inline h-3.5 w-3.5" /></button>
    {preview.data && <div className="mt-3 rounded-xl bg-slate-950/30 p-3"><div className="grid grid-cols-3 gap-2 text-center"><div><p className="text-[10px] text-slate-400">取込予定</p><p className="mt-1 font-mono text-sm font-bold text-cyan-200">{preview.data.validCount}</p></div><div><p className="text-[10px] text-slate-400">重複</p><p className="mt-1 font-mono text-sm font-bold text-violet-200">{preview.data.duplicateCount}</p></div><div><p className="text-[10px] text-slate-400">要修正</p><p className="mt-1 font-mono text-sm font-bold text-amber-200">{preview.data.invalidCount}</p></div></div><div className="mt-3 max-h-28 space-y-1 overflow-y-auto text-[10px]">{preview.data.rows.slice(0, 12).map(row => <p key={row.line} className={row.valid && !row.duplicate ? "text-slate-300" : "text-amber-100"}>行 {row.line}：{row.front || "（空）"} → {row.back || "（空）"}{row.duplicate ? "（重複）" : row.reason ? `（${row.reason}）` : ""}</p>)}</div><button type="button" onClick={() => void commit()} disabled={preview.data.invalidCount > 0 || preview.data.validCount === 0 || importCsv.isPending} className="mt-3 w-full rounded-xl bg-cyan-300 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-60">{importCsv.isPending ? "取り込んでいます…" : preview.data.invalidCount ? "要修正行を確認してください" : `${preview.data.validCount}語を追加する`}</button></div>}
  </section>;
}
