# HomeOS India — Complete Project Handoff

**Project:** HomeOS India  
**Checkpoint:** `5ce9f6bd`  
**Android test build:** `1.0.0 (1)` — internal distribution APK  
**Purpose:** A complete technical and product handoff for the HomeOS India customer application, technician application, internal operations console, backend service platform, and Android testing artifact.

> **Current readiness:** HomeOS is ready for **internal UX, workflow, and Android device acceptance testing**. The customer and technician product journeys, protected workflow rules, backend contracts, visual Preview, and Android test APK are implemented. It is **not yet ready for public commercial launch** because authenticated mobile-to-backend synchronization, real GPS/push, and live payment-provider verification remain to be completed.

## 1. Product Overview

HomeOS India is a Hyderabad-first home-services operating system. The product gives a homeowner one primary entry point—**“Tell us what's wrong”**—then guides the problem from issue description through AI-assisted triage, technician selection, job tracking, quote approval, protected completion, payment, warranty, and a living service record for the home.

The product contains three role-based experiences. Customers manage their homes and service requests, technicians manage suitable jobs and their execution, and internal operators supervise demand, supply, dispatch, verification, pricing, and operational signals.

| Surface | Primary responsibility | Main implementation status |
| --- | --- | --- |
| Customer app | Request help, supervise service, pay, retain records | Complete interactive preview and Android UX flow |
| Technician app | Accept work, execute service, send quote, provide proof | Complete interactive preview and Android UX flow |
| Operations console | Monitor dispatch, supply, quality, pricing, and exceptions | Complete visible internal-console workflow |
| Backend service platform | Secure data model, protected workflow contracts, invoices, warranty, documents, matching | Implemented and TypeScript-validated |

## 2. Customer Application

The customer home uses the required **“Tell us what's wrong”** primary call to action. It also includes quick service shortcuts, a 0–100 Home Health Score, active job status, maintenance reminders, warranty visibility, and navigation to jobs, Passport, and account settings.

The customer can move through the following intended service journey.

| Step | Customer experience | Trust or business rule |
| --- | --- | --- |
| 1. Onboarding | Sets location, home type, address, and appliances | Home is the anchor for all service history |
| 2. Fix Anything | Describes the issue and optionally provides a supported image | AI is decision support, not a guaranteed professional diagnosis |
| 3. Guided assessment | Receives follow-up questions, category, urgency, possible diagnosis, safety guidance, and a price range | Dangerous conditions are separated from ordinary requests |
| 4. Technician matching | Chooses a matching preference: fastest, best-rated, lowest-cost, or preferred professional | Dispatch is designed for controlled, eligible selection |
| 5. Tracking | Sees active job status, ETA, assigned technician, and route-ready tracking UI | Continuous live location needs production device/location configuration |
| 6. Quote approval | Reviews itemised visit fee, labour, parts, taxes, and total | **Work cannot begin without explicit customer approval** |
| 7. Completion OTP | Inspects work and confirms completion with OTP | **A job cannot be completed without a valid numeric OTP** |
| 8. Checkout | Selects UPI, Card, or Wallet and reviews the total | Live payment requires payment-provider activation |
| 9. Invoice and warranty | Receives job ID, technician, parts, labour, taxes, payment information, and warranty | Warranty is shown as **exactly 30 days** |
| 10. Home Service Passport | Sees service history, proof, warranties, appliances, maintenance, and home documents | Customer history remains attached to the home |

### Home Service Passport and Documents

The Passport presents historical service records, proof, invoices, warranty indicators, appliance maintenance details, and a 0–100 home-health indicator. It now includes customer-managed document categories for the following documents.

| Document category | Intended use |
| --- | --- |
| Appliance invoice | Purchase invoice, model proof, and purchase reference |
| Warranty paper | Manufacturer or extended-warranty documents |
| Installation record | Installation certificates, photos, and technician records |
| Service document | External service bills and inspection reports |

