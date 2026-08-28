import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync } from 'fastify';

import {
  refreshTokenController,
  requestLoginCodeController,
  verifyLoginCodeController,
} from './controller.js';
import {
  EmailBodySchema,
  RefreshBodySchema,
  VerifyBodySchema,
} from './schemas.js';
import type {
  RefreshTokenRoute,
  RequestLoginCodeRoute,
  VerifyLoginCodeRoute,
} from './types.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, { global: false });

  fastify.post<RequestLoginCodeRoute>(
    '/code/request',
    {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
      schema: { body: EmailBodySchema },
    },
    requestLoginCodeController
  );

  fastify.post<VerifyLoginCodeRoute>(
    '/code/verify',
    {
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
      schema: { body: VerifyBodySchema },
    },
    verifyLoginCodeController
  );

  fastify.post<RefreshTokenRoute>(
    '/token/refresh',
    {
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
      schema: { body: RefreshBodySchema },
    },
    refreshTokenController
  );
};
