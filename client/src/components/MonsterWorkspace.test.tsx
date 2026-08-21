import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const hooks = vi.hoisted(() => ({ invalidate: vi.fn(), claim: vi.fn(), startNew: vi.fn(), upload: vi.fn() }));
const dashboard = {
  active: { id: 1, eggNumber: "1", active: true, progression: { stage: 1, stageProgress: 0, minutesToNext: 1200 } },
  totalFocusSeconds: 0,
  claimedPoints: 0,
  eggs: [{ id: 1, eggNumber: "1", consumedAt: new Date(), acquiredAt: new Date(), source: "starter" }],
  history: [{ id: 1, eggNumber: "1", active: true, progression: { stage: 1, stageProgress: 0, minutesToNext: 1200 } }],
  images: [],
  mission: {
    daily: { progress: 0, missions: [{ key: "login", label: "ログインする", complete: false }, { key: "ai-english", label: "AIセレクト10（英語）を解く", complete: false }, { key: "ai-kanji", label: "AIセレクト10（漢字）を解く", complete: false }, { key: "test", label: "テストモードでテストを受ける", complete: false }, { key: "practice", label: "単語カードで練習をする", complete: false }] },
    monthly: { progress: 0, missions: [{ key: "login-10", label: "月に10日ログインする", value: 0, threshold: 10, complete: false }] },
    claimable: [],
  },
};

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ monster: { dashboard: { invalidate: hooks.invalidate }, images: { invalidate: hooks.invalidate } } }),
    monster: {
      dashboard: { useQuery: () => ({ data: dashboard, isLoading: false, refetch: vi.fn() }) },
      startNew: { useMutation: () => ({ mutateAsync: hooks.startNew, isPending: false }) },
      claim: { useMutation: () => ({ mutateAsync: hooks.claim, isPending: false }) },
      images: { useQuery: () => ({ data: [], isLoading: false }) },
      uploadImage: { useMutation: () => ({ mutateAsync: hooks.upload, isPending: false }) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { MonsterArtwork, MonsterGrowthPanel, MonsterMissionPanel, MonsterSettingsManager } from "./MonsterWorkspace";

afterEach(() => cleanup());

describe("モンスター育成UI", () => {
  it("初期進化、森林背景、左側のモンスター枠を表示する", () => {
    render(<MonsterGrowthPanel />);
    expect(screen.getByAltText("森の中のモンスター育成場所")).toBeTruthy();
    expect(screen.getByText(/進化 01/)).toBeTruthy();
    expect(screen.getByText(/次の進化まで 1200分/)).toBeTruthy();
    expect(screen.getByText(/画像未登録/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "更新" })).toBeTruthy();
  });

  it("初期進化では卵画像を優先し、進化後は対応する進化画像を使う", () => {
    const images = [{ slotKey: "egg-1", imageUrl: "/egg-one.png" }, { slotKey: "evolution-1", imageUrl: "/evolution-one.png" }, { slotKey: "evolution-2", imageUrl: "/evolution-two.png" }];
    const { rerender } = render(<MonsterArtwork images={images} eggNumber="1" stage={1} />);
    expect(screen.getByAltText("進化 1").getAttribute("src")).toBe("/egg-one.png");
    rerender(<MonsterArtwork images={images} eggNumber="1" stage={2} />);
    expect(screen.getByAltText("進化 2").getAttribute("src")).toBe("/evolution-two.png");
  });

  it("デイリー・マンスリー・ノーマルのミッション分類を表示する", () => {
    render(<MonsterMissionPanel />);
    expect(screen.getByRole("button", { name: "デイリー" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "マンスリー" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ノーマル" })).toBeTruthy();
    expect(screen.getByText("AIセレクト10（英語）を解く")).toBeTruthy();
  });

  it("卵3枠と進化13枠の画像登録先を管理設定へ表示する", () => {
    render(<MonsterSettingsManager />);
    expect(screen.getByRole("option", { name: "1個目の卵" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "3個目の卵" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "進化 13" })).toBeTruthy();
    expect(screen.getAllByText("未登録")).toHaveLength(16);
  });

  it("最終進化後は最初の未使用卵を選び、新しい育成を開始する", async () => {
    const originalActive = dashboard.active; const originalEggs = dashboard.eggs; const originalHistory = dashboard.history;
    dashboard.active = { id: 1, eggNumber: "1", active: true, progression: { stage: 13, stageProgress: 100, minutesToNext: 0 } };
    dashboard.eggs = [{ id: 2, eggNumber: "2", consumedAt: undefined as unknown as Date, acquiredAt: new Date(), source: "hours_260" }];
    dashboard.history = [{ id: 1, eggNumber: "1", active: true, progression: { stage: 13, stageProgress: 100, minutesToNext: 0 } }];
    render(<MonsterGrowthPanel />);
    fireEvent.click(screen.getByRole("button", { name: "新しいモンスターを育てる" }));
    await waitFor(() => expect(hooks.startNew).toHaveBeenCalledWith({ eggNumber: "2" }));
    dashboard.active = originalActive; dashboard.eggs = originalEggs; dashboard.history = originalHistory;
  });
});
