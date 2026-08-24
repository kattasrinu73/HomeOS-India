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
      [{ id: 44, serviceRequestId: 19, technicianId: 31, status: "accepted" }],
      [{ id: 31, displayName: "Verified technician", verificationStatus: "verified" }],
    );

    const queue = await homeosRouter.createCaller(createAuthenticatedContext(101, "admin")).operations.dispatchQueue();

    expect(queue).toEqual([expect.objectContaining({
      id: 19,
      latestDispatchRound: expect.objectContaining({ round: 2, searchRadiusKm: 10, eligibleOfferCount: 2, outcome: "offers_created" }),
      nextManualRadiusKm: 15,
      acceptedTechnicians: [{ offerId: 44, technician: { id: 31, displayName: "Verified technician", verificationStatus: "verified" } }],
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

  it("keeps a verified technician acceptance pending until protected operations explicitly assigns the offer", async () => {
    dbTestState.selections.push(
      [{ id: 31, userId: 101, verificationStatus: "verified", availability: "available" }],
      [{ id: 44, serviceRequestId: 19, technicianId: 31, status: "offered" }],
      [{ id: 19, status: "matched", assignedTechnicianId: null, customerId: 202 }],
    );

    const result = await homeosRouter.createCaller(createAuthenticatedContext()).technician.acceptOffer({ offerId: 44 });

    expect(result).toEqual({ success: true, status: "matched", assignmentPending: true });
    expect(dbTestState.updates.map(({ values }) => values)).toEqual([{ status: "accepted" }]);
    expect(dbTestState.inserts).toHaveLength(0);
  });

  it("allows only operations to confirm a persisted accepted offer as the final technician assignment", async () => {
    dbTestState.selections.push(
      [{ id: 44, serviceRequestId: 19, technicianId: 31, status: "accepted" }],
      [{ id: 19, status: "matched", assignedTechnicianId: null, customerId: 202 }],
      [{ id: 31, displayName: "Verified technician", verificationStatus: "verified" }],
    );

    const result = await homeosRouter.createCaller(createAuthenticatedContext(101, "admin")).operations.assignAcceptedOffer({ offerId: 44 });

    expect(result).toEqual({ success: true, status: "assigned", serviceRequestId: 19, technicianId: 31 });
    expect(dbTestState.updates.map(({ values }) => values)).toEqual([
      { status: "expired" },
      { status: "assigned", assignedTechnicianId: 31 },
    ]);
    expect(dbTestState.inserts.map(({ values }) => values)).toEqual([expect.objectContaining({
      userId: 202,
      serviceRequestId: 19,
      event: "technician_assigned",
    })]);
  });

  it("returns an administrator-only persisted sent-quote review queue with itemised totals and request context", async () => {
    dbTestState.selections.push(
      [{ id: 8, serviceRequestId: 19, technicianId: 31, status: "sent", reason: "Replace damaged part", createdAt: new Date("2026-08-24T08:00:00.000Z"), updatedAt: new Date("2026-08-24T08:05:00.000Z") }],
      [{ id: 19, publicId: "HOS-QUOTE-19", category: "plumbing", urgency: "high", status: "quote_pending" }],
      [{ id: 31, displayName: "Verified technician", verificationStatus: "verified" }],
      [
        { id: 1, quoteId: 8, itemType: "visit_fee", label: "Visit fee", amount: 199 },
        { id: 2, quoteId: 8, itemType: "part", label: "Valve", amount: 850 },
      ],
    );

    const review = await homeosRouter.createCaller(createAuthenticatedContext(101, "admin")).operations.quoteReview();

    expect(review).toEqual([expect.objectContaining({
      id: 8,
      status: "sent",
      total: 1049,
      request: { id: 19, publicId: "HOS-QUOTE-19", category: "plumbing", urgency: "high", status: "quote_pending" },
      technician: { id: 31, displayName: "Verified technician", verificationStatus: "verified" },
      items: [
        { id: 1, quoteId: 8, itemType: "visit_fee", label: "Visit fee", amount: 199 },
        { id: 2, quoteId: 8, itemType: "part", label: "Valve", amount: 850 },
      ],
    })]);
  });

  it("forbids a regular account from confirming an accepted dispatch offer", async () => {
    await expect(homeosRouter.createCaller(createAuthenticatedContext()).operations.assignAcceptedOffer({ offerId: 44 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbTestState.selections).toHaveLength(0);
    expect(dbTestState.updates).toHaveLength(0);
  });

  it("forbids a regular account from accessing the operations quote review queue", async () => {
    await expect(homeosRouter.createCaller(createAuthenticatedContext()).operations.quoteReview())
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbTestState.selections).toHaveLength(0);
  });

  it("cancels only an unstarted request while recording the operator reason, expiring offers, and notifying the customer", async () => {
    dbTestState.selections.push(
      [{ id: 19, customerId: 202, status: "assigned" }],
    );

    const result = await homeosRouter.createCaller(createAuthenticatedContext(101, "admin")).operations.cancelUnstartedRequest({
      serviceRequestId: 19,
      reason: "Customer requested a later service date.",
    });

    expect(result).toEqual({ success: true, status: "cancelled", serviceRequestId: 19 });
    expect(dbTestState.updates.map(({ values }) => values)).toEqual([
      { status: "expired" },
      { status: "cancelled" },
    ]);
    expect(dbTestState.inserts.map(({ values }) => values)).toEqual([
      { serviceRequestId: 19, initiatedByUserId: 101, action: "cancelled", reason: "Customer requested a later service date." },
      expect.objectContaining({ userId: 202, serviceRequestId: 19, event: "request_cancelled" }),
    ]);
  });

  it("forbids a regular account from cancelling a protected service request", async () => {
    await expect(homeosRouter.createCaller(createAuthenticatedContext()).operations.cancelUnstartedRequest({
      serviceRequestId: 19,
      reason: "Customer requested a later service date.",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbTestState.selections).toHaveLength(0);
    expect(dbTestState.updates).toHaveLength(0);
  });

  it("creates and completes a persisted maintenance reminder only for the owning customer home", async () => {
    const dueAt = new Date("2026-09-01T00:00:00.000Z");
    dbTestState.selections.push(
      [{ id: 9 }],
      [{ id: 41, homeId: 9, ownerId: 101, applianceId: null, title: "Service the air conditioner", dueAt, status: "open", completedAt: null, createdAt: dueAt }],
      [{ id: 41, homeId: 9, ownerId: 101, status: "open" }],
    );

    const caller = homeosRouter.createCaller(createAuthenticatedContext(101));
    const reminder = await caller.maintenance.create({ homeId: 9, title: "Service the air conditioner", dueAt });
    const completion = await caller.maintenance.complete({ reminderId: 41 });

    expect(reminder).toMatchObject({ id: 41, homeId: 9, ownerId: 101, status: "open" });
    expect(completion).toEqual({ success: true, status: "done", reminderId: 41 });
    expect(dbTestState.inserts[0]?.values).toEqual({ homeId: 9, title: "Service the air conditioner", dueAt, ownerId: 101, status: "open" });
    expect(dbTestState.updates[0]?.values).toMatchObject({ status: "done", completedAt: expect.any(Date) });
  });

  it("rejects maintenance reminder creation for a home outside the customer account", async () => {
    dbTestState.selections.push([]);

    await expect(homeosRouter.createCaller(createAuthenticatedContext()).maintenance.create({
      homeId: 9,
      title: "Service the air conditioner",
      dueAt: new Date("2026-09-01T00:00:00.000Z"),
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbTestState.inserts).toHaveLength(0);
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

  it("returns only the owner's persisted itemised confirmed invoice and 30-day warranty", async () => {
    const warrantyEndsAt = new Date("2026-09-23T06:00:00.000Z");
    dbTestState.selections.push(
      [{ id: 19, publicId: "HOS-INVOICE-19", customerId: 101 }],
      [{ id: 15, serviceRequestId: 19, paymentId: 8, invoiceNumber: "INV-INVOICE-19", technicianIdentity: "Verified technician", warrantyDays: 30, warrantyEndsAt }],
      [{ id: 8, method: "upi", status: "confirmed", visitFee: 199, labour: 1200, parts: 800, taxes: 180, platformFee: 50, credits: 100, total: 2329 }],
      [{ id: 4, serviceRequestId: 19, invoiceId: 15, status: "active", startsAt: new Date("2026-08-24T06:00:00.000Z"), endsAt: warrantyEndsAt }],
    );

    const result = await homeosRouter.createCaller(createAuthenticatedContext()).invoices.getForRequest({ serviceRequestId: 19 });

    expect(result).toMatchObject({
      invoice: { id: 15, invoiceNumber: "INV-INVOICE-19", technicianIdentity: "Verified technician", warrantyDays: 30 },
      warranty: { id: 4, status: "active", endsAt: warrantyEndsAt },
      document: {
        jobId: "HOS-INVOICE-19",
        technicianIdentity: "Verified technician",
        payment: { method: "upi", status: "confirmed", total: 2329 },
        warranty: { days: 30, endsAt: warrantyEndsAt },
      },
    });
    expect(result?.document.lineItems).toEqual([
      { type: "visit_fee", label: "Visit fee", amount: 199 },
      { type: "labour", label: "Labour", amount: 1200 },
      { type: "parts", label: "Parts", amount: 800 },
      { type: "taxes", label: "Taxes", amount: 180 },
      { type: "platform_fee", label: "Platform fee", amount: 50 },
      { type: "credits", label: "Wallet credits", amount: -100 },
    ]);
  });

  it("denies invoice retrieval when the request is not owned by the signed-in customer", async () => {
    dbTestState.selections.push([]);

    await expect(homeosRouter.createCaller(createAuthenticatedContext()).invoices.getForRequest({ serviceRequestId: 19 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
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
