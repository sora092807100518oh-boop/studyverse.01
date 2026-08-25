import React from "react";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ refetch: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: { learning: { trend: { useQuery: () => ({ data: undefined, isLoading: false, isError: true, refetch: hooks.refetch }) } } },
}));

vi.mock("@/components/ui/chart", () => ({ ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, ChartTooltip: () => null, ChartTooltipContent: () => null }));
vi.mock("recharts", () => ({ Bar: () => null, CartesianGrid: () => null, ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Legend: () => null, Line: () => null, XAxis: () => null, YAxis: () => null }));

import { fireEvent, render, screen } from "@testing-library/react";
import { LearningTrendChart } from "./LearningTrendChart";

describe("期間別学習グラフの取得失敗UI", () => {
  it("取得失敗時に可視エラーと再試行ボタンを表示する", () => {
    render(<LearningTrendChart />);
    expect(screen.getByText("学習グラフを取得できませんでした。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(hooks.refetch).toHaveBeenCalledTimes(1);
  });
});
