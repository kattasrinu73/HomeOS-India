import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  dispatchOffers,
  homes,
  invoices,
  jobProofs,
  notificationRecords,
  passportDocuments,
  payments,
  quoteItems,
  quotes,
  serviceRequests,
  technicians,
  technicianSkills,
  warranties,
} from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { createHomeosCheckout } from "./stripe";
import {
  canStartWork,
  buildInvoicePayload,
  buildInvoiceMetadata,
  hashCompletionOtp,
  thirtyDayWarrantyEnds,
  verifyCompletionOtp,
  rankDispatchCandidates,
} from "./homeosWorkflow";

const categories = ["electrical", "plumbing", "ac_appliances", "carpentry", "cleaning", "ro", "painting", "other"] as const;
const paymentMethods = ["upi", "card", "wallet", "cash"] as const;

const analysisOutputSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "homeos_issue_assessment",
    strict: true,
    schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: categories },
        urgency: { type: "string", enum: ["low", "medium", "high", "emergency"] },
        possibleDiagnosis: { type: "string" },
        safetyNote: { type: "string" },
        followUpQuestions: { type: "array", items: { type: "string" } },
        estimateMin: { type: "integer", minimum: 0 },
        estimateMax: { type: "integer", minimum: 0 },
      },
      required: ["category", "urgency", "possibleDiagnosis", "safetyNote", "followUpQuestions", "estimateMin", "estimateMax"],
      additionalProperties: false,
    },
  },
};

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "HomeOS storage is unavailable." });
  return db;
}

function asHomeCategory(category: (typeof categories)[number]) {
  return category === "ac_appliances" ? "AC & appliances" : category.replaceAll("_", " ");
}

