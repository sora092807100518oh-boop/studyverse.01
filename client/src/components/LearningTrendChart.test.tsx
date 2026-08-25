import React from "react";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ refetch: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: { learning: { trend: { useQuery: () => ({ data: undefined, isLoading: false, isError: true, refetch: hooks.refetch }) } } },
}));

vi.mock("@/components/ui/chart", () => ({ ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, ChartTooltip: () => null, ChartTooltipContent: () => null }));
vi.mock("recharts", () => ({ Bar: ({ shape }: { shape?: React.ReactElement<Record<string, unknown>> }) => shape ? React.cloneElement(shape, { x: 0, y: 0, width: 16, height: 16, payload: { label: "4/1", focusMinutes: 12, accuracy: 80 } }) : null, CartesianGrid: () => null, ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Legend: () => null, Line: ({ dot }: { dot?: React.ReactElement<Record<string, unknown>> }) => dot ? React.cloneElement(dot, { cx: 10, cy: 10, payload: { label: "4/1", focusMinutes: 12, accuracy: 80 } }) : null, XAxis: () => null, YAxis: () => null }));

import { fireEvent, render, screen } from "@testing-library/react";
import { Graph, LearningTrendChart } from "./LearningTrendChart";

describe("期間別学習グラフの取得失敗UI", () => {
  it("取得失敗時に可視エラーと再試行ボタンを表示する", () => {
    render(<LearningTrendChart />);
    expect(screen.getByText("学習グラフを取得できませんでした。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(hooks.refetch).toHaveBeenCalledTimes(1);
  });
});

describe("学習推移の系列別詳細", () => {
  it("棒をタップすると学習時間のみ、折れ線をタップすると正答率のみを表示する", () => {
    render(<Graph data={[{ label: "4/1", focusMinutes: 12, accuracy: 80 }]} />);
    fireEvent.click(document.querySelector("rect")!);
    expect(screen.getByRole("status", { name: "学習時間の詳細" }).textContent).toContain("4/1　12分");
    fireEvent.click(document.querySelector(".recharts-wrapper") ?? document.querySelector("div")!);
    fireEvent.click(document.querySelector("circle")!);
    expect(screen.getByRole("status", { name: "正答率の詳細" }).textContent).toContain("4/1　80%");
  });
});
