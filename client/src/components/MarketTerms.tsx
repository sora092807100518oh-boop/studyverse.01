import { Check, FileText, Trash2, Upload, X } from "lucide-react";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const acceptedTypes = ["application/pdf", "text/plain", "text/markdown", "image/png", "image/jpeg", "image/webp"];

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!acceptedTypes.includes(file.type) || file.size > 10_000_000) {
      reject(new Error("PDF・TXT・Markdown・画像の10MB以下のファイルを選択してください。"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("ファイルを読み込めませんでした。"));
    reader.readAsDataURL(file);
  });
}

export function MarketTerms() {
  const terms = trpc.market.terms.list.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const accept = trpc.market.terms.accept.useMutation();
  const utils = trpc.useUtils();
  const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const list = terms.data ?? [];
  const acceptanceFingerprint = list.map(term => `${term.id}:${term.accepted ? "1" : "0"}`).join(",");
  const pending = list.filter(term => !acceptedIds.has(term.id) && !term.accepted);
  const selected = list.find(term => term.id === selectedId) ?? null;

  useEffect(() => {
    if (!terms.data) return;
    const accepted = new Set(list.filter(term => term.accepted).map(term => term.id));
    setAcceptedIds(accepted);
    setSelectedId(current => current && list.some(term => term.id === current && !accepted.has(term.id)) ? current : null);
    setChecked(false);
  }, [acceptanceFingerprint]);

  const start = async () => {
    if (!selected || !checked) return;
    try {
      await accept.mutateAsync({ termId: selected.id });
      const nextAccepted = new Set(acceptedIds);
      nextAccepted.add(selected.id);
      setAcceptedIds(nextAccepted);
      const next = list.find(term => !nextAccepted.has(term.id));
      if (next) {
        setSelectedId(next.id);
        setChecked(false);
      } else {
        setSelectedId(null);
        setChecked(false);
        await utils.market.terms.list.invalidate();
        toast.success("利用規約に同意しました。マーケットを利用できます。");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "同意を保存できませんでした。");
    }
  };

  if (terms.isLoading || terms.isError || !list.length || (!pending.length && !selected)) return null;
  return <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="マーケット利用規約への同意">
    <section className="glass-card my-auto w-full max-w-xl rounded-[28px] p-5 shadow-2xl sm:p-6">
      <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-300/15 text-violet-100"><FileText className="h-5 w-5" /></div><div><p className="eyebrow">market terms</p><h2 className="mt-1 text-xl font-extrabold">マーケットを始める前に</h2><p className="mt-2 text-xs leading-5 text-slate-400">利用規約を確認し、同意するとマーケットを利用できます。</p></div></div>
      <div className="mt-4 flex flex-wrap gap-2">{list.map(term => <button key={term.id} type="button" onClick={() => { setSelectedId(term.id); setChecked(acceptedIds.has(term.id) || term.accepted); }} className={`rounded-full border px-3 py-2 text-xs font-bold ${term.id === selectedId ? "border-violet-200/50 bg-violet-300/15 text-violet-100" : "border-white/10 bg-white/[.04] text-slate-300"}`}>{term.title}{(acceptedIds.has(term.id) || term.accepted) && <Check className="ml-1 inline h-3 w-3 text-emerald-300" />}</button>)}</div>
      {selected ? <><p className="mt-4 text-xs font-bold text-slate-300">{selected.title}</p><div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-white"><iframe src={selected.fileUrl} title={selected.title} className="h-[min(58vh,560px)] w-full" /></div><button type="button" onClick={() => { setSelectedId(null); setChecked(false); }} className="mt-3 text-xs font-bold text-violet-200">利用規約の一覧に戻る</button><label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-violet-200/20 bg-violet-300/[.06] p-3 text-sm font-bold"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} className="h-5 w-5 accent-violet-400" />上記の利用規約に同意する</label><button type="button" onClick={() => void start()} disabled={!checked || accept.isPending} className="mt-3 w-full rounded-2xl bg-violet-300 py-3.5 text-sm font-extrabold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{accept.isPending ? "保存しています…" : pending.length > 1 ? "同意して次へ" : "始める"}</button></> : <div className="mt-5 rounded-2xl border border-violet-200/15 bg-violet-300/[.06] p-4"><p className="text-sm font-bold text-slate-100">確認する利用規約を選択してください</p><p className="mt-2 text-xs leading-5 text-slate-400">下のファイルをタップすると内容を開けます。PDFはページをスクロールして確認できます。</p></div>}
    </section>
  </div>;
}

export function MarketTermsAdmin() {
  const terms = trpc.market.terms.list.useQuery(undefined, { retry: false, staleTime: 10_000 });
  const upload = trpc.market.terms.upload.useMutation();
  const remove = trpc.market.terms.delete.useMutation();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !title.trim()) return toast.error("規約名とファイルを指定してください。");
    try {
      const dataUrl = await readFile(file);
      await upload.mutateAsync({ title: title.trim(), fileName: file.name, dataUrl });
      await utils.market.terms.list.invalidate();
      setTitle(""); setFile(null); if (fileRef.current) fileRef.current.value = "";
      toast.success("利用規約をアップロードしました。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "利用規約をアップロードできませんでした。");
    }
  };
  const removeTerm = async (id: number) => {
    if (!window.confirm("この利用規約を削除しますか？")) return;
    try { await remove.mutateAsync({ termId: id }); await utils.market.terms.list.invalidate(); toast.success("利用規約を削除しました。"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "利用規約を削除できませんでした。"); }
  };

  return <section className="glass-card rounded-[26px] p-4" aria-label="利用規約管理"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-300/12 text-violet-100"><FileText className="h-5 w-5" /></div><div><p className="eyebrow">market terms</p><h2 className="mt-1 text-lg font-bold">利用規約</h2><p className="mt-1 text-xs leading-5 text-slate-400">マーケット利用者に表示する規約ファイルを複数登録できます。</p></div></div><form onSubmit={submit} className="mt-4 grid gap-2 sm:grid-cols-2"><input required value={title} onChange={event => setTitle(event.target.value)} placeholder="規約名（例：マーケット利用規約 第1版）" className="rounded-xl border border-white/12 bg-slate-950/35 px-3 py-3 text-sm"/><input ref={fileRef} required type="file" accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/markdown,image/png,image/jpeg,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} className="rounded-xl border border-white/12 bg-slate-950/35 px-3 py-3 text-xs"/><button disabled={upload.isPending} className="sm:col-span-2 rounded-xl bg-violet-300 py-3 text-xs font-bold text-slate-950 disabled:opacity-60"><Upload className="mr-1 inline h-3.5 w-3.5" />{upload.isPending ? "アップロードしています…" : "利用規約を追加"}</button></form><div className="mt-4 space-y-2">{(terms.data ?? []).map(term => <div key={term.id} className="flex items-center gap-3 rounded-xl bg-slate-950/30 p-3"><FileText className="h-4 w-4 shrink-0 text-violet-200"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{term.title}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{term.fileName}</span></span><a href={term.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-violet-200">開く</a><button type="button" onClick={() => void removeTerm(term.id)} aria-label={`${term.title}を削除`} className="rounded-lg p-2 text-red-200"><Trash2 className="h-4 w-4"/></button></div>)}</div></section>;
}
