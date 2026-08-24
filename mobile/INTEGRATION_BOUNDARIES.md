# Production Integration Boundary

The mobile app now contains the complete native interaction model for customer intake, guided diagnosis, controlled matching, tracking, quote approval, OTP-gated completion, payment review, invoice display, 30-day warranty visibility, Home Service Passport, onboarding, and technician work management. It includes a SecureStore-backed bearer-token transport foundation and queries the saved HomeOS home record when a valid native session exists. The shared backend project supplies the persistent schema and protected service workflow contracts for these features.

The following services require deployment-specific configuration before the application can process real customer activity. The app deliberately does **not** claim to execute these actions until their providers are connected and tested.

| Capability | Current application behaviour | Production connection required |
| --- | --- | --- |
| Native account and home data | The native client opens the protected OAuth route, validates a one-time deep-link handoff, stores the bearer session in SecureStore, and synchronises homes, requests, quotes, invoices, and Passport documents. | Test a complete sign-in, sign-out, and record-synchronisation cycle on a physical Android device and add persisted appliance setup. |
| AI issue analysis | The native client invokes the protected structured diagnosis procedure after secure sign-in, including a securely uploaded issue image when selected. | Verify the image-assisted assessment path with a real signed-in customer account and retain configured LLM monitoring and limits. |
| Media attachments | Issue images and Passport documents are selected with device permissions, validated, uploaded as base64 to protected object storage, and stored through the relevant HomeOS record procedures. | Verify successful upload and retrieval on a physical Android device using a real signed-in session. |
| Technician tracking | The app presents a location-ready map/ETA experience. | Collect consented foreground/background technician location, publish signed updates, and render them using the mapping provider. |
| Notifications | The backend records notification events. | Configure push credentials and deliver notifications to device tokens. |
| UPI, cards, wallet credits | The app presents itemised checkout and payment-method selection. | Connect an approved payment provider, validate webhooks server-side, and only then mark payment and invoice records confirmed. |
| OTP delivery | The backend stores a salted completion-OTP hash and verifies numeric OTP input. | Send the OTP through an approved SMS or push provider; never expose the raw code through client APIs or database records. |

No customer testimonials or fabricated reviews are included in the application. Technician ranking is specified as a live data-driven operation and the interface says so whenever live dispatch scoring is not connected.
