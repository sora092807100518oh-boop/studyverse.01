import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

const hooks = vi.hoisted(() => ({
  useTicket: vi.fn().mockResolvedValue({ success: true }),
  createEvent: vi.fn().mockResolvedValue({ success: true }),
  invalidateDashboard: vi.fn().mockResolvedValue(undefined),
}));

const dateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ calendar: { dashboard: { invalidate: hooks.invalidateDashboard } } }),
    calendar: {
      dashboard: { useQuery: () => ({ data: { revivalTickets: 2, futureEvents: [], days: [{ dateKey: dateKey(new Date()), focusSeconds: 60, answers: 2, events: [], revived: false }] }, isLoading: false }) },
      useRevivalTicket: { useMutation: () => ({ mutateAsync: hooks.useTicket, isPending: false }) },
    },
    classroom: { calendar: { create: { useMutation: () => ({ mutateAsync: hooks.createEvent, isPending: false }) } } },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { LearningCalendar } from "./LearningCalendar";

afterEach(() => { cleanup(); hooks.useTicket.mockClear(); hooks.invalidateDashboard.mockClear(); });

describe("学習カレンダーの復活チケット", () => {
  it("今日を青い円として表示する", () => {
    const today = new Date();
    render(<LearningCalendar />);
    const todayButton = screen.getByRole("button", { name: String(today.getDate()) });
    expect(todayButton.className).toContain("bg-cyan-400/20");
    expect(todayButton.className).toContain("ring-cyan-300");
  });

  it("学習記録がある選択日にも復活チケットの利用操作を表示して実行できる", async () => {
    const today = new Date();
    render(<LearningCalendar />);
    fireEvent.click(screen.getByRole("button", { name: String(today.getDate()) }));
    fireEvent.click(screen.getByRole("button", { name: /復活チケットを使う/ }));
    await waitFor(() => expect(hooks.useTicket).toHaveBeenCalledWith({ dateKey: dateKey(today) }));
    expect(hooks.invalidateDashboard).toHaveBeenCalledOnce();
  });
});
