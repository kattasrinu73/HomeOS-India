import { describe, expect, it } from "vitest";
import {
  canTransitionJob,
  formatIndianRupees,
  isCompletionOtpFormatValid,
  warrantyEndsOn,
} from "./workflow";

describe("HomeOS job workflow safeguards", () => {
  it("does not allow work to start without explicit quote approval", () => {
    expect(
      canTransitionJob("quote_approved", "in_progress", {
        quoteApproved: false,
        completionOtp: "",
      }),
    ).toBe(false);
  });

  it("allows work to start after quote approval", () => {
    expect(
      canTransitionJob("quote_approved", "in_progress", {
        quoteApproved: true,
        completionOtp: "",
      }),
    ).toBe(true);
  });

  it("requires a numeric completion OTP before a job can be completed", () => {
    expect(
      canTransitionJob("completion_pending", "completed", {
        quoteApproved: true,
        completionOtp: "code",
      }),
    ).toBe(false);
    expect(
      canTransitionJob("completion_pending", "completed", {
        quoteApproved: true,
        completionOtp: "4821",
      }),
    ).toBe(true);
  });

  it("calculates an exact 30-day service warranty", () => {
    const completed = new Date("2026-08-21T00:00:00.000Z");
    expect(warrantyEndsOn(completed).toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("formats payment amounts in Indian rupees", () => {
    expect(formatIndianRupees(949)).toBe("₹949");
  });

  it("recognises a valid numeric OTP only", () => {
    expect(isCompletionOtpFormatValid("4821")).toBe(true);
    expect(isCompletionOtpFormatValid("48a1")).toBe(false);
  });
});
