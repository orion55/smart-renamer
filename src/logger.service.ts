import path from 'node:path';
import type winston from 'winston';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ROOT_DIR } from '../appDir';

const logDir = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(ROOT_DIR, 'logs');

const serializeMeta = (meta: object) =>
  JSON.stringify(meta, (_key, value) =>
    value instanceof Error ? { message: value.message, stack: value.stack } : value,
  );

const customFormat = format.printf(({ timestamp, level, message, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${serializeMeta(meta)}` : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `${timestamp} [${level}]: ${message}${metaStr}${stackStr}`;
});

const consoleFormat = format.combine(
  format.timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.colorize({ all: false }),
  customFormat,
);

const fileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'renamer-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  auditFile: path.join(logDir, 'audit.json'),
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.uncolorize(),
    customFormat,
  ),
});

const consoleTransport = new transports.Console({
  format: consoleFormat,
});

const logger: winston.Logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    customFormat,
  ),
  transports: [fileTransport, consoleTransport],
  exceptionHandlers: [fileTransport, consoleTransport],
  exitOnError: false,
});

export { logger };
