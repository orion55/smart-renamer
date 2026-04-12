import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.service';

const abort = (msg: string): never => {
  logger.error(msg);
  process.exit(1);
};

export const resolveInDir = (): string => {
  const raw = process.env.IN_DIR?.trim();
  if (!raw) return abort('IN_DIR is not set in .env — aborting');
  const resolved = path.resolve(raw);
  if (!fs.existsSync(resolved)) return abort(`IN_DIR does not exist: ${resolved}`);
  if (!fs.statSync(resolved).isDirectory()) return abort(`IN_DIR is not a directory: ${resolved}`);
  return resolved;
};
