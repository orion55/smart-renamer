import type { GPTScenario } from '../types';

export interface BatchInputEntry {
  type: GPTScenario;
  name: string;
}

const MAX_BATCH_SIZE = 50;

/**
 * Сериализовать массив записей в JSON-строку для отправки агенту.
 * Батч ограничен 50 записями (решение #2).
 * Агент ожидает массив объектов {type, name} в поле input.
 */
export const buildBatchInput = (entries: BatchInputEntry[]): string =>
  JSON.stringify(entries.slice(0, MAX_BATCH_SIZE));
