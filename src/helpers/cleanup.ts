import type { FallbackEntry } from '../types';
import { JUNK_TOKENS_G, YEAR_G } from './patterns';

export const cleanFallbackName = (name: string): string =>
  name
    .replace(/_?\[[^\]]+]/g, ' ')
    .replace(JUNK_TOKENS_G, ' ')
    .replace(YEAR_G, ' ')
    .replace(/[._]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[-–\s]+/, '')
    .replace(/[-–\s]+$/, '');

export const applyFallbackCleanup = (
  entries: FallbackEntry[],
  translations: Map<string, string>,
): void => {
  for (const entry of entries) {
    if (!translations.has(entry.item.path)) {
      translations.set(entry.item.path, cleanFallbackName(entry.item.originalName));
    }
  }
};
