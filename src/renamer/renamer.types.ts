import type { MediaFile } from '../types';

/** Извлечённые из имени файла номера сезона и эпизода. */
export interface EpisodeInfo {
  season: number;
  episode: number;
}

/** Файл вместе с извлечёнными из него данными эпизода. */
export interface FileInfo extends EpisodeInfo {
  file: MediaFile;
}
