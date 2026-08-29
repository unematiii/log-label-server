import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

const createdTimestamp = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();

export const userStatus = pgEnum('user_status', [
  'pending',
  'allowed',
  'blocked',
]);

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull().unique(),
    status: userStatus('status').notNull().default('pending'),
    createdAt: createdTimestamp('created_at'),
    updatedAt: createdTimestamp('updated_at'),
  },
  (table) => [index('users_status_idx').on(table.status)]
);

export const allowedEmails = pgTable('allowed_emails', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: createdTimestamp('created_at'),
});

export const loginCodes = pgTable(
  'login_codes',
  {
    id: serial('id').primaryKey(),
    allowedEmailId: integer('allowed_email_id')
      .notNull()
      .references(() => allowedEmails.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: createdTimestamp('created_at'),
  },
  (table) => [
    index('login_codes_email_created_idx').on(
      table.allowedEmailId,
      table.createdAt
    ),
  ]
);

export const emailJobs = pgTable(
  'email_jobs',
  {
    id: serial('id').primaryKey(),
    loginCodeId: integer('login_code_id')
      .notNull()
      .references(() => loginCodes.id, { onDelete: 'cascade' }),
    recipient: text('recipient').notNull(),
    encryptedCode: text('encrypted_code').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lastError: text('last_error'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdTimestamp('created_at'),
  },
  (table) => [
    index('email_jobs_pending_idx').on(table.nextAttemptAt, table.attemptCount),
  ]
);

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdTimestamp('created_at'),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)]
);

export const usage = pgTable(
  'usage',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    period: text('period').notNull(),
    requestCount: integer('request_count').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.period] }),
    check('usage_request_count_check', sql`${table.requestCount} >= 0`),
  ]
);