The visible application permits selecting a PDF, JPG, PNG, or WEBP document and shows it in the local Passport list. The protected backend contains secure document storage and list/remove procedures. The final production step is to connect the authenticated mobile client to those procedures and persist selected file bytes in protected object storage.

## 3. Technician Application

The technician workspace is available in the application through **Account → Technician app**. It is intentionally role-specific and keeps the service process inside the customer protection rules.

| Technician stage | Implemented experience | Rule enforced |
| --- | --- | --- |
| Availability and offers | Earnings card, new job card, distance, estimated payout, required skill, accept/decline | Offers are designed to come from eligible matching rounds |
| Assigned job | Customer description, arrival status, visit fee, call/navigation controls | Job is identifiable by HomeOS job ID |
| Diagnosis and quote | Itemised diagnosis, visit fee, labour, parts, taxes, and total | Quote must be explicitly approved by the customer |
| Proof | Before/after evidence state and protected proof storage contract | Evidence is intended for the customer Passport |
| Completion | OTP-request state shown after work | Technician cannot close work without customer OTP |
| Earnings/performance | Visible daily earnings and job context | Persisted earnings/performance binding remains a production integration task |

## 4. Operations Console

The internal operations console is a browser-oriented control plane; it is not a consumer feature. It contains active job volume, pending dispatch requests, verified technician supply, availability, a controlled dispatch queue, and interactive operator panels.

| Operations action | Visible control | Objective |
| --- | --- | --- |
| Verify technician | Verification queue and approval action | Check technician identity and skill credentials |
| Review pricing | Pricing review panel and approval action | Govern category-range and fee rules |
| Monitor job | Live job monitoring panel | Identify quote, arrival, or execution exceptions |
| View analytics | Service-health panel | Review active demand, dispatch need, and available supply |

The backend also exposes protected operations overview and dispatch-queue procedures. Connecting this console to live persisted data is listed in the production backlog below.

## 5. Core Workflow and Safety Contract

HomeOS uses a restricted state machine rather than allowing arbitrary job updates.

```text
submitted → matched → assigned → en_route → arrived → diagnosing
→ quote_pending → quote_approved → in_progress → completion_pending
→ completed → paid
```

| Transition | Actor | Required condition |
| --- | --- | --- |
| `submitted → matched` | Dispatch/operations | Suitable candidate availability |
| `matched → assigned` | Customer/operations | Eligible technician selected |
| `assigned → diagnosing` | Assigned technician | Assigned technician manages arrival and diagnosis |
| `quote_pending → quote_approved` | Customer | Explicit current-quote approval |
| `quote_approved → in_progress` | Technician | Quote approval guard must be true |
| `completion_pending → completed` | Technician | Customer completion OTP must validate |
| `completed → paid` | Customer/provider | Payment confirmation or accepted recorded method |

The workflow tests prove that an unapproved quote cannot enter `in_progress`, and an absent/invalid OTP cannot enter `completed`. A completed service starts an exact 30-day warranty period.

## 6. Backend Architecture

The managed full-stack service uses a React/Vite client, Express server, tRPC procedures, Drizzle ORM, and MySQL/TiDB-compatible managed database. Authentication is supplied through Manus OAuth for the web service. The Android project is a bundled Expo application with its own workflow tests and EAS build profile.

```text
Customer / Technician Android App       Internal Operations Web Console
                  │                                  │
                  └──────────── protected API ───────┘
                                     │
                       Express + tRPC application server
                                     │
      ┌───────────────┬──────────────┼───────────────┬───────────────┐
      │               │              │               │               │
  Database        Object storage     AI diagnosis   Stripe/EAS     Maps/notifications
  (records)       (file bytes)       contract       integrations   contracts
```

### Key Server Modules

