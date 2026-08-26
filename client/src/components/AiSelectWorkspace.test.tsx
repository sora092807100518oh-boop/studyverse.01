import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const hooks = vi.hoisted(() => ({ recordAnswer: vi.fn().mockResolvedValue({ success: true }), completeAiSelect: vi.fn().mockResolvedValue({ success: true }), invalidateMonster: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ monster: { dashboard: { invalidate: hooks.invalidateMonster } } }),
    wordbooks: { list: { useQuery: () => ({ data: [{ id: 9, title: "教室英単語", subject: "english", words: [{ id: 101, front: "observe", back: "観察する", reading: null }, { id: 102, front: "retain", back: "保持する", reading: null }] }], isLoading: false }) } },
    learning: { recordAnswer: { useMutation: () => ({ mutateAsync: hooks.recordAnswer, isPending: false }) }, completeAiSelect: { useMutation: () => ({ mutateAsync: hooks.completeAiSelect, isPending: false }) } },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { AiSelectWorkspace } from "./AiSelectWorkspace";

afterEach(() => { cleanup(); hooks.recordAnswer.mockClear(); hooks.completeAiSelect.mockClear(); hooks.invalidateMonster.mockClear(); });

describe("AIセレクト10専用画面", () => {
  it("教材から学習セットを開始し、AIセレクトとして回答を記録する", async () => {
    render(<AiSelectWorkspace onBack={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "AI セレクト 10" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "このセットを始める" }));
    expect(screen.getAllByText(/observe|retain/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /覚えた/ }));
    await waitFor(() => expect(hooks.recordAnswer).toHaveBeenCalledWith(expect.objectContaining({ mode: "ai_select", isCorrect: true })));
    expect(screen.getAllByText(/observe|retain/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /覚えた/ }));
    await waitFor(() => expect(hooks.completeAiSelect).toHaveBeenCalledWith({ subject: "english" }));
    expect(hooks.invalidateMonster).toHaveBeenCalledOnce();
  });

  it("カードを右へスワイプすると覚えたとして記録し、次のカードへ進む", async () => {
    vi.useFakeTimers();
    render(<AiSelectWorkspace onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "このセットを始める" }));
    const card = screen.getByLabelText("AIセレクトカードをスワイプ");
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 190 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 190 });
    await act(async () => { await vi.advanceTimersByTimeAsync(320); });
    expect(hooks.recordAnswer).toHaveBeenCalledWith(expect.objectContaining({ mode: "ai_select", isCorrect: true }));
    expect(screen.getByLabelText("AIセレクトカードをスワイプ")).toBeTruthy();
    vi.useRealTimers();
  });
});
