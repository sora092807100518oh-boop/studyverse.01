import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const hooks = vi.hoisted(() => ({ accept: vi.fn(), upload: vi.fn(), remove: vi.fn(), invalidate: vi.fn() }));
const terms = [{ id: 1, title: "マーケット利用規約", fileName: "terms.pdf", fileUrl: "/manus-storage/terms.pdf", storageKey: "terms.pdf", mimeType: "application/pdf", uploadedBy: 1, createdAt: new Date(), accepted: false }];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ market: { terms: { list: { invalidate: hooks.invalidate } } } }),
    market: { terms: {
      list: { useQuery: () => ({ data: terms, isLoading: false, isError: false }) },
      accept: { useMutation: () => ({ mutateAsync: hooks.accept, isPending: false }) },
      upload: { useMutation: () => ({ mutateAsync: hooks.upload, isPending: false }) },
      delete: { useMutation: () => ({ mutateAsync: hooks.remove, isPending: false }) },
    } },
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { MarketTerms, MarketTermsAdmin } from "./MarketTerms";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("利用規約", () => {
  it("ファイルを開いて同意チェックを入れるまで開始できず、同意後にAPIを呼ぶ", async () => {
    hooks.accept.mockResolvedValue({ accepted: true, alreadyAccepted: false });
    render(<MarketTerms />);
    expect(screen.getByRole("dialog", { name: "マーケット利用規約への同意" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "マーケット利用規約" }));
    expect(screen.getByTitle("マーケット利用規約")).toBeTruthy();
    const start = screen.getByRole("button", { name: "始める" }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("上記の利用規約に同意する"));
    expect(start.disabled).toBe(false);
    fireEvent.click(start);
    await waitFor(() => expect(hooks.accept).toHaveBeenCalledWith({ termId: 1 }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "マーケット利用規約への同意" })).toBeNull());
  });

  it("管理画面で利用規約名とファイルを追加できる", async () => {
    hooks.upload.mockResolvedValue({ id: 2 });
    render(<MarketTermsAdmin />);
    fireEvent.change(screen.getByPlaceholderText("規約名（例：マーケット利用規約 第1版）"), { target: { value: "追加規約" } });
    const file = new File(["terms"], "rules.txt", { type: "text/plain" });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.submit(screen.getByRole("button", { name: "利用規約を追加" }).closest("form")!);
    await waitFor(() => expect(hooks.upload).toHaveBeenCalledWith(expect.objectContaining({ title: "追加規約", fileName: "rules.txt", dataUrl: "data:text/plain;base64,dGVybXM=" })));
  });
});
