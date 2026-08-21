# Testing Notes

## 2026-08-21 — Expo Web Preview

The Expo web preview started successfully, but the initial browser render was blank with no visible interactive elements. The browser console contained no client-side error output at that time. The next verification step is to inspect the Metro server output and the web bundle request status before adjusting the implementation.

After Metro finished bundling, a refresh showed the intended premium customer home interface. The exact **“Tell us what's wrong”** CTA was visible and opened the first Fix Anything screen successfully. That screen displayed the issue input, photo attachment action, safety/disclaimer language, and a persistent continue action without runtime errors.

The Fix Anything continue action was also verified. It opens a guided assessment with targeted clarifying questions, an explicit “estimate, not a diagnosis” label, recommended service category, medium urgency, a safety-aware explanation, and an indicative ₹199–₹1,200 range.

The assessment’s technician matching action and technician selection were verified. The matching screen presents fastest, best-rated, lowest-cost, and preferred selection modes while explicitly avoiding fabricated ratings or reviews. Selecting a qualified technician opens the active-job view, which includes an ETA, a location-sharing readiness message, technician identity, and an explicit reminder that work cannot begin before quote approval.

The quote screen was verified end to end. It displays an itemised visit fee, labour, parts, and total; presents an explicit approval-required warning; and exposes the completion-OTP path only after the customer approves the quote. This matches the required hard approval gate before work can proceed.

The completion screen was verified after quote approval. It explains that OTP validation activates the 30-day warranty and updates the Home Service Passport, and it accepted a valid numeric OTP (`4821`) as required by the workflow contract.

Valid OTP verification opened an itemised payment screen with UPI, card, and wallet choices. The checkout then opened a digital invoice containing job ID, technician identity, visit fee, labour, parts, taxes, total paid, and a clearly surfaced **30-day service warranty** with an explicit end date. This confirms the required post-payment trust record is represented in the mobile flow.

After rebuilding the Expo preview, the customer home was rechecked. It now includes the required active-job status card directly beneath the Home Health score, showing request state, ETA, service title, assigned technician identity, and a direct entry into tracking.

The mobile project also produced successful production JavaScript exports for both **Android** and **iOS**. This validates native bundling for the current codebase. Device/simulator runtime verification remains separate because it requires an Android device/emulator and an iOS runtime outside this Linux environment.
