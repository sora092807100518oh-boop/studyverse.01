import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTodayNewsSource } from "./journal";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StudyJournalのニュース取得", () => {
  it("安全なHTTPS記事見出しと出典URLだけを抽出する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      articles: [
        { title: "Learning science update", url: "https://example.org/story", domain: "example.org" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTodayNewsSource()).resolves.toEqual({ title: "Learning science update", url: "https://example.org/story", domain: "example.org" });
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain("api.gdeltproject.org");
  });

  it("取得不能または不正な記事URLでは利用者向けの失敗コードを返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(fetchTodayNewsSource()).rejects.toThrow("NEWS_SOURCE_UNAVAILABLE");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ articles: [{ title: "unsafe", url: "http://example.org" }] }), { status: 200 })));
    await expect(fetchTodayNewsSource()).rejects.toThrow("NEWS_SOURCE_UNAVAILABLE");
  });

  it("GDELTが利用できないときはHacker News検索結果へフォールバックする", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ hits: [{ title: "A useful learning technology story", url: "https://example.org/hn-story" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTodayNewsSource()).resolves.toEqual({ title: "A useful learning technology story", url: "https://example.org/hn-story", domain: "example.org" });
    expect(fetchMock.mock.calls).toHaveLength(2);
    expect(fetchMock.mock.calls[1]?.[0].toString()).toContain("hn.algolia.com");
  });
});
