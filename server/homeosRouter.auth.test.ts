import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { homeosRouter } from "./homeosRouter";

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("HomeOS protected workflow transitions", () => {
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
});
