import { ExtractNutritionResponseSchema } from './schemas.js';
import type {
  ExtractNutritionBody,
  ExtractNutritionResponse,
} from './types.js';

type LlamaChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string;
    };
    finish_reason?: string;
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
    options?.baseUrl ?? process.env.LLAMA_BASE_URL ?? 'http://127.0.0.1:8080';

  const normalizedInput: ExtractNutritionBody['fullText'] =
    input.fullText.trim();

  const body = JSON.stringify({
    model: process.env.LLAMA_MODEL ?? 'qwen3-1.7b',

    messages: [
      {
        role: 'user',
        content: [
          '/no_think',
          'Extract nutrition information from this OCR result:',
          JSON.stringify(normalizedInput),
        ].join('\n\n'),
      },
    ],

    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'nutrition_label',
        strict: true,
        schema: ExtractNutritionResponseSchema,
      },
    },

    chat_template_kwargs: {
      enable_thinking: false,
    },

    temperature: 0,
    max_tokens: 800,
    stream: false,
  });

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: options?.signal || null,
    body,
  });

  if (!response.ok) {
    const responseBody = await response.text();

    throw new Error(
      `llama-server returned ${response.status}: ${responseBody}`
    );
  }

  const completion = (await response.json()) as LlamaChatCompletion;

  const choice = completion.choices?.[0];
  const content = choice?.message?.content;

  if (!content) {
    throw new Error(
      `llama-server returned no content. Finish reason: ${
        choice?.finish_reason ?? 'unknown'
      }`
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`llama-server returned invalid JSON: ${content}`);
  }

  if (!isExtractedNutrition(parsed)) {
    throw new Error(`llama-server returned an unexpected result: ${content}`);
  }

  return applyNutritionSanityChecks(parsed);
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
