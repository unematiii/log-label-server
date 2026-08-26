import { type FastifyPluginAsync } from 'fastify';

import { healthCheckController } from './health-check/controller.js';
import { ocrRoutes } from './ocr/routes.js';

export const routes: FastifyPluginAsync = async (fastify, _options) => {
  fastify.get('/health', healthCheckController);
  fastify.register(ocrRoutes, { prefix: '/ocr' });
};
