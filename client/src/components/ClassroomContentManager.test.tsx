import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  createAnnouncement: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ wordbooks: { managed: { invalidate: hooks.invalidate }, list: { invalidate: hooks.invalidate } }, classroom: { announcements: { manage: { invalidate: hooks.invalidate }, list: { invalidate: hooks.invalidate }, history: { invalidate: hooks.invalidate } } } }),
    classroom: {
      rooms: { list: { useQuery: () => ({ data: [{ id: 5, name: "検証教室", code: "UI-TEST" }], isLoading: false, isError: false }) } },
      announcements: {
        manage: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
        history: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: hooks.invalidate }) },
        create: { useMutation: () => ({ mutateAsync: hooks.createAnnouncement, isPending: false }) },
        update: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
        delete: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      },
    },
    wordbooks: {
      managed: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
      create: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      update: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      delete: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { error: hooks.toastError, success: hooks.toastSuccess } }));

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClassroomContentManager } from "./ClassroomContentManager";

afterEach(() => { cleanup(); hooks.createAnnouncement.mockReset(); hooks.toastError.mockReset(); hooks.toastSuccess.mockReset(); hooks.invalidate.mockClear(); });

function fillAnnouncement() {
  fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "今週のミッション" } });
  fireEvent.change(screen.getByLabelText("本文"), { target: { value: "単語カードを10問練習しましょう。" } });
  const selects = screen.getAllByRole("combobox");
  fireEvent.change(selects[0]!, { target: { value: "classroom" } });
  fireEvent.change(selects[1]!, { target: { value: "5" } });
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
