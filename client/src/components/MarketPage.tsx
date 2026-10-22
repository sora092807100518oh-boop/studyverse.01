import { Download, ImagePlus, Plus, Star, Upload, X } from "lucide-react";
import React from "react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5_000_000) {
      reject(new Error("画像は5MB以下のPNG・JPEG・WebPを指定してください。"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    reader.readAsDataURL(file);
  });
}

function Stars({ value, onSelect, disabled = false }: { value: number; onSelect?: (value: number) => void; disabled?: boolean }) {
  return <div className="flex items-center gap-1" aria-label={`星${value}個`}>{[1, 2, 3, 4, 5].map(star => <button key={star} type="button" disabled={disabled || !onSelect} aria-label={`${star}つ星`} onClick={() => onSelect?.(star)} className={`transition ${onSelect ? "hover:scale-110" : "cursor-default"} disabled:cursor-not-allowed`}><Star className={`h-5 w-5 ${star <= value ? "fill-amber-300 text-amber-300" : "text-slate-500"}`} /></button>)}</div>;
}

export function MarketPage() {
  const utils = trpc.useUtils();
  const market = trpc.market.list.useQuery(undefined, { retry: false, staleTime: 15_000 });
  const books = trpc.wordbooks.list.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const submit = trpc.market.submit.useMutation();
  const download = trpc.market.download.useMutation();
  const review = trpc.market.review.useMutation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [name, setName] = useState("");
  const [wordbookId, setWordbookId] = useState("");
  const [imageData, setImageData] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const ownBooks = useMemo(() => (books.data ?? []).filter(book => book.visibility === "private" && book.canEdit !== false), [books.data]);
  const selected = (market.data ?? []).find(item => item.id === selectedId) ?? null;

  const resetUpload = () => {
    setUploadOpen(false); setName(""); setWordbookId(""); setImageData(""); setImagePreview("");
    if (fileRef.current) fileRef.current.value = "";
  };
  const selectImage = async (file: File | undefined) => {
    if (!file) return;
    try { const dataUrl = await readImage(file); setImageData(dataUrl); setImagePreview(dataUrl); }
    catch (error) { toast.error(error instanceof Error ? error.message : "画像を選択できませんでした。"); }
  };
  const submitMarket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!wordbookId) return toast.error("出品する単語帳を選択してください。");
    if (!name.trim()) return toast.error("マーケットで表示する名前を入力してください。");
    if (!imageData) return toast.error("表示用の写真を選択してください。");
    try {
      await submit.mutateAsync({ wordbookId: Number(wordbookId), name: name.trim(), dataUrl: imageData });
      await utils.market.list.invalidate();
      resetUpload();
      toast.success("マーケットへの出品を申請しました。管理者の確認後に公開されます。");
    } catch (error) { toast.error(error instanceof Error ? error.message : "マーケットへの申請に失敗しました。"); }
  };
  const downloadItem = async () => {
    if (!selected) return;
    try {
      const result = await download.mutateAsync({ marketItemId: selected.id });
      await Promise.all([utils.market.list.invalidate(), utils.wordbooks.list.invalidate()]);
      toast.success(result.alreadyDownloaded ? "この教材はすでに単語帳へ追加されています。" : "単語帳へダウンロードしました。");
    } catch (error) { toast.error(error instanceof Error ? error.message : "ダウンロードできませんでした。"); }
  };
  const saveReview = async (stars: number) => {
    if (!selected) return;
    try { await review.mutateAsync({ marketItemId: selected.id, stars }); await utils.market.list.invalidate(); toast.success("レビューを保存しました。"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "レビューを保存できませんでした。"); }
  };

  return <div className="space-y-4 px-4 pb-28 pt-5">
    <section className="glass-card rounded-[28px] p-5"><p className="eyebrow">study market</p><h1 className="mt-1 text-2xl font-extrabold">マーケット</h1><p className="mt-2 text-xs leading-5 text-slate-400">みんなが作った学習教材を見つけて、自分の単語帳へ追加できます。</p></section>
    {market.isLoading ? <section className="glass-card rounded-[26px] p-5 text-sm text-slate-400">マーケットを読み込んでいます…</section> : market.isError ? <section className="rounded-[26px] border border-red-200/20 bg-red-400/5 p-5 text-sm text-red-100">マーケットを取得できませんでした。再読み込みしてください。</section> : (market.data ?? []).length ? <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{(market.data ?? []).map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="glass-card overflow-hidden rounded-[22px] text-left transition hover:-translate-y-0.5 hover:border-cyan-200/30"><div className="aspect-square bg-slate-950/30"><img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" /></div><div className="p-3"><p className="truncate text-sm font-bold">{item.name}</p><div className="mt-2 flex items-center gap-1"><Star className={`h-3.5 w-3.5 ${item.averageStars ? "fill-amber-300 text-amber-300" : "text-slate-500"}`} /><span className="text-[10px] text-slate-400">{item.averageStars ? item.averageStars.toFixed(1) : "レビューなし"}</span></div></div></button>)}</section> : <section className="glass-card rounded-[26px] p-8 text-center"><ImagePlus className="mx-auto h-10 w-10 text-slate-500" /><p className="mt-3 text-sm font-bold">まだ公開された教材はありません</p><p className="mt-1 text-xs leading-5 text-slate-400">右下のプラスから、自分の単語帳を出品できます。</p></section>}
    <button type="button" onClick={() => setUploadOpen(true)} aria-label="マーケットにアップロード" className="fixed bottom-24 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-cyan-300 text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,.35)] transition hover:scale-105 active:scale-95"><Plus className="h-7 w-7" /></button>
    {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="マーケット教材の詳細"><section className="glass-card mx-auto mt-8 flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col rounded-[30px] p-5"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">market item</p><h2 className="mt-1 text-2xl font-extrabold">{selected.name}</h2></div><button type="button" onClick={() => setSelectedId(null)} aria-label="マーケット詳細を閉じる" className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><X className="h-4 w-4" /></button></div><img src={selected.imageUrl} alt={selected.name} className="mt-5 aspect-square w-full rounded-[24px] object-cover" /><div className="mt-5 flex items-center justify-between gap-3"><div><p className="text-xs text-slate-400">レビュー</p><div className="mt-1 flex items-center gap-2"><Stars value={Math.round(selected.averageStars)} /><span className="text-xs text-slate-400">{selected.averageStars ? `${selected.averageStars.toFixed(1)}（${selected.reviewCount}件）` : "まだレビューはありません"}</span></div></div><span className="rounded-full bg-violet-300/10 px-3 py-1 text-xs text-violet-100">{selected.subject === "english" ? "英単語" : "その他"}</span></div>{selected.downloaded && <div className="mt-5 rounded-2xl bg-amber-300/10 p-4"><p className="text-sm font-bold text-amber-100">ダウンロード済み</p><p className="mt-1 text-xs text-slate-400">この教材への評価を送れます。</p><div className="mt-3"><Stars value={selected.ownReview ?? 0} onSelect={saveReview} disabled={review.isPending} /></div></div>}<div className="mt-auto pt-8"><button type="button" onClick={() => void downloadItem()} disabled={download.isPending} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 py-4 text-sm font-extrabold text-slate-950 disabled:opacity-60"><Download className="h-5 w-5" />{download.isPending ? "ダウンロードしています…" : selected.downloaded ? "単語帳を開く" : "ダウンロード"}</button>{!selected.downloaded && <p className="mt-2 text-center text-[10px] text-slate-500">ダウンロード後に星レビューが可能になります。</p>}</div></section></div>}
    {uploadOpen && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="マーケットへのアップロード"><section className="glass-card mx-auto mt-8 w-full max-w-lg rounded-[30px] p-5"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">upload to market</p><h2 className="mt-1 text-xl font-extrabold">マーケットにアップロード</h2></div><button type="button" onClick={resetUpload} aria-label="マーケットアップロードを閉じる" className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><X className="h-4 w-4" /></button></div><p className="mt-3 text-xs leading-5 text-slate-400">自分で作成した単語帳を選び、表示用の写真と名前を設定します。管理者の認証後に公開されます。</p><form onSubmit={submitMarket} className="mt-5 space-y-3"><label className="block text-xs font-bold text-slate-200">表示名<input aria-label="マーケット表示名" value={name} onChange={event => setName(event.target.value)} placeholder="例：高校英単語 スターター" className="mt-2 w-full rounded-xl border border-white/12 bg-slate-950/35 px-3 py-3 text-sm" /></label><label className="block text-xs font-bold text-slate-200">単語帳<select aria-label="出品する単語帳" value={wordbookId} onChange={event => setWordbookId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/12 bg-slate-950/35 px-3 py-3 text-sm"><option value="">単語帳を選択</option>{ownBooks.map(book => <option key={book.id} value={book.id}>{book.title}（{book.wordCount}語）</option>)}</select></label><label className="block text-xs font-bold text-slate-200">表示用の写真<input ref={fileRef} aria-label="マーケット表示用の写真" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void selectImage(event.target.files?.[0])} className="mt-2 block w-full rounded-xl border border-white/12 bg-slate-950/35 px-3 py-3 text-xs" /></label>{imagePreview ? <img src={imagePreview} alt="マーケット画像プレビュー" className="aspect-square w-full rounded-2xl object-cover" /> : <div className="grid aspect-square place-items-center rounded-2xl border border-dashed border-white/15 bg-slate-950/20 text-xs text-slate-500"><Upload className="mb-2 h-6 w-6" />写真を選択してください</div>}<button type="submit" disabled={submit.isPending} className="w-full rounded-2xl bg-cyan-300 py-4 text-sm font-extrabold text-slate-950 disabled:opacity-60">{submit.isPending ? "申請しています…" : "マーケットへ申請する"}</button></form></section></div>}
  </div>;
}

