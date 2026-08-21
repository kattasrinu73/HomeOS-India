# Production Integration Boundary

The mobile app now contains the complete native interaction model for customer intake, guided diagnosis, controlled matching, tracking, quote approval, OTP-gated completion, payment review, invoice display, 30-day warranty visibility, Home Service Passport, onboarding, and technician work management. The shared backend project supplies the persistent schema and protected service workflow contracts for these features.

The following services require deployment-specific configuration before the application can process real customer activity. The app deliberately does **not** claim to execute these actions until their providers are connected and tested.

| Capability | Current application behaviour | Production connection required |
| --- | --- | --- |
| AI issue analysis | Mobile presents the guided diagnosis journey; the backend exposes a structured, server-side diagnosis procedure. | Authenticate the mobile client to the backend and invoke the protected diagnosis procedure. |
| Media attachments | The mobile app requests photo-library permission and captures an attachment URI. | Upload image bytes to the backend’s secure object storage and persist the returned file key and URL. |
| Technician tracking | The app presents a location-ready map/ETA experience. | Collect consented foreground/background technician location, publish signed updates, and render them using the mapping provider. |
| Notifications | The backend records notification events. | Configure push credentials and deliver notifications to device tokens. |
| UPI, cards, wallet credits | The app presents itemised checkout and payment-method selection. | Connect an approved payment provider, validate webhooks server-side, and only then mark payment and invoice records confirmed. |
| OTP delivery | The backend stores a salted completion-OTP hash and verifies numeric OTP input. | Send the OTP through an approved SMS or push provider; never expose the raw code through client APIs or database records. |

No customer testimonials or fabricated reviews are included in the application. Technician ranking is specified as a live data-driven operation and the interface says so whenever live dispatch scoring is not connected.
