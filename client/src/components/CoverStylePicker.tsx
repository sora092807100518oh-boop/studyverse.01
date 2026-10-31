import React, { useState } from "react";
import { ImagePlus, Palette, Settings2, X } from "lucide-react";

type CoverStyle = { image?: string; color?: string };

export const COVER_STYLE_EVENT = "studyverse-cover-style-changed";
export const COVER_COLORS = ["#7664c6", "#2c9f9a", "#e58b68", "#4f78c8", "#d36b91", "#667085"];

export function readCoverStyles(namespace: string): Record<string, CoverStyle> {
  try {
    const value = JSON.parse(window.localStorage.getItem(`studyverse-cover-styles:${namespace}`) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function saveCoverStyle(namespace: string, id: string, style: CoverStyle) {
  const styles = readCoverStyles(namespace);
  styles[id] = style;
  window.localStorage.setItem(`studyverse-cover-styles:${namespace}`, JSON.stringify(styles));
  window.dispatchEvent(new CustomEvent(COVER_STYLE_EVENT, { detail: { namespace, id, style } }));
}

export function CoverStylePicker({ namespace, itemId, style }: { namespace: string; itemId: string; style?: CoverStyle }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CoverStyle>(style ?? {});
  const updateImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setDraft(current => ({ ...current, image: typeof reader.result === "string" ? reader.result : undefined }));
    reader.readAsDataURL(file);
  };
  const apply = () => {
    saveCoverStyle(namespace, itemId, draft);
    setOpen(false);
  };
  return <>
    <button type="button" className="cover-style-trigger" aria-label="表紙を設定" onClick={event => { event.stopPropagation(); setDraft(style ?? {}); setOpen(true); }}><Settings2 className="h-3.5 w-3.5" /></button>
    {open && <div className="cover-style-popover" role="dialog" aria-label="表紙を設定" onClick={event => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-2"><b>表紙を設定</b><button type="button" aria-label="表紙設定を閉じる" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
      <label className="cover-image-input"><ImagePlus className="h-4 w-4" />画像を選ぶ<input type="file" accept="image/*" onChange={event => updateImage(event.target.files?.[0])} /></label>
      <div className="cover-color-row"><Palette className="h-4 w-4" />{COVER_COLORS.map(color => <button type="button" key={color} aria-label={`背景色 ${color}`} className={`cover-color ${draft.color === color ? "is-active" : ""}`} style={{ backgroundColor: color }} onClick={() => setDraft(current => ({ ...current, color }))} />)}<input aria-label="好きな背景色" type="color" value={draft.color ?? "#7664c6"} onChange={event => setDraft(current => ({ ...current, color: event.target.value }))} /></div>
      {draft.image && <img src={draft.image} alt="表紙プレビュー" className="cover-style-preview" />}
      <button type="button" className="cover-style-save" onClick={apply}>保存する</button>
    </div>}
  </>;
}

export type { CoverStyle };
