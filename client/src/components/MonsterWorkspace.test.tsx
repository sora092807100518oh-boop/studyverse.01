import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const hooks = vi.hoisted(() => ({ invalidate: vi.fn(), claim: vi.fn(), claimAll: vi.fn(), startNew: vi.fn(), upload: vi.fn() }));
const dashboard: any = {
  active: { id: 1, eggNumber: "1", active: true, progression: { stage: 1, stageProgress: 0, minutesToNext: 1200 } },
  totalFocusSeconds: 0,
  claimedPoints: 0,
  eggs: [{ id: 1, eggNumber: "1", consumedAt: new Date(), acquiredAt: new Date(), source: "starter" }],
  history: [{ id: 1, eggNumber: "1", active: true, progression: { stage: 1, stageProgress: 0, minutesToNext: 1200 } }],
  images: [],
  allThreeCompleted: false,
  nextCycleEggNumber: null,
  mission: {
    daily: { periodKey: "2026-08-27", progress: 0, complete: false, missions: [{ key: "login", label: "ログインする", complete: false }, { key: "ai-english", label: "AIセレクト10（英語）を解く", complete: false }, { key: "ai-kanji", label: "AIセレクト10（漢字）を解く", complete: false }, { key: "test", label: "テストモードでテストを受ける", complete: false }, { key: "practice", label: "単語カードで練習をする", complete: false }] },
    monthly: { periodKey: "2026-08", progress: 0, complete: false, missions: [{ key: "login-10", label: "月に10日ログインする", value: 0, threshold: 10, complete: false }] },
    claimable: [],
    claimedKeys: [],
  },
};

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ monster: { dashboard: { invalidate: hooks.invalidate }, images: { invalidate: hooks.invalidate } } }),
    monster: {
      dashboard: { useQuery: () => ({ data: dashboard, isLoading: false, refetch: vi.fn() }) },
      startNew: { useMutation: () => ({ mutateAsync: hooks.startNew, isPending: false }) },
      claim: { useMutation: () => ({ mutateAsync: hooks.claim, isPending: false }) },
      claimAll: { useMutation: () => ({ mutateAsync: hooks.claimAll, isPending: false }) },
      images: { useQuery: () => ({ data: [], isLoading: false }) },
      uploadImage: { useMutation: () => ({ mutateAsync: hooks.upload, isPending: false }) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { MonsterArtwork, MonsterGrowthPanel, MonsterMissionPanel, MonsterSettingsManager } from "./MonsterWorkspace";

const resetDashboard = () => {
  dashboard.active = { id: 1, eggNumber: "1", active: true, progression: { stage: 1, stageProgress: 0, minutesToNext: 1200 } };
  dashboard.eggs = [{ id: 1, eggNumber: "1", consumedAt: new Date(), acquiredAt: new Date(), source: "starter" }];
  dashboard.history = [{ id: 1, eggNumber: "1", active: true, progression: { stage: 1, stageProgress: 0, minutesToNext: 1200 } }];
  dashboard.images = []; dashboard.allThreeCompleted = false; dashboard.nextCycleEggNumber = null;
  dashboard.mission.daily = { periodKey: "2026-08-27", progress: 0, complete: false, missions: [{ key: "login", label: "ログインする", complete: false }, { key: "ai-english", label: "AIセレクト10（英語）を解く", complete: false }, { key: "ai-kanji", label: "AIセレクト10（漢字）を解く", complete: false }, { key: "test", label: "テストモードでテストを受ける", complete: false }, { key: "practice", label: "単語カードで練習をする", complete: false }] };
  dashboard.mission.monthly = { periodKey: "2026-08", progress: 0, complete: false, missions: [{ key: "login-10", label: "月に10日ログインする", value: 0, threshold: 10, complete: false }] };
  dashboard.mission.claimable = []; dashboard.mission.claimedKeys = [];
};

afterEach(() => { cleanup(); vi.clearAllMocks(); resetDashboard(); });

describe("モンスター育成UI", () => {
  it("初期進化、森林背景、左側のモンスター枠を表示する", () => {
    render(<MonsterGrowthPanel />);
    expect(screen.getByAltText("森の中のモンスター育成場所")).toBeTruthy();
    expect(screen.getByText(/進化 01/)).toBeTruthy();
    expect(screen.getByText(/次の進化まで 1200分/)).toBeTruthy();
    expect(screen.getByText(/画像未登録/)).toBeTruthy();
  });

  it("初期進化では卵画像を優先し、モンスター別の進化画像を使う", () => {
    const images = [{ slotKey: "monster-2-egg", imageUrl: "/egg-two.png" }, { slotKey: "monster-2-evolution-2", imageUrl: "/evolution-two.png" }];
    const { rerender } = render(<MonsterArtwork images={images} eggNumber="2" stage={1} />);
    expect(screen.getByAltText("進化 1").getAttribute("src")).toBe("/egg-two.png");
    rerender(<MonsterArtwork images={images} eggNumber="2" stage={2} />);
    expect(screen.getByAltText("進化 2").getAttribute("src")).toBe("/evolution-two.png");
  });

  it("個別とまとめての報酬受取を表示し、対応するAPIを呼び出す", async () => {
    dashboard.mission.daily.missions[0].complete = true;
    dashboard.mission.daily.progress = 1;
    dashboard.mission.claimable = [{ missionKey: "daily.login", periodKey: "2026-08-27", points: 1, label: "ログインする" }];
    hooks.claim.mockResolvedValue({ points: 1, label: "ログインする" });
    hooks.claimAll.mockResolvedValue({ claims: dashboard.mission.claimable, totalPoints: 1 });
    render(<MonsterMissionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "受け取る" }));
    await waitFor(() => expect(hooks.claim).toHaveBeenCalledWith({ missionKey: "daily.login", periodKey: "2026-08-27" }));
    fireEvent.click(screen.getByRole("button", { name: /まとめて受け取る/ }));
    await waitFor(() => expect(hooks.claimAll).toHaveBeenCalledTimes(1));
  });

  it("モンスター1・2・3ごとの卵と13段階、計42の画像登録先を表示する", () => {
    render(<MonsterSettingsManager />);
    expect(screen.getByLabelText("モンスターの種類")).toBeTruthy();
    expect(screen.getByLabelText("画像の種類")).toBeTruthy();
    expect(screen.getByLabelText("進化段階")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("モンスターの種類"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("画像の種類"), { target: { value: "evolution" } });
    fireEvent.change(screen.getByLabelText("進化段階"), { target: { value: "13" } });
    expect(screen.getByText("登録先：モンスター3・進化 13")).toBeTruthy();
    expect(screen.getAllByText("未登録")).toHaveLength(42);
  });

  it("3種完走後には達成記章と卵1から始める周回導線を表示する", async () => {
    dashboard.active = { id: 3, eggNumber: "3", active: true, progression: { stage: 13, stageProgress: 100, minutesToNext: 0 } };
    dashboard.history = ["1", "2", "3"].map((eggNumber, id) => ({ id: id + 1, eggNumber, active: eggNumber === "3", progression: { stage: 13, stageProgress: 100, minutesToNext: 0 } }));
    dashboard.eggs = [];
    dashboard.allThreeCompleted = true;
    dashboard.nextCycleEggNumber = "1";
    hooks.startNew.mockResolvedValue({ profileId: 4 });
    render(<MonsterGrowthPanel />);
    expect(screen.getByLabelText("3種類育成達成記章")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "もう一度始める（卵1）" }));
    await waitFor(() => expect(hooks.startNew).toHaveBeenCalledWith({ eggNumber: "1" }));
  });
});
