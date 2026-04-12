import fs from 'node:fs';
import path from 'node:path';
import { JUNK_EXTENSIONS, VIDEO_EXTENSIONS } from '../helpers/patterns';
import { logger } from '../logger.service';
import type { MediaFile, MediaFolder } from '../types';

const makeMediaFile = (filePath: string): MediaFile => {
  const ext = path.extname(filePath).toLowerCase();
  return {
    path: filePath,
    originalName: path.basename(filePath, ext),
    extension: ext,
    type: 'unknown',
    status: 'pending',
  };
};

const makeMediaFolder = (folderPath: string): MediaFolder => ({
  path: folderPath,
  originalName: path.basename(folderPath),
  contentType: 'unknown',
  files: [],
});

/** Перечислить подпапки первого уровня в `inDir`. */
export const scanDirectory = (inDir: string): MediaFolder[] => {
  const entries = fs.readdirSync(inDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => makeMediaFolder(path.join(inDir, entry.name)));
};

/** Перечислить loose видеофайлы прямо в `inDir` (не рекурсивно). */
export const scanFiles = (inDir: string): MediaFile[] => {
  const entries = fs.readdirSync(inDir, { withFileTypes: true });
  return entries
    .filter(
      (entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
    )
    .map((entry) => makeMediaFile(path.join(inDir, entry.name)));
};

/** Рекурсивно собрать все видеофайлы в папке `folderPath`. */
export const getVideoFiles = (folderPath: string): MediaFile[] => {
  const result: MediaFile[] = [];

  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      logger.warn(`Cannot read directory: ${dir}`, { error });
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        result.push(makeMediaFile(fullPath));
      }
    }
  };

  walk(folderPath);
  return result;
};

/** Удалить файлы с мусорными расширениями внутри `folderPath` (рекурсивно). */
export const deleteJunkFiles = (folderPath: string): void => {
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      logger.warn(`Cannot read directory: ${dir}`, { error });
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && JUNK_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        try {
          fs.unlinkSync(fullPath);
        } catch (error) {
          logger.error(`Failed to delete junk file: ${fullPath}`, { error });
        }
      }
    }
  };

  walk(folderPath);
};

/** Рекурсивно удалить пустые подпапки в `dir` (но не сам `dir`). */
const removeEmptyDirs = (dir: string): void => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const subPath = path.join(dir, entry.name);
    removeEmptyDirs(subPath);

    try {
      const remaining = fs.readdirSync(subPath);
      if (remaining.length === 0) {
        fs.rmdirSync(subPath);
      }
    } catch (error) {
      logger.warn(`Cannot remove directory: ${subPath}`, { error });
    }
  }
};

/**
 * Поднять все вложенные видеофайлы в корень папки `folder.path`,
 * затем удалить опустевшие подпапки.
 *
 * При конфликте имён (файл уже существует в корне) — пропустить и залогировать.
 */
export const flattenSubfolders = (folder: MediaFolder): void => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(folder.path, { withFileTypes: true });
  } catch (error) {
    logger.warn(`Cannot read folder for flattening: ${folder.path}`, { error });
    return;
  }

  const subDirs = entries.filter((entry) => entry.isDirectory());
  if (subDirs.length === 0) return;

  for (const subDir of subDirs) {
    const subDirPath = path.join(folder.path, subDir.name);
    const videoFiles = getVideoFiles(subDirPath);

    for (const file of videoFiles) {
      const fileName = path.basename(file.path);
      const targetPath = path.join(folder.path, fileName);

      if (fs.existsSync(targetPath)) {
        logger.warn(`Flatten conflict — skipping: ${file.path} (target exists: ${targetPath})`);
        continue;
      }

      try {
        fs.renameSync(file.path, targetPath);
      } catch (error) {
        logger.error(`Failed to flatten: ${file.path}`, { error });
      }
    }
  }

  removeEmptyDirs(folder.path);
};

/**
 * Для каждой папки: удалить мусор, выровнять вложенность, пересчитать видеофайлы.
 * Вызывается из оркестратора после `scanDirectory`.
 */
export const processFolders = (folders: MediaFolder[]): void => {
  for (const folder of folders) {
    deleteJunkFiles(folder.path);
    flattenSubfolders(folder);
    folder.files = getVideoFiles(folder.path);
  }
};
