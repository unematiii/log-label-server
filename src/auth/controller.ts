import { randomInt } from 'node:crypto';

import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { RouteHandler } from 'fastify';

import { db } from '../database/index.js';
import { allowedEmails, loginCodes, users } from '../database/schema.js';

import { hashLoginCode, sendLoginCode } from './email.js';
import { createTokenPair, rotateRefreshToken } from './tokens.js';
import type {
  RefreshTokenRoute,
  RequestLoginCodeRoute,
  VerifyLoginCodeRoute,
} from './types.js';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const requestLoginCodeController: RouteHandler<
  RequestLoginCodeRoute
> = async (request, reply) => {
  const email = normalizeEmail(request.body.email);
  const [allowed] = await db
    .select()
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email))
    .limit(1);

  if (allowed) {
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const [recent] = await db
      .select({ id: loginCodes.id })
      .from(loginCodes)
      .where(
        and(
          eq(loginCodes.allowedEmailId, allowed.id),
          gt(loginCodes.createdAt, oneMinuteAgo)
        )
      )
      .limit(1);

    if (!recent) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await db.insert(loginCodes).values({
        allowedEmailId: allowed.id,
        codeHash: hashLoginCode(email, code),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      });
      try {
        await sendLoginCode(email, code);
      } catch (error) {
        request.log.error({ err: error }, 'Could not send login code');
      }
    }
  }

  return reply
    .code(202)
    .send({ message: 'If the email is allowed, a code has been sent' });
};

export const verifyLoginCodeController: RouteHandler<
  VerifyLoginCodeRoute
> = async (request, reply) => {
  const email = normalizeEmail(request.body.email);
  const [allowed] = await db
    .select()
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email))
    .limit(1);
  if (!allowed)
    return reply
      .code(401)
      .send({ code: 'INVALID_CODE', message: 'Invalid or expired code' });

  const [loginCode] = await db
    .select()
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.allowedEmailId, allowed.id),
        isNull(loginCodes.consumedAt),
        gt(loginCodes.expiresAt, new Date())
      )
    )
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);

  if (
    !loginCode ||
    loginCode.attemptCount >= 5 ||
    loginCode.codeHash !== hashLoginCode(email, request.body.code)
  ) {
    if (loginCode)
      await db
        .update(loginCodes)
        .set({ attemptCount: loginCode.attemptCount + 1 })
        .where(eq(loginCodes.id, loginCode.id));
    return reply
      .code(401)
      .send({ code: 'INVALID_CODE', message: 'Invalid or expired code' });
  }

  const [user] = await db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(loginCodes)
      .set({ consumedAt: new Date() })
      .where(
        and(eq(loginCodes.id, loginCode.id), isNull(loginCodes.consumedAt))
      )
      .returning({ id: loginCodes.id });

    if (!consumed) return [];

    return tx
      .insert(users)
      .values({ email, status: 'allowed' })
      .onConflictDoUpdate({
        target: users.email,
        set: { status: 'allowed', updatedAt: new Date() },
      })
      .returning({ id: users.id, email: users.email });
  });

  if (!user)
    return reply
      .code(401)
      .send({ code: 'INVALID_CODE', message: 'Invalid or expired code' });

  return reply.send(await createTokenPair(user));
};

export const refreshTokenController: RouteHandler<RefreshTokenRoute> = async (
  request,
  reply
) => {
  const tokens = await rotateRefreshToken(request.body.refreshToken);
  if (!tokens)
    return reply
      .code(401)
      .send({ code: 'INVALID_TOKEN', message: 'Invalid refresh token' });
  return reply.send(tokens);
};
