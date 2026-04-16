import fs from 'node:fs';
import path from 'node:path';
import { SEASON_MARKER_GI } from '../helpers/patterns';
import { logger } from '../logger.service';
import type { MediaFile, MediaFolder } from '../types';
import { resolveConflict } from './conflict.resolver';
import {
  DOT_SEASON_EPISODE_PATTERN,
  EP_PATTERN,
  FOUR_DIGIT_PATTERN,
  LEADING_NUMBER_PATTERN,
  RUS_EPISODE_PATTERN,
  SEASON_EPISODE_PATTERN,
  SEZON_SERIYA_PATTERN,
  SE_PATTERN,
  SUFFIX_SEASON_RUS_EPISODE_PATTERN,
  SXE_PATTERN,
  TRAILING_NUMBER_PATTERN,
  TRAILING_S_NUMBER_PATTERN,
  WINDOWS_INVALID_FILE_CHARS_PATTERN,
  WINDOWS_MAX_CONTROL_CHAR_CODE,
  WINDOWS_RESERVED_NAMES,
  WINDOWS_TRAILING_DOTS_AND_SPACES_PATTERN,
} from './renamer.constants';
import type { EpisodeInfo, FileInfo } from './renamer.types';

const sanitizePathName = (value: string, fallback: string): string => {
  // path.basename используется для защиты от path traversal (убирает ведущие компоненты пути).
  // Оставшиеся последовательности ".." нейтрализуются path.join в вызывающем коде.
  const sanitized = path.basename(
    value
      .split('')
      .map((char) => (char.charCodeAt(0) <= WINDOWS_MAX_CONTROL_CHAR_CODE ? ' ' : char))
      .join('')
      .replace(WINDOWS_INVALID_FILE_CHARS_PATTERN, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(WINDOWS_TRAILING_DOTS_AND_SPACES_PATTERN, ''),
  );

  if (!sanitized) {
    return fallback;
  }

  if (WINDOWS_RESERVED_NAMES.has(sanitized.toUpperCase())) {
    return `${sanitized}_`;
  }

  return sanitized;
};

const normalizeSeriesFolderTitle = (value: string): string =>
  value
    .replace(SEASON_MARKER_GI, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\[\s*\]/g, ' ')
    .replace(/\s*[._-]\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

/**
 * Извлечь номер сезона и эпизода из имени файла.
 * Приоритет: SxxExx → NxNN → .SSEE. (4 цифры).
 * Возвращает null, если ни один паттерн не совпал.
 */
const extractEpisodeInfo = (filename: string): EpisodeInfo | null => {
  const seMatch = SE_PATTERN.exec(filename);
  if (seMatch) {
    return { season: Number.parseInt(seMatch[1], 10), episode: Number.parseInt(seMatch[2], 10) };
  }

  const sxeMatch = SXE_PATTERN.exec(filename);
  if (sxeMatch) {
    return { season: Number.parseInt(sxeMatch[1], 10), episode: Number.parseInt(sxeMatch[2], 10) };
  }

  const sezonSeriyaMatch = SEZON_SERIYA_PATTERN.exec(filename);
  if (sezonSeriyaMatch) {
    return {
      season: Number.parseInt(sezonSeriyaMatch[1], 10),
      episode: Number.parseInt(sezonSeriyaMatch[2], 10),
    };
  }

  const dotSeasonEpisodeMatch = DOT_SEASON_EPISODE_PATTERN.exec(filename);
  if (dotSeasonEpisodeMatch) {
    return {
      season: Number.parseInt(dotSeasonEpisodeMatch[1], 10),
      episode: Number.parseInt(dotSeasonEpisodeMatch[2], 10),
    };
  }

  const seasonEpisodeMatch = SEASON_EPISODE_PATTERN.exec(filename);
  if (seasonEpisodeMatch) {
    return {
      season: Number.parseInt(seasonEpisodeMatch[1], 10),
      episode: Number.parseInt(seasonEpisodeMatch[2], 10),
    };
  }

  const epMatch = EP_PATTERN.exec(filename);
  if (epMatch) {
    return { season: 1, episode: Number.parseInt(epMatch[1], 10) };
  }

  const suffixSeasonRusEpisodeMatch = SUFFIX_SEASON_RUS_EPISODE_PATTERN.exec(filename);
  if (suffixSeasonRusEpisodeMatch) {
    return {
      season: Number.parseInt(suffixSeasonRusEpisodeMatch[1], 10),
      episode: Number.parseInt(suffixSeasonRusEpisodeMatch[2], 10),
    };
  }

  const rusEpisodeMatch = RUS_EPISODE_PATTERN.exec(filename);
  if (rusEpisodeMatch) {
    return { season: 1, episode: Number.parseInt(rusEpisodeMatch[1], 10) };
  }

  const fourDigitMatch = FOUR_DIGIT_PATTERN.exec(filename);
  if (fourDigitMatch) {
    const season = Number.parseInt(fourDigitMatch[1], 10);
    const episode = Number.parseInt(fourDigitMatch[2], 10);
    // Исключить year-like паттерны: 19xx и 20xx — это годы, не номера сезонов
    if (season < 19) {
      return { season, episode };
    }
  }

  const leadingMatch = LEADING_NUMBER_PATTERN.exec(filename);
  if (leadingMatch) {
    return { season: 1, episode: Number.parseInt(leadingMatch[1], 10) };
  }

  const trailingSMatch = TRAILING_S_NUMBER_PATTERN.exec(filename);
  if (trailingSMatch) {
    return { season: 1, episode: Number.parseInt(trailingSMatch[1], 10) };
  }

  const trailingNumberMatch = TRAILING_NUMBER_PATTERN.exec(filename);
  if (trailingNumberMatch) {
    return { season: 1, episode: Number.parseInt(trailingNumberMatch[1], 10) };
  }

  return null;
};

// --- Renamer functions ---

/**
 * Переименовать файлы эпизодов в папке сериала.
 *
 * Формат определяется по числу уникальных сезонов:
 * - Один сезон  → 2-цифровой номер эпизода: `05.mkv`
 * - Несколько   → 4-цифровой формат SSEE:   `0205.mkv`
 *
 * Конфликты разрешаются через resolveConflict (победа существующего файла).
 * Папка переименовывается отдельно через renameFolder.
 */
export const renameEpisodeFiles = (folder: MediaFolder): void => {
  const fileInfos: FileInfo[] = [];

  for (const file of folder.files) {
    const info = extractEpisodeInfo(file.originalName);
    if (info) {
      fileInfos.push({ file, ...info });
    }
  }

  if (fileInfos.length === 0) return;

  const uniqueSeasons = new Set(fileInfos.map((info) => info.season));
  const useMultiSeason = uniqueSeasons.size > 1;

  for (const { file, season, episode } of fileInfos) {
    const paddedEpisode = String(episode).padStart(2, '0');
    const paddedSeason = String(season).padStart(2, '0');
    const newBaseName = useMultiSeason ? `${paddedSeason}${paddedEpisode}` : paddedEpisode;
    const targetPath = path.join(folder.path, `${newBaseName}${file.extension}`);

    if (targetPath === file.path) continue;

    resolveConflict(targetPath, file.path);

    if (!fs.existsSync(file.path)) {
      file.status = 'skipped';
      continue;
    }

    try {
      fs.renameSync(file.path, targetPath);
      file.status = 'processed';
      file.path = targetPath;
      file.newName = newBaseName;
    } catch (error) {
      logger.error(`Failed to rename episode: ${file.path}`, { error });
      file.status = 'error';
    }
  }
};

/**
 * Переименовать папку в переведённое название.
 * Должна вызываться ПОСЛЕ переименования файлов внутри (R4).
 * Обновляет `folder.path` и `folder.newName` при успехе.
 */
export const renameFolder = (folder: MediaFolder, translatedTitle: string): void => {
  const parentDir = path.dirname(folder.path);
  const safeTitle = sanitizePathName(translatedTitle, folder.originalName);
  const targetPath = path.join(parentDir, safeTitle);

  if (targetPath === folder.path) return;

  if (fs.existsSync(targetPath)) {
    logger.warn(`Cannot rename folder — target already exists: ${targetPath}`);
    return;
  }

  try {
    fs.renameSync(folder.path, targetPath);
    folder.path = targetPath;
    folder.newName = safeTitle;
  } catch (error) {
    logger.error(`Failed to rename folder: ${folder.path}`, { error });
  }
};

/**
 * Поднять единственный видеофайл из папки в IN_DIR, затем удалить папку.
 * Вызывается для одиночных фильмов, которые ошибочно оказались в папке.
 */
export const liftSingleMovie = (folder: MediaFolder, translatedTitle: string): void => {
  if (folder.files.length !== 1) {
    logger.warn(
      `liftSingleMovie: expected 1 file in "${folder.originalName}", got ${folder.files.length}`,
    );
    return;
  }

  const file = folder.files[0];
  const inDir = path.dirname(folder.path);
  const safeTitle = sanitizePathName(translatedTitle, folder.originalName);
  const newFileName = `${safeTitle}${file.extension}`;
  const targetPath = path.join(inDir, newFileName);

  resolveConflict(targetPath, file.path);

  if (!fs.existsSync(file.path)) {
    logger.warn(`Lift skipped — source deleted as duplicate: ${file.path}`);
    return;
  }

  try {
    fs.renameSync(file.path, targetPath);
    file.status = 'processed';
    file.path = targetPath;
    file.newName = safeTitle;
  } catch (error) {
    logger.error(`Failed to lift movie: ${file.path}`, { error });
    file.status = 'error';
    return;
  }

  try {
    fs.rmSync(folder.path, { recursive: true, force: true });
  } catch (error) {
    logger.warn(`Failed to delete folder: ${folder.path}`, { error });
  }
};

/**
 * Переименовать loose видеофайл в корне IN_DIR в переведённое название.
 */
export const renameMovieFile = (file: MediaFile, translatedTitle: string): void => {
  const dir = path.dirname(file.path);
  const safeTitle = sanitizePathName(translatedTitle, file.originalName);
  const newFileName = `${safeTitle}${file.extension}`;
  const targetPath = path.join(dir, newFileName);

  if (targetPath === file.path) return;

  resolveConflict(targetPath, file.path);

  if (!fs.existsSync(file.path)) {
    file.status = 'skipped';
    return;
  }

  try {
    fs.renameSync(file.path, targetPath);
    file.status = 'processed';
    file.path = targetPath;
    file.newName = safeTitle;
  } catch (error) {
    logger.error(`Failed to rename movie: ${file.path}`, { error });
    file.status = 'error';
  }
};

/**
 * Переименовать многочастный фильм (2+ файла без маркеров эпизодов).
 * Файлы переименовываются в 01, 02, 03... (сортировка по оригинальному имени).
 * Затем папка переименовывается в переведённое название.
 */
export const renameMultipartFolder = (folder: MediaFolder, translatedTitle: string): void => {
  const sortedFiles = [...folder.files].sort((fileA, fileB) =>
    fileA.originalName.localeCompare(fileB.originalName),
  );

  for (const [index, file] of sortedFiles.entries()) {
    const newBaseName = String(index + 1).padStart(2, '0');
    const targetPath = path.join(folder.path, `${newBaseName}${file.extension}`);

    if (targetPath === file.path) continue;

    resolveConflict(targetPath, file.path);

    if (!fs.existsSync(file.path)) {
      file.status = 'skipped';
      continue;
    }

    try {
      fs.renameSync(file.path, targetPath);
      file.status = 'processed';
      file.path = targetPath;
      file.newName = newBaseName;
    } catch (error) {
      logger.error(`Failed to rename part: ${file.path}`, { error });
      file.status = 'error';
    }
  }

  renameFolder(folder, translatedTitle);
};

/**
 * Применить все переименования на основе classifications и переводов GPT.
 *
 * Порядок: файлы эпизодов → папки → loose-фильмы (R4: папка переименовывается последней).
 * Если перевод для элемента отсутствует — используется оригинальное имя
 * (элемент уже обработан или GPT вернул ошибку).
 */
export const renameAll = (
  folders: MediaFolder[],
  looseFiles: MediaFile[],
  translations: ReadonlyMap<string, string>,
): void => {
  for (const folder of folders) {
    const rawTitle = translations.get(folder.path) ?? folder.originalName;
    const title = folder.contentType === 'series' ? normalizeSeriesFolderTitle(rawTitle) : rawTitle;

    if (folder.contentType === 'series') {
      renameEpisodeFiles(folder);
      renameFolder(folder, title);
    } else if (folder.contentType === 'movie') {
      if (folder.files.length === 1) {
        liftSingleMovie(folder, title);
        // папка удалена с диска; сбрасываем путь, чтобы не было stale-ссылки
        if (folder.files[0].status === 'processed') {
          folder.lifted = true;
        }
      } else {
        renameMultipartFolder(folder, title);
      }
    } else {
      logger.warn(`Skipping rename — unknown content type: "${folder.originalName}"`);
    }
  }

  for (const file of looseFiles) {
    const title = translations.get(file.path) ?? file.originalName;
    renameMovieFile(file, title);
  }
};
