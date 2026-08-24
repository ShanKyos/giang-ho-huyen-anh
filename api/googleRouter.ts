import { z } from "zod";
import * as jose from "jose";
import * as cookie from "cookie";
import { createRouter, publicQuery } from "./middleware";
import { upsertUser } from "./queries/users";
import { signSessionToken } from "./kimi/session";
import { getSessionCookieOptions } from "./lib/cookies";
import { Session } from "@contracts/constants";
import { env } from "./lib/env";

/**
 * Đăng nhập Google (Google Identity Services):
 *  Client render nút Google → nhận credential (ID token JWT) → gửi lên đây.
 *  Server verify JWT bằng JWKS công khai của Google (chữ ký + issuer + audience),
 *  rồi upsert user (unionId = google:<sub>) và cấp session cookie chung.
 */
const googleJwks = jose.createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export const googleRouter = createRouter({
  login: publicQuery
    .input(z.object({ credential: z.string().min(50).max(4096) }))
    .mutation(async ({ ctx, input }) => {
      if (!env.googleClientId) {
        return { ok: false as const, error: "google_not_configured" };
      }
      let payload: jose.JWTPayload;
      try {
        const verified = await jose.jwtVerify(input.credential, googleJwks, {
          issuer: ["https://accounts.google.com", "accounts.google.com"],
          audience: env.googleClientId,
        });
        payload = verified.payload;
      } catch {
        return { ok: false as const, error: "bad_credential" };
      }
      const sub = payload.sub;
      if (!sub) return { ok: false as const, error: "bad_credential" };

      const unionId = `google:${sub}`;
      const name = (payload.name as string) || (payload.email as string) || "Hiệp khách";
      await upsertUser({
        unionId,
        name,
        email: (payload.email as string) || null,
        avatar: (payload.picture as string) || null,
        lastSignInAt: new Date(),
      });

      const token = await signSessionToken({ unionId, clientId: env.appId });
      const opts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.cookieName, token, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: Session.maxAgeMs / 1000,
        }),
      );

      return { ok: true as const, name };
    }),
});
