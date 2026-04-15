import colors from 'ansi-colors';
import cliProgress from 'cli-progress';

const BAR_OPTIONS: cliProgress.Options = {
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true,
  clearOnComplete: false,
};

/** Прогресс-бар для GPT-переводов. tick(done) — вызвать после каждого батча. */
export const createGptProgress = (
  total: number,
): { tick: (done: number) => void; stop: () => void } => {
  if (total === 0) return { tick: () => undefined, stop: () => undefined };

  const bar = new cliProgress.SingleBar(
    {
      ...BAR_OPTIONS,
      format: `  GPT    [${colors.green('{bar}')}] {percentage}% | {value}/{total}`,
    },
    cliProgress.Presets.shades_classic,
  );

  bar.start(total, 0);

  return {
    tick: (done: number) => bar.update(done),
    stop: () => bar.stop(),
  };
};

/** Прогресс-бар для переименования. tick(current, name) — вызвать после каждого элемента. */
export const createRenameProgress = (
  total: number,
): { tick: (current: number, name: string) => void; stop: () => void } => {
  if (total === 0) return { tick: () => undefined, stop: () => undefined };

  const bar = new cliProgress.SingleBar(
    {
      ...BAR_OPTIONS,
      format: `  Rename [${colors.green('{bar}')}] {percentage}% | {name}`,
    },
    cliProgress.Presets.shades_classic,
  );

  bar.start(total, 0, { name: '' });

  return {
    tick: (current: number, name: string) => bar.update(current, { name }),
    stop: () => bar.stop(),
  };
};
