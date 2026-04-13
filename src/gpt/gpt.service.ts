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

// Кастуем только метод create, сохраняя this-привязку через .bind().
// Необходимо, т.к. Yandex Cloud заменяет стандартный параметр `model`
// на `prompt.id` — несовместимые типы на уровне TypeScript, но runtime совместим.
const yandexCreate = client.responses.create.bind(client.responses) as unknown as (
  params: YandexCreateParams,
) => Promise<YandexCreateResult>;

const limit = pLimit(CONCURRENCY);

const formatApiError = (error: unknown): Record<string, unknown> => {
  if (error instanceof OpenAI.APIError) {
    return { status: error.status, name: error.name, message: error.message, body: error.error };
  }
  return { message: String(error) };
};

const callWithRetry = async (input: string, attempt = 0): Promise<string> => {
  try {
    const response = await yandexCreate({ prompt: { id: YANDEX_PROMPT_ID }, input });
    console.log(response);
    return response.output_text;
  } catch (error) {
    const details = formatApiError(error);
    if (attempt >= MAX_RETRIES - 1) {
      logger.error(`GPT request failed permanently after ${MAX_RETRIES} attempts`, details);
      throw error;
    }
    const delayMs = 1000 * 2 ** attempt;
    logger.warn(
      `GPT request failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delayMs}ms`,
      details,
    );
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
      } catch (error) {
        logger.error(`translateBatch: all retries exhausted for batch of ${batch.length}`, {
          error,
        });
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
