import jsQR from "jsqr";
import { CheckCircle2, Coins, QrCode, ScanLine, Send, ShieldCheck, UserRound, X } from "lucide-react";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type CoinSharePanelProps = {
  balance: number;
  onClose: () => void;
};

type ShareMode = "send" | "receive";

function parseCoinQr(value: string) {
  const match = /^STUDYVERSE:COIN:([A-Za-z0-9]{16,80})$/i.exec(value.trim());
  return match?.[1] ?? null;
}

function formatExpiry(value: Date | string | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function CoinQrScanner({ onDetected, onClose }: { onDetected: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectedRef = useRef(false);
  const callbackRef = useRef(onDetected);
  const [message, setMessage] = useState("カメラを起動しています…");
  callbackRef.current = onDetected;

  useEffect(() => {
    let stream: MediaStream | undefined;
    let frame = 0;
    let closed = false;
    const boot = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("CAMERA_UNAVAILABLE");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (closed) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setMessage("QRコードを枠内に写してください。");
        const scan = () => {
          if (closed || detectedRef.current) return;
          const canvas = canvasRef.current;
          if (canvas && video.videoWidth > 0 && video.videoHeight > 0) {
            const width = Math.min(video.videoWidth, 960);
            const height = Math.round(video.videoHeight * (width / video.videoWidth));
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (context) {
              context.drawImage(video, 0, 0, width, height);
              const image = context.getImageData(0, 0, width, height);
              const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
              if (result?.data) {
                detectedRef.current = true;
                callbackRef.current(result.data);
                return;
              }
            }
          }
          frame = window.requestAnimationFrame(scan);
        };
        frame = window.requestAnimationFrame(scan);
      } catch (error) {
        setMessage(error instanceof DOMException && error.name === "NotAllowedError" ? "カメラの利用が許可されませんでした。" : "カメラを開始できませんでした。");
      }
    };
    void boot();
    return () => {
      closed = true;
      if (frame) window.cancelAnimationFrame(frame);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  return <div className="fixed inset-0 z-[60] grid place-items-end bg-slate-950/80 p-4 backdrop-blur-sm sm:place-items-center">
    <section className="glass-card w-full max-w-md rounded-[28px] p-5" role="dialog" aria-modal="true" aria-label="コイン送金QRを読み取る">
      <div className="flex items-center justify-between"><div><p className="eyebrow">coin transfer</p><h2 className="mt-1 text-lg font-bold">QRコードを読み取る</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-white/8" aria-label="カメラを閉じる"><X className="h-4 w-4" /></button></div>
      <div className="relative mt-5 overflow-hidden rounded-2xl border border-amber-200/20 bg-slate-950/50"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" /><div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="h-44 w-44 rounded-2xl border-2 border-amber-200 shadow-[0_0_0_9999px_rgba(2,6,23,.28)]" /></div></div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="mt-4 text-center text-xs leading-5 text-slate-300">{message}</p>
      <button onClick={onClose} className="mt-4 w-full rounded-xl border border-white/12 py-3 text-sm font-bold text-slate-200">キャンセル</button>
    </section>
  </div>;
}

export function CoinSharePanel({ balance, onClose }: CoinSharePanelProps) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"history" | "share">("history");
  const [shareMode, setShareMode] = useState<ShareMode>("send");
  const [token, setToken] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const history = trpc.market.history.useQuery(undefined, { enabled: tab === "history", retry: false });
  const transfer = trpc.market.transfer.useQuery({ token: token || "0000000000000000" }, { enabled: Boolean(token), retry: false, refetchInterval: token && shareMode === "send" ? 2000 : false });
  const createTransfer = trpc.market.createTransfer.useMutation();
  const confirmTransfer = trpc.market.confirmTransfer.useMutation();
  const sendTransfer = trpc.market.sendTransfer.useMutation();

  const createQr = async () => {
    try {
      const result = await createTransfer.mutateAsync();
      setToken(result.token);
      setAmount("");
      toast.success("受け取り用QRコードを作成しました。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "QRコードを作成できませんでした。");
    }
  };

  const handleDetected = (raw: string) => {
    const parsed = parseCoinQr(raw);
    if (!parsed) {
      toast.error("StudyVerseのコイン送金QRではありません。");
      setScannerOpen(false);
      return;
    }
    setToken(parsed);
    setShareMode("receive");
    setScannerOpen(false);
    toast.success("送金QRを読み取りました。相手を確認してください。");
  };

  const confirmRecipient = async () => {
    try {
      await confirmTransfer.mutateAsync({ token });
      await transfer.refetch();
      toast.success("相手を確認しました。送る人が金額を設定できます。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "受取確認に失敗しました。");
    }
  };

  const send = async () => {
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      toast.error("1コイン以上の整数を入力してください。");
      return;
    }
    if (value > balance) {
      toast.error("残高を超えるコインは送れません。");
      return;
    }
    try {
      await sendTransfer.mutateAsync({ token, amount: value });
      await Promise.all([utils.market.wallet.invalidate(), utils.market.history.invalidate(), transfer.refetch()]);
      toast.success(`${value}コインを送信しました。`);
      setAmount("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "コインを送信できませんでした。");
    }
  };

  const resetShare = (mode: ShareMode) => {
    setShareMode(mode);
    setToken("");
    setAmount("");
  };

  return <div className="fixed inset-0 z-50 bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="マーケットコイン履歴とシェア">
    <section className="glass-card mx-auto mt-8 max-h-[calc(100vh-4rem)] w-full max-w-lg overflow-y-auto rounded-[28px] p-5 sm:mt-14">
      <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">market coin</p><h2 className="mt-1 text-xl font-bold">マーケットコイン</h2><p className="mt-1 text-xs text-slate-400">現在の残高：{balance}コイン</p></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-slate-200" aria-label="コイン履歴を閉じる"><X className="h-4 w-4" /></button></div>
      <div className="mt-5 grid grid-cols-2 rounded-2xl bg-slate-950/30 p-1"><button onClick={() => setTab("history")} className={`rounded-xl py-2.5 text-sm font-bold ${tab === "history" ? "bg-white/10 text-white" : "text-slate-400"}`}>履歴</button><button onClick={() => setTab("share")} className={`rounded-xl py-2.5 text-sm font-bold ${tab === "share" ? "bg-amber-300 text-slate-950" : "text-slate-400"}`}>シェア</button></div>
      {tab === "history" ? <div className="mt-5 space-y-2">{history.isFetching ? <p className="rounded-2xl bg-slate-950/30 p-4 text-sm text-slate-400">履歴を読み込んでいます…</p> : (history.data ?? []).length ? (history.data ?? []).map(item => <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/[.06] bg-slate-950/25 p-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.amount >= 0 ? "bg-cyan-300/15 text-cyan-200" : "bg-rose-300/15 text-rose-200"}`}><Coins className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.label}</p><time className="mt-1 block text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString("ja-JP")}</time></div><strong className={`shrink-0 text-sm ${item.amount >= 0 ? "text-cyan-200" : "text-rose-200"}`}>{item.amount >= 0 ? "+" : ""}{item.amount}コイン</strong></article>) : <p className="rounded-2xl bg-slate-950/30 p-4 text-sm text-slate-400">まだコインの履歴はありません。</p>}</div> : <div className="mt-5">
        <div className="grid grid-cols-2 gap-2"><button onClick={() => resetShare("send")} className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold ${shareMode === "send" ? "border-amber-200/40 bg-amber-300/15 text-amber-100" : "border-white/10 text-slate-400"}`}><Send className="h-4 w-4" />送る</button><button onClick={() => resetShare("receive")} className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold ${shareMode === "receive" ? "border-cyan-200/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 text-slate-400"}`}><ScanLine className="h-4 w-4" />送られる</button></div>
        {shareMode === "send" ? <div className="mt-4 rounded-2xl border border-amber-200/15 bg-amber-300/[.06] p-4">{!token ? <><div className="grid h-44 place-items-center rounded-xl border border-dashed border-amber-200/25 bg-slate-950/20"><QrCode className="h-12 w-12 text-amber-200/70" /></div><p className="mt-3 text-xs leading-5 text-slate-300">相手がこのQRコードを読み取って受取確認をすると、送金できるようになります。</p><button onClick={() => void createQr()} disabled={createTransfer.isPending} className="mt-4 w-full rounded-xl bg-amber-300 py-3 text-sm font-extrabold text-slate-950 disabled:opacity-60">{createTransfer.isPending ? "作成中…" : "送金QRを表示"}</button></> : <><div className="grid place-items-center rounded-xl bg-white p-4"><QRCodeSVG value={`STUDYVERSE:COIN:${token}`} size={196} level="M" includeMargin /></div><p className="mt-3 text-center text-xs text-slate-400">このQRは{formatExpiry(transfer.data?.expiresAt)}まで有効です</p>{transfer.data?.status === "recipient_confirmed" ? <div className="mt-4 rounded-xl bg-cyan-300/10 p-3"><p className="text-xs text-cyan-100"><CheckCircle2 className="mr-1 inline h-4 w-4" />{transfer.data.recipientName ?? "相手"}さんが受取を確認しました</p><div className="mt-3 flex gap-2"><input inputMode="numeric" min="1" max={balance} value={amount} onChange={event => setAmount(event.target.value.replace(/[^0-9]/g, ""))} placeholder="コイン数" aria-label="送るコイン数" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm" /><button onClick={() => void send()} disabled={sendTransfer.isPending} className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-60">送る</button></div></div> : transfer.data?.status === "completed" ? <p className="mt-4 rounded-xl bg-cyan-300/10 p-3 text-xs text-cyan-100"><CheckCircle2 className="mr-1 inline h-4 w-4" />送金が完了しました。</p> : <p className="mt-4 rounded-xl bg-slate-950/30 p-3 text-xs leading-5 text-slate-400">相手がQRコードを読み取ると、ここに相手の確認が表示されます。</p>}<button onClick={() => resetShare("send")} className="mt-3 w-full rounded-xl border border-white/10 py-2.5 text-xs font-bold text-slate-300">新しいQRを作る</button></>}</div> : <div className="mt-4 rounded-2xl border border-cyan-200/15 bg-cyan-300/[.06] p-4">{!token ? <><div className="grid h-44 place-items-center rounded-xl border border-dashed border-cyan-200/25 bg-slate-950/20"><ScanLine className="h-12 w-12 text-cyan-200/70" /></div><p className="mt-3 text-xs leading-5 text-slate-300">送る人が表示したQRコードをカメラで読み取ります。</p><button onClick={() => setScannerOpen(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 py-3 text-sm font-extrabold text-slate-950"><ScanLine className="h-4 w-4" />カメラを起動</button></> : <><div className="rounded-xl bg-slate-950/25 p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-cyan-200">送金相手</p><p className="mt-2 flex items-center gap-2 text-lg font-bold"><UserRound className="h-5 w-5 text-cyan-200" />{transfer.data?.senderName ?? "確認中…"}</p><p className="mt-2 text-xs leading-5 text-slate-400">相手の表示名を確認してから、受取確認を押してください。</p></div>{transfer.data?.status === "pending" ? <button onClick={() => void confirmRecipient()} disabled={confirmTransfer.isPending || transfer.isFetching} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 py-3 text-sm font-extrabold text-slate-950 disabled:opacity-60">{confirmTransfer.isPending ? "確認中…" : "相手を確認して受け取る"}</button> : transfer.data?.status === "recipient_confirmed" ? <p className="mt-4 rounded-xl bg-amber-300/10 p-3 text-xs leading-5 text-amber-100"><ShieldCheck className="mr-1 inline h-4 w-4" />受取確認済みです。送る人の送金完了を待っています。</p> : transfer.data?.status === "completed" ? <p className="mt-4 rounded-xl bg-cyan-300/10 p-3 text-xs text-cyan-100"><CheckCircle2 className="mr-1 inline h-4 w-4" />コインを受け取りました。</p> : null}<button onClick={() => resetShare("receive")} className="mt-3 w-full rounded-xl border border-white/10 py-2.5 text-xs font-bold text-slate-300">別のQRを読み取る</button></>}</div>}
        {scannerOpen && <CoinQrScanner onDetected={handleDetected} onClose={() => setScannerOpen(false)} />}
      </div>}
    </section>
  </div>;
}
