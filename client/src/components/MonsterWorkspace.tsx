import React, { useMemo, useRef, useState } from "react";
import { Check, Crown, Gift, History, Package } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const FOREST_BACKGROUND = "/manus-storage/monster-forest-background_260e4113.png";

export function MonsterArtwork({ images, eggNumber, stage, className = "" }: { images: Array<{ slotKey: string; imageUrl: string }>; eggNumber: string; stage: number; className?: string }) {
  const eggImage = images.find(item => item.slotKey === `egg-${eggNumber}`);
  const evolutionImage = images.find(item => item.slotKey === `evolution-${stage}`);
  const image = stage === 1 ? eggImage : evolutionImage ?? eggImage;
  if (image) return <img src={image.imageUrl} alt={`進化 ${stage}`} className={`h-full w-full object-contain ${className}`} />;
  return <div className={`grid h-full w-full place-items-center rounded-2xl border border-dashed border-amber-100/50 bg-slate-950/25 p-3 text-center text-xs leading-5 text-amber-50 ${className}`}>画像未登録<br />卵{eggNumber}・進化{stage}</div>;
}

export function MonsterGrowthPanel() {
  const utils = trpc.useUtils();
  const dashboard = trpc.monster.dashboard.useQuery(undefined, { retry: false, staleTime: 20_000 });
  const startNew = trpc.monster.startNew.useMutation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [eggChoice, setEggChoice] = useState("1");
  if (dashboard.isLoading) return <section className="glass-card min-h-[342px] rounded-[28px] p-4"><p className="text-xs text-slate-400">モンスターの成長を読み込んでいます…</p></section>;
  if (!dashboard.data) return <section className="rounded-[28px] border border-red-200/20 bg-red-400/5 p-4"><p className="text-sm font-bold text-red-100">モンスターの成長を取得できませんでした</p><button onClick={() => void dashboard.refetch()} className="mt-3 text-xs font-bold text-red-100 underline">再試行</button></section>;
  const data = dashboard.data;
  const active = data.active;
  const progress = active.progression;
  const availableEggs = data.eggs.filter(egg => !egg.consumedAt);
  const selectedEgg = availableEggs.some(egg => egg.eggNumber === eggChoice) ? eggChoice : availableEggs[0]?.eggNumber ?? "1";
  const beginNew = async () => {
    try {
      await startNew.mutateAsync({ eggNumber: selectedEgg as "1" | "2" | "3" });
      await utils.monster.dashboard.invalidate();
      toast.success("新しいモンスターの育成を始めました。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "新しいモンスターを開始できませんでした。");
    }
  };
  return <section className="relative min-h-[342px] overflow-hidden rounded-[28px] border border-amber-100/25 bg-[#243b2d] p-4 shadow-[0_20px_55px_rgba(4,10,28,.35)]">
    <img src={FOREST_BACKGROUND} alt="森の中のモンスター育成場所" className="absolute inset-0 h-full w-full object-cover opacity-80" />
    <div className="absolute inset-0 bg-gradient-to-r from-[#132718]/90 via-[#1d3827]/58 to-[#1a2116]/28" />
    <div className="relative flex min-h-[310px] flex-col">
      <div className="flex items-start justify-between gap-3">
        <div><p className="eyebrow text-amber-100">monster garden</p><h2 className="mt-1 text-xl font-bold text-white">モンスター育成</h2><p className="mt-1 text-xs text-emerald-50">20時間ごとに1進化。ミッションポイントは1分として成長を後押しします。</p></div>
        <div className="flex shrink-0 gap-2"><button onClick={() => void dashboard.refetch()} className="rounded-xl border border-white/25 bg-slate-950/35 px-3 py-2 text-xs font-bold text-white backdrop-blur-sm">更新</button><button onClick={() => setHistoryOpen(value => !value)} className="rounded-xl border border-white/25 bg-slate-950/35 px-3 py-2 text-xs font-bold text-white backdrop-blur-sm"><History className="mr-1 inline h-3.5 w-3.5" />育成履歴</button></div>
      </div>
      <div className="mt-4 grid flex-1 grid-cols-[minmax(110px,38%)_1fr] gap-4">
        <div className="flex min-h-44 items-end"><MonsterArtwork images={data.images} eggNumber={active.eggNumber} stage={progress.stage} className="max-h-52 drop-shadow-[0_14px_20px_rgba(0,0,0,.35)]" /></div>
        <div className="self-end rounded-2xl border border-white/18 bg-slate-950/50 p-3 backdrop-blur-md">
          <p className="text-xs text-amber-100">現在育てている</p><p className="mt-1 text-2xl font-extrabold text-white">進化 {String(progress.stage).padStart(2, "0")} <span className="text-sm font-medium text-emerald-100">/ 13</span></p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-amber-200 via-emerald-200 to-cyan-200 transition-all" style={{ width: `${progress.stageProgress}%` }} /></div>
          <p className="mt-2 font-mono text-[10px] text-amber-50">{progress.stage === 13 ? "最終進化を達成しました" : `次の進化まで ${progress.minutesToNext}分`}</p>
          <p className="mt-1 text-[10px] text-slate-200">学習 {Math.floor(data.totalFocusSeconds / 3600)}時間・ミッション {data.claimedPoints}分</p>
        </div>
      </div>
      {progress.stage === 13 && <div className="mt-3 rounded-2xl border border-amber-100/30 bg-slate-950/55 p-3 backdrop-blur-md">
        <p className="text-sm font-bold text-amber-50"><Crown className="mr-1 inline h-4 w-4" />最終進化を達成</p>
        {availableEggs.length ? <div className="mt-3 flex gap-2"><select value={selectedEgg} onChange={event => setEggChoice(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950/70 px-3 py-2 text-xs text-white">{availableEggs.map(egg => <option key={egg.id} value={egg.eggNumber}>卵 {egg.eggNumber}</option>)}</select><button disabled={startNew.isPending} onClick={() => void beginNew()} className="rounded-xl bg-amber-200 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-60">新しいモンスターを育てる</button></div> : <p className="mt-2 text-xs leading-5 text-slate-200">持ち物の卵を獲得すると、新しいモンスターを育てられます。</p>}
      </div>}
      {historyOpen && <div className="mt-4 rounded-2xl border border-white/18 bg-slate-950/65 p-3 backdrop-blur-md">
        <div className="flex items-center justify-between"><p className="text-sm font-bold text-white">今まで育てたモンスター</p><span className="text-xs text-amber-100">持ち物：卵 {availableEggs.length}個</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{data.history.map(profile => <div key={profile.id} className="rounded-xl bg-white/8 p-2"><div className="h-16"><MonsterArtwork images={data.images} eggNumber={profile.eggNumber} stage={profile.progression.stage} /></div><p className="mt-2 text-xs font-bold text-white">卵{profile.eggNumber}・進化{profile.progression.stage}</p><p className="mt-1 text-[10px] text-slate-300">{profile.active ? "現在育てている" : "育成済み"}</p></div>)}</div>
      </div>}
    </div>
  </section>;
}

export function MonsterMissionPanel() {
  const utils = trpc.useUtils(); const dashboard = trpc.monster.dashboard.useQuery(undefined, { retry: false, staleTime: 20_000 }); const claim = trpc.monster.claim.useMutation(); const [tab, setTab] = useState<"daily" | "monthly" | "normal">("daily");
  if (dashboard.isLoading) return <section className="glass-card min-h-[342px] rounded-[28px] p-4"><p className="text-xs text-slate-400">ミッションを読み込んでいます…</p></section>;
  if (!dashboard.data) return <section className="glass-card min-h-[342px] rounded-[28px] p-4"><p className="text-xs text-slate-400">ミッションを取得できませんでした。</p></section>;
  const data = dashboard.data; const rewards = data.mission.claimable;
  const claimReward = async (missionKey: string, periodKey: string) => { try { const result = await claim.mutateAsync({ missionKey, periodKey }); await utils.monster.dashboard.invalidate(); toast.success(`${result.points}ポイントを受け取りました。`); } catch (error) { toast.error(error instanceof Error ? error.message : "報酬を受け取れませんでした。"); } };
  const dailyRewards = rewards.filter(reward => reward.missionKey.startsWith("daily.")); const monthlyRewards = rewards.filter(reward => reward.missionKey.startsWith("monthly."));
  return <section className="glass-card min-h-[342px] rounded-[28px] p-4"><div className="flex items-start justify-between"><div><p className="eyebrow">mission garden</p><h2 className="mt-1 text-xl font-bold">ミッション</h2><p className="mt-1 text-xs text-slate-400">1つ達成ごとに1ポイント。ポイントはモンスターの育成時間を1分進めます。</p></div><span className="rounded-full bg-amber-300/15 px-2.5 py-1 text-xs font-bold text-amber-200">報酬 {rewards.length}件</span></div><div className="mt-4 grid grid-cols-3 rounded-xl bg-slate-950/35 p-1">{(["daily", "monthly", "normal"] as const).map(item => <button key={item} onClick={() => setTab(item)} className={`rounded-lg py-2 text-xs font-bold ${tab === item ? "bg-white text-slate-950" : "text-slate-400"}`}>{item === "daily" ? "デイリー" : item === "monthly" ? "マンスリー" : "ノーマル"}</button>)}</div>
    {tab === "daily" && <div className="mt-4"><div className="flex items-center justify-between text-xs"><span className="font-bold">今日の進捗</span><span className="text-amber-200">{data.mission.daily.progress} / 5</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-200" style={{ width: `${data.mission.daily.progress * 20}%` }} /></div><p className="mt-2 text-[10px] text-slate-400">全達成すると追加で5ポイント</p><div className="mt-3 space-y-2">{data.mission.daily.missions.map(mission => <div key={mission.key} className="flex items-center gap-2 rounded-xl bg-slate-950/30 p-2.5"><span className={`grid h-5 w-5 place-items-center rounded-full ${mission.complete ? "bg-cyan-300 text-slate-950" : "border border-white/25"}`}>{mission.complete && <Check className="h-3.5 w-3.5" />}</span><span className="flex-1 text-xs font-semibold">{mission.label}</span><span className="text-[10px] text-amber-200">+1</span></div>)}</div>{dailyRewards.length > 0 && <button disabled={claim.isPending} onClick={() => void claimReward(dailyRewards[0].missionKey, dailyRewards[0].periodKey)} className="mt-3 w-full rounded-xl bg-amber-200 py-2.5 text-xs font-bold text-slate-950"><Gift className="mr-1 inline h-3.5 w-3.5" />達成済み報酬を受け取る</button>}</div>}
    {tab === "monthly" && <div className="mt-4"><div className="flex items-center justify-between text-xs"><span className="font-bold">今月の進捗</span><span className="text-amber-200">{data.mission.monthly.progress} / {data.mission.monthly.missions.length}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-200" style={{ width: `${Math.round((data.mission.monthly.progress / data.mission.monthly.missions.length) * 100)}%` }} /></div><p className="mt-2 text-[10px] text-slate-400">全達成すると追加で30ポイント</p><div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">{data.mission.monthly.missions.map(mission => <div key={mission.key} className="rounded-xl bg-slate-950/30 p-2.5"><div className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center rounded-full ${mission.complete ? "bg-cyan-300 text-slate-950" : "border border-white/25"}`}>{mission.complete && <Check className="h-3.5 w-3.5" />}</span><span className="flex-1 text-xs font-semibold">{mission.label}</span><span className="text-[10px] text-amber-200">+1</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, Math.round((mission.value / mission.threshold) * 100))}%` }} /></div><p className="mt-1 text-right text-[10px] text-slate-400">{mission.value} / {mission.threshold}</p></div>)}</div>{monthlyRewards.length > 0 && <button disabled={claim.isPending} onClick={() => void claimReward(monthlyRewards[0].missionKey, monthlyRewards[0].periodKey)} className="mt-3 w-full rounded-xl bg-amber-200 py-2.5 text-xs font-bold text-slate-950"><Gift className="mr-1 inline h-3.5 w-3.5" />達成済み報酬を受け取る</button>}</div>}
    {tab === "normal" && <div className="mt-4 space-y-3"><p className="text-xs text-slate-400">学習時間の到達で、新しい卵を持ち物へ追加します。</p>{[{ hours: 260, egg: 2 }, { hours: 520, egg: 3 }].map(goal => { const totalHours = Math.floor(data.totalFocusSeconds / 3600); const earned = data.eggs.some(egg => Number(egg.eggNumber) === goal.egg); return <div key={goal.egg} className="rounded-2xl bg-slate-950/30 p-3"><div className="flex items-center justify-between"><div><p className="text-sm font-bold">総学習 {goal.hours}時間</p><p className="mt-1 text-xs text-slate-400">新しい{goal.egg}個目の卵を獲得</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${earned ? "bg-cyan-300/15 text-cyan-100" : "bg-white/8 text-slate-400"}`}>{earned ? "獲得済み" : `${totalHours} / ${goal.hours}h`}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-200 to-cyan-200" style={{ width: `${Math.min(100, Math.round((totalHours / goal.hours) * 100))}%` }} /></div></div>; })}<div className="rounded-2xl border border-dashed border-white/16 bg-white/[.025] p-3"><Package className="mr-2 inline h-4 w-4 text-amber-200" /><span className="text-sm font-bold">持ち物の卵：{data.eggs.filter(egg => !egg.consumedAt).length}個</span><p className="mt-2 text-xs leading-5 text-slate-400">最終進化を達成すると、モンスター育成画面で持っている卵を選んで新しいモンスターを育てられます。</p></div></div>}
  </section>;
}

export function MonsterSettingsManager() {
  const utils = trpc.useUtils(); const images = trpc.monster.images.useQuery(undefined, { retry: false }); const upload = trpc.monster.uploadImage.useMutation(); const fileRef = useRef<HTMLInputElement>(null); const [slot, setSlot] = useState("egg-1");
  const slots = useMemo(() => [{ key: "egg-1", label: "1個目の卵", imageType: "egg" as const, eggNumber: 1 }, { key: "egg-2", label: "2個目の卵", imageType: "egg" as const, eggNumber: 2 }, { key: "egg-3", label: "3個目の卵", imageType: "egg" as const, eggNumber: 3 }, ...Array.from({ length: 13 }, (_, index) => ({ key: `evolution-${index + 1}`, label: `進化 ${String(index + 1).padStart(2, "0")}`, imageType: "evolution" as const, evolutionStage: index + 1 }))], []);
  const selected = slots.find(item => item.key === slot)!;
  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5_000_000) { toast.error("5MB以下のPNG・JPEG・WebPを選択してください。"); return; } const reader = new FileReader(); reader.onload = async () => { try { await upload.mutateAsync({ slotKey: selected.key, imageType: selected.imageType, eggNumber: "eggNumber" in selected ? selected.eggNumber : undefined, evolutionStage: "evolutionStage" in selected ? selected.evolutionStage : undefined, dataUrl: String(reader.result) }); await utils.monster.images.invalidate(); toast.success(`${selected.label}の画像を保存しました。`); } catch (error) { toast.error(error instanceof Error ? error.message : "画像を保存できませんでした。"); } }; reader.readAsDataURL(file); };
  const imageMap = new Map((images.data ?? []).map(item => [item.slotKey, item.imageUrl]));
  return <section className="glass-card rounded-[26px] p-4"><p className="eyebrow">monster studio</p><h2 className="mt-1 text-lg font-bold">モンスター設定</h2><p className="mt-1 text-xs leading-5 text-slate-400">卵1〜3と進化1〜13の画像を分けて登録します。未登録の枠は学習者画面で「画像未登録」と表示されます。</p><label className="mt-4 block text-xs font-bold text-slate-200">登録する画像枠<select value={slot} onChange={event => setSlot(event.target.value)} className="mt-2 w-full rounded-xl border border-white/12 bg-slate-950/35 px-3 py-3 text-sm">{slots.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="sr-only" /><button disabled={upload.isPending} onClick={() => fileRef.current?.click()} className="mt-3 w-full rounded-xl bg-amber-200 py-3 text-xs font-bold text-slate-950 disabled:opacity-60">{upload.isPending ? "画像を保存しています…" : `${selected.label}の画像をアップロード`}</button><div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map(item => <div key={item.key} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/30"><div className="aspect-square bg-white/5">{imageMap.get(item.key) ? <img src={imageMap.get(item.key)} alt={item.label} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center p-2 text-center text-[10px] text-slate-500">未登録</div>}</div><p className="truncate px-2 py-1.5 text-[10px] text-slate-300">{item.label}</p></div>)}</div></section>;
}
