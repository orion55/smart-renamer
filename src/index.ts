import * as dotenv from 'dotenv';
import { buildGptQueue } from './classifier/classifier.service';
import { resolveInDir } from './helpers/env';
import { printSmartRenamer } from './helpers/greeting';
import { logger } from './logger.service';
import { processFolders, scanDirectory, scanFiles } from './scanner/scanner.service';

dotenv.config();

printSmartRenamer();

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
console.log(foldersForGpt, filesForGpt);

// ── TODO GROUP 4: GPT translation ────────────────────────────────────────────
// ── TODO GROUP 5: rename ─────────────────────────────────────────────────────
// ── TODO GROUP 7: print summary ──────────────────────────────────────────────
