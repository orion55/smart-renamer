import type { GPTScenario } from '../types';
import { BATCH_SIZE } from './gpt.constants';

export interface BatchInputEntry {
  type: GPTScenario;
  name: string;
}

/**
 * Сериализовать массив записей в JSON-строку для отправки агенту.
 * Ограничение по количеству (BATCH_SIZE) применяется здесь через slice.
 * Ограничение по символам (MAX_BATCH_CHARS) применяется вызывающим кодом до вызова этой функции.
 * Агент ожидает массив объектов {type, name} в поле input.
 */
export const buildBatchInput = (entries: BatchInputEntry[]): string =>
  JSON.stringify(entries.slice(0, BATCH_SIZE));
