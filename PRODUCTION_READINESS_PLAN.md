# HomeOS India: Production Readiness Plan

## Current posture

HomeOS India has protected customer, technician, and operations workflows with persisted records and automated validation. It is ready for continued development and controlled testing. It is not yet a public commercial service because live payment confirmation, physical-device acceptance testing, location delivery, push delivery, abuse controls, and support operations need production evidence.

## Release gates

| Gate                       | Evidence needed before broad launch                                                                                                                                                  | Owner                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Android acceptance         | Customer and technician role journeys completed on real Android devices, including OAuth return, document picker/upload/removal, camera/photo flows, and permission denial recovery. | Product and QA             |
| Payments                   | Provider account configured by the owner, webhook signature verified, and a confirmed provider event creates the correct payment, invoice, warranty, and notification records.       | Payments owner             |
| Location and notifications | Consent, privacy wording, device tokens, route/location provider, and delivered-notification monitoring tested on real devices.                                                      | Product and engineering    |
| Operations security        | Admin procedures denied to non-admin accounts; audit records retained for verification, assignment, pricing, cancellation, and dispatch actions.                                     | Operations and security    |
| Reliability                | Error monitoring, correlation IDs, rate limits, upload failure alerts, and runbooks exercised.                                                                                       | Engineering and operations |
| Privacy and support        | Published privacy notice, retention and deletion policy, incident response path, and customer support escalation process.                                                            | Product and operations     |

## Payment boundary

Payment provider activation is intentionally deferred until the owner requests it. Until then, the customer interface shows a provider-gated status only. It must not accept funds, report a job as paid, create an invoice, or activate a warranty from a local action.

When payment work is explicitly approved, the implementation must include idempotent provider events, signature validation, reconciliation, cancellation and failure states, and a complete audit trail. No payment credentials belong in the repository.

## Real-time and delivery plan

Critical state changes currently synchronize through protected reads after actions. A future real-time implementation should introduce authenticated, permission-aware event delivery for request status, quote approval, payment confirmation, and technician arrival. It should define ordering, retries, idempotency, and an outage fallback before it replaces the existing refresh-safe behaviour.

Technician location must be consented, purpose-limited, and visible only during an active service window. Precise live location and ETA must not be exposed before the relevant provider, privacy review, and device testing are complete.

## Security and abuse controls

Protect addresses, document links, job proof, and account data through server-side authorization. Apply account and IP rate limits to account access and request creation, verify file type and size server-side, introduce OTP retry limits, and avoid raw OTPs, document bytes, addresses, or payment data in logs. Security-sensitive administrator actions should remain immutable and auditable.

## Controlled launch sequence

1. Complete real Android device acceptance tests for both customer and technician paths.
2. Configure provider services only after the owner approves payment and notification activation.
3. Add observability, rate limits, incident handling, and operating runbooks.
4. Run a limited Hyderabad pilot with verified technicians and staffed support.
5. Expand only after the release-gate evidence has been reviewed by product, operations, and security owners.
