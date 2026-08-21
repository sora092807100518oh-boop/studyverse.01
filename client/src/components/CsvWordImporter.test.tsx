import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  previewData: null as null | { rows: Array<{ line: number; front: string; back: string; valid: boolean; duplicate: boolean; reason?: string }>; validCount: number; duplicateCount: number; invalidCount: number },
  previewMutate: vi.fn(),
  importMutate: vi.fn(),
  downloadMutate: vi.fn(),
  reset: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    wordbooks: {
      previewCsv: { useMutation: () => ({ mutateAsync: hooks.previewMutate, data: hooks.previewData, isPending: false, reset: hooks.reset }) },
      importCsv: { useMutation: () => ({ mutateAsync: hooks.importMutate, isPending: false }) },
      downloadCsv: { useMutation: () => ({ mutateAsync: hooks.downloadMutate, isPending: false }) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { error: hooks.toastError, success: hooks.toastSuccess } }));

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildVocabularyCsvTemplate, buildWordbookCsv, CsvWordImporter } from "./CsvWordImporter";

const invalidPreview = { rows: [{ line: 1, front: "observe", back: "観察する", valid: true, duplicate: false }, { line: 2, front: "", back: "欠損", valid: false, duplicate: false, reason: "表面と裏面の両方が必要です。" }], validCount: 1, duplicateCount: 0, invalidCount: 1 };
const duplicatePreview = { rows: [{ line: 1, front: "observe", back: "観察する", valid: true, duplicate: false }, { line: 2, front: "observe", back: "観察する", valid: true, duplicate: true }], validCount: 1, duplicateCount: 1, invalidCount: 0 };

afterEach(() => { cleanup(); hooks.previewData = null; hooks.previewMutate.mockReset(); hooks.importMutate.mockReset(); hooks.downloadMutate.mockReset(); hooks.reset.mockReset(); hooks.toastError.mockReset(); hooks.toastSuccess.mockReset(); });

describe("CSV単語帳取込UI", () => {
  it("テンプレートは単語・意味のヘッダーを含む", () => {
    expect(buildVocabularyCsvTemplate()).toBe("単語,意味\n");
  });

  it("教材CSVは読み列を含むExcel向けの行を生成する", () => {
    expect(buildWordbookCsv([{ front: "observe", back: "観察する", reading: null }, { front: "継続", back: "けいぞく", reading: "けいぞく" }])).toBe("単語,意味,読み\r\n\"observe\",\"観察する\",\"\"\r\n\"継続\",\"けいぞく\",\"けいぞく\"");
  });

  it("閲覧可能な教材をCSVとして保存する", async () => {
    hooks.downloadMutate.mockResolvedValue({ title: "教室教材", words: [{ front: "observe", back: "観察する", reading: null }] });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<CsvWordImporter wordbookId={55} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("教材CSVをダウンロード"));
    await waitFor(() => expect(hooks.downloadMutate).toHaveBeenCalledWith({ wordbookId: 55 }));
    expect(click).toHaveBeenCalled(); expect(hooks.toastSuccess).toHaveBeenCalledWith("教材CSVをダウンロードしました。");
    click.mockRestore();
  });

  it("不正行をプレビューで表示し、取込ボタンを無効化する", async () => {
    hooks.previewMutate.mockResolvedValue(invalidPreview);
    const { rerender } = render(<CsvWordImporter wordbookId={12} onComplete={vi.fn()} />);
    const file = new File(["observe,観察する\n,欠損"], "invalid.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("CSVファイルを選ぶ"), { target: { files: [file] } });
    await waitFor(() => expect(hooks.previewMutate).toHaveBeenCalledWith({ wordbookId: 12, csvText: "observe,観察する\n,欠損" }));
    hooks.previewData = invalidPreview; rerender(<CsvWordImporter wordbookId={12} onComplete={vi.fn()} />);
    expect(screen.getByText("要修正")).toBeTruthy();
    expect(screen.getByText("表面と裏面の両方が必要です。", { exact: false })).toBeTruthy();
    expect((screen.getByRole("button", { name: "要修正行を確認してください" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("重複を明示し、有効行のみの保存成功を表示する", async () => {
    hooks.previewMutate.mockResolvedValue(duplicatePreview); hooks.importMutate.mockResolvedValue({ importedCount: 1, skippedCount: 1 });
    const complete = vi.fn().mockResolvedValue(undefined); const { rerender } = render(<CsvWordImporter wordbookId={18} onComplete={complete} />);
    const file = new File(["observe,観察する\nobserve,観察する"], "duplicate.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("CSVファイルを選ぶ"), { target: { files: [file] } });
    await waitFor(() => expect(hooks.previewMutate).toHaveBeenCalled());
    hooks.previewData = duplicatePreview; rerender(<CsvWordImporter wordbookId={18} onComplete={complete} />);
    expect(screen.getByText("重複")).toBeTruthy(); expect(screen.getByText(/行\s*2/)).toBeTruthy(); expect(screen.getByText(/（重複）/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1語を追加する" }));
    await waitFor(() => expect(hooks.importMutate).toHaveBeenCalledWith({ wordbookId: 18, csvText: "observe,観察する\nobserve,観察する" }));
    await waitFor(() => expect(complete).toHaveBeenCalled());
    expect(hooks.toastSuccess).toHaveBeenCalledWith("1語を取り込みました。重複 1語は追加していません。");
  });

  it("プレビュー取得失敗時は再入力できるエラーを表示する", async () => {
    hooks.previewMutate.mockRejectedValue(new Error("CSVを確認できません"));
    render(<CsvWordImporter wordbookId={31} onComplete={vi.fn()} />);
    const file = new File(["observe,観察する"], "failure.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("CSVファイルを選ぶ"), { target: { files: [file] } });
    await waitFor(() => expect(hooks.toastError).toHaveBeenCalledWith("CSVを確認できません"));
    expect(screen.getByRole("button", { name: /failure\.csv を選択中/ })).toBeTruthy();
  });
});
