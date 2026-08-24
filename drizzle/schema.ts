import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const accountProfiles = mysqlTable("accountProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  serviceIntent: mysqlEnum("serviceIntent", ["customer", "technician"]).notNull().default("customer"),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const homes = mysqlTable("homes", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
  locality: varchar("locality", { length: 120 }).notNull(),
  city: varchar("city", { length: 120 }).notNull().default("Hyderabad"),
  postalCode: varchar("postalCode", { length: 20 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  homeType: mysqlEnum("homeType", ["apartment", "independent_house", "villa", "other"]).notNull(),
  healthScore: int("healthScore").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("homes_owner_idx").on(table.ownerId)]);

export const appliances = mysqlTable("appliances", {
  id: int("id").autoincrement().primaryKey(),
  homeId: int("homeId").notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  brand: varchar("brand", { length: 120 }),
  model: varchar("model", { length: 160 }),
  installedYear: int("installedYear"),
  invoiceFileKey: varchar("invoiceFileKey", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("appliances_home_idx").on(table.homeId)]);

export const maintenanceReminders = mysqlTable("maintenanceReminders", {
  id: int("id").autoincrement().primaryKey(),
  homeId: int("homeId").notNull(),
  ownerId: int("ownerId").notNull(),
  applianceId: int("applianceId"),
  title: varchar("title", { length: 180 }).notNull(),
  dueAt: timestamp("dueAt").notNull(),
  status: mysqlEnum("status", ["open", "done"]).notNull().default("open"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("maintenance_reminder_home_idx").on(table.homeId), index("maintenance_reminder_owner_status_idx").on(table.ownerId, table.status), index("maintenance_reminder_due_idx").on(table.dueAt)]);

export const technicians = mysqlTable("technicians", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  photoUrl: varchar("photoUrl", { length: 512 }),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "suspended"]).notNull().default("pending"),
  availability: mysqlEnum("availability", ["offline", "available", "busy"]).notNull().default("offline"),
  serviceRadiusKm: int("serviceRadiusKm").notNull().default(5),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  locationUpdatedAt: timestamp("locationUpdatedAt"),
  completionRate: decimal("completionRate", { precision: 5, scale: 2 }).notNull().default("0"),
  onTimeRate: decimal("onTimeRate", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const technicianSkills = mysqlTable("technicianSkills", {
  id: int("id").autoincrement().primaryKey(),
  technicianId: int("technicianId").notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("tech_skill_unique").on(table.technicianId, table.category)]);

export const serviceRequests = mysqlTable("serviceRequests", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 40 }).notNull().unique(),
  customerId: int("customerId").notNull(),
  homeId: int("homeId").notNull(),
  status: mysqlEnum("status", ["submitted", "matched", "assigned", "en_route", "arrived", "diagnosing", "quote_pending", "quote_approved", "in_progress", "completion_pending", "completed", "paid", "cancelled"]).notNull().default("submitted"),
  category: varchar("category", { length: 80 }).notNull(),
  description: text("description").notNull(),
  attachmentUrl: varchar("attachmentUrl", { length: 512 }),
  possibleDiagnosis: text("possibleDiagnosis"),
  urgency: mysqlEnum("urgency", ["low", "medium", "high", "emergency"]).notNull().default("medium"),
  estimateMin: int("estimateMin"),
  estimateMax: int("estimateMax"),
  assignedTechnicianId: int("assignedTechnicianId"),
  quoteApprovedAt: timestamp("quoteApprovedAt"),
  completionOtpHash: varchar("completionOtpHash", { length: 255 }),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("service_requests_customer_idx").on(table.customerId), index("service_requests_home_idx").on(table.homeId), index("service_requests_status_idx").on(table.status)]);

