# HomeOS India Automated Testing Report

**Generated:** 24 August 2026, updated after the manual-assignment release.  
**Report format:** Allure-compatible raw results in [`allure-results/`](./allure-results/) plus this reviewable summary.  
**Scope:** The protected HomeOS web/server application and Expo Android client.

## Automated validation summary

| Area                         | Command or evidence                               | Result | Verified outcome                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------- | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server and web type safety   | `pnpm check`                                      | Passed | TypeScript completed without errors.                                                                                                                                                         |
| Server workflow tests        | `pnpm test`                                       | Passed | **38 tests** across four files passed, including protected quote, OTP, manual dispatch, operator assignment, AI assessment, invoice/warranty, Home Health Score, and authorization behavior. |
| Production web/server bundle | `pnpm build`                                      | Passed | Vite web bundle and Node server bundle were produced.                                                                                                                                        |
| Expo client type safety      | `mobile: pnpm check`                              | Passed | Native TypeScript completed without errors.                                                                                                                                                  |
| Expo workflow tests          | `mobile: pnpm test`                               | Passed | **8 tests** across two files passed.                                                                                                                                                         |
| Expo web export              | `mobile: pnpm exec expo export --platform web`    | Passed | Static Expo web export was generated.                                                                                                                                                        |
| Android internal APK         | Expo build `73522b2e-39e1-471d-92fe-6a8263234788` | Passed | Completed successfully and is internally installable through the Expo build page.                                                                                                            |

> **Interpretation:** The automated suite currently contains **46 passing tests** in total: 38 in the web/server project and 8 in the Expo project. The result does not constitute physical-device or payment-provider certification.

## High-value workflow coverage

| Protected behavior                                                                       | Automated coverage status |
| ---------------------------------------------------------------------------------------- | ------------------------- |
| Anonymous users cannot approve quotes, start work, complete jobs, or initiate payment    | Passed                    |
| Customer-owned quote approval and technician-only work start                             | Passed                    |
| Assigned-technician OTP completion and invalid-OTP rejection                             | Passed                    |
| Manual dispatch audit persistence and latest-audit operations read                       | Passed                    |
| Technician acceptance remains pending until an administrator confirms assignment         | Passed                    |
| Accepted-candidate queue data and administrator-only assignment confirmation             | Passed                    |
| Customer dispatch-handoff state remains aggregate and does not expose technician data    | Passed                    |
| AI assessment accepts text or secure attachment URLs and falls back cautiously           | Passed                    |
| Customer invoice ownership, line items, confirmed payment, and 30-day warranty retrieval | Passed                    |
| Home Health Score is bounded, persisted, event-refreshed, and warranty-expiry-aware      | Passed                    |
| Native workflow helpers and Expo web export                                              | Passed                    |

## Verification boundaries

The following are intentionally **not marked as passed** in this report. They require external evidence rather than sandbox simulation.

| Boundary                                                             |   Status | Reason                                                                                                             |
| -------------------------------------------------------------------- | -------: | ------------------------------------------------------------------------------------------------------------------ |
| Android physical-device OAuth completion                             |  Pending | The APK completed successfully; a real Android device is still required to complete custom deep-link OAuth return. |
| Device location permission and persisted coordinates                 |  Pending | Requires real device permission handling and location services.                                                    |
| Passport file picker upload/removal on a physical Android device     |  Pending | The protected code path is validated, but device picker behavior needs a device run.                               |
| Push/real-time delivery and live technician route/ETA                |  Pending | No live push/location provider is activated.                                                                       |
| Stripe payment confirmation, webhook, invoice, and warranty issuance | Deferred | Payment-provider activation remains deferred by owner request.                                                     |

## Build notes

The production web/server build completed successfully. It emitted a bundle-size advisory for a JavaScript chunk above 500 kB; this is a performance optimization opportunity, not a build failure. Expo type checking, unit tests, web export, and the refreshed internal Android APK build completed successfully.

## How to open the Allure report

The raw Allure result files are in `allure-results/`. On a machine with the Allure CLI installed, run:

```bash
allure generate allure-results --clean -o allure-report
allure open allure-report
```

The Allure CLI was not installed in the validation environment, so this workspace produced and formatter-validated **raw Allure-compatible result files** rather than a locally rendered Allure HTML dashboard. The result files deliberately separate passed automated checks from skipped device/provider checks, so an Allure dashboard generated from them does not overstate coverage.
