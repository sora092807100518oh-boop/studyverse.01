import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const hooks = vi.hoisted(() => ({ addWord: vi.fn().mockResolvedValue({ id: 101 }), invalidateList: vi.fn().mockResolvedValue(undefined), invalidateManaged: vi.fn().mockResolvedValue(undefined), toastSuccess: vi.fn(), toastError: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ wordbooks: { list: { invalidate: hooks.invalidateList }, managed: { invalidate: hooks.invalidateManaged } } }),
    wordbooks: { list: { useQuery: () => ({ data: [{ id: 9, title: "英語第1章", subject: "english", words: [] }], isLoading: false }) }, addWord: { useMutation: () => ({ mutateAsync: hooks.addWord, isPending: false }) } },
  },
}));

vi.mock("sonner", () => ({ toast: { error: hooks.toastError, success: hooks.toastSuccess, info: vi.fn() } }));

import { CardRegistrationPanel } from "./Home";

afterEach(() => { cleanup(); hooks.addWord.mockClear(); hooks.invalidateList.mockClear(); hooks.invalidateManaged.mockClear(); hooks.toastSuccess.mockClear(); hooks.toastError.mockClear(); });

describe("単語カード直接登録", () => {
  it("単語帳、表面、裏面を指定して単語カードを保存する", async () => {
    render(<CardRegistrationPanel />);
    fireEvent.change(screen.getByLabelText("登録先の単語帳"), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText("カード表面"), { target: { value: "observe" } });
    fireEvent.change(screen.getByLabelText("カード裏面"), { target: { value: "観察する" } });
    fireEvent.click(screen.getByRole("button", { name: "単語カードを登録" }));
    await waitFor(() => expect(hooks.addWord).toHaveBeenCalledWith({ wordbookId: 9, front: "observe", back: "観察する", reading: undefined, source: "manual" }));
    expect(hooks.invalidateList).toHaveBeenCalled(); expect(hooks.invalidateManaged).toHaveBeenCalled(); expect(hooks.toastSuccess).toHaveBeenCalledWith("単語カードを登録しました。");
  });
});
