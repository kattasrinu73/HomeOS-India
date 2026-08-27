# Security Policy

## Reporting a vulnerability

Please do not publish security vulnerabilities, authentication bypasses, document-access issues, payment concerns, or personal data in public issues. Contact the repository owner privately through GitHub instead, with a concise reproduction, affected area, and potential impact.

The project maintainer should acknowledge a report, assess reproducibility, and coordinate a fix before public disclosure. Do not include credentials, access tokens, customer documents, or real user data in a report.

## Security design expectations

HomeOS India keeps authorization-sensitive decisions on the server. Contributions must preserve owner scoping, role checks, quote approval before work begins, technician-only OTP completion, and provider-gated payment confirmation. Uploaded documents and images must use managed object storage with database references rather than database blobs.

## Supported development branch

Security fixes should target the current `main` branch unless a maintainer requests a release branch.
