import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BrainCircuit, Check, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Subject = "英単語" | "漢字";
type SelectWord = { id: number; front: string; back: string; reading: string | null };

export function AiSelectWorkspace({ onBack }: { onBack: () => void }) {
  const [subject, setSubject] = useState<Subject>("英単語");
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState({ known: 0, review: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const utils = trpc.useUtils();
  const wordbooks = trpc.wordbooks.list.useQuery({ subject: subject === "英単語" ? "english" : "kanji" }, { retry: false });
  const recordAnswer = trpc.learning.recordAnswer.useMutation();
  const completeAiSelect = trpc.learning.completeAiSelect.useMutation();
  const words = useMemo<SelectWord[]>(() => {
    const pool = (wordbooks.data ?? []).flatMap(book => book.words);
    return pool.map(word => ({ word, key: Math.random() })).sort((a, b) => a.key - b.key).slice(0, 10).map(item => item.word);
  }, [wordbooks.data, subject]);
  const word = words[index] ?? { id: 0, front: "準備中", back: "単語帳に単語を登録してください。", reading: null };

  const start = () => {
    if (!words.length) return toast.error("この科目の単語帳に、先に単語を登録してください。");
    setStarted(true); setIndex(0); setFlipped(false); setResult({ known: 0, review: 0 });
  };
  const answer = async (isCorrect: boolean) => {
    if (savingRef.current || !words.length) return;
    savingRef.current = true; setIsSaving(true);
    try {
      await recordAnswer.mutateAsync({ wordId: word.id, mode: "ai_select", isCorrect });
      setResult(current => ({ known: current.known + (isCorrect ? 1 : 0), review: current.review + (isCorrect ? 0 : 1) }));
      if (index + 1 >= words.length) {
        await completeAiSelect.mutateAsync({ subject: subject === "英単語" ? "english" : "kanji" });
        await utils.monster.dashboard.invalidate();
        setStarted(false); setIndex(words.length); toast.success("AIセレクト10の学習記録を保存しました。");
      } else { setIndex(current => current + 1); setFlipped(false); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "回答を保存できませんでした。"); }
    finally { savingRef.current = false; setIsSaving(false); }
  };

  if (index >= words.length && words.length) return <div className="px-4 pb-28 pt-6"><button onClick={onBack} className="mb-5 inline-flex items-center gap-1 text-xs font-bold text-cyan-200"><ArrowLeft className="h-3.5 w-3.5" />ホームへ戻る</button><section className="glass-card rounded-[30px] p-6 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-300/13 text-amber-200"><Trophy className="h-8 w-8" /></div><p className="eyebrow mt-5">select complete</p><h1 className="mt-2 text-2xl font-extrabold">AIセレクトを記録しました</h1><p className="mt-3 text-sm text-slate-300">覚えた：<b className="text-cyan-200">{result.known}</b>　復習：<b className="text-violet-200">{result.review}</b></p><button onClick={() => { setIndex(0); setFlipped(false); setResult({ known: 0, review: 0 }); }} className="mt-6 w-full rounded-xl bg-cyan-300 py-3 text-sm font-bold text-slate-950">もう一度セレクトする</button></section></div>;
  if (!started) return <div className="space-y-4 px-4 pb-28 pt-5"><button onClick={onBack} className="inline-flex items-center gap-1 text-xs font-bold text-cyan-200"><ArrowLeft className="h-3.5 w-3.5" />ホームへ戻る</button><section className="relative overflow-hidden rounded-[28px] border border-violet-200/15 bg-gradient-to-br from-[#37245d] via-[#1d315b] to-[#102342] p-5"><Sparkles className="absolute -right-3 -top-3 h-24 w-24 text-cyan-100/10" /><p className="eyebrow">random practice</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-.05em]">AI セレクト 10</h1><p className="mt-2 max-w-sm text-xs leading-5 text-slate-200">利用可能な単語帳からランダムに最大10語を選び、短い学習セットとして出題します。</p></section><section className="glass-card rounded-[26px] p-4"><p className="text-sm font-bold">科目を選択</p><div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-950/35 p-1">{(["英単語", "漢字"] as Subject[]).map(item => <button key={item} onClick={() => { setSubject(item); setIndex(0); }} className={`rounded-lg py-2.5 text-sm font-bold ${subject === item ? "bg-white text-slate-950" : "text-slate-400"}`}>{item}</button>)}</div><div className="mt-5 rounded-2xl bg-slate-950/30 p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/12 text-cyan-100"><BrainCircuit className="h-5 w-5" /></div><div><p className="text-sm font-bold">今回のランダムセット</p><p className="mt-1 text-xs text-slate-400">{wordbooks.isLoading ? "単語帳を読み込んでいます…" : words.length ? `${words.length}語を出題します。` : "登録済みの単語がありません。"}</p></div></div></div><button disabled={wordbooks.isLoading || !words.length} onClick={start} className="mt-4 w-full rounded-xl bg-cyan-300 py-3.5 text-sm font-bold text-slate-950 disabled:opacity-60">このセットを始める</button></section></div>;
  return <div className="px-4 pb-28 pt-5"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">ai select · {index + 1} / {words.length}</p><p className="mt-1 text-sm text-slate-300">タップで答えを確認して、記憶を記録します。</p></div><button onClick={() => { setStarted(false); setFlipped(false); }} disabled={isSaving} className="text-xs text-slate-400 disabled:opacity-50">終了する</button></div><div className="relative mx-auto h-[370px] max-w-md"><div className="absolute inset-x-6 top-5 h-[340px] rounded-[28px] bg-white/15" /><div className="absolute inset-x-3 top-2 h-[345px] rounded-[28px] bg-white/35" /><motion.button whileTap={{ scale: .985 }} onClick={() => !isSaving && setFlipped(value => !value)} className="absolute inset-x-0 top-0 flex h-[350px] w-full flex-col justify-between rounded-[28px] bg-[#fbfcff] p-6 text-left text-slate-950 shadow-[0_24px_48px_rgba(0,0,0,.3)]"><div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400"><span>{subject}</span><span>{flipped ? "answer" : "question"}</span></div><div className="text-center"><p className="text-4xl font-extrabold tracking-[-.05em]">{flipped ? word.back : word.front}</p></div><p className="text-center text-xs text-slate-400">カードをタップして{flipped ? "表面へ戻す" : "答えを見る"}</p></motion.button></div><div className="mx-auto mt-3 grid max-w-md grid-cols-2 gap-3"><button disabled={isSaving} onClick={() => void answer(false)} className="rounded-xl border border-violet-200/25 bg-violet-400/10 py-3.5 text-sm font-bold text-violet-100 disabled:opacity-50"><RotateCcw className="mr-1 inline h-4 w-4" />復習する</button><button disabled={isSaving} onClick={() => void answer(true)} className="rounded-xl bg-cyan-300 py-3.5 text-sm font-bold text-slate-950 disabled:opacity-60"><Check className="mr-1 inline h-4 w-4" />覚えた</button></div></div>;
}
