# HomeOS India — Real Application Gap Audit

**Purpose:** This audit distinguishes the currently implemented authenticated foundation from the remaining prototype-only or integration-ready experiences that must be replaced before public launch.

> **Account model:** A person authenticates through HomeOS identity, owns one or more customer homes, may apply for a technician profile, and receives operations access only through the server-side administrator role. Customer home data, requests, jobs, quotes, payments, invoices, documents, and notifications must be fetched under that authenticated identity. A technician profile is a separate persisted entity with verification state, skills, location consent, availability, offers, and job eligibility.

## Authentication and Account Lifecycle

| Current state | Target real-app state | Required implementation |
| --- | --- | --- |
| Visible sign-in page uses the HomeOS OAuth entry. | Distinct account creation, sign-in, session-expiry recovery, and account recovery experience. | Confirm provider account-creation entry or add a dedicated create-account capability; handle expired sessions with clear return-to-sign-in UI. |
| Web profile is loaded from authenticated `auth.me`. | Customer and technician intent is persisted at onboarding. | Add a profile-intent table or safe user-profile extension and require role-specific onboarding. |
| Logout clears authenticated web session. | Logout everywhere with device/session management and confirmation. | Add active-session management when the identity provider supports it; retain current server-side logout as the minimum control. |

## Customer Surface

| Current state | Target real-app state | Required implementation |
| --- | --- | --- |
| Saved home form writes protected home records. | Multiple homes, appliance register, address validation, primary-home selection, and health-score recalculation. | Add appliance CRUD, home update/archive, geocoding, and health-score service. |
| Fix Anything uses protected server diagnosis and creates a request. | Client uploads real issue attachments, retains conversational follow-ups, and submits the final confirmed intake. | Bind mobile/web upload transport to object storage; add persisted follow-up conversation and diagnosis-review confirmation. |
| Customer dashboard and jobs read authenticated requests. | Live job timeline, technician assignment, quote, payment, invoice, and warranty records. | Join request query to lifecycle data and introduce subscription/polling refresh strategy. |
| Matching view contains design-time candidates. | Real controlled dispatch candidates and customer preference selection. | Seed/verify technicians, run dispatch rounds, expose suitable offers, and assign only accepted matches. |
| Tracking uses route-ready UI. | Consent-based live technician GPS, ETA, and event timeline. | Implement device-token/location consent, signed location updates, and map provider routing. |
| Passport document picker is visible. | Private persisted uploads, document lifecycle, invoice/proof/warranty data, retention, and deletion. | Bind authenticated client bytes to secure document procedures and object storage. |

## Technician Surface

| Current state | Target real-app state | Required implementation |
| --- | --- | --- |
| Technician profile can be applied for and availability is persisted. | Identity/KYC review, skill proof, verified categories, location consent, and approvals. | Build secure profile onboarding and operations verification queue. |
| Technician workspace demonstrates offer, quote, proof, and completion UX. | Only eligible offers are loaded from persisted dispatch rounds. | Bind authenticated technician API client to offer list/accept/decline procedures. |
| Work-start and completion procedures enforce assigned-technician identity. | Full job timeline including arrival, diagnosis, proof, quote, customer approval, OTP, and earnings. | Persist every technician action with author, timestamps, idempotency keys, and audited evidence. |
| Earnings display is visual. | Real settlement and payout ledger. | Add provider settlement reconciliation; never display payable balances until confirmed. |

## Operations Surface

| Current state | Target real-app state | Required implementation |
| --- | --- | --- |
| Admin-only operations navigation and protected overview APIs exist. | Live queue, technician verification decisions, pricing rule changes, service exceptions, and audit exports. | Bind console to real records and record all operator actions with reason, actor, time, and before/after values. |
| Analytics panels are visual. | Metrics based only on persisted jobs, completion, response time, refunds, and verified supply. | Aggregate server-side data; define data-retention and report-access controls. |

## Integrations, Reliability, and Trust

| Capability | Target launch standard |
| --- | --- |
| Payments | Claim test environment; run Stripe Checkout and signature-verified webhook tests; establish a compliant India payment strategy before enabling money movement. |
| Notifications | Device registration, push credentials, delivery tracking, SMS/OTP fallback, consent, retry policy, and notification preferences. |
| Real-time | Polling or managed pub/sub/websocket architecture for job, quote, technician location, and operations updates; all updates must be authorized by request participant. |
| Security | Least-privilege procedures, ownership checks, rate limits, upload MIME/size scanning, CSRF/session controls, event audit trail, secret rotation, and abuse reporting. |
| Privacy | Address minimization, consent for location/media, retention schedule, document deletion process, access/export request process, and production privacy notice. |
| Observability | Structured errors, request correlation IDs, service health checks, queue metrics, alerts, uptime monitoring, and safe support diagnostics. |
| Support | In-app issue reporting, job dispute/claim workflow, cancellation/refund policy, technician quality review, and incident runbooks. |

## Recommended Delivery Sequence

1. Complete provider-verified account creation, role-intent onboarding, and mobile/web authenticated client transport.
2. Connect homes, appliances, service requests, matching, jobs, quotes, invoices, Passport, and documents to the authenticated API.
3. Bind technician verification, skills, availability, offers, job actions, and evidence to persistent records.
4. Complete payment sandbox, document storage, notifications, live tracking, and real-time update delivery.
5. Run security, abuse, load, accessibility, privacy, Android/iOS device, and pilot-operations acceptance testing before public launch.