| Path | Responsibility |
| --- | --- |
| `drizzle/schema.ts` | Persistent HomeOS domain tables |
| `server/homeosRouter.ts` | Protected customer, technician, dispatch, Passport, notification, operations, upload, and invoice procedures |
| `server/homeosWorkflow.ts` | Transition guards, OTP validation, warranty calculation, dispatch scoring, and invoice payload assembly |
| `server/stripe.ts` | Checkout session and signed webhook integration scaffolding |
| `server/products.ts` | Central payment product/price configuration |
| `server/_core/index.ts` | Express runtime and Stripe webhook registration |
| `client/src/pages/Home.tsx` | Complete interactive customer, technician, Passport, and operations preview |
| `mobile/App.tsx` | Bundled native HomeOS user interface |
| `mobile/src/workflow.ts` | Native app workflow rules |
| `mobile/eas.json` | Expo/EAS internal APK build profile |

## 7. Persistent Data Model

The service platform stores relational business records in the database and keeps file bytes in object storage. It deliberately avoids storing raw media in database columns.

| Domain table | Purpose |
| --- | --- |
| `users` | Authenticated HomeOS identities and roles |
| `homes` | Customer homes, address, type, and 0–100 health score |
| `appliances` | Appliance register and invoice reference metadata |
| `technicians` | Technician identity, availability, verification, radius, location, and performance fields |
| `technicianSkills` | Verified service-category skills |
| `serviceRequests` | Customer request, diagnosis, urgency, estimates, status, assigned technician, OTP hash |
| `dispatchOffers` | Controlled matching round, radius, score, offer status, and decline reason |
| `quotes` and `quoteItems` | Itemised technician quote and approval status |
| `jobProofs` | Before/part/after evidence metadata |
| `payments` | Business payment components and payment status |
| `invoices` | Invoice identity, technician identity, payment link, and 30-day warranty facts |
| `warranties` | Active, claimed, expired, or void warranty lifecycle |
| `notificationRecords` | In-app/push notification event records |
| `passportDocuments` | Customer document metadata, file key, URL, type, MIME type, and size |

## 8. AI, Storage, Matching, Maps, Payments, and Notifications

| Capability | Current implementation | Production completion requirement |
| --- | --- | --- |
| AI diagnosis | Protected structured diagnosis procedure supports category, urgency, possible diagnosis, safety note, follow-ups, and estimate range | Connect authenticated mobile client to the procedure and evaluate safety prompts against pilot scenarios |
| Customer/technician media | Secure image upload contract and protected object storage | Bind native media picker/file bytes to authenticated server transport |
| Passport documents | Secure PDF/JPG/PNG/WEBP upload, list, add, and remove backend procedures | Bind document selector to authenticated mobile client and object storage response |
| Matching | Controlled rounds, radius expansion, distance-aware scoring, technician offers | Use verified technician availability, home location, and real customer booking data |
| Maps | Route/ETA tracking interface | Configure real map provider calls and consented technician location updates |
| Payments | Stripe checkout session/webhook scaffolding plus UPI/Card/Wallet UX | Claim/activate Stripe sandbox, test checkout and webhook, then configure a suitable Indian payment strategy before launch |
| Notifications | Persisted event records | Add device tokens, push credentials, delivery retries, and consent flows |

## 9. Android Test APK

An internal Android APK was successfully built through Expo EAS after correcting the missing Expo native entry file.

| Item | Value |
| --- | --- |
| Expo project | `@srk553/homeos-india-mobile` |
| Android package | `com.homeos.india` |
| Build profile | `preview` internal distribution |
| Version | `1.0.0 (1)` |
| Artifact status | **FINISHED** |
| APK installation URL | <https://expo.dev/artifacts/eas/I4a8gQ4k0-K3XRDSuE_jMyiitCMGBz2cwBkdRbrPFOw.apk> |
| Build details | <https://expo.dev/accounts/srk553/projects/homeos-india-mobile/builds/3e6efcb7-7e4a-4efd-a907-c66a26873ecc> |

To test both roles in the APK, use the customer home and bottom navigation for the customer journey. Open **Account → Technician app** for the technician experience. On a physical Android device, test permissions, document picker behavior, customer navigation, technician proof flow, and completion-OTP request flow.

## 10. Test Evidence

