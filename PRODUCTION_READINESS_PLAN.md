# HomeOS India Production-Readiness Plan

## Purpose and release posture

HomeOS India is a protected home-services platform for customers, technicians, and internal operations. The current release provides the account-aware customer workflow, technician offer acceptance, operations visibility, S3-backed Passport documents, server-enforced quote approval, completion-OTP checks, payment-provider scaffolding, invoices, and a fixed **30-day warranty** record. This plan defines the remaining controls required before a broad consumer launch.

> **Release principle:** customer safety, service integrity, and privacy take precedence over dispatch speed or growth targets.

## Current implementation status

| Capability | Current state | Launch requirement |
|---|---|---|
| Authentication and roles | Manus OAuth with protected customer, technician, and administrator procedures | Verify account-recovery experience, browser cookie compatibility, and administrator-access reviews |
| Quote approval | Server-enforced: work cannot begin without a sent quote being explicitly approved | Maintain audit logs for quote versions and customer approval timestamp |
| Completion OTP | Server-enforced technician completion workflow | Deliver OTP through a production notification channel and add rate limits/lockouts |
| Payment and invoices | Stripe checkout initiation and persisted payment/invoice/warranty contracts | Claim the Stripe sandbox, configure webhook signing, verify production confirmation and reversal flows |
| Passport documents | Per-user/per-home S3-backed upload, list, and removal contracts | Add native Expo transport, file-scan policy, validation messages, retention policy, and support recovery workflow |
| Dispatch | Scored, controlled dispatch rounds with verified-skill and availability filtering | Add dispatch runbooks, location quality thresholds, escalation timers, and on-call observability |
| Operations | Protected overview and dispatch queue | Implement audited verification/pricing actions and export controls |

## Launch gates

| Gate | Acceptance criterion | Owner | Evidence |
|---|---|---|---|
| Payment provider activation | Sandbox is claimed, webhook signature verified, and a successful payment creates a confirmed payment, invoice, warranty, and customer notification | Payments owner | Stripe test run, webhook log, database audit record |
| Customer journey | A signed-in customer can create a home, request service, review a real quote, approve it, and view persisted job, invoice, and warranty states | Product and QA | Scripted device test on Android and mobile web |
| Technician journey | A verified technician can receive, accept/decline, and view assigned work without seeing unrelated customer data | Operations and QA | Role-isolation test evidence |
| OTP safeguards | OTP is delivered securely, rate-limited, expires as designed, and completion attempts are logged | Security and backend | Negative and replay-attempt test evidence |
| Passport documents | Unsupported types and files over 10 MB show usable errors; permitted uploads are scoped to the owning home/account | Backend and mobile | Storage authorization and native client test evidence |
| Operations security | Admin-only views/actions are denied to customer and technician sessions and action logs are retained | Operations and security | Authorization test results and audit-log sample |

## Reliability, real-time updates, and observability

The product should initially use request refetching after critical mutations and introduce real-time updates only after a clear delivery guarantee is defined. Recommended next steps are authenticated event delivery for request status, quote, payment, and technician-arrival updates; idempotency keys for payment webhooks and dispatch actions; and a dead-letter/retry strategy for notifications.

Operational telemetry should measure service-request creation, dispatch offer acceptance/decline, quote approval, OTP failures, payment initiation/confirmation, invoice generation, document upload failures, and authorization denials. Each event should include a correlation ID, request ID where applicable, user role, outcome, and latency; logs must avoid raw OTPs, document bytes, home addresses, or payment card data. Alerting should cover webhook failures, invoice/warranty creation failures after confirmed payment, sustained dispatch backlog, abnormal OTP failures, and storage-upload error spikes.

## Security, privacy, and abuse prevention

Home addresses, contact information, document links, and job proof are high-sensitivity data. Access must remain least-privilege and server-checked, never enforced only in the client. Before launch, complete a privacy notice, consent wording for service delivery and documents, data-retention schedule, account-deletion flow, incident response process, and support escalation path for compromised accounts.

Abuse controls should include per-account and per-IP request limits, CAPTCHA or risk checks for repeated sign-up/request activity, file-content scanning where available, document MIME/size verification on the server, OTP retry limits, payment webhook signature verification, and immutable audit records for administrator approvals, pricing changes, and refund decisions. Never expose a technician’s precise location to a customer outside the active job context, and do not expose customer contact details beyond the assigned technician’s necessary service window.

## Mobile and provider integration plan

The Expo Android application must receive the same authenticated Passport document transport and validation UX as the web client. Test Android permission states for camera, photo library, files, and location, including denial/recovery paths. The live tracking map should use a provider only after consent, battery-impact review, acceptable-use rules, and technician location-sharing policy are complete.

Stripe remains the source of truth for card/UPI payment confirmation. The server should create invoices and warranties only after a verified provider event, and payment redirects must have clear completed, pending, cancelled, and failed states. Wallet credits require a separately designed ledger, limits, anti-fraud controls, and reconciliation process before being treated as a production payment rail.

## Support and operating model

Define named escalation owners for customer safety, technician safety, payment disputes, missed appointments, warranty claims, and data-access requests. Create customer-facing support content for quote review, OTP safety, payment confirmation, invoices, warranty claims, and Passport documents. Operations needs runbooks for supply outages, dispatch escalation, bad actor suspension, provider outage, suspected fraud, document access errors, and data incidents.

## Suggested release sequence

1. Complete Stripe sandbox claim, webhook confirmation testing, and confirmed-payment-to-invoice/warranty automation.
2. Add native Passport document upload/list/remove with validation feedback and test both customer and technician role isolation on physical Android devices.
3. Add observability, rate limiting, event audit records, and operational alerting.
4. Run a limited Hyderabad pilot with verified technicians, staffed support, and a daily operational review.
5. Expand only after launch-gate evidence, incident drills, and measured service-quality targets are accepted by product, operations, and security owners.
