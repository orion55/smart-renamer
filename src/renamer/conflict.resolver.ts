import fs from 'node:fs';
import { logger } from '../logger.service';

/**
 * Разрешить конфликт при переименовании: если `targetPath` уже существует,
 * удалить `sourcePath` (входящий дубликат). Побеждает существующий файл.
 */
export const resolveConflict = (targetPath: string, sourcePath: string): void => {
  if (targetPath === sourcePath) return;
  if (!fs.existsSync(targetPath)) return;

  try {
    fs.unlinkSync(sourcePath);
    logger.warn(`Conflict resolved — deleted duplicate: ${sourcePath} (kept: ${targetPath})`);
  } catch (error) {
    logger.error(`Failed to delete duplicate: ${sourcePath}`, { error });
  }
};
