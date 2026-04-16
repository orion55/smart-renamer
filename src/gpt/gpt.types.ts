import type { GptEntry } from '../classifier/classifier.types';
import type { GPTScenario, MediaFile, MediaFolder } from '../types';

/**
 * Yandex Cloud расширяет стандартный OpenAI Responses API:
 * вместо поля `model` используется `prompt.id` — ID сохранённого промпта агента.
 */
export interface YandexCreateParams {
  prompt: { id: string };
  input: string;
  max_output_tokens?: number;
}

/**
 * Alice AI LLM использует стандартные поля Responses API:
 * `model` — URI вида gpt://<folder>/<model>, `instructions` — системный промпт.
 */
export interface AliceCreateParams {
  model: string;
  instructions: string;
  input: string;
  temperature?: number;
  max_output_tokens?: number;
}

/**
 * Подмножество реального `Response` из openai SDK.
 * Включает поля для детектирования мягких сбоев (HTTP 200, но status: 'failed').
 */
export interface YandexCreateResult {
  id?: string;
  output_text: string;
  status: string;
  error: { code: string; message: string } | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: {
      cached_tokens?: number;
    };
  };
  conversation?: {
    id?: string;
  } | null;
  incomplete_details?: unknown;
  output?: unknown[];
}

/**
 * Минимальный контракт элемента, который можно отправить в translateBatch.
 * Не привязан к MediaFolder/MediaFile — любой объект с originalName подходит.
 */
export interface TranslateEntry {
  item: { originalName: string };
  scenario: GPTScenario;
}

/** Объединение всех возможных GPT-очередей из classifier. */
export type MediaGptEntry = GptEntry<MediaFolder | MediaFile>;

/** Результат applyTranslations: path → переведённое название. */
export type TranslationMap = ReadonlyMap<string, string>;