The following validations passed in the recorded end-to-end test run.

| Validation | Result |
| --- | --- |
| Web/backend Vitest suite | **PASS** — 3 files and 8 tests |
| Expo token API validation | **PASS** |
| Backend TypeScript | **PASS** |
| Production Vite/server build | **PASS**; bundle-size code-splitting advisory remains |
| Native workflow suite | **PASS** — 8 tests including sequential customer and technician lifecycle tests |
| Native TypeScript | **PASS** |
| Native Android export bundle | **PASS** — 676 modules bundled |
| Customer Preview states | **PASS** — onboarding, intake, assessment, matching, tracking, quote, OTP, checkout, invoice, jobs, Passport, account |
| Technician Preview states | **PASS** — workspace, job, quote, proof, OTP request |
| Operations Preview states | **PASS** — verification, pricing, monitoring, analytics |
| Internal Android APK cloud build | **PASS** — finished artifact available |

The detailed verification record is available in `E2E_TEST_OUTPUT.md`.

## 11. What Is Complete vs. What Remains

### Completed

The completed deliverable includes the interactive customer, technician, and operations UI; the customer-protection workflow contract; quote approval guard; OTP completion guard; exact warranty calculation; invoice model; Home Service Passport; Passport document data model and server procedures; controlled dispatch model; operations monitoring views; Android build configuration; and a successful installable Android test APK.

### Remaining Before Public Launch

| Priority | Work item | Why it is required |
| --- | --- | --- |
| Critical | Connect Android client authentication to protected backend APIs | Current native experience is not yet synchronized with persistent live user records |
| Critical | Bind mobile uploads and Passport selection to object storage and document APIs | Document selection is visible; authenticated secure persistence still needs client transport |
| Critical | Complete payment sandbox checkout and signed webhook test | Payments cannot be accepted publicly without verified provider completion |
| Critical | Real-device GPS, camera, media, push, and permission acceptance tests | These require an actual Android device and configured providers |
| High | Bind customer dashboard, jobs, invoices, Passport, technician work, and operations console to live records | Preview reflects intended experience; full live data binding remains |
| High | Populate and verify actual technician supply / skills / availability | Controlled dispatch requires real verified service professionals |
| High | Production notification delivery | Persisted records exist; device token registration and push delivery remain |
| Medium | Code-split the web preview bundle | Build passes, but Vite warns about a JavaScript chunk larger than 500 kB |

## 12. Recommended Pilot Plan

Start with a small Hyderabad pilot area and verified technician group. First run the Android APK on physical customer and technician devices, test permissions and customer safety guidance, then connect authenticated mobile data to a test database. Next, seed real homes and technicians, verify controlled dispatch with actual distance and availability, and test the entire payment flow in the claimed Stripe sandbox. Only after signed webhook, file storage, GPS, notification, and OTP delivery tests are completed should a broader customer pilot begin.

## 13. Project Locations and Key Artifacts

| Artifact | Location or link |
| --- | --- |
| Managed full-stack project | `/home/ubuntu/homeos-india` |
| Bundled Expo mobile app | `/home/ubuntu/homeos-india/mobile` |
| Current project checkpoint | `manus-webdev://5ce9f6bd` |
| Product scope | `PRODUCT_SCOPE.md` |
| Native test and APK guide | `mobile/APK_TESTING.md` |
| E2E test output | `E2E_TEST_OUTPUT.md` |
| Complete handoff | `HOMEOS_INDIA_COMPLETE_PROJECT.md` |

## References

[1] [Expo, “Programmatic access”](https://docs.expo.dev/accounts/programmatic-access/) — Documents the use of `EXPO_TOKEN` for authenticated EAS CLI automation and the requirement to link an EAS project before invoking build commands.

[2] [Expo Build Details: HomeOS India Android internal build](https://expo.dev/accounts/srk553/projects/homeos-india-mobile/builds/3e6efcb7-7e4a-4efd-a907-c66a26873ecc) — Internal Android build record and installation pathway.
