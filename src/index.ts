import * as dotenv from 'dotenv';
import { buildGptQueue } from './classifier/classifier.service';
import { applyTranslations } from './gpt/gpt.service';
import { resolveInDir } from './helpers/env';
import { printSmartRenamer } from './helpers/greeting';
import { createGptProgress, createRenameProgress } from './helpers/progress';
import { logger } from './logger.service';
import { renameAll } from './renamer/renamer.service';
import { processFolders, scanDirectory, scanFiles } from './scanner/scanner.service';
import { summarize } from './stats';

dotenv.config();

printSmartRenamer();

const startTime = new Date();

void (async () => {
  logger.info(`SmartRenamer started at ${startTime.toISOString()}`);

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

  const gptProgress = createGptProgress(foldersForGpt.length + filesForGpt.length);
  const translations = await applyTranslations(
    [...foldersForGpt, ...filesForGpt],
    gptProgress.tick,
  );
  gptProgress.stop();

  // ── GROUP 5: Rename ──────────────────────────────────────────────────────────

  const renameProgress = createRenameProgress(folders.length + looseFiles.length);
  renameAll(folders, looseFiles, translations, renameProgress.tick);
  renameProgress.stop();

  // ── GROUP 6: Summary ─────────────────────────────────────────────────────────

  summarize(folders, looseFiles, startTime);

  logger.info('SmartRenamer finished');
})();
