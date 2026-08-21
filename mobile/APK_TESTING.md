# HomeOS India Android Test Build

The Expo project is configured with an internal `preview` Android build profile that produces an **APK**. The app supports both customer and technician test journeys within the same application.

## Fastest Test: Expo Go

From the `mobile/` directory, run `pnpm install` and then `pnpm start`. Install **Expo Go** on an Android phone, ensure the phone and the development machine are on the same network, and scan the QR code displayed by Expo. This is the quickest way to test the app before making an APK.

| Journey | In the app |
| --- | --- |
| Customer | Use the customer home, Jobs, Passport, and Account tabs. Choose **Tell us what's wrong** to run through diagnosis, matching, quote, OTP, payment, invoice, and warranty screens. |
| Technician | Open **Account**, then select **Technician app**. Accept the service offer, open the job, send the quote, add service proof, and request a completion OTP. |

## APK Test Build

An EAS/Expo account is required to create the downloadable APK. After signing in to the intended Expo account, run the following from `mobile/`:

```bash
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest build --platform android --profile preview
```

EAS will provide a download link for the APK once the cloud build completes. Download it on an Android device and allow installation from the browser or file manager when Android requests permission.

## Current Build Status

The project configuration, Expo manifest, native workflow tests, and TypeScript validation have been checked successfully. An attempted cloud-build check confirmed that this environment is **not logged in to an Expo account**, so an APK cannot be requested until the owner authenticates with the intended Expo account.

## Build Attempt Log

After the Expo project was linked to the `srk553` account, the internal Android preview build was submitted successfully but failed during **Bundle JavaScript**. The EAS build page reports `pnpm expo export:embed --eager --platform android --dev false exited with non-zero code: 1`; the build summary does not expose the deeper bundle error in its text view. The build page is available at <https://expo.dev/accounts/srk553/projects/homeos-india-mobile/builds/4fc50a8c-4358-4247-bb37-d2a36613b882>.

The missing Expo `index.ts` entry point was added and the Android bundle command then completed successfully. The corrected internal Android APK build finished successfully and can be installed from <https://expo.dev/accounts/srk553/projects/homeos-india-mobile/builds/3e6efcb7-7e4a-4efd-a907-c66a26873ecc>.

> The preview APK exercises the customer and technician interfaces. Real customer data, secure Passport-document sync, live GPS, notifications, and payments require the protected backend connection and their production providers to be configured.
