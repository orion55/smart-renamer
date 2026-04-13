import type { GptEntry } from '../classifier/classifier.types';
import type { GPTScenario, MediaFile, MediaFolder } from '../types';

/**
 * Yandex Cloud расширяет стандартный OpenAI Responses API:
 * вместо поля `model` используется `prompt.id` — ID сохранённого промпта агента.
 */
export interface YandexCreateParams {
  prompt: { id: string };
  input: string;
}

/**
 * Подмножество реального `Response` из openai SDK.
 * Включает поля для детектирования мягких сбоев (HTTP 200, но status: 'failed').
 */
export interface YandexCreateResult {
  output_text: string;
  status: string;
  valid: boolean;
  error: { code: string; message: string } | null;
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
