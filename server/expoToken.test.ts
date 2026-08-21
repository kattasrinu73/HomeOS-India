import { describe, expect, it } from "vitest";

describe("Expo build authorization", () => {
  it("validates the configured Expo access token against the current-user API", async () => {
    const token = process.env.EXPO_TOKEN;
    expect(token).toBeTruthy();

    const response = await fetch("https://api.expo.dev/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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
