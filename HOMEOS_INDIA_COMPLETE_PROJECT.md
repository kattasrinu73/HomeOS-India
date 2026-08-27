# HomeOS India: Project Overview

## Purpose

HomeOS India is a Hyderabad-first home-services platform for households, technicians, and internal operations teams. It is built to keep home-service records, dispatch decisions, quotes, completion evidence, invoices, warranties, and Passport documents connected to the correct account and home.

The product is intentionally mobile-first. The customer web experience is a companion interface and operations control plane; the Expo Android client carries the customer and technician journeys.

## User journeys

| Role       | Core journey                                                                                                                                                                                                        | Important safeguards                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer   | Save a home and appliances, describe an issue, upload an optional image, receive guidance, request matching, approve a quote, track service, and retain documents and history.                                      | A quote must be explicitly approved before work starts. The customer does not locally complete a job.                                                      |
| Technician | Apply, declare skills, become available after verification, review offers, accept an offer, execute the job stages, create an itemised quote, upload proof, and submit the completion OTP.                          | Only verified, available, skilled, and location-ready technicians can receive dispatch offers. Only the assigned technician can submit the completion OTP. |
| Operations | Verify technicians and skills, manually run dispatch rounds, review accepted offers, confirm assignment, monitor jobs, review sent quotes, cancel unstarted jobs with an audit trail, and read persisted analytics. | Dispatch is a manual decision. No automatic search-radius expansion or fabricated ETA is used.                                                             |

## Workflow state and records

```text
submitted → matched → assigned → en_route → arrived → diagnosing
→ quote_pending → quote_approved → in_progress → completion_pending
→ completed → paid
```

Every important state transition is protected on the server. Quote approval is a customer-owned action. OTP completion requires the assigned technician and a valid customer code. Payment, invoice creation, and warranty activation remain provider-confirmed rather than client-simulated.

## Technology

| Layer      | Implementation                                                                   |
| ---------- | -------------------------------------------------------------------------------- |
| Web        | React, Vite, Tailwind CSS, tRPC client                                           |
| Server     | Express, tRPC, TypeScript                                                        |
| Data       | Drizzle ORM with a MySQL/TiDB-compatible database                                |
| Mobile     | Expo and React Native                                                            |
| Files      | Managed object storage with database metadata and access controls                |
| Validation | Vitest, TypeScript checks, production build, Expo export, Android internal build |

## Current validation

The latest recorded automated validation includes **45 web/server tests** and **8 Expo tests**. Web/server type checks and production builds pass. The Android internal APK build is complete and documented in [`mobile/UPDATED_ANDROID_APK_BUILD.md`](mobile/UPDATED_ANDROID_APK_BUILD.md).

The detailed result is in [`ALLURE_TESTING_REPORT.md`](ALLURE_TESTING_REPORT.md). That report distinguishes automated evidence from the remaining external checks: a real Android device run, live location and push delivery, and payment-provider confirmation.

## Deliberate boundaries

The project does not collect money, mark payment as confirmed, issue an invoice, or activate a warranty from local client state. A payment provider must confirm a transaction before those records advance. Live tracking and push notifications also need a configured provider and physical-device validation.

## Repository guide

Start with [`README.md`](README.md) for setup and architecture, [`CONTRIBUTING.md`](CONTRIBUTING.md) for development expectations, and [`SECURITY.md`](SECURITY.md) for responsible reporting. The project-specific Claude Code working agreement is in [`CLAUDE.md`](CLAUDE.md).
