# HomeOS India Native and Provider Release Boundaries

## Purpose

HomeOS India now has protected web workflow bindings for customer requests, document uploads, AI-assisted assessment with optional issue images, technician offers and jobs, itemised quote approval, payment initiation, invoices, warranties, and operations data. This document records the distinction between those implemented web contracts and the remaining work that depends on native-client transport, external provider activation, or operational policy decisions.

> **No external integration should be represented as confirmed until it has completed an authenticated, provider-verified end-to-end test in the target environment.**

## Delivery status by surface

| Surface | Implemented in the current web release | Boundary before production launch |
|---|---|---|
| Customer service intake | Authenticated home selection, secure issue-image storage, attachment-aware structured assessment, persisted service request creation, and controlled-dispatch handoff | Native application must invoke the same authenticated contracts rather than retaining a device-local request flow |
| Passport | Per-home document listing, PDF/JPG/PNG/WEBP upload, 10 MB limit, error feedback, opening, and removal | Expo must add the same storage transport, device file picker handling, and user-visible validation feedback |
| Technician workflow | Real offer list, accept/decline, assigned-job list, editable quote creation, persisted note proof, start-work gate, and completion-ready notification action | Native technician workspace must call the protected procedures and add file-backed before/part/after proof capture |
| Payment, invoice, warranty | Payment initiation uses persisted quote totals; confirmed payment contracts generate invoice and fixed 30-day warranty records | Stripe sandbox claim, webhook signature validation, hosted checkout return states, refund handling, and a confirmed-payment device test remain required |
| Dispatch | Server supports scored eligibility, controlled rounds, persisted offers, technician response, and assignment | Operations must run/automate rounds using homes with precise locations, with escalation thresholds and auditable operator review |
| Notifications and live tracking | Persisted in-app notification records and a live-tracking UI shell are available | Push credentials, device-token management, consented location publishing, map-provider configuration, and outage handling are required |

## Native Android release requirement

The bundled Expo Android application remains a separate client surface. The production Android release must authenticate using the same user session model and use the shared tRPC procedures for diagnosis, attachments, homes, requests, jobs, Passport documents, technician actions, invoices, and notifications. Local `Alert`-only transitions and device-local image URIs must not be treated as customer records.

Native testing must cover Android permission grant, denial, revocation, and recovery paths for the camera, photo library, files, notification permission, and location. The app should provide a readable fallback whenever a permission is not available, rather than blocking service intake. Passport document content must be uploaded to protected storage before it appears in the user’s account history.

## Payment and invoice boundary

The Stripe hosted checkout initiation path is implemented, but payment confirmation is deliberately server-side. A customer should not see a paid invoice or warranty merely because a checkout was opened or a local wallet-pending record was created. The final sequence is: authenticated checkout creation, verified provider event, payment confirmation, invoice generation, warranty creation, request update, and customer notification.

| Required payment test | Expected evidence |
|---|---|
| Successful card or UPI sandbox payment | A verified webhook creates a confirmed payment, invoice, warranty, and `paid` request status |
| Cancelled checkout | No confirmed invoice or warranty; customer can safely return to payment selection |
| Duplicate webhook | Idempotent behavior: no duplicate payment, invoice, warranty, or notification |
| Refund or dispute | Payment and warranty handling follows an approved operational policy and is audit logged |

## Operational release decision

A limited Hyderabad pilot may proceed only after the Stripe confirmation flow, native secure media/document transport, technician verification process, device permissions, rate limiting, support escalation, and operational monitoring have all been tested with real pilot accounts. Until then, the web release should be treated as an authenticated pilot foundation rather than an unrestricted consumer service.
