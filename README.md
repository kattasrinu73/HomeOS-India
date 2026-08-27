# HomeOS India

HomeOS India is a Hyderabad-first home-services operations platform. It combines a customer web experience, an internal operations console, and an Expo Android client so a household can request a service, retain appliance records, receive an itemised quote, review its service history, and maintain a Home Service Passport.

The project is designed around a simple principle: workflow status should come from protected persisted records rather than browser-only demonstrations. The current implementation is suitable for further development and controlled testing; it is **not** a live payment, real-time location, or physical-device certification.

## What is implemented

| Area                | Current capability                                                                                                                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer workflow   | Account access, saved homes and coordinates, appliance records, image-assisted issue intake, controlled matching, quote approval, request tracking, Passport documents, manual maintenance reminders, notifications, invoices, and warranty history. |
| Technician workflow | Profile application, skill declaration, verification-gated availability and location, offer review, travel/arrival/diagnosis transitions, itemised quote creation, proof upload, and technician-only OTP completion.                                 |
| Operations workflow | Technician and skill verification, manual dispatch rounds, accepted-offer assignment, protected job cancellation audits, job monitoring, pricing review, and persisted service analytics.                                                            |
| Data protection     | Owner-scoped protected procedures, server-enforced quote and OTP gates, S3-backed file references, recorded dispatch and job-management audits, and persisted Home Health Score recalculation.                                                       |

## Architecture

```text
React + Vite customer and operations web app
             │
             │ typed tRPC procedures
             ▼
Express server ── Drizzle ORM ── MySQL/TiDB-compatible database
       │                          │
       ├── S3-backed document and image storage
       └── Expo Android client using the same protected service API
```

## Local development

### Web and server

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm dev
```

The server requires its deployment environment to supply the database, authentication, storage, and optional service credentials. Do not commit `.env` files, tokens, device credentials, or payment-provider secrets.

### Expo mobile client

```bash
cd mobile
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm exec expo export --platform web
```

The latest internally distributed Android build and testing notes are in [`mobile/UPDATED_ANDROID_APK_BUILD.md`](mobile/UPDATED_ANDROID_APK_BUILD.md).

## Validation evidence

The latest recorded automated validation comprises **45 web/server tests** and **8 Expo tests**. The project’s [Allure-compatible report](ALLURE_TESTING_REPORT.md) separates automated results from checks requiring external evidence, such as physical Android device flows, live location delivery, push delivery, and payment-provider confirmation.

## Product boundaries

Payment collection, payment confirmation, invoice issuance, and the 30-day warranty activation path remain provider-gated. The product does not locally mark a service as paid or fabricate payment confirmation. Dispatch expansion is an explicit operations action; it is not a background loop or an automatic radius-expansion service.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening an issue or pull request. Security issues should follow [SECURITY.md](SECURITY.md) and should not be reported in a public issue.

## Claude Code and open-source program notes

[`CLAUDE.md`](CLAUDE.md) contains practical repository instructions for Claude Code. [`CLAUDE_FOR_OPEN_SOURCE_RESEARCH.md`](CLAUDE_FOR_OPEN_SOURCE_RESEARCH.md) and [`docs/CLAUDE_FOR_OSS_APPLICATION_GUIDANCE.md`](docs/CLAUDE_FOR_OSS_APPLICATION_GUIDANCE.md) record the official program criteria and a truthful application-preparation checklist.

> This repository’s documentation helps reviewers understand the work. It does not create, imply, or guarantee eligibility for any external program. Eligibility must be supported by the applicant’s own public contribution record and project impact.[1]

## References

[1]: https://www.anthropic.com/claude-for-oss-terms "Claude for Open Source Terms and Conditions"
