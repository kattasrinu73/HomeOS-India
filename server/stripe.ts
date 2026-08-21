import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { invoices, notificationRecords, payments, serviceRequests, technicians, warranties } from "../drizzle/schema";
import { getDb } from "./db";
import { buildInvoiceMetadata } from "./homeosWorkflow";
import { HOMEOS_SERVICE_PRODUCT } from "./products";

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured.");
  return new Stripe(key);
}

export async function createHomeosCheckout(input: {
  paymentId: number;
  amount: number;
  userId: number;
  customerEmail?: string | null;
  customerName?: string | null;
  origin: string;
}) {
  const stripe = stripeClient();
  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "upi"],
    line_items: [{
      price_data: {
        currency: HOMEOS_SERVICE_PRODUCT.currency,
        product_data: { name: HOMEOS_SERVICE_PRODUCT.name, description: HOMEOS_SERVICE_PRODUCT.description },
        unit_amount: input.amount,
      },
      quantity: 1,
    }],
    customer_email: input.customerEmail ?? undefined,
    client_reference_id: String(input.userId),
    metadata: {
      user_id: String(input.userId),
      customer_email: input.customerEmail ?? "",
      customer_name: input.customerName ?? "",
      homeos_payment_id: String(input.paymentId),
    },
    allow_promotion_codes: true,
    success_url: `${input.origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/?checkout=cancelled`,
  });
}

async function settleCheckoutSession(session: Stripe.Checkout.Session) {
  const paymentId = Number(session.metadata?.homeos_payment_id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw new Error("Missing HomeOS payment identifier in checkout metadata.");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for payment settlement.");
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new Error("Payment record not found.");
  if (payment.status === "confirmed") return;
  const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, payment.serviceRequestId)).limit(1);
  if (!request || request.status !== "completed" || !request.completedAt) throw new Error("Only OTP-completed jobs can be settled.");
  const invoiceMetadata = buildInvoiceMetadata(request.publicId, request.completedAt);
  const technicianIdentity = request.assignedTechnicianId
    ? (await db.select({ displayName: technicians.displayName }).from(technicians).where(eq(technicians.id, request.assignedTechnicianId)).limit(1))[0]?.displayName ?? "Verified HomeOS technician"
    : "Verified HomeOS technician";
  await db.update(payments).set({
    status: "confirmed",
    providerReference: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
    paidAt: new Date(),
  }).where(eq(payments.id, payment.id));
  const [existingInvoice] = await db.select().from(invoices).where(eq(invoices.serviceRequestId, request.id)).limit(1);
  if (!existingInvoice) {
    await db.insert(invoices).values({
      serviceRequestId: request.id,
      paymentId: payment.id,
      invoiceNumber: invoiceMetadata.invoiceNumber,
      technicianIdentity,
      warrantyDays: 30,
      warrantyEndsAt: invoiceMetadata.warrantyEndsAt,
    });
    const [invoice] = await db.select().from(invoices).where(eq(invoices.serviceRequestId, request.id)).limit(1);
    if (!invoice) throw new Error("Invoice generation failed.");
    await db.insert(warranties).values({
      serviceRequestId: request.id,
      invoiceId: invoice.id,
      startsAt: request.completedAt,
      endsAt: invoiceMetadata.warrantyEndsAt,
    });
  }
  await db.update(serviceRequests).set({ status: "paid" }).where(and(eq(serviceRequests.id, request.id), eq(serviceRequests.status, "completed")));
  await db.insert(notificationRecords).values({
    userId: request.customerId,
    serviceRequestId: request.id,
    event: "payment_confirmed",
    title: "Payment confirmed — warranty active",
    body: `Your payment is confirmed. Your 30-day service warranty is active until ${invoiceMetadata.warrantyEndsAt.toLocaleDateString("en-IN")}.`,
  });
}

export function registerStripeRoutes(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") return res.status(400).json({ error: "Missing Stripe signature" });
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) throw new Error("Stripe webhook secret is not configured.");
      const event = stripeClient().webhooks.constructEvent(req.body, signature, webhookSecret);
      if (event.id.startsWith("evt_test_")) {
        console.log("[Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") await settleCheckoutSession(session);
      }
      console.log("[Webhook] Stripe event processed", { id: event.id, type: event.type, created: event.created });
      return res.json({ received: true });
    } catch (error) {
      console.error("[Webhook] Stripe verification or settlement failed", error);
      return res.status(400).json({ error: "Webhook verification failed" });
    }
  });
}
