import colors from 'ansi-colors';
import { logger } from './logger.service';
import type { MediaFile, MediaFolder, ProcessingResult } from './types';

const collectStats = (
  folders: MediaFolder[],
  looseFiles: MediaFile[],
  startTime: number,
): ProcessingResult => {
  const allFiles = [...looseFiles, ...folders.flatMap((folder) => folder.files)];
  let renamed = 0;
  let skipped = 0;
  let errors = 0;
  for (const file of allFiles) {
    if (file.status === 'processed') renamed++;
    else if (file.status === 'skipped') skipped++;
    else if (file.status === 'error') errors++;
  }
  return { total: allFiles.length, renamed, skipped, errors, duration: Date.now() - startTime };
};

const printSummary = (result: ProcessingResult): void => {
  const line = '─'.repeat(44);
  const durationSec = (result.duration / 1000).toFixed(1);
  console.log(`\n${colors.cyan(line)}`);
  console.log(colors.bold.white('  SmartRenamer Summary'));
  console.log(colors.cyan(line));
  console.log(`  Total:      ${colors.white(String(result.total))}`);
  console.log(`  Renamed:    ${colors.green(String(result.renamed))}`);
  console.log(`  Skipped:    ${colors.yellow(String(result.skipped))}`);
  console.log(
    `  Errors:     ${result.errors > 0 ? colors.red(String(result.errors)) : colors.white('0')}`,
  );
  console.log(`  Duration:   ${colors.white(`${durationSec}s`)}`);
  console.log(`${colors.cyan(line)}\n`);
  logger.info(
    `Summary: total=${result.total} renamed=${result.renamed} ` +
      `skipped=${result.skipped} errors=${result.errors} duration=${durationSec}s`,
  );
};

export const summarize = (
  folders: MediaFolder[],
  looseFiles: MediaFile[],
  startTime: number,
): void => {
  printSummary(collectStats(folders, looseFiles, startTime));
};
