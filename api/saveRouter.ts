import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { findSaveByUserId, upsertSave } from "./queries/saves";
import { upsertLeaderboard } from "./queries/leaderboard";

export const saveRouter = createRouter({
  get: authedQuery.query(async ({ ctx }) => {
    const row = await findSaveByUserId(ctx.user.id);
    if (!row) return null;
    return { data: row.data, savedAt: row.savedAt };
  }),
  put: authedQuery
    .input(
      z.object({
        data: z.string().max(2_000_000),
        savedAt: z.number().int().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Never overwrite a newer cloud save with an older snapshot
      const existing = await findSaveByUserId(ctx.user.id);
      if (existing && existing.savedAt > input.savedAt) {
        return { ok: true as const, skipped: true as const, savedAt: existing.savedAt };
      }
      await upsertSave(ctx.user.id, input.data, input.savedAt);
      // Cập nhật Bảng Xếp Hạng Võ Lâm từ snapshot vừa lưu (bỏ qua nếu payload lỗi, nhưng log lại
      // để không âm thầm mất cập nhật bảng xếp hạng khi schema save đổi mà không ai để ý)
      try {
        const p = JSON.parse(input.data)?.player;
        if (p && typeof p.level === "number") {
          await upsertLeaderboard(ctx.user.id, {
            sect: typeof p.sect === "string" ? p.sect : null,
            level: p.level,
            realm: p.dantian?.realm ?? 0,
            kills: p.kills ?? 0,
          });
        }
      } catch (err) {
        console.error("leaderboard update failed for user", ctx.user.id, err);
      }
      return { ok: true as const, skipped: false as const, savedAt: input.savedAt };
    }),
});
