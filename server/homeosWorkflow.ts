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

export type DispatchOfferSummary = {
  round: number;
  searchRadiusKm: number;
  status: "offered" | "accepted" | "declined" | "expired";
};

export function calculateHomeHealthScore(input: {
  hasLocation: boolean;
  applianceCount: number;
  completedServiceCount: number;
  activeWarrantyCount: number;
}): number {
  const appliancePoints = Math.min(Math.max(input.applianceCount, 0), 4) * 8;
  const servicePoints = Math.min(Math.max(input.completedServiceCount, 0), 4) * 7;
  const warrantyPoints = Math.min(Math.max(input.activeWarrantyCount, 0), 2) * 5;
  return Math.min(100, Math.max(0, 20 + (input.hasLocation ? 10 : 0) + appliancePoints + servicePoints + warrantyPoints));
}

export const technicianProgressTransitions = {
  en_route: "assigned",
  arrived: "en_route",
  diagnosing: "arrived",
} as const;

export function canTechnicianAdvanceJob(currentStatus: ServiceJobStatus, nextStatus: keyof typeof technicianProgressTransitions): boolean {
  return currentStatus === technicianProgressTransitions[nextStatus];
}

export function buildTechnicianPerformanceSummary(input: { assignedJobStatuses: ServiceJobStatus[]; confirmedPaymentTotals: number[] }) {
  const completedJobCount = input.assignedJobStatuses.filter((status) => status === "completed" || status === "paid").length;
  const activeJobCount = input.assignedJobStatuses.filter((status) => !["completed", "paid", "cancelled"].includes(status)).length;
  return {
    completedJobCount,
    activeJobCount,
    confirmedPaymentCount: input.confirmedPaymentTotals.length,
    confirmedCustomerPaymentTotal: input.confirmedPaymentTotals.reduce((total, paymentTotal) => total + paymentTotal, 0),
  };
}

export function buildCustomerDispatchHandoff(input: { requestStatus: ServiceJobStatus; offers: DispatchOfferSummary[] }) {
  const latestRound = input.offers.length ? Math.max(...input.offers.map((offer) => offer.round)) : null;
  const latestRoundOffers = latestRound === null ? [] : input.offers.filter((offer) => offer.round === latestRound);
  const activeOfferCount = latestRoundOffers.filter((offer) => offer.status === "offered").length;
  const acceptedOfferCount = latestRoundOffers.filter((offer) => offer.status === "accepted").length;
  const searchRadiusKm = latestRoundOffers[0]?.searchRadiusKm ?? null;
  const alreadyAssigned = ["assigned", "en_route", "arrived", "diagnosing", "quote_pending", "quote_approved", "in_progress", "completion_pending", "completed", "paid"].includes(input.requestStatus);

  if (alreadyAssigned) {
    return {
      state: "technician_assigned" as const,
      label: "Verified technician assigned",
      message: "A verified technician has accepted this protected service request.",
      round: latestRound,
      searchRadiusKm,
      activeOfferCount,
    };
  }

  if (activeOfferCount > 0) {
    return {
      state: "offers_out" as const,
      label: "Verified offers are out",
      message: "The current operator-controlled dispatch round has been sent to eligible, verified technicians. This screen will update when a technician accepts.",
      round: latestRound,
      searchRadiusKm,
      activeOfferCount,
    };
  }

  if (input.requestStatus === "submitted" && input.offers.length === 0) {
    return {
      state: "awaiting_operator_round" as const,
      label: "Operator dispatch pending",
      message: "Your request is saved and awaits the first HomeOS operator-controlled verified dispatch round.",
      round: null,
      searchRadiusKm: null,
      activeOfferCount: 0,
    };
  }

  return {
    state: "operator_review" as const,
    label: acceptedOfferCount ? "Operator assignment confirmation" : "Operator dispatch review",
    message: acceptedOfferCount
      ? "A verified technician has accepted the protected offer. A HomeOS operator is confirming final assignment before the job can begin."
      : "The current dispatch round has no accepted technician. A HomeOS operator is reviewing the next safe dispatch step.",
    round: latestRound,
    searchRadiusKm,
    activeOfferCount: 0,
  };
}

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

export function nextManualDispatchRadiusKm(latestRadiusKm: number | null): number | null {
  const approvedManualRadii = [5, 10, 15, 20, 25];
  return approvedManualRadii.find((radiusKm) => latestRadiusKm === null || radiusKm > latestRadiusKm) ?? null;
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
