# Contributing to HomeOS India

Thank you for considering a contribution. HomeOS India handles service history, identity-linked records, documents, and operational decisions, so changes should favour safety, clarity, and reproducible validation.

## Before opening a pull request

Please open an issue or discussion first for changes that alter user roles, persistence, authorization, dispatch, payments, document storage, or service-completion rules. Avoid bundling unrelated refactors with a workflow change.

For a normal code contribution, install dependencies and run the relevant validation before requesting review.

```bash
pnpm check
pnpm test
pnpm build

cd mobile
pnpm check
pnpm test
pnpm exec expo export --platform web
```

## Engineering expectations

Use typed tRPC contracts for client-server interactions and add focused Vitest coverage for business-rule changes. Keep ownership and role checks on the server. Store file metadata and storage references in the database; do not add file bytes to database tables. Database changes should be non-destructive by default and accompanied by a reviewed migration.

Do not introduce mock customer data, fabricated reviews, local payment completion, automatic dispatch loops, or unverified real-time claims. Provider-dependent and device-dependent flows must remain clearly labelled until they have external validation.

## Pull request checklist

- [ ] The change has a focused description and linked issue when appropriate.
- [ ] Validation commands relevant to the change have passed.
- [ ] Tests cover authorization and state-transition changes.
- [ ] No credentials, device artifacts, generated build output, or personal data are included.
- [ ] Documentation and release boundaries are updated when behaviour changes.

## Conduct and security

Treat contributors and users respectfully. If you discover a security concern, follow [SECURITY.md](SECURITY.md) rather than creating a public issue.
