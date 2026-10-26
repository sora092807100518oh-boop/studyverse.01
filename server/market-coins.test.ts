import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { downloadMarketItem, getDb, getMarketCoinWallet } from "./db";
import { marketCoinTransactions, marketDownloads, marketItems, users, vocabularyWords, wordbooks } from "../drizzle/schema";

const userIds: number[] = [];
const wordbookIds: number[] = [];
const itemIds: number[] = [];

async function createUser(name: string, coins: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const inserted = await db.insert(users).values({ openId: `market-coin-test:${name}:${Date.now()}:${Math.random()}`, name, loginMethod: "test", marketCoins: coins }).$returningId();
  const id = inserted[0]?.id;
  if (!id) throw new Error("ACCOUNT_CREATE_FAILED");
  userIds.push(id);
  return id;
}

async function createApprovedItem(ownerUserId: number, price: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const source = await db.insert(wordbooks).values({ title: `出品教材 ${price}`, subject: "english", visibility: "private", ownerUserId }).$returningId();
  const wordbookId = source[0]?.id;
  if (!wordbookId) throw new Error("WORD_BOOK_NOT_FOUND");
  wordbookIds.push(wordbookId);
  await db.insert(vocabularyWords).values({ wordbookId, front: "market", back: "市場", source: "manual" });
  const item = await db.insert(marketItems).values({ ownerUserId, wordbookId, name: `教材 ${price}コイン`, imageUrl: "/market-test.png", price, status: "approved" }).$returningId();
  const itemId = item[0]?.id;
  if (!itemId) throw new Error("MARKET_ITEM_NOT_FOUND");
  itemIds.push(itemId);
  return { itemId, wordbookId };
}

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (itemIds.length) {
    await db.delete(marketCoinTransactions).where(inArray(marketCoinTransactions.marketItemId, itemIds));
    await db.delete(marketDownloads).where(inArray(marketDownloads.marketItemId, itemIds));
    await db.delete(marketItems).where(inArray(marketItems.id, itemIds));
  }
  if (wordbookIds.length) {
    await db.delete(vocabularyWords).where(inArray(vocabularyWords.wordbookId, wordbookIds));
    await db.delete(wordbooks).where(inArray(wordbooks.id, wordbookIds));
  }
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
}, 60_000);

describe("マーケットコイン購入", () => {
  it("有料教材は一度だけ購入でき、購入者から出品者へ正確にコインが移る", async () => {
    const db = await getDb();
    if (!db) return;
    const seller = await createUser("出品者", 0);
    const buyer = await createUser("購入者", 100);
    const { itemId } = await createApprovedItem(seller, 40);

    const first = await downloadMarketItem(buyer, itemId);
    expect(first).toMatchObject({ alreadyDownloaded: false, pricePaid: 40, balance: 60 });
    wordbookIds.push(first.downloadedWordbookId);
    expect(await getMarketCoinWallet(seller)).toEqual({ balance: 40 });
    expect(await getMarketCoinWallet(buyer)).toEqual({ balance: 60 });

    const retry = await downloadMarketItem(buyer, itemId);
    expect(retry).toMatchObject({ alreadyDownloaded: true, pricePaid: 40, balance: 60, downloadedWordbookId: first.downloadedWordbookId });
    expect(await db.select().from(marketDownloads).where(and(eq(marketDownloads.marketItemId, itemId), eq(marketDownloads.userId, buyer)))).toHaveLength(1);
    expect(await db.select().from(marketCoinTransactions).where(eq(marketCoinTransactions.marketItemId, itemId))).toHaveLength(2);
  }, 30_000);

  it("0コイン教材は残高ゼロでも追加でき、コイン取引を作らない", async () => {
    const db = await getDb();
    if (!db) return;
    const seller = await createUser("無料出品者", 0);
    const buyer = await createUser("無料購入者", 0);
    const { itemId } = await createApprovedItem(seller, 0);
    const result = await downloadMarketItem(buyer, itemId);
    expect(result).toMatchObject({ alreadyDownloaded: false, pricePaid: 0, balance: 0 });
    wordbookIds.push(result.downloadedWordbookId);
    expect(await db.select().from(marketCoinTransactions).where(eq(marketCoinTransactions.marketItemId, itemId))).toHaveLength(0);
  }, 30_000);

  it("残高不足ではコピー・購入記録・コイン移動のどれも残さない", async () => {
    const db = await getDb();
    if (!db) return;
    const seller = await createUser("不足出品者", 0);
    const buyer = await createUser("不足購入者", 10);
    const { itemId } = await createApprovedItem(seller, 20);
    await expect(downloadMarketItem(buyer, itemId)).rejects.toThrow("MARKET_INSUFFICIENT_COINS");
    expect(await db.select().from(marketDownloads).where(and(eq(marketDownloads.marketItemId, itemId), eq(marketDownloads.userId, buyer)))).toHaveLength(0);
    expect(await db.select().from(marketCoinTransactions).where(eq(marketCoinTransactions.marketItemId, itemId))).toHaveLength(0);
    expect(await getMarketCoinWallet(buyer)).toEqual({ balance: 10 });
    expect(await getMarketCoinWallet(seller)).toEqual({ balance: 0 });
  }, 30_000);
});
