import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.service';
import type { MediaFile, MediaFolder } from '../types';
import { resolveConflict } from './conflict.resolver';
import { FOUR_DIGIT_PATTERN, SE_PATTERN, SXE_PATTERN } from './renamer.constants';
import type { EpisodeInfo, FileInfo } from './renamer.types';

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

  const fourDigitMatch = FOUR_DIGIT_PATTERN.exec(filename);
  if (fourDigitMatch) {
    const season = Number.parseInt(fourDigitMatch[1], 10);
    const episode = Number.parseInt(fourDigitMatch[2], 10);
    // Исключить year-like паттерны: 19xx и 20xx — это годы, не номера сезонов
    if (season < 19) {
      return { season, episode };
    }
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
export const renameEpisodeFiles = (folder: MediaFolder, translatedTitle: string): void => {
  const fileInfos: FileInfo[] = [];

  for (const file of folder.files) {
    const info = extractEpisodeInfo(file.originalName);
    if (info) {
      fileInfos.push({ file, ...info });
    }
  }

  if (fileInfos.length === 0) {
    logger.info(`renameEpisodeFiles: no episode markers found in "${translatedTitle}", skipping`);
    return;
  }

  const uniqueSeasons = new Set(fileInfos.map((info) => info.season));
  const useMultiSeason = uniqueSeasons.size > 1;

  logger.info(
    `Renaming ${fileInfos.length} episode file(s) for "${translatedTitle}" ` +
      `(${useMultiSeason ? '4-digit SSEE' : '2-digit EE'} format)`,
  );

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
      logger.info(
        `Renamed: ${file.originalName}${file.extension} → ${newBaseName}${file.extension}`,
      );
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
  const targetPath = path.join(parentDir, translatedTitle);

  if (targetPath === folder.path) return;

  if (fs.existsSync(targetPath)) {
    logger.warn(`Cannot rename folder — target already exists: ${targetPath}`);
    return;
  }

  try {
    fs.renameSync(folder.path, targetPath);
    logger.info(`Renamed folder: ${folder.originalName} → ${translatedTitle}`);
    folder.path = targetPath;
    folder.newName = translatedTitle;
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
  const newFileName = `${translatedTitle}${file.extension}`;
  const targetPath = path.join(inDir, newFileName);

  resolveConflict(targetPath, file.path);

  if (!fs.existsSync(file.path)) {
    logger.warn(`Lift skipped — source deleted as duplicate: ${file.path}`);
    return;
  }

  try {
    fs.renameSync(file.path, targetPath);
    logger.info(`Lifted movie: ${file.originalName}${file.extension} → ${newFileName}`);
    file.status = 'processed';
    file.path = targetPath;
    file.newName = translatedTitle;
  } catch (error) {
    logger.error(`Failed to lift movie: ${file.path}`, { error });
    file.status = 'error';
    return;
  }

  try {
    fs.rmSync(folder.path, { recursive: true, force: true });
    logger.info(`Deleted folder after lift: ${folder.path}`);
  } catch (error) {
    logger.warn(`Failed to delete folder: ${folder.path}`, { error });
  }
};

/**
 * Переименовать loose видеофайл в корне IN_DIR в переведённое название.
 */
export const renameMovieFile = (file: MediaFile, translatedTitle: string): void => {
  const dir = path.dirname(file.path);
  const newFileName = `${translatedTitle}${file.extension}`;
  const targetPath = path.join(dir, newFileName);

  if (targetPath === file.path) return;

  resolveConflict(targetPath, file.path);

  if (!fs.existsSync(file.path)) {
    file.status = 'skipped';
    return;
  }

  try {
    fs.renameSync(file.path, targetPath);
    logger.info(`Renamed movie: ${file.originalName}${file.extension} → ${newFileName}`);
    file.status = 'processed';
    file.path = targetPath;
    file.newName = translatedTitle;
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

  logger.info(
    `Renaming ${sortedFiles.length} part(s) of multipart folder "${folder.originalName}"`,
  );

  sortedFiles.forEach((file, index) => {
    const newBaseName = String(index + 1).padStart(2, '0');
    const targetPath = path.join(folder.path, `${newBaseName}${file.extension}`);

    if (targetPath === file.path) return;

    resolveConflict(targetPath, file.path);

    if (!fs.existsSync(file.path)) {
      file.status = 'skipped';
      return;
    }

    try {
      fs.renameSync(file.path, targetPath);
      logger.info(
        `Renamed part: ${file.originalName}${file.extension} → ${newBaseName}${file.extension}`,
      );
      file.status = 'processed';
      file.path = targetPath;
      file.newName = newBaseName;
    } catch (error) {
      logger.error(`Failed to rename part: ${file.path}`, { error });
      file.status = 'error';
    }
  });

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
  onProgress?: (current: number, name: string) => void,
): void => {
  let current = 0;

  for (const folder of folders) {
    const title = translations.get(folder.path) ?? folder.originalName;

    if (folder.contentType === 'series') {
      renameEpisodeFiles(folder, title);
      renameFolder(folder, title);
    } else if (folder.contentType === 'movie') {
      if (folder.files.length === 1) {
        liftSingleMovie(folder, title);
      } else {
        renameMultipartFolder(folder, title);
      }
    } else {
      logger.warn(`Skipping rename — unknown content type: "${folder.originalName}"`);
    }

    current++;
    onProgress?.(current, title);
  }

  for (const file of looseFiles) {
    const title = translations.get(file.path) ?? file.originalName;
    renameMovieFile(file, title);
    current++;
    onProgress?.(current, title);
  }
};
