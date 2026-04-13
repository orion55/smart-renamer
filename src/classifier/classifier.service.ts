import {
  CLEAN_CYRILLIC_FOLDER,
  COLLECTION,
  CYRILLIC,
  EPISODE_MARKER,
  JUNK_TOKENS,
  LATIN,
  NUMERIC_FILENAME,
  SEASON_MARKER,
  TRANSLIT_PATTERN,
  YEAR,
} from '../helpers/patterns';
import { logger } from '../logger.service';
import type { ContentType, GPTScenario, MediaFile, MediaFolder } from '../types';
import type { GptEntry } from './classifier.types';

export type { GptEntry };

/**
 * Удалить маркеры сезона и эпизода из имени папки, чтобы проверить
 * оставшуюся часть на «чистую кириллицу».
 */
const stripSeasonMarkers = (name: string): string =>
  name.replace(SEASON_MARKER, ' ').replace(EPISODE_MARKER, ' ').trim();

/**
 * Проверить, обработан ли уже данный элемент:
 * - папка: после удаления маркеров сезона/эпизода содержит только кириллицу
 * - файл: имя (без расширения) — число из 2 или 4 цифр
 */
export const isAlreadyProcessed = (name: string, isFolder: boolean): boolean => {
  if (isFolder) {
    const stripped = stripSeasonMarkers(name);
    return CLEAN_CYRILLIC_FOLDER.test(stripped);
  }
  return NUMERIC_FILENAME.test(name);
};

/**
 * Определить GPT-сценарий для имени папки или loose-файла.
 *
 * Возвращает:
 * - `'translit'`      — латиница с признаками русской транслитерации
 * - `'foreign'`       — латиница без транслита (иностранное название)
 * - `'cleanRussian'`  — кириллица, но есть технический мусор
 * - `null`            — GPT не нужен (уже обработано или чистая кириллица)
 */
export const needsGPT = (name: string): GPTScenario | null => {
  if (isAlreadyProcessed(name, true) || isAlreadyProcessed(name, false)) {
    return null;
  }

  if (TRANSLIT_PATTERN.test(name)) {
    return 'translit';
  }

  if (LATIN.test(name)) {
    return 'foreign';
  }

  // JUNK_TOKENS использует флаг g — сбрасываем lastIndex перед .test()
  JUNK_TOKENS.lastIndex = 0;
  const hasJunk = JUNK_TOKENS.test(name);
  JUNK_TOKENS.lastIndex = 0;

  if (CYRILLIC.test(name) && hasJunk) {
    return 'cleanRussian';
  }

  return null;
};

/**
 * Классифицировать папку или файл по имени и количеству видеофайлов.
 *
 * Дерево решений (согласно плану T4):
 * 1. EPISODE_MARKER → 'series'
 * 2. SEASON_MARKER  → 'series'
 * 3. COLLECTION     → 'movie'
 * 4. YEAR           → 'movie'
 * 5. Нет маркеров:
 *    - videoFileCount === 1 → 'movie'
 *    - videoFileCount >= 2  → 'series'
 * 6. Иначе          → 'unknown' (логируется)
 */
export const classify = (name: string, videoFileCount: number): ContentType => {
  if (EPISODE_MARKER.test(name) || SEASON_MARKER.test(name)) return 'series';
  if (COLLECTION.test(name) || YEAR.test(name)) return 'movie';
  if (videoFileCount === 1) return 'movie';
  if (videoFileCount >= 2) return 'series';
  logger.warn(`classify: cannot determine content type for "${name}" (${videoFileCount} files)`);
  return 'unknown';
};

/**
 * Классифицировать все папки и loose-файлы, проставить им типы,
 * вернуть очереди элементов, требующих GPT-перевода.
 *
 * Мутирует `folder.contentType` и `file.type` переданных объектов.
 */
export const buildGptQueue = (
  folders: MediaFolder[],
  looseFiles: MediaFile[],
): { foldersForGpt: GptEntry<MediaFolder>[]; filesForGpt: GptEntry<MediaFile>[] } => {
  for (const folder of folders) {
    folder.contentType = classify(folder.originalName, folder.files.length);
  }

  for (const file of looseFiles) {
    file.type = classify(file.originalName, 1);
  }

  const foldersForGpt: GptEntry<MediaFolder>[] = folders
    .filter((folder) => !isAlreadyProcessed(folder.originalName, true))
    .flatMap((folder) => {
      const scenario = needsGPT(folder.originalName);
      return scenario !== null ? [{ item: folder, scenario }] : [];
    });

  const filesForGpt: GptEntry<MediaFile>[] = looseFiles
    .filter((file) => !isAlreadyProcessed(file.originalName, false))
    .flatMap((file) => {
      const scenario = needsGPT(file.originalName);
      return scenario !== null ? [{ item: file, scenario }] : [];
    });

  logger.info(
    `Classified ${folders.length} folder(s), ${looseFiles.length} loose file(s). ` +
      `Items queued for GPT: ${foldersForGpt.length + filesForGpt.length}`,
  );

  return { foldersForGpt, filesForGpt };
};
