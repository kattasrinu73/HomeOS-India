# Updated HomeOS India Android APK

The latest internal Android APK was built successfully through Expo Application Services on 24 August 2026. It includes secure native OAuth sign-in with a one-time session handoff, protected account intent, homes with optional dispatch coordinates, appliances, requests, Passport history/documents, and notifications; image-assisted intake; selected-request tracking with state-derived milestones; technician profile application with verification-gated availability and dispatch-location sharing; technician-declared service skills pending protected operations review; and a technician workflow with verified travel, arrival, diagnosis, itemised quote, approval-gated work, secure after-work proof upload, and assigned-technician OTP submission for protected completion.

This build also records an accepted technician offer as **pending operations confirmation**. It does not permit travel or job actions until a protected HomeOS operations administrator confirms final assignment. Customer payment screens render only persisted quote or confirmed-payment records; a customer OTP cannot locally complete a job; and Passport uploads visibly state the accepted PDF/JPG/PNG/WEBP formats and 10 MB limit. Payment remains safely provider-gated and does not locally mark a service paid.

| Field        | Value                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Build ID     | `73522b2e-39e1-471d-92fe-6a8263234788`                                                                      |
| Distribution | Internal Android APK                                                                                        |
| Install page | <https://expo.dev/accounts/srk553/projects/homeos-india-mobile/builds/73522b2e-39e1-471d-92fe-6a8263234788> |

Install the APK from the Expo build page on an Android device. Use **Sign in to HomeOS** in Account to establish a protected native session, then test homes, appliances, requests, Passport documents/history, notifications, and the technician lifecycle. When a technician accepts a dispatch offer, verify the new **Assignment confirmation pending** state; an operations administrator must confirm the assignment before the job appears as assigned. Provider-dependent payment confirmation remains deferred until the owner explicitly requests activation.
