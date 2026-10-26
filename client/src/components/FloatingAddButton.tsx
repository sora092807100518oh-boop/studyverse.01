import React from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";

/** Keep viewport controls outside animated/scrolling page containers. */
export function FloatingAddButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return createPortal(
    <button type="button" className="library-fab" aria-label={label} disabled={disabled} onClick={onClick}>
      <Plus aria-hidden="true" className="h-6 w-6" />
    </button>,
    document.body,
  );
}