function normaliseServiceCategory(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

export const homeosRouter = router({
  uploads: router({
    storeImage: protectedProcedure
      .input(z.object({
        base64: z.string().min(8),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        purpose: z.enum(["issue", "before", "part", "after"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const payload = input.base64.replace(/^data:image\/(jpeg|png|webp);base64,/, "");
        const bytes = Buffer.from(payload, "base64");
        const maxBytes = 5 * 1024 * 1024;
        if (bytes.length === 0 || bytes.length > maxBytes) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Images must be smaller than 5 MB." });
        }
        const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
        const stored = await storagePut(
          `homeos/${ctx.user.id}/${input.purpose}/${nanoid(12)}.${extension}`,
          bytes,
          input.mimeType,
        );
        return stored;
      }),
    storeDocument: protectedProcedure
      .input(z.object({
        base64: z.string().min(8),
        mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
        filename: z.string().trim().min(1).max(180),
      }))
      .mutation(async ({ ctx, input }) => {
        const payload = input.base64.replace(/^data:(application\/pdf|image\/(jpeg|png|webp));base64,/, "");
        const bytes = Buffer.from(payload, "base64");
        if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Documents must be smaller than 10 MB." });
        }
        const extension = input.mimeType === "application/pdf" ? "pdf" : input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
        return storagePut(`homeos/${ctx.user.id}/passport/${nanoid(12)}.${extension}`, bytes, input.mimeType);
      }),
    }),
    homes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await databaseOrThrow();
      return db.select().from(homes).where(eq(homes.ownerId, ctx.user.id)).orderBy(desc(homes.updatedAt));
    }),
    create: protectedProcedure
      .input(z.object({
        label: z.string().trim().min(1).max(120),
        addressLine1: z.string().trim().min(3).max(255),
        locality: z.string().trim().min(2).max(120),
        city: z.string().trim().min(2).max(120).default("Hyderabad"),
        postalCode: z.string().trim().max(20).optional(),
        homeType: z.enum(["apartment", "independent_house", "villa", "other"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        await db.insert(homes).values({ ...input, ownerId: ctx.user.id, healthScore: 0 });
        const created = await db.select().from(homes).where(and(eq(homes.ownerId, ctx.user.id), eq(homes.label, input.label))).orderBy(desc(homes.id)).limit(1);
        return created[0];
      }),
  }),
  diagnosis: router({
    assess: protectedProcedure
      .input(z.object({
        description: z.string().trim().min(6).max(2000),
        attachmentUrl: z.string().url().optional(),
      }))
      .mutation(async ({ input }) => {
        const userContent = input.attachmentUrl
          ? [{ type: "text" as const, text: input.description }, { type: "image_url" as const, image_url: { url: input.attachmentUrl, detail: "auto" as const } }]
          : input.description;
        try {
          const response = await invokeLLM({
            model: "claude-haiku-4-5",
            messages: [
              {
                role: "system",
                content: "You are HomeOS India’s cautious service-intake assistant. You provide preliminary guidance, not professional diagnosis. Escalate spark, burning-smell, gas, or severe-leak concerns. Keep estimates broad and in Indian rupees. Return only the requested structured data.",
              },
              { role: "user", content: userContent },
            ],
            response_format: analysisOutputSchema,
          });
          const content = response.choices[0]?.message.content;
          if (!content || typeof content !== "string") throw new Error("Empty diagnosis response");
          return z.object({
            category: z.enum(categories),
            urgency: z.enum(["low", "medium", "high", "emergency"]),
            possibleDiagnosis: z.string(),
            safetyNote: z.string(),
            followUpQuestions: z.array(z.string()),
            estimateMin: z.number().int().nonnegative(),
            estimateMax: z.number().int().nonnegative(),
          }).parse(JSON.parse(content));
        } catch (error) {
          console.error("[HomeOS] Diagnosis assessment failed", error);
          return {
            category: "other" as const,
            urgency: "medium" as const,
            possibleDiagnosis: "A qualified professional should inspect the issue on site before confirming the cause.",
            safetyNote: "If you notice sparks, smoke, gas smell, or major water leakage, move to safety and request emergency support.",
            followUpQuestions: ["When did this begin?", "Is the issue continuous or intermittent?"],
            estimateMin: 0,
            estimateMax: 0,
          };
        }
      }),
  }),
  requests: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await databaseOrThrow();
      return db.select().from(serviceRequests).where(eq(serviceRequests.customerId, ctx.user.id)).orderBy(desc(serviceRequests.updatedAt));
    }),
    create: protectedProcedure
      .input(z.object({
        homeId: z.number().int().positive(),
        category: z.enum(categories),
        description: z.string().trim().min(6).max(2000),
        attachmentUrl: z.string().url().optional(),
        possibleDiagnosis: z.string().max(2000).optional(),
        urgency: z.enum(["low", "medium", "high", "emergency"]),
        estimateMin: z.number().int().nonnegative().optional(),
        estimateMax: z.number().int().nonnegative().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const ownedHome = await db.select({ id: homes.id }).from(homes).where(and(eq(homes.id, input.homeId), eq(homes.ownerId, ctx.user.id))).limit(1);
        if (!ownedHome[0]) throw new TRPCError({ code: "FORBIDDEN", message: "Choose a home that belongs to your account." });
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const publicId = `HOS-${nanoid(10).toUpperCase()}`;
        await db.insert(serviceRequests).values({
          publicId,
          customerId: ctx.user.id,
          homeId: input.homeId,
          category: asHomeCategory(input.category),
          description: input.description,
          attachmentUrl: input.attachmentUrl,
          possibleDiagnosis: input.possibleDiagnosis,
          urgency: input.urgency,
          estimateMin: input.estimateMin,
          estimateMax: input.estimateMax,
          completionOtpHash: hashCompletionOtp(otp, ENV.cookieSecret || "homeos-dev"),
        });
        const created = await db.select().from(serviceRequests).where(eq(serviceRequests.publicId, publicId)).limit(1);
        if (!created[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create service request." });
        await db.insert(notificationRecords).values({
          userId: ctx.user.id,
          serviceRequestId: created[0].id,
          event: "request_received",
          title: "Service request received",
          body: "Your service request was recorded. A completion OTP will be sent through the configured notification provider when the job is ready to close.",
        });
        return created[0];
      }),
    approveQuote: protectedProcedure
      .input(z.object({ quoteId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const quote = await db.select().from(quotes).where(eq(quotes.id, input.quoteId)).limit(1);
        if (!quote[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found." });
        const request = await db.select().from(serviceRequests).where(and(eq(serviceRequests.id, quote[0].serviceRequestId), eq(serviceRequests.customerId, ctx.user.id))).limit(1);
        if (!request[0]) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot approve this quote." });
        if (quote[0].status !== "sent") throw new TRPCError({ code: "CONFLICT", message: "Only the current sent quote can be approved." });
        const approvedAt = new Date();
        await db.update(quotes).set({ status: "approved", approvedAt }).where(eq(quotes.id, quote[0].id));
        await db.update(serviceRequests).set({ status: "quote_approved", quoteApprovedAt: approvedAt }).where(eq(serviceRequests.id, request[0].id));
        return { success: true, status: "quote_approved" as const };
      }),
    startWork: protectedProcedure
      .input(z.object({ serviceRequestId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await databaseOrThrow();
        const request = await db.select().from(serviceRequests).where(eq(serviceRequests.id, input.serviceRequestId)).limit(1);
        if (!request[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Service request not found." });
        if (!canStartWork(request[0].status, request[0].quoteApprovedAt)) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Work cannot start until the customer explicitly approves the current quote." });
        }
        await db.update(serviceRequests).set({ status: "in_progress" }).where(eq(serviceRequests.id, request[0].id));
        return { success: true, status: "in_progress" as const };
      }),
    complete: protectedProcedure
      .input(z.object({ serviceRequestId: z.number().int().positive(), completionOtp: z.string().trim().min(4).max(8) }))
      .mutation(async ({ input }) => {
        const db = await databaseOrThrow();
        const request = await db.select().from(serviceRequests).where(eq(serviceRequests.id, input.serviceRequestId)).limit(1);
        if (!request[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Service request not found." });
        if (request[0].status !== "completion_pending" && request[0].status !== "in_progress") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The job is not ready for OTP-gated completion." });
        }
        if (!verifyCompletionOtp(input.completionOtp, request[0].completionOtpHash, ENV.cookieSecret || "homeos-dev")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The completion OTP is invalid." });
        }
        const completedAt = new Date();
        await db.update(serviceRequests).set({ status: "completed", completedAt }).where(eq(serviceRequests.id, request[0].id));
        return { success: true, status: "completed" as const, completedAt };
      }),
  }),
  dispatch: router({
    runRound: adminProcedure
      .input(z.object({ serviceRequestId: z.number().int().positive(), searchRadiusKm: z.number().int().min(1).max(25), limit: z.number().int().min(1).max(10).default(3) }))
      .mutation(async ({ input }) => {
        const db = await databaseOrThrow();
        const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, input.serviceRequestId)).limit(1);
        if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Service request not found." });
        if (!["submitted", "matched"].includes(request.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only unassigned requests can enter a dispatch round." });
        const [home] = await db.select().from(homes).where(eq(homes.id, request.homeId)).limit(1);
        if (!home?.latitude || !home.longitude) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The service home needs a precise location before dispatch." });
        const eligibleTechnicians = await db.select().from(technicians).where(and(eq(technicians.availability, "available"), eq(technicians.verificationStatus, "verified")));
        const skills = await db.select().from(technicianSkills).where(eq(technicianSkills.verified, true));
        const skilledTechnicianIds = new Set(skills.filter((skill) => normaliseServiceCategory(skill.category) === normaliseServiceCategory(request.category)).map((skill) => skill.technicianId));
        const candidates = eligibleTechnicians
          .filter((technician) => technician.latitude && technician.longitude && skilledTechnicianIds.has(technician.id))
          .map((technician) => ({
            technician,
            distanceKm: distanceKm({ latitude: Number(home.latitude), longitude: Number(home.longitude) }, { latitude: Number(technician.latitude), longitude: Number(technician.longitude) }),
          }))
          .filter((candidate) => candidate.distanceKm <= input.searchRadiusKm);
        const ranked = rankDispatchCandidates(candidates.map(({ technician, distanceKm: candidateDistance }) => ({
          technicianId: technician.id,
          distanceKm: candidateDistance,
          completionRate: Number(technician.completionRate),
          onTimeRate: Number(technician.onTimeRate),
          available: technician.availability === "available",
          verifiedSkill: skilledTechnicianIds.has(technician.id),
        }))).slice(0, input.limit);
        const existingOffers = await db.select().from(dispatchOffers).where(eq(dispatchOffers.serviceRequestId, request.id));
        const alreadyOffered = new Set(existingOffers.map((offer) => offer.technicianId));
        const round = Math.max(0, ...existingOffers.map((offer) => offer.round)) + 1;
        const offers = ranked.filter((candidate) => !alreadyOffered.has(candidate.technicianId));
        if (offers.length) {
          await db.insert(dispatchOffers).values(offers.map((candidate) => ({ serviceRequestId: request.id, technicianId: candidate.technicianId, round, searchRadiusKm: input.searchRadiusKm, score: candidate.score.toFixed(2) })));
          await db.update(serviceRequests).set({ status: "matched" }).where(eq(serviceRequests.id, request.id));
        }
        return { round, offers, exhausted: offers.length === 0 };
      }),
    queue: adminProcedure.query(async () => {
      const db = await databaseOrThrow();
      return db.select().from(serviceRequests).where(inArray(serviceRequests.status, ["submitted", "matched", "assigned"])).orderBy(desc(serviceRequests.createdAt));
    }),
  }),
  technician: router({
    offers: protectedProcedure.query(async ({ ctx }) => {
      const db = await databaseOrThrow();
      const [technician] = await db.select().from(technicians).where(eq(technicians.userId, ctx.user.id)).limit(1);
      if (!technician) throw new TRPCError({ code: "FORBIDDEN", message: "Technician profile required." });
      const offers = await db.select().from(dispatchOffers).where(and(eq(dispatchOffers.technicianId, technician.id), eq(dispatchOffers.status, "offered"))).orderBy(desc(dispatchOffers.createdAt));
      return Promise.all(offers.map(async (offer) => ({ offer, request: (await db.select().from(serviceRequests).where(eq(serviceRequests.id, offer.serviceRequestId)).limit(1))[0] ?? null })));
    }),
    acceptOffer: protectedProcedure
      .input(z.object({ offerId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const [technician] = await db.select().from(technicians).where(eq(technicians.userId, ctx.user.id)).limit(1);
        const [offer] = technician ? await db.select().from(dispatchOffers).where(and(eq(dispatchOffers.id, input.offerId), eq(dispatchOffers.technicianId, technician.id))).limit(1) : [];
        if (!technician || !offer || offer.status !== "offered") throw new TRPCError({ code: "FORBIDDEN", message: "This dispatch offer is unavailable." });
        const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, offer.serviceRequestId)).limit(1);
        if (!request || request.assignedTechnicianId || !["submitted", "matched"].includes(request.status)) throw new TRPCError({ code: "CONFLICT", message: "This job has already been assigned." });
        await db.update(dispatchOffers).set({ status: "accepted" }).where(eq(dispatchOffers.id, offer.id));
        await db.update(dispatchOffers).set({ status: "expired" }).where(and(eq(dispatchOffers.serviceRequestId, request.id), eq(dispatchOffers.status, "offered")));
        await db.update(serviceRequests).set({ status: "assigned", assignedTechnicianId: technician.id }).where(eq(serviceRequests.id, request.id));
        await db.insert(notificationRecords).values({ userId: request.customerId, serviceRequestId: request.id, event: "technician_assigned", title: "A qualified technician has accepted", body: "Your selected service professional is preparing to travel to your home." });
        return { success: true, status: "assigned" as const };
      }),
    declineOffer: protectedProcedure
      .input(z.object({ offerId: z.number().int().positive(), reason: z.enum(["too_far", "wrong_skill", "occupied", "unsupported_service", "safety_concern", "parts_unavailable", "other"]) }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const [technician] = await db.select().from(technicians).where(eq(technicians.userId, ctx.user.id)).limit(1);
        if (!technician) throw new TRPCError({ code: "FORBIDDEN", message: "Technician profile required." });
        await db.update(dispatchOffers).set({ status: "declined", declineReason: input.reason }).where(and(eq(dispatchOffers.id, input.offerId), eq(dispatchOffers.technicianId, technician.id), eq(dispatchOffers.status, "offered")));
        return { success: true };
      }),
    createQuote: protectedProcedure
      .input(z.object({
        serviceRequestId: z.number().int().positive(),
        reason: z.string().trim().min(4).max(2000),
        items: z.array(z.object({
          itemType: z.enum(["visit_fee", "labour", "part", "tax", "platform_fee", "discount"]),
          label: z.string().trim().min(1).max(160),
          amount: z.number().int(),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const technician = await db.select().from(technicians).where(eq(technicians.userId, ctx.user.id)).limit(1);
        if (!technician[0] || technician[0].verificationStatus !== "verified") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only a verified technician can send a quote." });
        }
        const request = await db.select().from(serviceRequests).where(and(eq(serviceRequests.id, input.serviceRequestId), eq(serviceRequests.assignedTechnicianId, technician[0].id))).limit(1);
        if (!request[0]) throw new TRPCError({ code: "FORBIDDEN", message: "This request is not assigned to you." });
        if (!["arrived", "diagnosing", "quote_pending"].includes(request[0].status)) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A quote can be sent only after arrival and diagnosis." });
        }
        await db.update(quotes).set({ status: "superseded" }).where(and(eq(quotes.serviceRequestId, request[0].id), eq(quotes.status, "sent")));
        await db.insert(quotes).values({ serviceRequestId: request[0].id, technicianId: technician[0].id, status: "sent", reason: input.reason });
        const quote = await db.select().from(quotes).where(and(eq(quotes.serviceRequestId, request[0].id), eq(quotes.technicianId, technician[0].id))).orderBy(desc(quotes.id)).limit(1);
        if (!quote[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create quote." });
        await db.insert(quoteItems).values(input.items.map((item) => ({ ...item, quoteId: quote[0].id })));
        await db.update(serviceRequests).set({ status: "quote_pending" }).where(eq(serviceRequests.id, request[0].id));
        await db.insert(notificationRecords).values({ userId: request[0].customerId, serviceRequestId: request[0].id, event: "quote_ready", title: "Your quote is ready", body: "Review the itemised quote. No work can start until you approve it." });
        return quote[0];
      }),
    addProof: protectedProcedure
      .input(z.object({
        serviceRequestId: z.number().int().positive(),
        proofType: z.enum(["before", "part", "after", "note"]),
        fileKey: z.string().max(512).optional(),
        fileUrl: z.string().max(512).optional(),
        note: z.string().trim().max(2000).optional(),
      }).refine((value) => Boolean(value.fileKey || value.fileUrl || value.note), { message: "Add a proof file or service note." }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const technician = await db.select().from(technicians).where(eq(technicians.userId, ctx.user.id)).limit(1);
        if (!technician[0]) throw new TRPCError({ code: "FORBIDDEN", message: "Technician profile required." });
        const request = await db.select().from(serviceRequests).where(and(eq(serviceRequests.id, input.serviceRequestId), eq(serviceRequests.assignedTechnicianId, technician[0].id))).limit(1);
        if (!request[0]) throw new TRPCError({ code: "FORBIDDEN", message: "This request is not assigned to you." });
        await db.insert(jobProofs).values(input);
        return { success: true };
      }),
    readyForCompletion: protectedProcedure
      .input(z.object({ serviceRequestId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const technician = await db.select().from(technicians).where(eq(technicians.userId, ctx.user.id)).limit(1);
        const request = technician[0] ? await db.select().from(serviceRequests).where(and(eq(serviceRequests.id, input.serviceRequestId), eq(serviceRequests.assignedTechnicianId, technician[0].id))).limit(1) : [];
        if (!request[0]) throw new TRPCError({ code: "FORBIDDEN", message: "This request is not assigned to you." });
        if (request[0].status !== "in_progress") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The approved work must be in progress before completion can be requested." });
        await db.update(serviceRequests).set({ status: "completion_pending" }).where(eq(serviceRequests.id, request[0].id));
        await db.insert(notificationRecords).values({ userId: request[0].customerId, serviceRequestId: request[0].id, event: "completion_otp_required", title: "Enter completion OTP", body: "Review the completed work and share your secure completion OTP only when you are satisfied." });
        return { success: true, status: "completion_pending" as const };
      }),
  }),
  payments: router({
    startCheckout: protectedProcedure
      .input(z.object({
        serviceRequestId: z.number().int().positive(),
        method: z.enum(["upi", "card"]),
        visitFee: z.number().int().nonnegative(),
        labour: z.number().int().nonnegative(),
        parts: z.number().int().nonnegative(),
        taxes: z.number().int().nonnegative(),
        platformFee: z.number().int().nonnegative().default(0),
        credits: z.number().int().nonnegative().default(0),
        origin: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const request = await db.select().from(serviceRequests).where(and(eq(serviceRequests.id, input.serviceRequestId), eq(serviceRequests.customerId, ctx.user.id))).limit(1);
        if (!request[0]) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot pay for this request." });
        if (request[0].status !== "completed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payment is available only after OTP-gated completion." });
        const total = input.visitFee + input.labour + input.parts + input.taxes + input.platformFee - input.credits;
        if (total < 50) throw new TRPCError({ code: "BAD_REQUEST", message: "The checkout amount must meet the payment provider minimum." });
        await db.insert(payments).values({ ...input, total, method: input.method, status: "pending" });
        const [payment] = await db.select().from(payments).where(and(eq(payments.serviceRequestId, request[0].id), eq(payments.status, "pending"))).orderBy(desc(payments.id)).limit(1);
        if (!payment) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to prepare payment." });
        const origin = ctx.req.headers.origin && /^https:\/\//.test(ctx.req.headers.origin) ? ctx.req.headers.origin : input.origin;
        const checkout = await createHomeosCheckout({ paymentId: payment.id, amount: total, userId: ctx.user.id, customerEmail: ctx.user.email, customerName: ctx.user.name, origin });
        await db.update(payments).set({ providerReference: checkout.id }).where(eq(payments.id, payment.id));
        return { checkoutUrl: checkout.url, paymentId: payment.id };
      }),
    recordPending: protectedProcedure
      .input(z.object({
        serviceRequestId: z.number().int().positive(),
        method: z.enum(paymentMethods),
        visitFee: z.number().int().nonnegative(),
        labour: z.number().int().nonnegative(),
        parts: z.number().int().nonnegative(),
        taxes: z.number().int().nonnegative(),
        platformFee: z.number().int().nonnegative().default(0),
        credits: z.number().int().nonnegative().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const request = await db.select().from(serviceRequests).where(and(eq(serviceRequests.id, input.serviceRequestId), eq(serviceRequests.customerId, ctx.user.id))).limit(1);
        if (!request[0]) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot pay for this request." });
        if (request[0].status !== "completed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payment is available only after OTP-gated completion." });
        const total = input.visitFee + input.labour + input.parts + input.taxes + input.platformFee - input.credits;
        await db.insert(payments).values({ ...input, total, status: "pending" });
        return { success: true, total, status: "pending" as const, message: "Ready for the configured payment provider." };
      }),
    confirmProviderPayment: adminProcedure
      .input(z.object({ paymentId: z.number().int().positive(), providerReference: z.string().trim().min(3).max(160) }))
      .mutation(async ({ input }) => {
        const db = await databaseOrThrow();
        const payment = await db.select().from(payments).where(eq(payments.id, input.paymentId)).limit(1);
        if (!payment[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found." });
        if (payment[0].status !== "pending") throw new TRPCError({ code: "CONFLICT", message: "Payment is already finalised." });
        const request = await db.select().from(serviceRequests).where(eq(serviceRequests.id, payment[0].serviceRequestId)).limit(1);
        if (!request[0] || request[0].status !== "completed" || !request[0].completedAt) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only OTP-completed jobs can be paid and invoiced." });
        }
        const completedAt = request[0].completedAt;
        const invoiceMetadata = buildInvoiceMetadata(request[0].publicId, completedAt);
        const technicianIdentity = request[0].assignedTechnicianId
          ? (await db.select({ displayName: technicians.displayName }).from(technicians).where(eq(technicians.id, request[0].assignedTechnicianId)).limit(1))[0]?.displayName ?? "Verified HomeOS technician"
          : "Verified HomeOS technician";
        const paidAt = new Date();
        await db.update(payments).set({ status: "confirmed", providerReference: input.providerReference, paidAt }).where(eq(payments.id, payment[0].id));
        await db.insert(invoices).values({
          serviceRequestId: request[0].id,
          paymentId: payment[0].id,
          invoiceNumber: invoiceMetadata.invoiceNumber,
          technicianIdentity,
          warrantyDays: invoiceMetadata.warrantyDays,
          warrantyEndsAt: invoiceMetadata.warrantyEndsAt,
        });
        const invoice = await db.select().from(invoices).where(eq(invoices.serviceRequestId, request[0].id)).limit(1);
        if (!invoice[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to generate invoice." });
        await db.insert(warranties).values({ serviceRequestId: request[0].id, invoiceId: invoice[0].id, startsAt: completedAt, endsAt: invoiceMetadata.warrantyEndsAt });
        await db.update(serviceRequests).set({ status: "paid" }).where(eq(serviceRequests.id, request[0].id));
        await db.insert(notificationRecords).values({ userId: request[0].customerId, serviceRequestId: request[0].id, event: "warranty_active", title: "Your 30-day warranty is active", body: `Payment is confirmed. Your service warranty is active until ${invoiceMetadata.warrantyEndsAt.toLocaleDateString("en-IN")}.` });
        return { invoice: invoice[0], warrantyEndsAt: invoiceMetadata.warrantyEndsAt };
      }),
  }),
  invoices: router({
    getForRequest: protectedProcedure
      .input(z.object({ serviceRequestId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const request = await db.select().from(serviceRequests).where(and(eq(serviceRequests.id, input.serviceRequestId), eq(serviceRequests.customerId, ctx.user.id))).limit(1);
        if (!request[0]) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot view this invoice." });
        const invoice = await db.select().from(invoices).where(eq(invoices.serviceRequestId, input.serviceRequestId)).limit(1);
        if (!invoice[0]) return null;
        const [payment] = await db.select().from(payments).where(eq(payments.id, invoice[0].paymentId)).limit(1);
        const warranty = await db.select().from(warranties).where(eq(warranties.serviceRequestId, input.serviceRequestId)).limit(1);
        if (!payment) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invoice payment record is unavailable." });
        return {
          invoice: invoice[0],
          warranty: warranty[0] ?? null,
          document: buildInvoicePayload({
            jobId: request[0].publicId,
            technicianIdentity: invoice[0].technicianIdentity,
            visitFee: payment.visitFee,
            labour: payment.labour,
            parts: payment.parts,
            taxes: payment.taxes,
            platformFee: payment.platformFee,
            credits: payment.credits,
            paymentMethod: payment.method,
            paymentStatus: payment.status,
            total: payment.total,
            warrantyDays: invoice[0].warrantyDays,
            warrantyEndsAt: invoice[0].warrantyEndsAt,
          }),
        };
      }),
  }),
  passport: router({
    getForHome: protectedProcedure
      .input(z.object({ homeId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const home = await db.select().from(homes).where(and(eq(homes.id, input.homeId), eq(homes.ownerId, ctx.user.id))).limit(1);
        if (!home[0]) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot view this home history." });
        const requests = await db.select().from(serviceRequests).where(eq(serviceRequests.homeId, input.homeId)).orderBy(desc(serviceRequests.createdAt));
        const requestIds = requests.map((request) => request.id);
        const records = await Promise.all(requestIds.map(async (serviceRequestId) => {
          const [invoice] = await db.select().from(invoices).where(eq(invoices.serviceRequestId, serviceRequestId)).limit(1);
          const [warranty] = await db.select().from(warranties).where(eq(warranties.serviceRequestId, serviceRequestId)).limit(1);
          const proofs = await db.select().from(jobProofs).where(eq(jobProofs.serviceRequestId, serviceRequestId));
          return { serviceRequestId, invoice: invoice ?? null, warranty: warranty ?? null, proofs };
        }));
        return { home: home[0], requests, records };
      }),
    listDocuments: protectedProcedure
      .input(z.object({ homeId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const [home] = await db.select({ id: homes.id }).from(homes).where(and(eq(homes.id, input.homeId), eq(homes.ownerId, ctx.user.id))).limit(1);
        if (!home) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot view documents for this home." });
        return db.select().from(passportDocuments).where(and(eq(passportDocuments.homeId, input.homeId), eq(passportDocuments.ownerId, ctx.user.id))).orderBy(desc(passportDocuments.createdAt));
      }),
    addDocument: protectedProcedure
      .input(z.object({
        homeId: z.number().int().positive(),
        documentType: z.enum(["appliance_invoice", "warranty_paper", "installation_record", "service_document", "other"]),
        label: z.string().trim().min(1).max(180),
        fileKey: z.string().min(1).max(512),
        fileUrl: z.string().min(1).max(512),
        mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
        fileSize: z.number().int().positive().max(10 * 1024 * 1024),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const [home] = await db.select({ id: homes.id }).from(homes).where(and(eq(homes.id, input.homeId), eq(homes.ownerId, ctx.user.id))).limit(1);
        if (!home) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot add documents to this home." });
        await db.insert(passportDocuments).values({ ...input, ownerId: ctx.user.id });
        const [created] = await db.select().from(passportDocuments).where(and(eq(passportDocuments.homeId, input.homeId), eq(passportDocuments.ownerId, ctx.user.id), eq(passportDocuments.label, input.label))).orderBy(desc(passportDocuments.id)).limit(1);
        return created;
      }),
    removeDocument: protectedProcedure
      .input(z.object({ documentId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const [document] = await db.select().from(passportDocuments).where(and(eq(passportDocuments.id, input.documentId), eq(passportDocuments.ownerId, ctx.user.id))).limit(1);
        if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Passport document not found." });
        await db.delete(passportDocuments).where(eq(passportDocuments.id, document.id));
        return { success: true };
      }),
  }),
  operations: router({
    overview: adminProcedure.query(async () => {
      const db = await databaseOrThrow();
      const [requests, technicianRows, pendingDispatch, activeJobs] = await Promise.all([
        db.select().from(serviceRequests),
        db.select().from(technicians),
        db.select().from(serviceRequests).where(inArray(serviceRequests.status, ["submitted", "matched", "assigned"])),
        db.select().from(serviceRequests).where(inArray(serviceRequests.status, ["en_route", "arrived", "diagnosing", "quote_pending", "quote_approved", "in_progress", "completion_pending"])),
      ]);
      return {
        totalRequests: requests.length,
        activeJobs: activeJobs.length,
        pendingDispatch: pendingDispatch.length,
        verifiedTechnicians: technicianRows.filter((technician) => technician.verificationStatus === "verified").length,
        availableTechnicians: technicianRows.filter((technician) => technician.availability === "available" && technician.verificationStatus === "verified").length,
      };
    }),
    dispatchQueue: adminProcedure.query(async () => {
      const db = await databaseOrThrow();
      return db.select().from(serviceRequests).where(inArray(serviceRequests.status, ["submitted", "matched", "assigned"])).orderBy(desc(serviceRequests.createdAt));
    }),
  }),
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await databaseOrThrow();
      return db.select().from(notificationRecords).where(eq(notificationRecords.userId, ctx.user.id)).orderBy(desc(notificationRecords.createdAt));
    }),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await databaseOrThrow();
        const record = await db.select().from(notificationRecords).where(and(eq(notificationRecords.id, input.notificationId), eq(notificationRecords.userId, ctx.user.id))).limit(1);
        if (!record[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found." });
        await db.update(notificationRecords).set({ readAt: new Date() }).where(eq(notificationRecords.id, record[0].id));
        return { success: true };
      }),
  }),
});

export { thirtyDayWarrantyEnds };
