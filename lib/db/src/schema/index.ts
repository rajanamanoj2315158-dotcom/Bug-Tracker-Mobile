import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const whitelist = pgTable(
  "whitelist",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    appName: text("app_name").notNull(),
    packageName: text("package_name").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("whitelist_user_package_unique").on(
      table.userId,
      table.packageName,
    ),
    index("whitelist_user_idx").on(table.userId),
  ],
);

export const blockedApps = pgTable(
  "blocked_apps",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    appName: text("app_name").notNull(),
    packageName: text("package_name").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    strictOnly: boolean("strict_only").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("blocked_apps_user_package_unique").on(
      table.userId,
      table.packageName,
    ),
    index("blocked_apps_user_enabled_idx").on(table.userId, table.enabled),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    status: text("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    plannedEndAt: timestamp("planned_end_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds").notNull(),
    blockedPackages: jsonb("blocked_packages").$type<string[]>().notNull(),
    isStrict: boolean("is_strict").default(false).notNull(),
    bypassAttempts: integer("bypass_attempts").default(0).notNull(),
  },
  (table) => [
    index("sessions_user_started_at_idx").on(table.userId, table.startedAt),
    index("sessions_user_status_idx").on(table.userId, table.status),
    check("sessions_duration_nonnegative", sql`${table.durationSeconds} >= 0`),
    check(
      "sessions_bypass_attempts_nonnegative",
      sql`${table.bypassAttempts} >= 0`,
    ),
  ],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    packageName: text("package_name").notNull(),
    eventType: text("event_type").notNull(),
    eventAt: timestamp("event_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  },
  (table) => [
    index("usage_events_user_event_at_idx").on(table.userId, table.eventAt),
    index("usage_events_session_idx").on(table.sessionId),
    index("usage_events_user_package_idx").on(table.userId, table.packageName),
  ],
);
