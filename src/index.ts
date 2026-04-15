import * as dotenv from 'dotenv';
import { buildGptQueue } from './classifier/classifier.service';
import { applyTranslations } from './gpt/gpt.service';
import { resolveInDir } from './helpers/env';
import { printSmartRenamer } from './helpers/greeting';
import { logger } from './logger.service';
import { renameAll } from './renamer/renamer.service';
import { processFolders, scanDirectory, scanFiles } from './scanner/scanner.service';

dotenv.config();

printSmartRenamer();

void (async () => {
  logger.info('SmartRenamer started');

  const inDir = resolveInDir();
  logger.info(`Input directory: ${inDir}`);

  // ── GROUP 2: Scanner ─────────────────────────────────────────────────────────

  const folders = scanDirectory(inDir);
  logger.info(`Found ${folders.length} folder(s) in ${inDir}`);

  processFolders(folders);

  const looseFiles = scanFiles(inDir);
  logger.info(`Found ${looseFiles.length} loose video file(s) in root`);

  // ── GROUP 3: Classify ────────────────────────────────────────────────────────

  const { foldersForGpt, filesForGpt } = buildGptQueue(folders, looseFiles);

  // ── GROUP 4: GPT translation ─────────────────────────────────────────────────

  const translations = await applyTranslations([...foldersForGpt, ...filesForGpt]);

  // ── GROUP 5: Rename ──────────────────────────────────────────────────────────

  renameAll(folders, looseFiles, translations);

  // ── TODO GROUP 7: print summary ──────────────────────────────────────────────
})();
