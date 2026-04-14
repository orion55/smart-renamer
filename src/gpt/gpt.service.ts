import OpenAI from 'openai';
import pLimit from 'p-limit';
import { logger } from '../logger.service';
import {
  BATCH_SIZE,
  CONCURRENCY,
  MAX_RETRIES,
  YANDEX_BASE_URL,
  YANDEX_FOLDER_ID,
  YANDEX_PROMPT_ID,
} from './gpt.constants';
import { GptSoftError, NON_RETRYABLE_CODES } from './gpt.errors';
import type {
  MediaGptEntry,
  TranslateEntry,
  TranslationMap,
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

const yandexCreate = (params: YandexCreateParams): Promise<YandexCreateResult> =>
  client.responses.create(params as never) as unknown as Promise<YandexCreateResult>;

const limit = pLimit(CONCURRENCY);

const callYandex = async (input: string): Promise<string> => {
  const response = await yandexCreate({ prompt: { id: YANDEX_PROMPT_ID }, input });
  if (response.status === 'failed' || !response.valid) {
    const apiError = response.error ?? { code: 'unknown', message: 'no error details' };
    throw new GptSoftError(
      apiError.message,
      apiError.code,
      !NON_RETRYABLE_CODES.has(apiError.code),
    );
  }
  return response.output_text;
};

const callWithRetry = async (input: string, attempt = 0): Promise<string> => {
  try {
    return await callYandex(input);
  } catch (error) {
    const isNonRetryable = error instanceof GptSoftError && !error.retryable;
    const isExhausted = attempt >= MAX_RETRIES - 1;

    if (isNonRetryable || isExhausted) {
      const meta =
        error instanceof GptSoftError
          ? { code: error.code, message: error.message }
          : { message: error instanceof OpenAI.APIError ? error.message : String(error) };
      logger.error(
        isNonRetryable
          ? `GPT request failed (non-retryable: ${(error as GptSoftError).code})`
          : `GPT request failed after ${MAX_RETRIES} attempts`,
        meta,
      );
      throw error;
    }

    const delayMs = 1000 * 2 ** attempt;
    logger.warn(`GPT attempt ${attempt + 1}/${MAX_RETRIES} failed, retry in ${delayMs}ms`);
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    return callWithRetry(input, attempt + 1);
  }
};

/**
 * Перевести записи через GPT-агент Yandex Cloud.
 * Разбивает на батчи по 50, выполняет параллельно (не более 3 одновременно).
 * Возвращает массив строк той же длины (null при ошибке для конкретной позиции).
 */
export const translateBatch = async (entries: TranslateEntry[]): Promise<(string | null)[]> => {
  if (entries.length === 0) return [];

  const inputEntries: BatchInputEntry[] = entries.map((entry) => ({
    type: entry.scenario,
    name: entry.item.originalName,
  }));

  const batches: BatchInputEntry[][] = [];
  for (let batchStart = 0; batchStart < inputEntries.length; batchStart += BATCH_SIZE) {
    batches.push(inputEntries.slice(batchStart, batchStart + BATCH_SIZE));
  }

  const batchTasks = batches.map((batch) =>
    limit(async () => {
      const batchInput = buildBatchInput(batch);
      try {
        const rawText = await callWithRetry(batchInput);
        return parseResponse(rawText, batch.length);
      } catch {
        return new Array<null>(batch.length).fill(null);
      }
    }),
  );

  const batchResults = await Promise.all(batchTasks);
  return batchResults.flat();
};

/**
 * Перевести все записи через GPT.
 * Возвращает Map<path → translatedName> только для успешно переведённых элементов.
 * Оригинальные объекты не изменяются — поток данных явный и без side-effects.
 */
export const applyTranslations = async (allEntries: MediaGptEntry[]): Promise<TranslationMap> => {
  const results = await translateBatch(allEntries);
  const translations = new Map<string, string>();
  for (const [entryIndex, entry] of allEntries.entries()) {
    const translated = results[entryIndex];
    if (translated != null) {
      translations.set(entry.item.path, translated);
    }
  }
  logger.info(`GPT translated ${translations.size} of ${allEntries.length} item(s)`);
  return translations;
};
