import { Check, FileText, Trash2, Upload, X } from "lucide-react";
import React from "react";
import { useRef, useState } from "react";
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const selected = (terms.data ?? []).find(term => term.id === selectedId) ?? null;

  const open = (term: NonNullable<typeof terms.data>[number]) => {
    setSelectedId(term.id);
    setChecked(term.accepted);
  };
  const close = () => {
    setSelectedId(null);
    setChecked(false);
  };
  const start = async () => {
    if (!selected || !checked) return;
    try {
      await accept.mutateAsync({ termId: selected.id });
      await utils.market.terms.list.invalidate();
      toast.success("利用規約に同意しました。利用を開始できます。");
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "同意を保存できませんでした。");
    }
  };

  return <section className="glass-card rounded-[26px] p-4" aria-label="利用規約">
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-300/12 text-violet-100"><FileText className="h-5 w-5" /></div>
      <div><p className="eyebrow">market terms</p><h2 className="mt-1 text-lg font-bold">利用規約</h2><p className="mt-1 text-xs leading-5 text-slate-400">ファイルを開いて内容を確認し、同意すると利用を開始できます。</p></div>
    </div>
    {terms.isLoading ? <p className="mt-4 text-xs text-slate-400">利用規約を読み込んでいます…</p> : terms.isError ? <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-xs text-red-100">利用規約を取得できませんでした。</p> : (terms.data ?? []).length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{(terms.data ?? []).map(term => <button key={term.id} type="button" onClick={() => open(term)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/25 p-3 text-left transition hover:border-violet-200/30"><FileText className="h-5 w-5 shrink-0 text-violet-200" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{term.title}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{term.fileName}</span></span>{term.accepted ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/12 px-2 py-1 text-[10px] font-bold text-emerald-200"><Check className="h-3 w-3" />同意済み</span> : <span className="text-[10px] text-violet-200">読む</span>}</button>)}</div> : <p className="mt-4 rounded-xl bg-slate-950/30 p-3 text-xs text-slate-500">現在公開されている利用規約はありません。</p>}
    {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${selected.title}の利用規約`}><section className="glass-card mx-auto mt-5 flex min-h-[calc(100vh-2.5rem)] w-full max-w-3xl flex-col rounded-[28px] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">terms document</p><h3 className="mt-1 text-xl font-bold">{selected.title}</h3><p className="mt-1 text-xs text-slate-500">{selected.fileName}</p></div><button type="button" aria-label="利用規約を閉じる" onClick={close} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><X className="h-4 w-4" /></button></div><div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-white"><iframe src={selected.fileUrl} title={selected.title} className="h-[min(62vh,620px)] w-full" /></div><label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-violet-200/20 bg-violet-300/[.06] p-3 text-sm font-bold"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} className="h-5 w-5 accent-violet-400" />上記の利用規約に同意する</label><button type="button" onClick={() => void start()} disabled={!checked || accept.isPending} className="mt-3 w-full rounded-2xl bg-violet-300 py-3 text-sm font-extrabold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{accept.isPending ? "保存しています…" : selected.accepted ? "利用を開始する" : "同意して利用を開始"}</button></section></div>}
  </section>;
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
