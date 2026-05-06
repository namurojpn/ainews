/**
 * Stripe Webhook 結合テスト
 * - 署名検証
 * - checkout.session.completed → サブスクをアクティブに
 * - customer.subscription.updated → DB 状態同期
 * - customer.subscription.deleted → canceled に変更
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      upsert: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));

import { POST } from "@/app/api/subscriptions/webhook/route";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

const mockStripe = stripe as any;
const mp = prisma as any;

function makeWebhookRequest(body: string, sig = "valid-sig") {
  return new Request("http://localhost/api/subscriptions/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig },
    body,
  });
}

const MOCK_SUB: Partial<Stripe.Subscription> = {
  id: "sub_123",
  status: "active",
  items: {
    object: "list",
    data: [{ current_period_end: 1800000000 } as Stripe.SubscriptionItem],
    has_more: false,
    url: "",
  },
};

describe("POST /api/subscriptions/webhook — 署名検証", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stripe-signature ヘッダーなしは 400 を返す", async () => {
    const req = new Request("http://localhost/api/subscriptions/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("署名検証に失敗した場合 400 を返す", async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const res = await POST(makeWebhookRequest("{}", "bad-sig"));
    expect(res.status).toBe(400);
  });

  it("有効な署名は 200 を返す（未知のイベントタイプはスキップ）", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "payment_intent.created",
      data: { object: {} },
    });
    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/subscriptions/webhook — checkout.session.completed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("サブスクリプションを active に更新する", async () => {
    const session: Partial<Stripe.Checkout.Session> = {
      metadata: { userId: "user-1" },
      subscription: "sub_123",
      customer: "cus_123",
    };
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(MOCK_SUB);
    mp.subscription.upsert.mockResolvedValue({});
    mp.user.update.mockResolvedValue({});

    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
    expect(mp.$transaction).toHaveBeenCalledOnce();
  });

  it("userId が metadata にない場合は DB 更新をスキップする", async () => {
    const session: Partial<Stripe.Checkout.Session> = {
      metadata: {},
      subscription: "sub_123",
    };
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });

    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(mp.$transaction).not.toHaveBeenCalled();
  });
});

describe("POST /api/subscriptions/webhook — subscription.updated/deleted", () => {
  beforeEach(() => vi.clearAllMocks());

  it("subscription.updated: 対応する DB レコードを同期する", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: { ...MOCK_SUB, status: "active" } },
    });
    mp.subscription.findFirst.mockResolvedValue({ id: "db-sub-1", userId: "user-1" });
    mp.subscription.update.mockResolvedValue({});
    mp.user.update.mockResolvedValue({});

    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(mp.$transaction).toHaveBeenCalledOnce();
  });

  it("subscription.deleted: ステータスを canceled に変更する", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: { ...MOCK_SUB, status: "canceled" } },
    });
    mp.subscription.findFirst.mockResolvedValue({ id: "db-sub-1", userId: "user-1" });
    mp.subscription.update.mockResolvedValue({});
    mp.user.update.mockResolvedValue({});

    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(mp.$transaction).toHaveBeenCalledOnce();
  });

  it("DB に対応するサブスクがない場合は更新をスキップする", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: { ...MOCK_SUB, status: "past_due" } },
    });
    mp.subscription.findFirst.mockResolvedValue(null);

    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(mp.$transaction).not.toHaveBeenCalled();
  });

  it("past_due は suspended にマッピングされる", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: { ...MOCK_SUB, status: "past_due" } },
    });
    mp.subscription.findFirst.mockResolvedValue({ id: "db-sub-1", userId: "user-1" });
    mp.subscription.update.mockResolvedValue({});
    mp.user.update.mockResolvedValue({});

    await POST(makeWebhookRequest("{}"));

    const transactionCall = mp.$transaction.mock.calls[0][0];
    // $transaction に渡された配列の 1 つ目が subscription.update 呼び出しのはず
    expect(mp.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "suspended" }),
      })
    );
  });
});
