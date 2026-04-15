import colors from 'ansi-colors';
import { logger } from './logger.service';
import type { MediaFile, MediaFolder, ProcessingResult } from './types';

export class StatsTracker {
  private renamed = 0;
  private skipped = 0;
  private errors = 0;
  private total = 0;

  /** Collect stats from file statuses after renaming completes. */
  collectFromFiles(folders: MediaFolder[], looseFiles: MediaFile[]): void {
    const allFiles = [...looseFiles, ...folders.flatMap((folder) => folder.files)];
    for (const file of allFiles) {
      this.total++;
      if (file.status === 'processed') this.renamed++;
      else if (file.status === 'skipped') this.skipped++;
      else if (file.status === 'error') this.errors++;
    }
  }

  getSummary(): ProcessingResult {
    return {
      total: this.total,
      renamed: this.renamed,
      skipped: this.skipped,
      errors: this.errors,
    };
  }

  printSummary(result: ProcessingResult): void {
    const line = '─'.repeat(44);

    console.log(`\n${colors.cyan(line)}`);
    console.log(colors.bold.white('  SmartRenamer Summary'));
    console.log(colors.cyan(line));
    console.log(`  Total:      ${colors.white(String(result.total))}`);
    console.log(`  Renamed:    ${colors.green(String(result.renamed))}`);
    console.log(`  Skipped:    ${colors.yellow(String(result.skipped))}`);
    console.log(
      `  Errors:     ${result.errors > 0 ? colors.red(String(result.errors)) : colors.white('0')}`,
    );
    console.log(`${colors.cyan(line)}\n`);

    logger.info(
      `Summary: total=${result.total} renamed=${result.renamed} ` +
        `skipped=${result.skipped} errors=${result.errors}`,
    );
  }
}

/** Convenience wrapper for a one-line call from index.ts. */
export const summarize = (folders: MediaFolder[], looseFiles: MediaFile[]): void => {
  const tracker = new StatsTracker();
  tracker.collectFromFiles(folders, looseFiles);
  tracker.printSummary(tracker.getSummary());
};
