import { ExtractNutritionResponseSchema } from './schemas.js';
import type {
  ExtractNutritionBody,
  ExtractNutritionResponse,
} from './types.js';

type MistralConversationResponse = {
  outputs?: Array<{
    type?: string;
    content?:
      | string
      | Array<{
          type?: string;
          text?: string;
        }>;
  }>;
};

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
  const output = response.outputs
    ?.slice()
    .reverse()
    .find((item) => item.type === 'message.output' || item.type === undefined);

  if (typeof output?.content === 'string') {
    return output.content;
  }

  if (Array.isArray(output?.content)) {
    const text = output.content
      .filter((chunk) => chunk.type === 'text' || chunk.type === undefined)
      .map((chunk) => chunk.text ?? '')
      .join('');

    return text || undefined;
  }

  return undefined;
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
  if (!isRecord(value)) {
    return false;
  }

  const numericFields = [
    'basisAmount',
    'servingAmount',
    'energyKj',
    'energyKcal',
    'fatG',
    'saturatedFatG',
    'carbohydratesG',
    'sugarsG',
    'fibreG',
    'proteinG',
    'saltG',
    'sodiumMg',
  ];

  const numbersAreValid = numericFields.every(
    (field) =>
      value[field] === null ||
      (typeof value[field] === 'number' &&
        Number.isFinite(value[field]) &&
        value[field] >= 0)
  );

  const basisUnitIsValid =
    value.basisUnit === null ||
    value.basisUnit === 'g' ||
    value.basisUnit === 'ml' ||
    value.basisUnit === 'serving';

  const servingUnitIsValid =
    value.servingUnit === null ||
    value.servingUnit === 'g' ||
    value.servingUnit === 'ml';

  return numbersAreValid && basisUnitIsValid && servingUnitIsValid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
