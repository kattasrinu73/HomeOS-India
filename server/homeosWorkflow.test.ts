import { describe, expect, it } from "vitest";
import {
  buildInvoicePayload,
  buildInvoiceMetadata,
  canStartWork,
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

  it("requires an explicitly approved quote before work can start", () => {
    expect(canStartWork("quote_approved", null)).toBe(false);
    expect(canStartWork("quote_pending", new Date())).toBe(false);
    expect(canStartWork("quote_approved", new Date())).toBe(true);
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
