import * as SecureStore from "expo-secure-store";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

const fallbackApiBaseUrl = "https://homeosind-qstsvsej.manus.space";
const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? fallbackApiBaseUrl).replace(/\/+$/, "");

export const HOMEOS_NATIVE_SESSION_KEY = "homeos.native.session-token";

export async function readNativeSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(HOMEOS_NATIVE_SESSION_KEY);
}

export async function storeNativeSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(HOMEOS_NATIVE_SESSION_KEY, token);
}

export async function clearNativeSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(HOMEOS_NATIVE_SESSION_KEY);
}

/**
 * The native client must establish a Manus OAuth session before calling protected procedures.
 * `any` deliberately avoids bundling server-only router code into the Expo application.
 */
export const homeosApi = createTRPCProxyClient<any>({
  links: [
    httpBatchLink({
      url: `${apiBaseUrl}/api/trpc`,
      transformer: superjson,
      async headers() {
        const token = await readNativeSessionToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

export function homeosApiConfigured(): boolean {
  return Boolean(apiBaseUrl.startsWith("https://"));
}

export function homeosApiBaseUrl(): string {
  return apiBaseUrl;
}
