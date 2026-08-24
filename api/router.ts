import { authRouter } from "./auth-router";
import { saveRouter } from "./saveRouter";
import { leaderboardRouter } from "./leaderboardRouter";
import { walletRouter } from "./walletRouter";
import { googleRouter } from "./googleRouter";
import { npcRouter } from "./npcRouter";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  // Bản deploy local-only (Vercel: LOCAL_ONLY=1) — frontend ẩn login/cloud, chơi + lưu tại máy
  config: publicQuery.query(() => ({ localOnly: process.env.LOCAL_ONLY === "1" })),
  auth: authRouter,
  save: saveRouter,
  leaderboard: leaderboardRouter,
  wallet: walletRouter,
  google: googleRouter,
  npc: npcRouter,
});

export type AppRouter = typeof appRouter;
