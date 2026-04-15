import colors from 'ansi-colors';
import { logger } from './logger.service';
import type { MediaFile, MediaFolder, ProcessingResult } from './types';

export class StatsTracker {
  private renamed = 0;
  private skipped = 0;
  private errors = 0;
  private total = 0;

  /** Собрать статистику из статусов файлов после завершения переименования. */
  collectFromFiles(folders: MediaFolder[], looseFiles: MediaFile[]): void {
    const allFiles = [...looseFiles, ...folders.flatMap((folder) => folder.files)];
    for (const file of allFiles) {
      this.total++;
      if (file.status === 'processed') this.renamed++;
      else if (file.status === 'skipped') this.skipped++;
      else if (file.status === 'error') this.errors++;
    }
  }

  getSummary(startTime: Date): ProcessingResult {
    return {
      total: this.total,
      renamed: this.renamed,
      skipped: this.skipped,
      errors: this.errors,
      duration: Date.now() - startTime.getTime(),
    };
  }

  printSummary(result: ProcessingResult): void {
    const durationSec = (result.duration / 1000).toFixed(1);
    const line = '─'.repeat(44);

    console.log(`\n${colors.cyan(line)}`);
    console.log(colors.bold.white('  SmartRenamer — итоги'));
    console.log(colors.cyan(line));
    console.log(`  Всего:      ${colors.white(String(result.total))}`);
    console.log(`  Переимен.:  ${colors.green(String(result.renamed))}`);
    console.log(`  Пропущено:  ${colors.yellow(String(result.skipped))}`);
    console.log(
      `  Ошибки:     ${result.errors > 0 ? colors.red(String(result.errors)) : colors.white('0')}`,
    );
    console.log(`  Время:      ${colors.white(`${durationSec} с`)}`);
    console.log(`${colors.cyan(line)}\n`);

    logger.info(
      `Summary: total=${result.total} renamed=${result.renamed} ` +
        `skipped=${result.skipped} errors=${result.errors} duration=${durationSec}s`,
    );
  }
}

/** Удобная обёртка для однострочного вызова из index.ts. */
export const summarize = (
  folders: MediaFolder[],
  looseFiles: MediaFile[],
  startTime: Date,
): void => {
  const tracker = new StatsTracker();
  tracker.collectFromFiles(folders, looseFiles);
  tracker.printSummary(tracker.getSummary(startTime));
};
