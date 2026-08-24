import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";
import { hashCompletionOtp } from "./homeosWorkflow";

const dbTestState = vi.hoisted(() => ({
  getDb: vi.fn(),
  selections: [] as unknown[][],
  updates: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  inserts: [] as Array<{ table: unknown; values: unknown }>,
}));

vi.mock("./db", () => ({ getDb: dbTestState.getDb }));

import { homeosRouter } from "./homeosRouter";

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAuthenticatedContext(userId = 101, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `test-user-${userId}`,
      name: "HomeOS Test User",
      email: "test@example.com",
      loginMethod: "test",
      role,
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      updatedAt: new Date("2026-08-24T00:00:00.000Z"),
      lastSignedIn: new Date("2026-08-24T00:00:00.000Z"),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createMockDb() {
  const select = vi.fn(() => {
    const selectedRows = dbTestState.selections.shift() ?? [];
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectedRows),
          orderBy: vi.fn(async () => selectedRows),
          then: (resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(selectedRows).then(resolve, reject),
        })),
      })),
    };
  });
  const update = vi.fn((table: unknown) => ({
    set: vi.fn((values: Record<string, unknown>) => {
      dbTestState.updates.push({ table, values });
      return { where: vi.fn(async () => undefined) };
    }),
  }));
  const insert = vi.fn((table: unknown) => ({
    values: vi.fn(async (values: unknown) => {
      dbTestState.inserts.push({ table, values });
    }),
  }));

  return { select, update, insert };
}

