import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { completeCoinTransfer, confirmCoinTransferRecipient, createCoinTransferRequest, getDb, getMarketCoinWallet, getCoinTransferRequest, listMarketCoinTransactions } from "./db";
import { marketCoinTransactions, marketCoinTransfers, users } from "../drizzle/schema";

const userIds: number[] = [];
const tokens: string[] = [];

async function createUser(name: string, coins: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const inserted = await db.insert(users).values({ openId: `coin-transfer-test:${name}:${Date.now()}:${Math.random()}`, name, loginMethod: "test", marketCoins: coins }).$returningId();
  const id = inserted[0]?.id;
  if (!id) throw new Error("ACCOUNT_CREATE_FAILED");
  userIds.push(id);
  return id;
}

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (userIds.length) await db.delete(marketCoinTransactions).where(inArray(marketCoinTransactions.userId, userIds));
  if (tokens.length) await db.delete(marketCoinTransfers).where(inArray(marketCoinTransfers.token, tokens));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
}, 60_000);

describe("QRコイン送金", () => {
  it("受取人の確認後だけ送金でき、双方の履歴へ記録する", async () => {
    const sender = await createUser("QR送金者", 100);
    const recipient = await createUser("QR受取人", 0);
    const request = await createCoinTransferRequest(sender);
    tokens.push(request.token);

    const pending = await getCoinTransferRequest(recipient, request.token);
    expect(pending).toMatchObject({ status: "pending", senderName: "QR送金者", recipientUserId: null });
    await expect(completeCoinTransfer(sender, { token: request.token, amount: 30 })).rejects.toThrow("COIN_TRANSFER_RECIPIENT_REQUIRED");

    const confirmed = await confirmCoinTransferRecipient(recipient, request.token);
    expect(confirmed).toMatchObject({ status: "recipient_confirmed", recipientUserId: recipient, recipientName: "QR受取人" });
    const result = await completeCoinTransfer(sender, { token: request.token, amount: 30 });
    expect(result).toMatchObject({ senderBalance: 70, recipientBalance: 30, recipientUserId: recipient });
    expect(await getMarketCoinWallet(sender)).toEqual({ balance: 70 });
    expect(await getMarketCoinWallet(recipient)).toEqual({ balance: 30 });

    const senderHistory = await listMarketCoinTransactions(sender);
    const recipientHistory = await listMarketCoinTransactions(recipient);
    expect(senderHistory.some(item => item.type === "coin_transfer_send" && item.amount === -30 && item.label.includes("QR受取人"))).toBe(true);
    expect(recipientHistory.some(item => item.type === "coin_transfer_receive" && item.amount === 30 && item.label.includes("QR送金者"))).toBe(true);
    await expect(completeCoinTransfer(sender, { token: request.token, amount: 30 })).rejects.toThrow("COIN_TRANSFER_COMPLETED");
  }, 30_000);

  it("QRの送金者本人や残高不足から送金できない", async () => {
    const sender = await createUser("本人確認送金者", 20);
    const recipient = await createUser("本人確認受取人", 0);
    const request = await createCoinTransferRequest(sender);
    tokens.push(request.token);
    await expect(confirmCoinTransferRecipient(sender, request.token)).rejects.toThrow("COIN_TRANSFER_SELF_FORBIDDEN");
    await confirmCoinTransferRecipient(recipient, request.token);
    await expect(completeCoinTransfer(sender, { token: request.token, amount: 21 })).rejects.toThrow("MARKET_INSUFFICIENT_COINS");
    const transfer = (await getDb()) && await (await getDb())!.select().from(marketCoinTransfers).where(and(eq(marketCoinTransfers.token, request.token), eq(marketCoinTransfers.senderUserId, sender))).limit(1);
    expect(transfer?.[0]?.status).toBe("recipient_confirmed");
  }, 30_000);
});
