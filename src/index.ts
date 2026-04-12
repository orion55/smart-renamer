import * as dotenv from 'dotenv';
import { resolveInDir } from './helpers/env';
import { printSmartRenamer } from './helpers/greeting';
import { logger } from './logger.service';
import {
  processFolders,
  scanDirectory,
  scanFiles
} from './scanner/scanner.service';
import type { MediaFile, MediaFolder } from './types';

dotenv.config();

printSmartRenamer();

logger.info('SmartRenamer started');

const inDir = resolveInDir();
logger.info(`Input directory: ${inDir}`);

// ── GROUP 2: Scanner ─────────────────────────────────────────────────────────

const folders: MediaFolder[] = scanDirectory(inDir);
logger.info(`Found ${folders.length} folder(s) in ${inDir}`);

processFolders(folders);

const looseFiles: MediaFile[] = scanFiles(inDir);
logger.info(`Found ${looseFiles.length} loose video file(s) in root`);

// ── TODO GROUP 3: classify folders and looseFiles ────────────────────────────
// ── TODO GROUP 4: GPT translation ────────────────────────────────────────────
// ── TODO GROUP 5: rename ─────────────────────────────────────────────────────
// ── TODO GROUP 7: print summary ──────────────────────────────────────────────