export function MarketModerationPanel() {
  const utils = trpc.useUtils();
  const items = trpc.market.manage.useQuery(undefined, { retry: false });
  const moderate = trpc.market.moderate.useMutation();
  const act = async (marketItemId: number, status: "approved" | "rejected") => {
    try { await moderate.mutateAsync({ marketItemId, status, reviewNote: status === "rejected" ? "管理者の確認により非承認" : undefined }); await Promise.all([utils.market.manage.invalidate(), utils.market.list.invalidate()]); toast.success(status === "approved" ? "マーケットへ公開しました。" : "出品を非承認にしました。"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "マーケット審査を更新できませんでした。"); }
  };
  if (items.isLoading) return <section className="glass-card rounded-[26px] p-4"><p className="text-sm text-slate-400">申請中のマーケット教材を読み込んでいます…</p></section>;
  if (items.isError) return <section className="rounded-[26px] border border-red-200/20 bg-red-400/5 p-4"><p className="text-sm font-bold text-red-100">マーケット審査を利用できません</p><p className="mt-1 text-xs text-slate-400">全体管理者としてログインしてください。</p></section>;
  return <section className="glass-card rounded-[26px] p-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/12 text-cyan-200"><Download className="h-5 w-5" /></div><div><p className="eyebrow">market moderation</p><h2 className="mt-1 text-lg font-bold">マーケット審査</h2><p className="mt-1 text-xs leading-5 text-slate-400">利用者から申請された教材を確認し、公開または非承認にします。</p></div></div><div className="mt-5 space-y-3">{(items.data ?? []).length ? (items.data ?? []).map(item => <article key={item.id} className="rounded-2xl bg-slate-950/30 p-3"><div className="flex gap-3"><img src={item.imageUrl} alt={item.name} className="h-20 w-20 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="truncate text-sm font-bold">{item.name}</h3><p className="mt-1 text-[10px] text-slate-400">申請者：{item.ownerName ?? "利用者"}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${item.status === "pending" ? "bg-amber-300/15 text-amber-100" : item.status === "approved" ? "bg-cyan-300/15 text-cyan-100" : "bg-red-300/15 text-red-100"}`}>{item.status === "pending" ? "審査待ち" : item.status === "approved" ? "公開中" : "非承認"}</span></div><p className="mt-1 text-xs text-slate-400">{item.subject === "english" ? "英単語" : "その他"}・レビュー {item.reviewCount}件</p></div></div>{item.status === "pending" && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void act(item.id, "rejected")} disabled={moderate.isPending} className="rounded-xl border border-red-200/25 py-2 text-xs font-bold text-red-100 disabled:opacity-50">非承認</button><button type="button" onClick={() => void act(item.id, "approved")} disabled={moderate.isPending} className="rounded-xl bg-cyan-300 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">認証して公開</button></div>}</article>) : <p className="rounded-2xl bg-slate-950/30 p-4 text-xs text-slate-400">マーケットへの申請はありません。</p>}</div></section>;
}
