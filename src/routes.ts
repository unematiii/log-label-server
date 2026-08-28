import { type FastifyPluginAsync } from 'fastify';

import { authRoutes } from './auth/routes.js';
import { healthCheckController } from './health-check/controller.js';
import { ocrRoutes } from './ocr/routes.js';

export const routes: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get('/health', healthCheckController);
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(ocrRoutes, { prefix: '/ocr' });
};
