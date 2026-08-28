import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SignJWT, jwtVerify } from 'jose';

import { db } from '../database/index.js';
import { sessions, users } from '../database/schema.js';
import { authConfig } from './config.js';

const accessTokenLifetimeSeconds = 15 * 60;
const refreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply
      .code(401)
      .send({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  try {
    await jwtVerify(header.slice(7), jwtKey(), {
      issuer: 'label-log-server',
      audience: 'label-log-ios',
    });
  } catch {
    return reply
      .code(401)
      .send({ code: 'UNAUTHORIZED', message: 'Invalid access token' });
  }
}

export async function createTokenPair(user: { id: number; email: string }) {
  const refreshToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + refreshTokenLifetimeMs);

  await db.insert(sessions).values({
    userId: user.id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt,
  });

  return tokenPairResponse(user, refreshToken);
}

export async function rotateRefreshToken(refreshToken: string) {
  const now = new Date();
  const newRefreshToken = randomBytes(32).toString('base64url');
  const nextExpiresAt = new Date(now.getTime() + refreshTokenLifetimeMs);

  const user = await db.transaction(async (tx) => {
    const [session] = await tx
      .select({ sessionId: sessions.id, userId: users.id, email: users.email })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.refreshTokenHash, hashToken(refreshToken)),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          eq(users.status, 'allowed')
        )
      )
      .limit(1);

    if (!session) return null;

    const [revoked] = await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(eq(sessions.id, session.sessionId), isNull(sessions.revokedAt))
      )
      .returning({ id: sessions.id });

    if (!revoked) return null;

    await tx.insert(sessions).values({
      userId: session.userId,
      refreshTokenHash: hashToken(newRefreshToken),
      expiresAt: nextExpiresAt,
    });

    return { id: session.userId, email: session.email };
  });

  if (!user) return null;

  return tokenPairResponse(user, newRefreshToken);
}

async function createAccessToken(user: { id: number; email: string }) {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuer('label-log-server')
    .setAudience('label-log-ios')
    .setIssuedAt()
    .setExpirationTime(`${accessTokenLifetimeSeconds}s`)
    .sign(jwtKey());
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function jwtKey() {
  return new TextEncoder().encode(authConfig.jwtSecret());
}

async function tokenPairResponse(
  user: { id: number; email: string },
  refreshToken: string
) {
  return {
    tokenType: 'Bearer',
    accessToken: await createAccessToken(user),
    refreshToken,
    expiresIn: accessTokenLifetimeSeconds,
  };
}
