import { Type, type TSchema } from '@sinclair/typebox';

const Nullable = <T extends TSchema>(schema: T) =>
  Type.Union([schema, Type.Null()]);

export const OcrRectSchema = Type.Object(
  {
    x: Type.Number({
      minimum: 0,
      maximum: 1,
    }),
    y: Type.Number({
      minimum: 0,
      maximum: 1,
    }),
    width: Type.Number({
      minimum: 0,
      maximum: 1,
    }),
    height: Type.Number({
      minimum: 0,
      maximum: 1,
    }),
  },
  {
    additionalProperties: false,
  }
);

export const OcrLineSchema = Type.Object(
  {
    text: Type.String({
      minLength: 1,
      maxLength: 500,
    }),
    rect: OcrRectSchema,
  },
  {
    additionalProperties: false,
  }
);

export const ExtractNutritionBodySchema = Type.Object(
  {
    fullText: Type.String({
      minLength: 1,
      maxLength: 20_000,
    }),
    lines: Type.Array(OcrLineSchema, {
      minItems: 1,
      maxItems: 200,
    }),
    coordinateSpace: Type.Literal('normalized-top-left'),
  },
  {
    additionalProperties: false,
  }
);

const NullableNonNegativeNumber = () =>
  Nullable(
    Type.Number({
      minimum: 0,
    })
  );

export const ExtractNutritionResponseSchema = Type.Object(
  {
    basisAmount: NullableNonNegativeNumber(),
    basisUnit: Type.Union([
      Type.Literal('g'),
      Type.Literal('ml'),
      Type.Literal('serving'),
      Type.Null(),
    ]),
    servingAmount: NullableNonNegativeNumber(),
    servingUnit: Type.Union([
      Type.Literal('g'),
      Type.Literal('ml'),
      Type.Null(),
    ]),
    energyKj: NullableNonNegativeNumber(),
    energyKcal: NullableNonNegativeNumber(),
    fatG: NullableNonNegativeNumber(),
    saturatedFatG: NullableNonNegativeNumber(),
    carbohydratesG: NullableNonNegativeNumber(),
    sugarsG: NullableNonNegativeNumber(),
    fibreG: NullableNonNegativeNumber(),
    proteinG: NullableNonNegativeNumber(),
    saltG: NullableNonNegativeNumber(),
    sodiumMg: NullableNonNegativeNumber(),
  },
  {
    additionalProperties: false,
  }
);

export const ExtractNutritionErrorSchema = Type.Object(
  {
    code: Type.Union([
      Type.Literal('NUTRITION_EXTRACTION_FAILED'),
      Type.Literal('INVALID_MODEL_RESPONSE'),
    ]),
    message: Type.String(),
  },
  {
    additionalProperties: false,
  }
);
