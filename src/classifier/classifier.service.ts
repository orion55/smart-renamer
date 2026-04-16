import {
  CLEAN_CYRILLIC_FOLDER,
  COLLECTION,
  CYRILLIC,
  EPISODE_MARKER,
  EPISODE_MARKER_G,
  JUNK_TOKENS,
  LATIN,
  NUMERIC_FILENAME,
  SEASON_MARKER,
  SEASON_MARKER_GI,
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
  name.replace(SEASON_MARKER_GI, ' ').replace(EPISODE_MARKER_G, ' ').trim();

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
export const needsGPT = (name: string, isFolder: boolean): GPTScenario | null => {
  if (isAlreadyProcessed(name, isFolder)) {
    return null;
  }

  if (TRANSLIT_PATTERN.test(name)) {
    return 'translit';
  }

  if (LATIN.test(name)) {
    return 'foreign';
  }

  if (CYRILLIC.test(name) && JUNK_TOKENS.test(name)) {
    return 'cleanRussian';
  }

  return null;
};

/**
 * Классифицировать папку или файл по имени и количеству видеофайлов.
 *
 * Дерево решений (согласно плану T4):
 * 1. videoFileCount === 1 → 'movie'
 * 2. EPISODE_MARKER → 'series'
 * 3. SEASON_MARKER  → 'series'
 * 4. COLLECTION     → 'movie'
 * 5. YEAR           → 'movie'
 * 6. videoFileCount >= 2  → 'series'
 * 7. Иначе          → 'unknown' (логируется)
 *
 * Правило пользователя: если после очистки/выравнивания в папке остался
 * ровно один видеофайл, это фильм, даже если в имени есть season-маркеры.
 */
export const classify = (name: string, videoFileCount: number): ContentType => {
  if (videoFileCount === 1) return 'movie';
  if (EPISODE_MARKER.test(name) || SEASON_MARKER.test(name)) return 'series';
  if (COLLECTION.test(name) || YEAR.test(name)) return 'movie';
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
): {
  foldersForGpt: GptEntry<MediaFolder>[];
  filesForGpt: GptEntry<MediaFile>[];
  allForGpt: Array<GptEntry<MediaFolder> | GptEntry<MediaFile>>;
} => {
  for (const folder of folders) {
    folder.contentType = classify(folder.originalName, folder.files.length);
  }

  for (const file of looseFiles) {
    file.type = classify(file.originalName, 1);
  }

  // needsGPT уже вызывает isAlreadyProcessed внутри — внешний .filter избыточен
  const foldersForGpt: GptEntry<MediaFolder>[] = folders.flatMap((folder) => {
    const scenario = needsGPT(folder.originalName, true);
    return scenario !== null ? [{ item: folder, scenario }] : [];
  });

  const filesForGpt: GptEntry<MediaFile>[] = looseFiles.flatMap((file) => {
    const scenario = needsGPT(file.originalName, false);
    return scenario !== null ? [{ item: file, scenario }] : [];
  });

  logger.info(
    `Classified ${folders.length} folder(s), ${looseFiles.length} loose file(s). ` +
      `Items queued for GPT: ${foldersForGpt.length + filesForGpt.length}`,
  );

  return { foldersForGpt, filesForGpt, allForGpt: [...foldersForGpt, ...filesForGpt] };
};
