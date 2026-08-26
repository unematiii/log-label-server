import type { RouteHandler } from 'fastify';

import { extractNutrition } from './api.js';
import type { ExtractNutritionRoute } from './types.js';

export const extractNutritionController: RouteHandler<
  ExtractNutritionRoute
> = async (request, reply) => {
  try {
    const extracted = await extractNutrition(request.body);

    return reply.code(200).send(extracted);
  } catch (error) {
    request.log.error(
      {
        err: error,
      },
      'Nutrition extraction failed'
    );

    return reply.code(502).send({
      code: 'NUTRITION_EXTRACTION_FAILED',
      message: 'Could not extract nutrition information',
    });
  }
};
