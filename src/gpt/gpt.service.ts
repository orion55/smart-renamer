import OpenAI from 'openai';
import { getYandexProvider } from '../helpers/env';
import { logger } from '../logger.service';
import {
  ALICE_MODEL,
  ALICE_TEMPERATURE,
  BATCH_SIZE,
  CONTEXT_LIMIT_MESSAGE,
  INPUT_TOKENS_LIMIT_PATTERN,
  MAX_BATCH_CHARS,
  MAX_OUTPUT_TOKENS,
  MAX_RETRIES,
  YANDEX_BASE_URL,
  YANDEX_FOLDER_ID,
  YANDEX_PROMPT_ID,
} from './gpt.constants';
import { GptSoftError, NON_RETRYABLE_CODES } from './gpt.errors';
import { ALICE_INSTRUCTIONS } from './gpt.prompt';
import type {
  AliceCreateParams,
  MediaGptEntry,
  TranslateEntry,
  YandexCreateParams,
  YandexCreateResult,
} from './gpt.types';
import type { BatchInputEntry } from './prompt.builder';
import { buildBatchInput } from './prompt.builder';
import { parseResponse } from './response.parser';

const client = new OpenAI({
  apiKey: process.env.YANDEX_API_KEY,
  baseURL: YANDEX_BASE_URL,
  defaultHeaders: {
    'OpenAI-Project': YANDEX_FOLDER_ID,
  },
});

// Yandex использует prompt.id вместо model — параметры не совместимы с типами SDK.
const yandexCreate = (params: YandexCreateParams): Promise<YandexCreateResult> =>
  client.responses.create(
    params as unknown as Parameters<typeof client.responses.create>[0],
  ) as unknown as Promise<YandexCreateResult>;

// Alice AI LLM использует стандартный Responses API с полем model.
const aliceCreate = (params: AliceCreateParams): Promise<YandexCreateResult> =>
  client.responses.create(
    params as unknown as Parameters<typeof client.responses.create>[0],
  ) as unknown as Promise<YandexCreateResult>;

const getErrorMeta = (error: unknown) => {
  if (error instanceof GptSoftError) {
    return { code: error.code, details: error.message };
  }

  if (error instanceof OpenAI.APIError) {
    return {
      code: error.code ?? 'api_error',
      details: error.message,
      status: error.status,
      type: error.type,
    };
  }

  return { details: String(error) };
};

const isContextLimitError = (error: unknown): boolean =>
  error instanceof GptSoftError && error.code === 'context_limit_exceeded';

const isProviderOversizeMessage = (message: string): boolean => {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes(CONTEXT_LIMIT_MESSAGE) || INPUT_TOKENS_LIMIT_PATTERN.test(message)
  );
};

const normalizeTranslation = (value: string | null): string | null => {
  if (value == null) return null;

  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return null;

  // GPT sometimes returns "-" as "I don't know". In that case keep the source name.
  if (/^-+$/.test(normalized)) return null;

  return normalized;
};

/**
 * Общая обработка ответа Responses API — одинакова для агента и Alice.
 * Бросает GptSoftError при failed-статусе или пустом выводе.
 */
const extractOutputText = (response: YandexCreateResult): string => {
  if (response.status === 'failed') {
    const apiError = response.error ?? { code: 'unknown', message: 'no error details' };
    logger.warn(`GPT failed: ${apiError.code} — ${apiError.message}`, { responseId: response.id });
    const errorCode = isProviderOversizeMessage(apiError.message)
      ? 'context_limit_exceeded'
      : apiError.code;
    throw new GptSoftError(apiError.message, errorCode, !NON_RETRYABLE_CODES.has(errorCode));
  }

  if (response.output_text.length === 0) {
    const apiError = response.error ?? {
      code: 'empty_output',
      message: 'Provider returned empty output_text',
    };
    logger.warn('GPT empty output', { responseId: response.id, status: response.status });
    throw new GptSoftError(apiError.message, apiError.code, true);
  }

  return response.output_text;
};

const callYandex = async (input: string): Promise<string> =>
  extractOutputText(
    await yandexCreate({
      prompt: { id: YANDEX_PROMPT_ID },
      input,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    }),
  );

const callAlice = async (input: string): Promise<string> =>
  extractOutputText(
    await aliceCreate({
      model: ALICE_MODEL,
      instructions: ALICE_INSTRUCTIONS,
      input,
      temperature: ALICE_TEMPERATURE,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    }),
  );

