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
const assessmentState = vi.hoisted(() => ({ invokeLLM: vi.fn() }));

vi.mock("./db", () => ({ getDb: dbTestState.getDb }));
vi.mock("./_core/llm", () => ({ invokeLLM: assessmentState.invokeLLM }));

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
    const query = {
      limit: vi.fn(async () => selectedRows),
      orderBy: vi.fn(() => query),
      then: (resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(selectedRows).then(resolve, reject),
    };
    const fromQuery = {
      where: vi.fn(() => query),
      then: query.then,
    };
    return {
      from: vi.fn(() => fromQuery),
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
    assessmentState.invokeLLM.mockReset();
    assessmentState.invokeLLM.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            category: "ac_appliances",
            urgency: "medium",
            possibleDiagnosis: "The appliance needs a qualified inspection.",
            safetyNote: "Disconnect power if you notice sparks, smoke, or a burning smell.",
            followUpQuestions: ["When did the issue begin?"],
            estimateMin: 0,
            estimateMax: 0,
          }),
        },
      }],
    });
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
      [{ id: 19, homeId: 5, assignedTechnicianId: 31, status: "completion_pending", completionOtpHash: hashCompletionOtp("4821", ENV.cookieSecret || "homeos-dev") }],
      [{ id: 31, userId: 101 }],
      [{ id: 5, healthScore: 30, latitude: "17.4400000", longitude: "78.3900000" }],
      [],
      [{ id: 19, status: "completed" }],
      [],
    );

    const result = await homeosRouter.createCaller(createAuthenticatedContext()).requests.complete({ serviceRequestId: 19, completionOtp: "4821" });

    expect(result).toMatchObject({ success: true, status: "completed", completedAt: expect.any(Date) });
    expect(dbTestState.updates.map(({ values }) => values)).toEqual([
      expect.objectContaining({ status: "completed", completedAt: expect.any(Date) }),
      expect.objectContaining({ healthScore: 37 }),
    ]);
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

  it("returns an administrator-only job board from persisted active-job, technician, and quote records", async () => {
    dbTestState.selections.push(
      [{ id: 19, publicId: "HOS-JOB-19", category: "plumbing", urgency: "high", status: "quote_pending", updatedAt: new Date("2026-08-24T09:00:00.000Z"), assignedTechnicianId: 31 }],
      [{ id: 31, displayName: "Verified technician", verificationStatus: "verified" }],
      [{ id: 8, serviceRequestId: 19, status: "sent", updatedAt: new Date("2026-08-24T08:59:00.000Z") }],
    );

    const jobs = await homeosRouter.createCaller(createAuthenticatedContext(101, "admin")).operations.jobBoard();

    expect(jobs).toEqual([expect.objectContaining({
      publicId: "HOS-JOB-19",
      status: "quote_pending",
      assignedTechnician: expect.objectContaining({ displayName: "Verified technician", verificationStatus: "verified" }),
      latestQuoteStatus: "sent",
    })]);
  });

  it("derives operations analytics from persisted request, latest quote, confirmed payment, and active-warranty records", async () => {
    dbTestState.selections.push(
      [
        { id: 1, status: "submitted" },
        { id: 2, status: "completed" },
        { id: 3, status: "paid" },
      ],
      [
        { id: 1, serviceRequestId: 1, status: "sent" },
        { id: 2, serviceRequestId: 1, status: "approved" },
        { id: 3, serviceRequestId: 2, status: "rejected" },
      ],
      [
        { status: "confirmed", total: 2400 },
        { status: "pending", total: 1800 },
      ],
      [
        { status: "active", endsAt: new Date("2099-01-01T00:00:00.000Z") },
        { status: "active", endsAt: new Date("2000-01-01T00:00:00.000Z") },
        { status: "claimed", endsAt: new Date("2099-01-01T00:00:00.000Z") },
      ],
    );

    const analytics = await homeosRouter.createCaller(createAuthenticatedContext(101, "admin")).operations.analytics();

    expect(analytics.statusCounts).toEqual(expect.arrayContaining([
      { status: "submitted", count: 1 },
      { status: "completed", count: 1 },
      { status: "paid", count: 1 },
    ]));
    expect(analytics.quoteFunnel).toEqual({ total: 2, sent: 0, approved: 1, rejected: 1 });
    expect(analytics).toMatchObject({ completedJobs: 2, confirmedPayments: 1, confirmedPaymentTotal: 2400, activeWarranties: 1 });
  });

  it("refreshes a persisted Home Health Score on protected home reads when an active warranty has expired", async () => {
    dbTestState.selections.push(
      [{ id: 5, healthScore: 42 }],
      [{ id: 5, healthScore: 42, latitude: "17.4400000", longitude: "78.3900000" }],
      [],
      [{ id: 19, status: "completed" }],
      [{ status: "active", endsAt: new Date("2000-01-01T00:00:00.000Z") }],
      [{ id: 5, healthScore: 37 }],
    );

    const homes = await homeosRouter.createCaller(createAuthenticatedContext()).homes.list();

    expect(homes).toEqual([expect.objectContaining({ id: 5, healthScore: 37 })]);
    expect(dbTestState.updates.map(({ values }) => values)).toEqual([expect.objectContaining({ healthScore: 37 })]);
  });

  it("recalculates Home Health Score after an owned appliance is added", async () => {
    dbTestState.selections.push(
      [{ id: 5 }],
      [{ id: 5, healthScore: 30, latitude: "17.4400000", longitude: "78.3900000" }],
      [{ id: 2 }],
      [],
      [{ id: 2, homeId: 5, category: "ac" }],
    );

    const appliance = await homeosRouter.createCaller(createAuthenticatedContext()).appliances.create({ homeId: 5, category: "ac" });

    expect(appliance).toMatchObject({ id: 2, homeId: 5, category: "ac" });
    expect(dbTestState.updates.map(({ values }) => values)).toEqual([expect.objectContaining({ healthScore: 38 })]);
  });

  it("recalculates Home Health Score after provider-confirmed warranty activation", async () => {
    const completedAt = new Date("2026-08-24T06:00:00.000Z");
    dbTestState.selections.push(
      [{ id: 8, status: "pending", serviceRequestId: 19 }],
      [{ id: 19, publicId: "HOS-HEALTH-1", homeId: 5, customerId: 101, status: "completed", completedAt, assignedTechnicianId: 31 }],
      [{ displayName: "Verified technician" }],
      [{ id: 15, serviceRequestId: 19 }],
      [{ id: 5, healthScore: 37, latitude: "17.4400000", longitude: "78.3900000" }],
      [],
      [{ id: 19, status: "paid" }],
      [{ status: "active", endsAt: new Date("2026-09-23T06:00:00.000Z") }],
    );

    const result = await homeosRouter.createCaller(createAuthenticatedContext(101, "admin")).payments.confirmProviderPayment({ paymentId: 8, providerReference: "provider-health-8" });

    expect(result).toMatchObject({ invoice: { id: 15 }, warrantyEndsAt: expect.any(Date) });
    expect(dbTestState.updates.map(({ values }) => values)).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "confirmed", providerReference: "provider-health-8", paidAt: expect.any(Date) }),
      expect.objectContaining({ status: "paid" }),
      expect.objectContaining({ healthScore: 42 }),
    ]));
  });

  it("sends a text-only protected service description to the structured assessment boundary", async () => {
    const result = await homeosRouter.createCaller(createAuthenticatedContext()).diagnosis.assess({
      description: "The AC runs but the room is not cooling.",
    });

    expect(result).toMatchObject({ category: "ac_appliances", urgency: "medium" });
    expect(assessmentState.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: "claude-haiku-4-5",
      messages: expect.arrayContaining([expect.objectContaining({ role: "user", content: "The AC runs but the room is not cooling." })]),
    }));
  });

  it("sends an attached secure image URL alongside the text description to the structured assessment boundary", async () => {
    const attachmentUrl = "https://storage.example/homeos/issues/ac-unit.jpg";

    await homeosRouter.createCaller(createAuthenticatedContext()).diagnosis.assess({
      description: "The AC outdoor unit is making a loud noise.",
      attachmentUrl,
    });

    const request = assessmentState.invokeLLM.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: unknown }> };
    expect(request.messages[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "The AC outdoor unit is making a loud noise." },
        { type: "image_url", image_url: { url: attachmentUrl, detail: "auto" } },
      ],
    });
  });

  it("returns cautious fallback guidance when structured assessment is unavailable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    assessmentState.invokeLLM.mockRejectedValueOnce(new Error("model unavailable"));

    const result = await homeosRouter.createCaller(createAuthenticatedContext()).diagnosis.assess({
      description: "There is a smell from the breaker panel.",
    });

    expect(result).toMatchObject({
      category: "other",
      urgency: "medium",
      estimateMin: 0,
      estimateMax: 0,
    });
    consoleError.mockRestore();
  });
});
