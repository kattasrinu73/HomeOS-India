# HomeOS India — Product Scope

## Product Definition

HomeOS India is a Hyderabad-first home-services operating system. It gives a customer one clear starting point—**“Tell us what's wrong”**—then guides the issue from description through diagnosis, technician matching, controlled service execution, payment, warranty, and a permanent service record for the home. The primary deliverable is a **native mobile app** for iOS and Android, with a web interface reserved for the internal operations console. The first implementation prioritizes the high-trust service lifecycle rather than a conventional category directory.

The application has three operational surfaces. Customers create and supervise requests for their homes, technicians receive and execute appropriate work, and operations users oversee supply, dispatch, pricing, and quality. The visual language should be calm and premium: warm ivory surfaces, deep evergreen navigation, restrained terracotta for attention, clear type hierarchy, generous spacing, and immediate feedback around status transitions.

## Production MVP

| Surface | Included capabilities | MVP intent |
| --- | --- | --- |
| Customer portal | Home profile, appliance register, service request, guided AI diagnosis, technician selection, job tracking, quote approval, payment, invoice, 30-day warranty, and Home Service Passport | Deliver the complete, customer-protected service journey. |
| Technician workspace | Availability, incoming job cards, accept/decline, arrival, diagnosis, itemised quote, evidence, completion OTP, earnings, and performance | Make qualified job execution fast and legible. |
| Operations console | Jobs, technicians, dispatch status, pricing ranges, complaints, and live operational indicators | Give the pilot team clear control over service quality and supply. |
| AI diagnosis | Text issue description with optional issue image, clarifying questions, service category, urgency, possible diagnosis, safety note, and estimate range | Provide decision support, never a guaranteed diagnosis. |
| Dispatch engine | Qualified-technician scoring plus sequential, radius-based dispatch rounds and customer selection modes | Avoid technician spam and favour relevant, reliable matches. |
| Trust layer | Explicit quote approval, required completion OTP, itemised invoice, proof attachments, warranty dates, and immutable job timeline | Prevent surprise charges and fake completion. |

## Non-Negotiable Workflow Rules

| Rule | Enforcement point | Required behaviour |
| --- | --- | --- |
| Exact primary call to action | Customer home | The main action must read **“Tell us what's wrong”** exactly. |
| Diagnosis limitation | AI response and request detail | The experience must say that its result is an estimate and not a confirmed professional diagnosis. |
| Quote approval gate | Job state transition | A technician may diagnose and draft a quote, but may not begin repair work until the customer has explicitly approved the quote. |
| Completion OTP | Job completion transition | A job cannot move to `completed` without validating the customer-provided OTP. |
| Itemised payment | Bill and payment record | Visit fee, labour, parts, tax, platform fee, discount/credits, and chosen payment method must be captured separately. |
| Invoice completeness | Invoice generation | Every invoice must display the job ID, technician identity, parts, labour, taxes, payment information, and a clearly stated **30-day service warranty**. |
| Warranty visibility | Invoice, home history, and notifications | Warranty records must show their start date, end date, and active status for the exact 30-day period. |
| Home Health score | Customer home and home record | The score is an integer from 0 to 100 and is explained as a health indicator, not a false precision metric. |

## Job State Contract

The core workflow uses a restricted state machine. A request begins as `submitted`, becomes `matched` when suitable candidates are available, then `assigned` after customer confirmation. The technician can move it through `en_route`, `arrived`, and `diagnosing`. Work can become `in_progress` only from a customer-approved quote. A job can become `completed` only from an approved, in-progress job after a valid completion OTP is entered. Paid completion creates the invoice, starts the 30-day warranty, and appends the service evidence and invoice to the Home Service Passport.

| State | Actor allowed to progress it | Guard condition |
| --- | --- | --- |
| `submitted` | Customer | A home, service description, and supported service category are present. |
| `matched` | Dispatch engine or operations | At least one eligible technician candidate is available. |
| `assigned` | Customer or operations | An eligible technician is selected and the customer has accepted the booking. |
| `en_route` / `arrived` / `diagnosing` | Assigned technician | The technician is assigned to the request. |
| `quote_pending` | Assigned technician | Diagnosis and at least one itemised quote line are present. |
| `quote_approved` | Customer | Customer explicitly approves the current quote version. |
| `in_progress` | Assigned technician | The current quote is approved. |
| `completion_pending` | Assigned technician | Service proof and completion notes are recorded. |
| `completed` | Assigned technician | The completion OTP validates successfully. |
| `paid` | Customer / payment provider | A payment record is confirmed or an approved payment method is recorded. |

## Integration Boundaries

The application will be built with an integration-ready payment, tracking, file-storage, notification, and AI architecture. Customer issue images and technician proof use private object storage, while the relational database holds only their metadata and references. The map UI uses the preconfigured mapping service for route and ETA presentation. Device-grade continuous GPS tracking and provider push delivery require consented mobile location collection and production provider configuration; the first web release provides the location-update contract and a realistic operational tracking interface.

Secure live payment collection requires connecting a payment provider. The application will keep the checkout and invoice model ready for UPI, cards, and wallet credits, but it will not attempt to collect real money until the payment provider connection and merchant policy are configured. Similarly, customer reviews will be collected only from actual post-completion users; no ratings or testimonials will be fabricated.
