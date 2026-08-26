import type { FastifyPluginAsync } from 'fastify';

import { extractNutritionController } from './controller.js';
import {
  ExtractNutritionBodySchema,
  ExtractNutritionErrorSchema,
  ExtractNutritionResponseSchema,
} from './schemas.js';
import type { ExtractNutritionRoute } from './types.js';

export const ocrRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<ExtractNutritionRoute>(
    '/extract',
    {
      schema: {
        body: ExtractNutritionBodySchema,
        response: {
          200: ExtractNutritionResponseSchema,
          502: ExtractNutritionErrorSchema,
        },
      },
    },
    extractNutritionController
  );
};
