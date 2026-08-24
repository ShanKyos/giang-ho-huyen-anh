import { desc, eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";

export async function upsertLeaderboard(
  userId: number,
  stats: { sect: string | null; level: number; realm: number; kills: number },
) {
  await getDb()
    .insert(schema.leaderboard)
    .values({ userId, ...stats })
    .onDuplicateKeyUpdate({ set: { ...stats, updatedAt: new Date() } });
}

export async function getTopLeaderboard(limit = 50) {
  return getDb()
    .select({
      userId: schema.leaderboard.userId,
      name: schema.users.name,
      avatar: schema.users.avatar,
      sect: schema.leaderboard.sect,
      level: schema.leaderboard.level,
      realm: schema.leaderboard.realm,
      kills: schema.leaderboard.kills,
      updatedAt: schema.leaderboard.updatedAt,
    })
    .from(schema.leaderboard)
    .leftJoin(schema.users, eq(schema.leaderboard.userId, schema.users.id))
    .orderBy(desc(schema.leaderboard.level), desc(schema.leaderboard.realm), desc(schema.leaderboard.kills))
    .limit(limit);
}
