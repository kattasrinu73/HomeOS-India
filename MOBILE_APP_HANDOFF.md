# HomeOS India Mobile App Handoff

The native application source lives in [`mobile/`](./mobile/). It is an Expo-based iOS and Android client with a customer experience and a technician workspace. The shared backend, database schema, operations console, AI diagnosis endpoint, secure storage endpoint, protected workflow rules, invoice assembly, notification records, and checkout session code remain at the project root.

## Local Run Sequence

| Component | Command | Purpose |
| --- | --- | --- |
| Full-stack backend and operations console | `pnpm dev` from the project root | Runs the protected API and the internal `/ops` dashboard. |
| Native customer and technician app | `pnpm install` then `pnpm start` from `mobile/` | Opens the Expo development experience for Android, iOS, or web. |
| Native validation | `pnpm test && pnpm check` from `mobile/` | Validates the mobile workflow helpers and TypeScript source. |
| Backend validation | `pnpm test && pnpm check` from the project root | Validates permission-sensitive workflow and invoice logic. |

## Implemented Trust Controls

> A technician cannot start additional work until the customer explicitly approves the current itemised quote. A job cannot become completed without a valid numeric OTP. A successful, provider-confirmed payment creates the digital invoice and activates the exact **30-day service warranty**.

The backend stores attachment references, OTP hashes rather than raw OTP values, itemised payment fields, invoice identifiers, warranty dates, job proof metadata, and in-app notification records. The invoice API assembles job ID, technician identity, parts, labour, taxes, payment details, and warranty details from the persistent records.

## Required Production Connections

| Integration | Current status | Next production step |
| --- | --- | --- |
| Mobile authentication and data binding | Native screens and protected backend contracts are present. | Configure the Expo client’s authenticated API transport so homes, requests, dispatch candidates, invoice data, and notifications render from live records. |
| Images and job proof | Backend storage procedure and native image selection are present. | Convert selected device media to bytes/base64 and invoke `homeos.uploads.storeImage`, then persist returned keys and URLs with each request or job proof. |
| GPS tracking | Permission-ready native interface and tracking UI are present. | Add consented foreground/background technician location publishing and subscribe customers to signed job-location updates. |
| Device notifications | Notification records and event creation are present. | Configure a push provider and device tokens, then deliver the stored events to eligible devices. |
| Payments | Stripe Checkout session and verified webhook handlers are present. | Claim the supplied Stripe sandbox, test the signed webhook, and then connect the mobile checkout action to the checkout URL. |

The mobile client intentionally does not contain payment keys, provider secrets, raw OTP values, card details, or fabricated customer ratings/reviews.