export const dispatchOffers = mysqlTable("dispatchOffers", {
  id: int("id").autoincrement().primaryKey(),
  serviceRequestId: int("serviceRequestId").notNull(),
  technicianId: int("technicianId").notNull(),
  round: int("round").notNull(),
  searchRadiusKm: int("searchRadiusKm").notNull(),
  score: decimal("score", { precision: 8, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["offered", "accepted", "declined", "expired"]).notNull().default("offered"),
  declineReason: varchar("declineReason", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("dispatch_request_idx").on(table.serviceRequestId), index("dispatch_technician_idx").on(table.technicianId)]);

export const dispatchRoundAudits = mysqlTable("dispatchRoundAudits", {
  id: int("id").autoincrement().primaryKey(),
  serviceRequestId: int("serviceRequestId").notNull(),
  initiatedByUserId: int("initiatedByUserId").notNull(),
  round: int("round").notNull(),
  searchRadiusKm: int("searchRadiusKm").notNull(),
  eligibleOfferCount: int("eligibleOfferCount").notNull().default(0),
  outcome: mysqlEnum("outcome", ["offers_created", "exhausted"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("dispatch_round_audit_request_idx").on(table.serviceRequestId), index("dispatch_round_audit_created_idx").on(table.createdAt)]);

export const operationsRequestAudits = mysqlTable("operationsRequestAudits", {
  id: int("id").autoincrement().primaryKey(),
  serviceRequestId: int("serviceRequestId").notNull(),
  initiatedByUserId: int("initiatedByUserId").notNull(),
  action: mysqlEnum("action", ["cancelled"]).notNull(),
  reason: varchar("reason", { length: 400 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("operations_request_audit_request_idx").on(table.serviceRequestId), index("operations_request_audit_created_idx").on(table.createdAt)]);

export const quotes = mysqlTable("quotes", {
  id: int("id").autoincrement().primaryKey(),
  serviceRequestId: int("serviceRequestId").notNull(),
  technicianId: int("technicianId").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "approved", "rejected", "superseded"]).notNull().default("draft"),
  reason: text("reason").notNull(),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("quotes_request_idx").on(table.serviceRequestId)]);

export const quoteItems = mysqlTable("quoteItems", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quoteId").notNull(),
  itemType: mysqlEnum("itemType", ["visit_fee", "labour", "part", "tax", "platform_fee", "discount"]).notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  amount: int("amount").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("quote_items_quote_idx").on(table.quoteId)]);

export const jobProofs = mysqlTable("jobProofs", {
  id: int("id").autoincrement().primaryKey(),
  serviceRequestId: int("serviceRequestId").notNull(),
  proofType: mysqlEnum("proofType", ["before", "part", "after", "note"]).notNull(),
  fileKey: varchar("fileKey", { length: 512 }),
  fileUrl: varchar("fileUrl", { length: 512 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("proofs_request_idx").on(table.serviceRequestId)]);

export const passportDocuments = mysqlTable("passportDocuments", {
  id: int("id").autoincrement().primaryKey(),
  homeId: int("homeId").notNull(),
  ownerId: int("ownerId").notNull(),
  documentType: mysqlEnum("documentType", ["appliance_invoice", "warranty_paper", "installation_record", "service_document", "other"]).notNull(),
  label: varchar("label", { length: 180 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: int("fileSize").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("passport_documents_home_idx").on(table.homeId), index("passport_documents_owner_idx").on(table.ownerId)]);

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  serviceRequestId: int("serviceRequestId").notNull(),
  providerReference: varchar("providerReference", { length: 160 }),
  method: mysqlEnum("method", ["upi", "card", "wallet", "cash"]).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "failed", "refunded"]).notNull().default("pending"),
  visitFee: int("visitFee").notNull().default(0),
  labour: int("labour").notNull().default(0),
  parts: int("parts").notNull().default(0),
  taxes: int("taxes").notNull().default(0),
  platformFee: int("platformFee").notNull().default(0),
  credits: int("credits").notNull().default(0),
  total: int("total").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("payments_request_idx").on(table.serviceRequestId)]);

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  serviceRequestId: int("serviceRequestId").notNull().unique(),
  paymentId: int("paymentId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull().unique(),
  technicianIdentity: varchar("technicianIdentity", { length: 255 }).notNull(),
  warrantyDays: int("warrantyDays").notNull().default(30),
  warrantyEndsAt: timestamp("warrantyEndsAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const warranties = mysqlTable("warranties", {
  id: int("id").autoincrement().primaryKey(),
  serviceRequestId: int("serviceRequestId").notNull().unique(),
  invoiceId: int("invoiceId").notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  status: mysqlEnum("status", ["active", "claimed", "expired", "void"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notificationRecords = mysqlTable("notificationRecords", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  serviceRequestId: int("serviceRequestId"),
  channel: mysqlEnum("channel", ["in_app", "push"]).notNull().default("in_app"),
  event: varchar("event", { length: 120 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("notifications_user_idx").on(table.userId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type JobStatus = ServiceRequest["status"];
