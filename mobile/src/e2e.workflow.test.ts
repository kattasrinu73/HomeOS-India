import { describe, expect, it } from "vitest";
import { canTransitionJob, type JobGuard, type JobStatus, warrantyEndsOn } from "./workflow";

function move(from: JobStatus, to: JobStatus, guard: JobGuard) {
  expect(canTransitionJob(from, to, guard)).toBe(true);
  return to;
}

describe("HomeOS sequential customer and technician workflow", () => {
  it("completes the customer lifecycle from submitted request to paid service with required safeguards", () => {
    const guard: JobGuard = { quoteApproved: false, completionOtp: "" };
    let state: JobStatus = "submitted";

    state = move(state, "matched", guard);
    state = move(state, "assigned", guard);
    state = move(state, "en_route", guard);
    state = move(state, "arrived", guard);
    state = move(state, "diagnosing", guard);
    state = move(state, "quote_pending", guard);

    expect(canTransitionJob(state, "quote_approved", guard)).toBe(true);
    state = move(state, "quote_approved", guard);
    expect(canTransitionJob(state, "in_progress", guard)).toBe(false);

    guard.quoteApproved = true;
    state = move(state, "in_progress", guard);
    state = move(state, "completion_pending", guard);
    expect(canTransitionJob(state, "completed", guard)).toBe(false);

    guard.completionOtp = "4821";
    state = move(state, "completed", guard);
    state = move(state, "paid", guard);
    expect(state).toBe("paid");

    const warrantyEnd = warrantyEndsOn(new Date("2026-08-21T00:00:00.000Z"));
    expect(warrantyEnd.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("walks the technician operational path and proves no work or completion bypass is permitted", () => {
    const guard: JobGuard = { quoteApproved: false, completionOtp: "" };
    let state: JobStatus = "assigned";

    state = move(state, "en_route", guard);
    state = move(state, "arrived", guard);
    state = move(state, "diagnosing", guard);
    state = move(state, "quote_pending", guard);
    state = move(state, "quote_approved", guard);
    expect(canTransitionJob(state, "in_progress", guard)).toBe(false);

    guard.quoteApproved = true;
    state = move(state, "in_progress", guard);
    state = move(state, "completion_pending", guard);
    expect(canTransitionJob(state, "completed", guard)).toBe(false);
    guard.completionOtp = "4821";
    state = move(state, "completed", guard);
    expect(state).toBe("completed");
  });
});
