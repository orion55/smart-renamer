import type { FallbackEntry } from '../types';
import {
  BY_ENCODER_G,
  JUNK_TOKENS_G,
  LANG_TOKENS_G,
  PLATFORM_CODES_G,
  RELEASE_GROUPS_G,
  YEAR_G,
} from './patterns';

export const cleanFallbackName = (name: string): string =>
  name
    .replace(/\([^)]+\)/g, ' ') // убрать (скобочный мусор): студии, актёры, коды вещателей
    .replace(/_?\[[^\]]+]/g, ' ') // убрать [теги]
    .replace(BY_ENCODER_G, ' ') // убрать «by AKTEP», «от New-Team»
    .replace(PLATFORM_CODES_G, ' ') // убрать AMZN, NF, LE, TVHUB…
    .replace(LANG_TOKENS_G, ' ') // убрать Rus, Eng, Fre, MVO, sub, Original…
    .replace(RELEASE_GROUPS_G, ' ') // убрать ViruseProject, LostFilm, msltel…
    .replace(JUNK_TOKENS_G, ' ') // убрать x264, WEB-DL, 400p, WEB, FILM…
    .replace(YEAR_G, ' ') // убрать годы в формате .2024. / (2024) / 2024-2025
    .replace(/[._]+/g, ' ') // точки и подчёркивания → пробелы
    .replace(/[,;]+/g, ' ') // осиротевшие запятые и точки с запятой
    .replace(/\s{2,}/g, ' ') // схлопнуть множественные пробелы
    .trim()
    .replace(/^[-–\s]+/, '') // убрать ведущие дефисы
    .replace(/[-–\s]+$/, '') // убрать хвостовые дефисы
    .replace(/^\w/, (char) => char.toUpperCase()); // первая буква — заглавная

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
