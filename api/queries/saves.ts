import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";

export async function findSaveByUserId(userId: number) {
  const rows = await getDb()
    .select()
    .from(schema.saves)
    .where(eq(schema.saves.userId, userId))
    .limit(1);
  return rows.at(0);
}

export async function upsertSave(userId: number, data: string, savedAt: number) {
  await getDb()
    .insert(schema.saves)
    .values({ userId, data, savedAt })
    .onDuplicateKeyUpdate({ set: { data, savedAt, updatedAt: new Date() } });
}
