export type ContentType = 'series' | 'movie' | 'unknown';

export type GPTScenario = 'foreign' | 'translit' | 'cleanRussian';

export type StatusType = 'pending' | 'processed' | 'skipped' | 'error';

export interface MediaFile {
  path: string;
  originalName: string;
  extension: string;
  type: ContentType;
  newName?: string;
  status: StatusType;
}

export interface MediaFolder {
  path: string;
  originalName: string;
  contentType: ContentType;
  files: MediaFile[];
  newName?: string;
  /** true после liftSingleMovie: файл поднят в IN_DIR, папка удалена, path более не валиден */
  lifted?: boolean;
}

export interface ProcessingResult {
  total: number;
  renamed: number;
  skipped: number;
  errors: number;
}

export type FallbackEntry = { item: { originalName: string; path: string } };
