import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const hooks = vi.hoisted(() => ({ invalidate: vi.fn(), submit: vi.fn(), download: vi.fn(), review: vi.fn() }));
const marketItems = [{ id: 1, name: "旅行英語スターター", imageUrl: "/market.png", status: "approved", subject: "english", price: 50, averageStars: 4.5, reviewCount: 2, downloadCount: 12, downloaded: false, ownReview: null, isOwner: false, isOfficial: true, isFreeNow: false }];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ market: { list: { invalidate: hooks.invalidate }, ranking: { invalidate: hooks.invalidate }, wallet: { invalidate: hooks.invalidate }, manage: { invalidate: hooks.invalidate }, terms: { list: { invalidate: hooks.invalidate } } }, wordbooks: { list: { invalidate: hooks.invalidate } } }),
    market: {
      list: { useQuery: () => ({ data: marketItems, isLoading: false, isError: false }) },
      ranking: { useQuery: () => ({ data: marketItems, isLoading: false, isError: false }) },
      wallet: { useQuery: () => ({ data: { balance: 200 }, isLoading: false }) },
      submit: { useMutation: () => ({ mutateAsync: hooks.submit, isPending: false }) },
      download: { useMutation: () => ({ mutateAsync: hooks.download, isPending: false }) },
      review: { useMutation: () => ({ mutateAsync: hooks.review, isPending: false }) },
      manage: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
      moderate: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      terms: { list: { useQuery: () => ({ data: [], isLoading: false, isError: false }) }, upload: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, delete: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, accept: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } },
    },
    wordbooks: { list: { useQuery: () => ({ data: [{ id: 7, title: "自作単語帳", wordCount: 12, visibility: "private", canEdit: true }], isLoading: false }) } },
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { MarketPage } from "./MarketPage";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("マーケット画面", () => {
  it("公開教材を正方形カードで表示し、詳細にダウンロードを表示する", () => {
    render(<MarketPage />);
    expect(screen.getByRole("button", { name: /旅行英語スターター/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /旅行英語スターター/ }));
    expect(screen.getByRole("heading", { name: "旅行英語スターター" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "50コインで購入して追加" })).toBeTruthy();
    expect(screen.getByText("追加後に星レビューが可能になります。")).toBeTruthy();
  });

  it("プラスから単語帳・画像・名前を選び、出品申請できる", async () => {
    hooks.submit.mockResolvedValue({ id: 3, status: "pending" });
    render(<MarketPage />);
    fireEvent.click(screen.getByRole("button", { name: "マーケットにアップロード" }));
    fireEvent.change(screen.getByLabelText("マーケット表示名"), { target: { value: "自作教材" } });
    fireEvent.change(screen.getByLabelText("マーケット価格"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("出品する単語帳"), { target: { value: "7" } });
    const file = new File(["image"], "cover.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("マーケット表示用の写真"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByAltText("マーケット画像プレビュー")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "マーケットへ申請する" }));
    await waitFor(() => expect(hooks.submit).toHaveBeenCalledWith(expect.objectContaining({ wordbookId: 7, name: "自作教材", price: 0, dataUrl: expect.stringContaining("data:image/png;base64,") })));
  });
});
