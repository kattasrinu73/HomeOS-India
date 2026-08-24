import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { homeosApiBaseUrl, storeNativeSessionToken } from "./homeosApi";

type NativeExchangeResponse = { sessionToken?: string; error?: string };

export async function startNativeHomeosLogin(): Promise<void> {
  const nativeState = Crypto.randomUUID();
  const redirectUri = Linking.createURL("oauth/callback");
  const startUrl = `${homeosApiBaseUrl()}/api/oauth/native/start?nativeState=${encodeURIComponent(nativeState)}`;
  const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
  if (result.type !== "success") {
    throw new Error("The secure sign-in flow was cancelled or did not return to HomeOS.");
  }
  const parsed = Linking.parse(result.url);
  const handoff = typeof parsed.queryParams?.handoff === "string" ? parsed.queryParams.handoff : "";
  const callbackState = typeof parsed.queryParams?.nativeState === "string" ? parsed.queryParams.nativeState : "";
  if (!handoff || callbackState !== nativeState) {
    throw new Error("The secure sign-in response could not be verified.");
  }
  const response = await fetch(`${homeosApiBaseUrl()}/api/oauth/native/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handoff, nativeState }),
  });
  const payload = await response.json() as NativeExchangeResponse;
  if (!response.ok || !payload.sessionToken) {
    throw new Error(payload.error || "HomeOS could not establish a secure mobile session.");
  }
  await storeNativeSessionToken(payload.sessionToken);
}
