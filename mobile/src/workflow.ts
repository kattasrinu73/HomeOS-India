export type JobStatus =
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
  | "paid";

export type JobGuard = {
  quoteApproved: boolean;
  completionOtp: string;
};

export const isCompletionOtpFormatValid = (otp: string) => /^\d{4,8}$/.test(otp.trim());

export function canTransitionJob(
  from: JobStatus,
  to: JobStatus,
  guard: JobGuard,
): boolean {
  const transitions: Record<JobStatus, JobStatus[]> = {
    submitted: ["matched"],
    matched: ["assigned"],
    assigned: ["en_route"],
    en_route: ["arrived"],
    arrived: ["diagnosing"],
    diagnosing: ["quote_pending"],
    quote_pending: ["quote_approved"],
    quote_approved: ["in_progress"],
    in_progress: ["completion_pending"],
    completion_pending: ["completed"],
    completed: ["paid"],
    paid: [],
  };

  if (!transitions[from].includes(to)) return false;
  if (to === "in_progress") return guard.quoteApproved;
  if (to === "completed") return isCompletionOtpFormatValid(guard.completionOtp);
  return true;
}

export function warrantyEndsOn(completedAt: Date): Date {
  const warrantyEnd = new Date(completedAt);
  warrantyEnd.setDate(warrantyEnd.getDate() + 30);
  return warrantyEnd;
}

export function formatIndianRupees(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
