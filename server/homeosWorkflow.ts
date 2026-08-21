import { createHash } from "node:crypto";

export type ServiceJobStatus =
  | "submitted"
  | "matched"
  | "assigned"
  | "en_route"
  | "arrived"
  | "diagnosing"
  | "quote_pending"
  | "quote_approved"
  | "in_progress"
  | "completion_pending"
  | "completed"
  | "paid"
  | "cancelled";

export type DispatchCandidate = {
  technicianId: number;
  distanceKm: number;
  completionRate: number;
  onTimeRate: number;
  available: boolean;
  verifiedSkill: boolean;
};

export function scoreCandidate(candidate: DispatchCandidate): number {
  if (!candidate.available || !candidate.verifiedSkill) return Number.NEGATIVE_INFINITY;
  const distanceScore = Math.max(0, 100 - candidate.distanceKm * 12);
  return distanceScore * 0.35 + candidate.completionRate * 0.35 + candidate.onTimeRate * 0.3;
}

export function rankDispatchCandidates(candidates: DispatchCandidate[]): Array<DispatchCandidate & { score: number }> {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate) }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score);
}

export function canStartWork(status: ServiceJobStatus, quoteApprovedAt: Date | null): boolean {
  return status === "quote_approved" && quoteApprovedAt !== null;
}

export function isValidCompletionOtp(otp: string): boolean {
  return /^\d{4,8}$/.test(otp.trim());
}

export function hashCompletionOtp(otp: string, secret: string): string {
  return createHash("sha256").update(`${otp}:${secret}`).digest("hex");
}

export function verifyCompletionOtp(otp: string, expectedHash: string | null, secret: string): boolean {
  if (!expectedHash || !isValidCompletionOtp(otp)) return false;
  return hashCompletionOtp(otp, secret) === expectedHash;
}

export function thirtyDayWarrantyEnds(completedAt: Date): Date {
  const end = new Date(completedAt);
  end.setUTCDate(end.getUTCDate() + 30);
  return end;
}

export function buildInvoiceMetadata(publicJobId: string, completedAt: Date) {
  return {
    invoiceNumber: `INV-${publicJobId.replace(/^HOS-/, "")}`,
    warrantyDays: 30,
    warrantyEndsAt: thirtyDayWarrantyEnds(completedAt),
  };
}

export function buildInvoicePayload(input: {
  jobId: string;
  technicianIdentity: string;
  visitFee: number;
  labour: number;
  parts: number;
  taxes: number;
  platformFee: number;
  credits: number;
  paymentMethod: "upi" | "card" | "wallet" | "cash";
  paymentStatus: "pending" | "confirmed" | "failed" | "refunded";
  total: number;
  warrantyDays: number;
  warrantyEndsAt: Date;
}) {
  return {
    jobId: input.jobId,
    technicianIdentity: input.technicianIdentity,
    lineItems: [
      { type: "visit_fee", label: "Visit fee", amount: input.visitFee },
      { type: "labour", label: "Labour", amount: input.labour },
      { type: "parts", label: "Parts", amount: input.parts },
      { type: "taxes", label: "Taxes", amount: input.taxes },
      { type: "platform_fee", label: "Platform fee", amount: input.platformFee },
      { type: "credits", label: "Wallet credits", amount: -input.credits },
    ],
    payment: { method: input.paymentMethod, status: input.paymentStatus, total: input.total },
    warranty: { days: input.warrantyDays, endsAt: input.warrantyEndsAt },
  };
}
