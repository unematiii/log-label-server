import type { Static } from '@sinclair/typebox';
import type { RouteGenericInterface } from 'fastify';

import {
  ExtractNutritionBodySchema,
  ExtractNutritionErrorSchema,
  ExtractNutritionResponseSchema,
  OcrLineSchema,
  OcrRectSchema,
} from './schemas.js';

export type OcrRect = Static<typeof OcrRectSchema>;
export type OcrLine = Static<typeof OcrLineSchema>;

export type ExtractNutritionBody = Static<typeof ExtractNutritionBodySchema>;

export type ExtractNutritionResponse = Static<
  typeof ExtractNutritionResponseSchema
>;

export type ExtractNutritionError = Static<typeof ExtractNutritionErrorSchema>;

export interface ExtractNutritionRoute extends RouteGenericInterface {
  Body: ExtractNutritionBody;

  Reply: {
    200: ExtractNutritionResponse;
    502: ExtractNutritionError;
  };
}
