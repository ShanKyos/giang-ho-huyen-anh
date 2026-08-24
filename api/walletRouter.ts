import { z } from "zod";
import * as crypto from "crypto";
import * as cookie from "cookie";
import { isAddress, verifyMessage, getAddress } from "viem";
import { createRouter, publicQuery } from "./middleware";
import { findUserByUnionId, upsertUser } from "./queries/users";
import { signSessionToken } from "./kimi/session";
import { getSessionCookieOptions } from "./lib/cookies";
import { Session } from "@contracts/constants";
import { env } from "./lib/env";

/**
 * Đăng nhập bằng ví Ronin (Sign-In With Ethereum rút gọn):
 *  1. Client xin nonce → server phát message để ký.
 *  2. Client ký personal_sign bằng ví → server verify chữ ký.
 *  3. Hợp lệ → upsert user (unionId = ronin:<address>) + cấp session cookie
 *     dùng chung hạ tầng với Kimi login → saveRouter/leaderboard chạy ngay.
 *
 * Nonce lưu in-memory (TTL 5 phút, một server instance) — đủ cho mục đích
 * chống replay của một lần đăng nhập.
 */

type NonceEntry = { nonce: string; message: string; expiresAt: number };
const nonceStore = new Map<string, NonceEntry>();
const NONCE_TTL_MS = 5 * 60 * 1000;

function buildLoginMessage(address: string, nonce: string): string {
  return [
    "Giang Hồ Huyễn Ảnh — Đăng nhập bằng Ronin Wallet",
    "",
    `Địa chỉ: ${address}`,
    `Nonce: ${nonce}`,
    `Thời gian: ${new Date().toISOString()}`,
    "",
    "Chữ ký này chỉ dùng để xác thực đăng nhập.",
    "Không tốn phí, không gửi giao dịch, không cấp quyền chi tiêu.",
  ].join("\n");
}

function sweepExpired() {
  const now = Date.now();
  for (const [k, v] of nonceStore) if (v.expiresAt < now) nonceStore.delete(k);
}

export const walletRouter = createRouter({
  /** Phát message để ví ký. */
  nonce: publicQuery
    .input(z.object({ address: z.string().min(10).max(64) }))
    .mutation(({ input }) => {
      if (!isAddress(input.address)) {
        return { ok: false as const, error: "invalid_address" };
      }
      sweepExpired();
      const address = getAddress(input.address);
      const nonce = crypto.randomBytes(16).toString("hex");
      const message = buildLoginMessage(address, nonce);
      nonceStore.set(address.toLowerCase(), {
        nonce,
        message,
        expiresAt: Date.now() + NONCE_TTL_MS,
      });
      return { ok: true as const, message };
    }),

  /** Verify chữ ký → cấp session cookie. */
  verify: publicQuery
    .input(
      z.object({
        address: z.string().min(10).max(64),
        signature: z.string().min(10).max(256),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAddress(input.address)) {
        return { ok: false as const, error: "invalid_address" };
      }
      const address = getAddress(input.address);
      const entry = nonceStore.get(address.toLowerCase());
      if (!entry || entry.expiresAt < Date.now()) {
        return { ok: false as const, error: "nonce_expired" };
      }
      nonceStore.delete(address.toLowerCase()); // dùng một lần

      let valid = false;
      try {
        valid = await verifyMessage({
          address,
          message: entry.message,
          signature: input.signature as `0x${string}`,
        });
      } catch {
        valid = false;
      }
      if (!valid) {
        return { ok: false as const, error: "bad_signature" };
      }

      const unionId = `ronin:${address.toLowerCase()}`;
      const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const existing = await findUserByUnionId(unionId);
      await upsertUser({
        unionId,
        name: existing?.name || `Hiệp Sĩ ${short}`,
        lastSignInAt: new Date(),
      });

      const token = await signSessionToken({
        unionId,
        clientId: env.appId,
      });
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

      return { ok: true as const, address, name: existing?.name || `Hiệp Sĩ ${short}` };
    }),
});
