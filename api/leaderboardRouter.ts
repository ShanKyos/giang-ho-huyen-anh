import { createRouter, publicQuery } from "./middleware";
import { getTopLeaderboard } from "./queries/leaderboard";

export const leaderboardRouter = createRouter({
  list: publicQuery.query(async () => {
    const rows = await getTopLeaderboard(50);
    return rows.map((r, i) => ({ rank: i + 1, ...r }));
  }),
});
