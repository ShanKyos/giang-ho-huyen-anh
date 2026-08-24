import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  mediumtext,
  timestamp,
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Cloud game saves — one row per user, upserted on each save.
 * `data` holds the serialized game state (JSON string, LZ-compressed by the game client).
 */
export const saves = mysqlTable("saves", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id)
    .unique(),
  data: mediumtext("data").notNull(),
  savedAt: bigint("savedAt", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/**
 * Bảng Xếp Hạng Võ Lâm — one row per user, refreshed on each cloud save.
 */
export const leaderboard = mysqlTable("leaderboard", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id)
    .unique(),
  sect: varchar("sect", { length: 64 }),
  level: bigint("level", { mode: "number" }).notNull().default(1),
  realm: bigint("realm", { mode: "number" }).notNull().default(0),
  kills: bigint("kills", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type LeaderboardEntry = typeof leaderboard.$inferSelect;

export type Save = typeof saves.$inferSelect;
export type InsertSave = typeof saves.$inferInsert;

// TODO: Add your tables here. See docs/Database.md for schema examples and patterns.
//
// Example:
// export const posts = mysqlTable("posts", {
//   id: serial("id").primaryKey(),
//   title: varchar("title", { length: 255 }).notNull(),
//   content: text("content"),
//   createdAt: timestamp("created_at").notNull().defaultNow(),
// });
//
// Note: FK columns referencing a serial() PK must use:
//   bigint("columnName", { mode: "number", unsigned: true }).notNull()