// Провайдер выбирается один раз при инициализации модуля на основе YANDEX_AI_PROVIDER.
const callProvider: (input: string) => Promise<string> =
  getYandexProvider() === 'alice' ? callAlice : callYandex;

const callWithRetry = async (input: string, attempt = 0): Promise<string> => {
  try {
    return await callProvider(input);
  } catch (error) {
    const isNonRetryable = error instanceof GptSoftError && !error.retryable;
    const isExhausted = attempt >= MAX_RETRIES - 1;

    if (isNonRetryable || isExhausted) {
      logger.error(
        isNonRetryable
          ? `GPT request failed (non-retryable: ${(error as GptSoftError).code})`
          : `GPT request failed after ${MAX_RETRIES} attempts`,
        getErrorMeta(error),
      );
      throw error;
    }

    const delayMs = 1000 * 2 ** attempt;
    logger.warn(`GPT attempt ${attempt + 1}/${MAX_RETRIES} failed, retry in ${delayMs}ms`);
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    return callWithRetry(input, attempt + 1);
  }
};

const getBatchMetrics = (batch: BatchInputEntry[], inputStr: string) => {
  const nameLengths = batch.map((entry) => entry.name.length);
  return {
    batchSize: batch.length,
    inputChars: inputStr.length,
    longestNameChars: nameLengths.length > 0 ? Math.max(...nameLengths) : 0,
    totalNameChars: nameLengths.reduce((sum, length) => sum + length, 0),
  };
};

const translateChunk = async (batch: BatchInputEntry[], depth = 0): Promise<(string | null)[]> => {
  const batchInput = buildBatchInput(batch);

  logger.info(`GPT batch start (${batch.length})`);

  try {
    const rawText = await callWithRetry(batchInput);
    return parseResponse(rawText, batch.length);
  } catch (error) {
    if (isContextLimitError(error) && batch.length > 1) {
      const middleIndex = Math.ceil(batch.length / 2);
      logger.warn(
        `GPT context limit, splitting ${batch.length} → ${middleIndex}+${batch.length - middleIndex} (depth ${depth})`,
      );

      const leftResult = await translateChunk(batch.slice(0, middleIndex), depth + 1);
      const rightResult = await translateChunk(batch.slice(middleIndex), depth + 1);
      return [...leftResult, ...rightResult];
    }

    const metrics = getBatchMetrics(batch, batchInput);
    logger.error('GPT batch failed', { ...metrics, splitDepth: depth, ...getErrorMeta(error) });
    return new Array<null>(batch.length).fill(null);
  }
};

/**
 * Перевести записи через GPT-провайдер (агент или Alice AI LLM).
 * Разбивает на батчи по 50 элементов (или MAX_BATCH_CHARS символов), выполняет последовательно.
 * Возвращает массив строк той же длины (null при ошибке для конкретной позиции).
 */
export const translateBatch = async (entries: TranslateEntry[]): Promise<(string | null)[]> => {
  if (entries.length === 0) return [];

  const inputEntries: BatchInputEntry[] = entries.map((entry) => ({
    type: entry.scenario,
    name: entry.item.originalName,
  }));

  const batches: BatchInputEntry[][] = [];
  let currentBatch: BatchInputEntry[] = [];
  for (const entry of inputEntries) {
    const prospective = [...currentBatch, entry];
    const wouldExceedCount = prospective.length > BATCH_SIZE;
    const wouldExceedChars = JSON.stringify(prospective).length > MAX_BATCH_CHARS;
    if (currentBatch.length > 0 && (wouldExceedCount || wouldExceedChars)) {
      batches.push(currentBatch);
      currentBatch = [entry];
    } else {
      currentBatch.push(entry);
    }
  }
  if (currentBatch.length > 0) batches.push(currentBatch);

  const batchResults: (string | null)[][] = [];
  for (const batch of batches) {
    batchResults.push(await translateChunk(batch));
  }
  return batchResults.flat();
};

/**
 * Перевести все записи через GPT.
 * Возвращает Map<path → translatedName> только для успешно переведённых элементов.
 * Оригинальные объекты не изменяются — поток данных явный и без side-effects.
 */
export const applyTranslations = async (
  allEntries: MediaGptEntry[],
): Promise<Map<string, string>> => {
  const results = await translateBatch(allEntries);
  const translations = new Map<string, string>();
  for (const [entryIndex, entry] of allEntries.entries()) {
    const translated = normalizeTranslation(results[entryIndex]);
    if (translated != null) {
      translations.set(entry.item.path, translated);
    }
  }
  logger.info(`GPT translated ${translations.size} of ${allEntries.length} item(s)`);
  return translations;
};