describe("HomeOS protected workflow transitions", () => {
  beforeEach(() => {
    dbTestState.selections.length = 0;
    dbTestState.updates.length = 0;
    dbTestState.inserts.length = 0;
    dbTestState.getDb.mockReset();
    dbTestState.getDb.mockResolvedValue(createMockDb());
  });

  it("rejects an anonymous quote approval before accessing service records", async () => {
    const caller = homeosRouter.createCaller(createAnonymousContext());

    await expect(caller.requests.approveQuote({ quoteId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects anonymous work start and OTP completion attempts", async () => {
    const caller = homeosRouter.createCaller(createAnonymousContext());

    await expect(caller.requests.startWork({ serviceRequestId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.requests.complete({ serviceRequestId: 1, completionOtp: "4821" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects anonymous payment initiation so invoices cannot be created outside the protected flow", async () => {
    const caller = homeosRouter.createCaller(createAnonymousContext());

    await expect(caller.payments.startCheckout({
      serviceRequestId: 1,
      method: "card",
      visitFee: 199,
      labour: 800,
      parts: 0,
      taxes: 0,
      platformFee: 0,
      credits: 0,
      origin: "https://homeos.example",
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("approves only an owned sent quote and persists both the quote and request transition", async () => {
    dbTestState.selections.push(
      [{ id: 7, serviceRequestId: 19, status: "sent" }],
      [{ id: 19, customerId: 101 }],
    );

    const result = await homeosRouter.createCaller(createAuthenticatedContext()).requests.approveQuote({ quoteId: 7 });

    expect(result).toEqual({ success: true, status: "quote_approved" });
    expect(dbTestState.updates.map(({ values }) => values)).toEqual([
      expect.objectContaining({ status: "approved", approvedAt: expect.any(Date) }),
      expect.objectContaining({ status: "quote_approved", quoteApprovedAt: expect.any(Date) }),
    ]);
  });

  it("refuses quote approval for a request the signed-in customer does not own", async () => {
    dbTestState.selections.push(
      [{ id: 7, serviceRequestId: 19, status: "sent" }],
      [],
    );

    await expect(homeosRouter.createCaller(createAuthenticatedContext()).requests.approveQuote({ quoteId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbTestState.updates).toHaveLength(0);
  });

  it("starts work only for the assigned technician after persisted quote approval", async () => {
    dbTestState.selections.push(
      [{ id: 19, assignedTechnicianId: 31, status: "quote_approved", quoteApprovedAt: new Date("2026-08-24T06:00:00.000Z") }],
      [{ id: 31, userId: 101 }],
    );

    const result = await homeosRouter.createCaller(createAuthenticatedContext()).requests.startWork({ serviceRequestId: 19 });

    expect(result).toEqual({ success: true, status: "in_progress" });
    expect(dbTestState.updates.map(({ values }) => values)).toEqual([expect.objectContaining({ status: "in_progress" })]);
  });

  it("rejects a work start mutation without the persisted quote-approval timestamp", async () => {
    dbTestState.selections.push(
      [{ id: 19, assignedTechnicianId: 31, status: "quote_approved", quoteApprovedAt: null }],
      [{ id: 31, userId: 101 }],
    );

    await expect(homeosRouter.createCaller(createAuthenticatedContext()).requests.startWork({ serviceRequestId: 19 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(dbTestState.updates).toHaveLength(0);
  });

  it("persists a completed request only when its assigned technician supplies the valid completion OTP", async () => {
    dbTestState.selections.push(
      [{ id: 19, assignedTechnicianId: 31, status: "completion_pending", completionOtpHash: hashCompletionOtp("4821", ENV.cookieSecret || "homeos-dev") }],
      [{ id: 31, userId: 101 }],
    );

    const result = await homeosRouter.createCaller(createAuthenticatedContext()).requests.complete({ serviceRequestId: 19, completionOtp: "4821" });

    expect(result).toMatchObject({ success: true, status: "completed", completedAt: expect.any(Date) });
    expect(dbTestState.updates.map(({ values }) => values)).toEqual([expect.objectContaining({ status: "completed", completedAt: expect.any(Date) })]);
  });

  it("does not write a completion transition when the OTP is invalid", async () => {
    dbTestState.selections.push(
      [{ id: 19, assignedTechnicianId: 31, status: "completion_pending", completionOtpHash: hashCompletionOtp("4821", ENV.cookieSecret || "homeos-dev") }],
      [{ id: 31, userId: 101 }],
    );

    await expect(homeosRouter.createCaller(createAuthenticatedContext()).requests.complete({ serviceRequestId: 19, completionOtp: "9999" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbTestState.updates).toHaveLength(0);
  });

  it("records an exhausted manual dispatch round for later operations review without auto-expanding the radius", async () => {
    dbTestState.selections.push(
      [{ id: 19, status: "submitted", homeId: 5, category: "plumbing" }],
      [{ id: 5, latitude: "17.4400000", longitude: "78.3900000" }],
      [],
      [],
      [],
    );

    const result = await homeosRouter.createCaller(createAuthenticatedContext(101, "admin")).dispatch.runRound({ serviceRequestId: 19, searchRadiusKm: 5, limit: 3 });

    expect(result).toMatchObject({ round: 1, offers: [], exhausted: true });
    expect(dbTestState.inserts.map(({ values }) => values)).toEqual([expect.objectContaining({
      serviceRequestId: 19,
      initiatedByUserId: 101,
      round: 1,
      searchRadiusKm: 5,
      eligibleOfferCount: 0,
      outcome: "exhausted",
    })]);
  });

  it("returns the latest persisted dispatch audit with each protected operations queue item", async () => {
    dbTestState.selections.push(
      [{ id: 19, publicId: "HOS-DISPATCH-1", status: "matched", category: "plumbing", urgency: "medium" }],
      [
        { id: 4, serviceRequestId: 19, round: 1, searchRadiusKm: 5, eligibleOfferCount: 0, outcome: "exhausted", createdAt: new Date("2026-08-24T08:00:00.000Z") },
        { id: 5, serviceRequestId: 19, round: 2, searchRadiusKm: 10, eligibleOfferCount: 2, outcome: "offers_created", createdAt: new Date("2026-08-24T08:10:00.000Z") },
      ],
    );

    const queue = await homeosRouter.createCaller(createAuthenticatedContext(101, "admin")).operations.dispatchQueue();

    expect(queue).toEqual([expect.objectContaining({
      id: 19,
      latestDispatchRound: expect.objectContaining({ round: 2, searchRadiusKm: 10, eligibleOfferCount: 2, outcome: "offers_created" }),
    })]);
  });
});
