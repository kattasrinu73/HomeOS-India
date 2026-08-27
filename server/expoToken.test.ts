import { describe, expect, it } from "vitest";

const expoToken = process.env.EXPO_TOKEN;
const itWithExpoToken = expoToken ? it : it.skip;

describe("Expo build authorization", () => {
  itWithExpoToken("validates the configured Expo access token against the current-user API", async () => {
    expect(expoToken).toBeTruthy();

    const response = await fetch("https://api.expo.dev/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${expoToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "query { me { id username } }" }),
    });
    expect(response.ok).toBe(true);

    const payload = await response.json() as { data?: { me?: { id?: string; username?: string } }; errors?: unknown };
    expect(payload.errors).toBeUndefined();
    expect(payload.data?.me?.id).toBeTruthy();
    expect(payload.data?.me?.username).toBeTruthy();
  }, 15_000);
});
