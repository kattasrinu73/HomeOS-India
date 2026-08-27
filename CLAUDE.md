# HomeOS India — Claude Code Working Agreement

Use this repository as a protected service-workflow system, not as a static prototype. Begin by reading `README.md`, `todo.md`, the affected router, and its tests before making changes.

## Required checks

For web or server changes, run `pnpm check`, `pnpm test`, and `pnpm build`. For mobile changes, run `pnpm check`, `pnpm test`, and `pnpm exec expo export --platform web` from `mobile/`.

## Non-negotiable workflow rules

Keep quote approval server-enforced before work starts. Keep completion OTP server-enforced and limited to the assigned technician. Preserve owner and role checks for homes, documents, requests, offers, operations actions, and payments. Never fabricate customer reviews, ratings, payment confirmation, warranty activation, or real-time location/ETA.

Payment, invoice issuance, and warranty activation remain provider-confirmed. Do not activate a payment provider, add payment credentials, or simulate a paid state without explicit owner direction. Dispatch remains manual and operations-controlled; do not add background dispatch loops or automatic radius expansion.

## Data and documentation rules

Use migrations for schema changes. Keep uploaded bytes in managed object storage and record references/metadata in the database. Do not commit secrets or `.env` files. Update focused tests and public documentation whenever a security boundary or user-visible workflow changes.
