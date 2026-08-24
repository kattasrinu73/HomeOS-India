import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { encodeOAuthState } from "../../shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

const NATIVE_CALLBACK_URI = "homeosindia://oauth/callback";
const NATIVE_HANDOFF_TTL_SECONDS = 120;

function nativeHandoffSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

async function signNativeHandoff(payload: { openId: string; name: string; nativeState: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(`${NATIVE_HANDOFF_TTL_SECONDS}s`)
    .sign(nativeHandoffSecret());
}

async function verifyNativeHandoff(token: string) {
  const { payload } = await jwtVerify(token, nativeHandoffSecret(), { algorithms: ["HS256"] });
  const { openId, name, nativeState } = payload as Record<string, unknown>;
  if (typeof openId !== "string" || typeof name !== "string" || typeof nativeState !== "string") throw new Error("Invalid native handoff");
  return { openId, name, nativeState };
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/native/start", (req, res) => {
    const nativeState = getQueryParam(req, "nativeState");
    const origin = `${req.protocol}://${req.get("host")}`;
    if (!nativeState || nativeState.length < 16 || nativeState.length > 256 || !ENV.oAuthPortalUrl || !ENV.appId) {
      res.status(400).json({ error: "Native sign-in is not configured." });
      return;
    }
    const nonce = crypto.randomUUID();
    const redirectUri = `${origin}/api/oauth/callback`;
    const state = encodeOAuthState({ redirectUri, nonce, native: true, nativeState });
    res.cookie(OAUTH_STATE_COOKIE, nonce, { ...getSessionCookieOptions(req), maxAge: 10 * 60 * 1000 });
    const loginUrl = new URL(`${ENV.oAuthPortalUrl}/app-auth`);
    loginUrl.searchParams.set("appId", ENV.appId);
    loginUrl.searchParams.set("redirectUri", redirectUri);
    loginUrl.searchParams.set("state", state);
    loginUrl.searchParams.set("type", "signIn");
    res.redirect(302, loginUrl.toString());
  });

  app.post("/api/oauth/native/exchange", async (req, res) => {
    const handoff = typeof req.body?.handoff === "string" ? req.body.handoff : "";
    const nativeState = typeof req.body?.nativeState === "string" ? req.body.nativeState : "";
    if (!handoff || !nativeState) {
      res.status(400).json({ error: "handoff and nativeState are required" });
      return;
    }
    try {
      const payload = await verifyNativeHandoff(handoff);
      if (payload.nativeState !== nativeState) {
        res.status(403).json({ error: "invalid native handoff state" });
        return;
      }
      const sessionToken = await sdk.createSessionToken(payload.openId, { name: payload.name, expiresInMs: ONE_YEAR_MS });
      res.json({ sessionToken });
    } catch {
      res.status(403).json({ error: "invalid or expired native handoff" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie that
    // startLogin set in the browser that began this login. An attacker can
    // forge `state`, but cannot plant this cookie in the victim's browser.
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const decodedState = decodeOAuthState(state);
      if (decodedState.native && decodedState.nativeState) {
        const handoff = await signNativeHandoff({ openId: userInfo.openId, name: userInfo.name || "", nativeState: decodedState.nativeState });
        const callback = new URL(NATIVE_CALLBACK_URI);
        callback.searchParams.set("handoff", handoff);
        callback.searchParams.set("nativeState", decodedState.nativeState);
        res.redirect(302, callback.toString());
        return;
      }

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
