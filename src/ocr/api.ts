import { TypeCompiler } from '@sinclair/typebox/compiler';

import { ExtractNutritionResponseSchema } from './schemas.js';
import type {
  ExtractNutritionBody,
  ExtractNutritionResponse,
} from './types.js';

type MistralConversationResponse = {
  outputs?: Array<{
    type?: string;
    content?: string;
  }>;
};

const ExtractNutritionResponseValidator = TypeCompiler.Compile(
  ExtractNutritionResponseSchema
);

export async function extractNutrition(
  input: ExtractNutritionBody,
  options?: {
    baseUrl?: string;
    signal?: AbortSignal;
  }
): Promise<ExtractNutritionResponse> {
  const baseUrl =
    options?.baseUrl ??
    process.env.MISTRAL_BASE_URL ??
    'https://api.mistral.ai';

  const normalizedInput: ExtractNutritionBody['fullText'] =
    input.fullText.trim();

  const body = JSON.stringify({
    model: 'ministral-3b-latest',
    inputs: [
      {
        role: 'user',
        content: [
          'Extract nutrition information from this OCR result:',
          JSON.stringify(normalizedInput),
        ].join('\n\n'),
      },
    ],
    instructions: `Do not deviate from the response schema. Where data is missing, supply null value.`,
    completion_args: {
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response_schema',
          schema_definition: ExtractNutritionResponseSchema,
          strict: true,
        },
      },
    },
    tools: [],
  });

  const response = await fetch(`${baseUrl}/v1/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    signal: options?.signal || null,
    body,
  });

  if (!response.ok) {
    const responseBody = await response.text();

    throw new Error(`Mistral API returned ${response.status}: ${responseBody}`);
  }

  const conversation = (await response.json()) as MistralConversationResponse;
  const content = getMistralOutputContent(conversation);

  if (!content) {
    throw new Error('Mistral API returned no message output content');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Mistral API returned invalid JSON: ${content}`);
  }

  if (!isExtractedNutrition(parsed)) {
    throw new Error(`Mistral API returned an unexpected result: ${content}`);
  }

  return applyNutritionSanityChecks(parsed);
}

function getMistralOutputContent(
  response: MistralConversationResponse
): string | undefined {
  return response.outputs?.findLast(
    (output) => output.type === 'message.output'
  )?.content;
}

function applyNutritionSanityChecks(
  result: ExtractNutritionResponse
): ExtractNutritionResponse {
  const cleaned = { ...result };

  if (
    cleaned.fatG !== null &&
    cleaned.saturatedFatG !== null &&
    cleaned.saturatedFatG > cleaned.fatG
  ) {
    cleaned.saturatedFatG = null;
  }

  if (
    cleaned.carbohydratesG !== null &&
    cleaned.sugarsG !== null &&
    cleaned.sugarsG > cleaned.carbohydratesG
  ) {
    cleaned.sugarsG = null;
  }

  // These limits are deliberately generous. They catch OCR/model mistakes,
  // while allowing unusual products.
  for (const field of [
    'fatG',
    'saturatedFatG',
    'carbohydratesG',
    'sugarsG',
    'fibreG',
    'proteinG',
    'saltG',
  ] as const) {
    if (
      cleaned[field] !== null &&
      cleaned.basisAmount === 100 &&
      cleaned[field] > 100
    ) {
      cleaned[field] = null;
    }
  }

  return cleaned;
}

function isExtractedNutrition(
  value: unknown
): value is ExtractNutritionResponse {
  return ExtractNutritionResponseValidator.Check(value);
}
