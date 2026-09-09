import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  createAnnouncement: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
  managedBooks: [] as Array<{ id: number; title: string; subject: "english" | "kanji"; visibility: "private" | "classroom" | "global"; classroomId: number | null; wordCount: number; words: Array<{ front: string; back: string; reading: string | null }> }>,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ wordbooks: { managed: { invalidate: hooks.invalidate }, list: { invalidate: hooks.invalidate } }, classroom: { announcements: { manage: { invalidate: hooks.invalidate }, list: { invalidate: hooks.invalidate }, history: { invalidate: hooks.invalidate } } } }),
    siteAdmin: { me: { useQuery: () => ({ data: null, isLoading: false }) } },
    classroom: {
      rooms: { list: { useQuery: () => ({ data: [{ id: 5, name: "検証教室", code: "UI-TEST" }], isLoading: false, isError: false }) } },
      announcements: {
        manage: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
        history: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: hooks.invalidate }) },
        create: { useMutation: () => ({ mutateAsync: hooks.createAnnouncement, isPending: false }) },
        update: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
        delete: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      },
      recommendedTests: { create: { useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue({ targetCount: 1 }), isPending: false }) }, manage: { useQuery: () => ({ data: [], isLoading: false, isError: false }) }, list: { useQuery: () => ({ data: [], isLoading: false }) }, announcements: { useQuery: () => ({ data: [], isLoading: false }) }, delete: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } },
    },
    wordbooks: {
      managed: { useQuery: () => ({ data: hooks.managedBooks, isLoading: false, isError: false }) },
      create: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      update: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      updateWord: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      uploadImage: { useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue({ imageUrl: "https://example.com/uploaded.png" }), isPending: false }) },
      delete: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      exportCsv: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { error: hooks.toastError, success: hooks.toastSuccess } }));

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClassroomContentManager, resolveTarget, TargetClassroomSelect } from "./ClassroomContentManager";

afterEach(() => { cleanup(); hooks.createAnnouncement.mockReset(); hooks.toastError.mockReset(); hooks.toastSuccess.mockReset(); hooks.invalidate.mockClear(); hooks.managedBooks = []; });

function fillAnnouncement() {
  fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "今週のミッション" } });
  fireEvent.change(screen.getByLabelText("本文"), { target: { value: "単語カードを10問練習しましょう。" } });
  fireEvent.change(screen.getByLabelText("対象教室"), { target: { value: "5" } });
}

describe("お知らせ管理UI", () => {
  it("対象教室を指定したお知らせを保存し、成功メッセージを表示する", async () => {
    hooks.createAnnouncement.mockResolvedValue({ id: 1 });
    render(<ClassroomContentManager section="announcements" />);
    fillAnnouncement();
    fireEvent.click(screen.getByRole("button", { name: "配信して保存" }));
    await waitFor(() => expect(hooks.createAnnouncement).toHaveBeenCalledWith({ title: "今週のミッション", body: "単語カードを10問練習しましょう。", visibility: "classroom", classroomId: 5 }));
    expect(hooks.toastSuccess).toHaveBeenCalledWith("お知らせを配信しました。");
  });

  it("予約日時を設定すると、予約保存としてAPIへ日時を送信する", async () => {
    hooks.createAnnouncement.mockResolvedValue({ id: 2 });
    render(<ClassroomContentManager section="announcements" />);
    fillAnnouncement();
    fireEvent.change(screen.getByLabelText("予約日時"), { target: { value: "2026-08-22T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "予約して保存" }));
    await waitFor(() => expect(hooks.createAnnouncement).toHaveBeenCalledWith({ title: "今週のミッション", body: "単語カードを10問練習しましょう。", visibility: "classroom", classroomId: 5, scheduledAt: new Date("2026-08-22T09:00") }));
    expect(hooks.toastSuccess).toHaveBeenCalledWith("お知らせを予約しました。");
  });

  it("お知らせ保存が失敗したときはエラーを表示し、再試行できる", async () => {
    hooks.createAnnouncement.mockRejectedValue(new Error("配信サーバーに接続できません"));
    render(<ClassroomContentManager section="announcements" />);
    fillAnnouncement();
    fireEvent.click(screen.getByRole("button", { name: "配信して保存" }));
    await waitFor(() => expect(hooks.toastError).toHaveBeenCalledWith("配信サーバーに接続できません"));
    expect(screen.getByRole("alert").textContent).toContain("配信サーバーに接続できません");
    expect((screen.getByRole("button", { name: "配信して保存" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("管理単語帳CSV", () => {
  it("読み込み済みの単語帳データからCSV保存を開始する", () => {
    hooks.managedBooks = [{ id: 9, title: "英語第1章", subject: "english", visibility: "classroom", classroomId: 5, wordCount: 1, words: [{ front: "observe", back: "観察する", reading: null }] }];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ClassroomContentManager section="wordbooks" />);
    expect(screen.queryByText("教室教材を管理")).toBeNull();
    expect(screen.queryByRole("button", { name: "教材を保存" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "CSVをダウンロード" }));
    expect(click).toHaveBeenCalled(); const links = document.querySelectorAll('a[href^="data:text/csv"]'); expect(links[links.length - 1]?.getAttribute("download")).toBe("英語第1章.csv"); expect(hooks.toastSuccess).toHaveBeenCalledWith("単語帳CSVをダウンロードしました。");
    click.mockRestore();
  });
});

describe("対象教室の権限制御", () => {
  it("全体管理ではすべての教室と個別教室を選択できる", () => {
    const onChange = vi.fn();
    render(<TargetClassroomSelect value="all" onChange={onChange} isSiteAdmin rooms={[{ id: 5, name: "検証教室", code: "UI-TEST" }, { id: 6, name: "別教室", code: "UI-OTHER" }]} />);
    expect(screen.getByRole("option", { name: "すべての教室" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "検証教室｜UI-TEST" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("対象教室"), { target: { value: "6" } });
    expect(onChange).toHaveBeenCalledWith("6");
  });

  it("先生管理では担当教室だけが選択肢となり、すべての教室は表示しない", () => {
    render(<TargetClassroomSelect value="5" onChange={vi.fn()} isSiteAdmin={false} rooms={[{ id: 5, name: "検証教室", code: "UI-TEST" }]} />);
    expect(screen.getByRole("option", { name: "検証教室｜UI-TEST" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "すべての教室" })).toBeNull();
    expect(resolveTarget("5", false)).toEqual({ allClassrooms: false, classroomId: 5 });
    expect(resolveTarget("all", true)).toEqual({ allClassrooms: true, classroomId: undefined });
  });
});
