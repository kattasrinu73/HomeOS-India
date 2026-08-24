import { describe, expect, it } from "vitest";
import {
  buildInvoicePayload,
  buildInvoiceMetadata,
  buildCustomerDispatchHandoff,
  buildTechnicianPerformanceSummary,
  canStartWork,
  canTechnicianAdvanceJob,
  hashCompletionOtp,
  rankDispatchCandidates,
  thirtyDayWarrantyEnds,
  verifyCompletionOtp,
} from "./homeosWorkflow";

describe("HomeOS service workflow", () => {
  it("only ranks available technicians with verified skills", () => {
    const ranked = rankDispatchCandidates([
      { technicianId: 1, distanceKm: 1.2, completionRate: 95, onTimeRate: 94, available: true, verifiedSkill: true },
      { technicianId: 2, distanceKm: 0.2, completionRate: 100, onTimeRate: 100, available: false, verifiedSkill: true },
      { technicianId: 3, distanceKm: 0.8, completionRate: 90, onTimeRate: 89, available: true, verifiedSkill: false },
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.technicianId).toBe(1);
  });

  it("prioritises a dependable nearby verified technician over a nearer but less reliable candidate", () => {
    const ranked = rankDispatchCandidates([
      { technicianId: 11, distanceKm: 0.3, completionRate: 85, onTimeRate: 85, available: true, verifiedSkill: true },
      { technicianId: 12, distanceKm: 2, completionRate: 100, onTimeRate: 100, available: true, verifiedSkill: true },
    ]);

    expect(ranked.map((candidate) => candidate.technicianId)).toEqual([12, 11]);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it("requires an explicitly approved quote before work can start", () => {
    expect(canStartWork("quote_approved", null)).toBe(false);
    expect(canStartWork("quote_pending", new Date())).toBe(false);
    expect(canStartWork("quote_approved", new Date())).toBe(true);
  });

  it("allows technician progress only through the protected travel and diagnosis sequence", () => {
    expect(canTechnicianAdvanceJob("assigned", "en_route")).toBe(true);
    expect(canTechnicianAdvanceJob("en_route", "arrived")).toBe(true);
    expect(canTechnicianAdvanceJob("arrived", "diagnosing")).toBe(true);
    expect(canTechnicianAdvanceJob("assigned", "arrived")).toBe(false);
    expect(canTechnicianAdvanceJob("arrived", "en_route")).toBe(false);
    expect(canTechnicianAdvanceJob("diagnosing", "arrived")).toBe(false);
  });

  it("summarises technician performance only from assigned job status and confirmed payment totals", () => {
    expect(buildTechnicianPerformanceSummary({ assignedJobStatuses: ["assigned", "completed", "paid", "cancelled"], confirmedPaymentTotals: [749, 1200] })).toEqual({
      completedJobCount: 2,
      activeJobCount: 1,
      confirmedPaymentCount: 2,
      confirmedCustomerPaymentTotal: 1949,
    });
    expect(buildTechnicianPerformanceSummary({ assignedJobStatuses: [], confirmedPaymentTotals: [] })).toEqual({
      completedJobCount: 0,
      activeJobCount: 0,
      confirmedPaymentCount: 0,
      confirmedCustomerPaymentTotal: 0,
    });
  });

  it("derives customer dispatch handoff states from aggregate persisted offer facts without revealing technician data", () => {
    expect(buildCustomerDispatchHandoff({ requestStatus: "submitted", offers: [] })).toMatchObject({
      state: "awaiting_operator_round",
      activeOfferCount: 0,
      round: null,
    });
    expect(buildCustomerDispatchHandoff({ requestStatus: "matched", offers: [{ round: 1, searchRadiusKm: 5, status: "offered" }] })).toMatchObject({
      state: "offers_out",
      activeOfferCount: 1,
      round: 1,
      searchRadiusKm: 5,
    });
    expect(buildCustomerDispatchHandoff({ requestStatus: "matched", offers: [{ round: 1, searchRadiusKm: 5, status: "declined" }] })).toMatchObject({
      state: "operator_review",
      activeOfferCount: 0,
      round: 1,
    });
    expect(buildCustomerDispatchHandoff({ requestStatus: "assigned", offers: [{ round: 1, searchRadiusKm: 5, status: "accepted" }] })).toMatchObject({
      state: "technician_assigned",
      activeOfferCount: 0,
      round: 1,
    });
  });

  it("validates the completion OTP without storing it in plain text", () => {
    const hash = hashCompletionOtp("4821", "secret");
    expect(verifyCompletionOtp("4821", hash, "secret")).toBe(true);
    expect(verifyCompletionOtp("wrong", hash, "secret")).toBe(false);
  });

  it("calculates the exact 30-day warranty end date", () => {
    const completedAt = new Date("2026-08-21T00:00:00.000Z");
    expect(thirtyDayWarrantyEnds(completedAt).toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("makes invoice metadata include the fixed 30-day warranty", () => {
    const metadata = buildInvoiceMetadata("HOS-AC-260821", new Date("2026-08-21T00:00:00.000Z"));
    expect(metadata).toMatchObject({
      invoiceNumber: "INV-AC-260821",
      warrantyDays: 30,
    });
    expect(metadata.warrantyEndsAt.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("preserves the exact warranty end date in the customer-facing invoice payload", () => {
    const warrantyEndsAt = new Date("2026-09-20T10:30:00.000Z");
    const invoice = buildInvoicePayload({
      jobId: "HOS-WARRANTY-1",
      technicianIdentity: "Verified technician",
      visitFee: 199,
      labour: 800,
      parts: 0,
      taxes: 0,
      platformFee: 0,
      credits: 0,
      paymentMethod: "card",
      paymentStatus: "confirmed",
      total: 999,
      warrantyDays: 30,
      warrantyEndsAt,
    });

    expect(invoice.warranty).toEqual({ days: 30, endsAt: warrantyEndsAt });
  });

  it("assembles every required invoice field from the persisted payment and warranty records", () => {
    const invoice = buildInvoicePayload({
      jobId: "HOS-AC-260821",
      technicianIdentity: "Ramesh Kumar",
      visitFee: 199,
      labour: 300,
      parts: 450,
      taxes: 0,
      platformFee: 0,
      credits: 0,
      paymentMethod: "upi",
      paymentStatus: "confirmed",
      total: 949,
      warrantyDays: 30,
      warrantyEndsAt: new Date("2026-09-20T00:00:00.000Z"),
    });
    expect(invoice).toMatchObject({
      jobId: "HOS-AC-260821",
      technicianIdentity: "Ramesh Kumar",
      payment: { method: "upi", status: "confirmed", total: 949 },
      warranty: { days: 30 },
    });
    expect(invoice.lineItems).toEqual(expect.arrayContaining([
      { type: "parts", label: "Parts", amount: 450 },
      { type: "labour", label: "Labour", amount: 300 },
      { type: "taxes", label: "Taxes", amount: 0 },
    ]));
  });
});
